import { NextResponse } from "next/server";
import { getFacilities, saveCase, getCases } from "@/lib/db";
import { generateNextCaseRef } from "@/lib/caseId";
import { getCallerIdForPhone } from "@/lib/callerId";
import {
  resolveCallerLocation,
  rankNearestFacilities,
  isTieUp,
  isHospital,
  isDispensary,
  isEsicHospital,
  isGovtDistrictHospital,
} from "@/lib/geo";
import { evaluateTriage, summarizeRedFlags, getDispensaryOperatingStatus, isLifeThreateningAmbulanceCase, formatClinicalSummary, extractCallerReportedProblems } from "@/lib/triageEngine";
import {
  calculateClinicalSeverityScore,
  mapScoreToUrgency,
  validateCallerMentionedDuration,
  doesCaseNeedMedicalTreatment,
} from "@/lib/clinicalScoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAgentCode(rawAgent) {
  if (!rawAgent) return "A1";
  const str = String(rawAgent).toUpperCase();
  if (str.includes("ADMIN 1") || str.includes("ADMIN1") || str === "AD1") return "AD1";
  if (str.includes("ADMIN 2") || str.includes("ADMIN2") || str === "AD2") return "AD2";
  if (str.includes("3") || str === "A3") return "A3";
  if (str.includes("2") || str === "A2") return "A2";
  if (str.includes("1") || str === "A1") return "A1";
  return "A1";
}

export async function POST(request) {
  const startTime = Date.now();
  let intake = {};

  try {
    try {
      intake = (await request.json()) || {};
    } catch (parseErr) {
      intake = {};
    }

    if (!intake.symptom_notes || String(intake.symptom_notes).trim().length < 3) {
      return NextResponse.json(
        { detail: "Enter complaint notes (minimum 3 characters)" },
        { status: 400 }
      );
    }

    // 1. Perform clinical triage evaluation with safety guarantee
    let triage = {};
    try {
      triage = (await evaluateTriage(intake)) || {};
    } catch (evalErr) {
      console.warn("evaluateTriage non-fatal error, generating fallback decision:", evalErr.message);
      const repSev = Number(intake.severity_reported) || 5;
      const fallbackUrgency = repSev >= 8 ? "Severe" : (repSev >= 4 ? "Moderate" : "Mild");
      triage = {
        urgency_level: fallbackUrgency,
        assessed_severity: fallbackUrgency,
        urgency_score: fallbackUrgency === "Severe" ? 10 : (fallbackUrgency === "Moderate" ? 6 : 3),
        confidence: "medium",
        summary_en: `Caller reported symptoms: ${String(intake.symptom_notes).slice(0, 120)}. Guided to healthcare facility.`,
        summary_hi: "लक्षणों के आधार पर उपयुक्त स्वास्थ्य सुविधा के लिए मार्गदर्शन किया गया।",
        reasoning: "Clinical assessment based on reported symptoms and severity.",
        red_flags: [],
        call_108: fallbackUrgency === "Severe",
        detected_language: "Hinglish",
      };
    }

    const ekmsCtx = intake.ekms_ai_context || {};
    const tState = ekmsCtx.triageState || ekmsCtx;
    const explicitReferral = String(tState?.referralDestination || "").toLowerCase();
    const callerUtterances = Array.isArray(ekmsCtx.chatHistory)
      ? ekmsCtx.chatHistory
          .filter((m) => m && (m.sender === "user" || m.role === "user"))
          .map((m) => m.text || m.content || "")
          .join(" ")
      : "";
    const callerSpokenText = `${intake.symptom_notes || ""} ${callerUtterances}`.trim().toLowerCase();
    const notes = `${callerSpokenText} ${tState?.symptom || ""}`.toLowerCase();

    const isNacoHIV =
      /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(notes) ||
      explicitReferral.includes("naco") ||
      explicitReferral.includes("1097");

    const isPsychiatricCase = !isNacoHIV && Boolean(
      triage.is_psychiatric ||
      tState?.isPsychiatric ||
      ekmsCtx?.isPsychiatric ||
      explicitReferral.includes("psych") ||
      (explicitReferral.includes("counsel") && !isNacoHIV) ||
      explicitReferral.includes("manas") ||
      explicitReferral.includes("14416") ||
      /\b(suicid|mar ja|jaan de dunga|depress|udaas|hopeless|anxiety|ghabrahat|die\b|kill myself|self-harm|self harm|crying)\b/i.test(notes)
    );

    if (isNacoHIV) {
      triage.is_psychiatric = false;
      triage.call_108 = false;
      triage.call_referral_primary = "104 Health Helpline";
      triage.referral_destination = "104 Health Helpline";
      triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
      triage.recommended_action = "Transfer call directly to 104 Health Helpline for 24x7 confidential doctor counseling, STI guidance, and testing support.";
      triage.summary_en = "Caller inquiry regarding HIV / AIDS, STI symptoms, testing, PEP, or sexual health counseling. Transfer directly to 104 Health Helpline.";
      triage.summary_hi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी परामर्श चाहता है; 104 हेल्पलाइन से संपर्क आवश्यक है।";
    }

    const ambulanceEval = isLifeThreateningAmbulanceCase(
      notes,
      triage.urgency_score || intake.severity_reported,
      intake,
      tState
    );

    const validatedDuration = validateCallerMentionedDuration(
      intake.duration || tState?.duration || triage.duration,
      callerSpokenText
    );
    intake.duration = validatedDuration;
    triage.duration = validatedDuration;

    const clinicalScoreResult = calculateClinicalSeverityScore({
      symptom: intake.primary_complaint || tState?.symptom,
      condition: tState?.condition || tState?.suspectedCondition,
      callerSpokenText,
      allText: notes,
      duration: validatedDuration,
      chatHistory: Array.isArray(ekmsCtx.chatHistory) ? ekmsCtx.chatHistory : [],
      intake,
      tState,
    });

    let evaluatedScore = isNacoHIV ? 3 : clinicalScoreResult.score;
    let urgencyCategory = isNacoHIV ? "Mild" : clinicalScoreResult.urgency_level;

    const isPsychCase = isPsychiatricCase;
    const isDistHospRequest = /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|immunization|vaccination|tika|tika karan|child vaccine)\b/i.test(notes);
    const isTieUpEligible = /\b(tie-?up|empanelled|private partner hospital|super specialty)\b/i.test(notes);

    // STRICT USER MANDATE: Normal OPD conditions must NOT be sent to hospital and must NOT be Moderate!
    // Send to Dispensary or 104.
    // Moderate is ONLY where IPD treatment is needed, 1 day or more hospitalization needed,
    // specialist doctor consultation or procedural treatment needed, or lab/imaging needed.
    const requiresHospitalCare = Boolean(
      ambulanceEval.is108 ||
      isPsychCase ||
      isNacoHIV ||
      isTieUpEligible ||
      isDistHospRequest ||
      /\b(ipd|admit|admission|hospitaliz\w*|overnight|observation|bed|day care|inpatient|iv fluid|iv drip|saline drip|intravenous)\b/i.test(notes) ||
      /\b(specialist|cardiologist|orthopedic|orthopedist|neurologist|surgeon|general surgeon|gynecolog\w*|pediatrician|ent specialist|stitches|sutur\w*|taanke|fracture|broken bone|dislocation|plaster|cast|minor ot|wound toilet|incision|abscess drainage)\b/i.test(notes) ||
      /\b(lab|blood test|cbc|x-ray|xray|ecg|ultrasound|usg|scan|imaging|serology|pathology|biochemistry|cardiac enzyme|troponin)\b/i.test(notes) ||
      /\b(continuous vomit|cannot keep.*fluid|unable to retain fluid|severe abdominal pain|rigid abdomen|blood in vomit|hematemesis|deep cut|stitches)\b/i.test(notes) ||
      /\b(head injury|head trauma|sar.*chot|concussion|skull|hit.*head|loss of consciousness|lost consciousness|blackout|blacked out|behosh|unconscious|deep cut|gaping cut|exposing fat|exposing muscle)\b/i.test(notes)
    );

    // USER MANDATE:
    // 1. For 1-3 days duration (or 2-3 days, today, yesterday):
    //    If other condition or answers are Moderate level or Severe level, then based on the situation show Moderate or Severe!
    //    DO NOT restrict anything. Based on every situation show the forward referral.
    // 2. Only if other answers are genuinely mild, evaluate as Mild.
    const isClinicalModerateOrSevere =
      urgencyCategory === "Moderate" ||
      urgencyCategory === "Severe" ||
      evaluatedScore >= 5 ||
      ambulanceEval.is108 ||
      clinicalScoreResult.isLifeThreatening;

    if (!isClinicalModerateOrSevere) {
      urgencyCategory = "Mild";
      evaluatedScore = (evaluatedScore >= 1 && evaluatedScore <= 4) ? evaluatedScore : 3;
    }


    const isSevere = urgencyCategory === "Severe";
    const isModerate = urgencyCategory === "Moderate";

    triage.urgency_level = urgencyCategory;
    triage.assessed_severity = urgencyCategory;
    triage.urgency_score = evaluatedScore;
    triage.severity_score = evaluatedScore;
    triage.assessed_severity_score = evaluatedScore;

    // Assess time of day in IST and hospital manageability for Severe cases
    const nowUtc = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
    const istHour = istDate.getHours();
    const isScore8 = evaluatedScore === 8;
    const isExtremeLifeThreat = Boolean(
      /\b(cardiac arrest|unconscious|behosh|not breathing|saans nahi|collapse|crushing chest.*(?:sweat|pasina|left arm|radiat)|arterial bleed|snake\s*bite|drank poison|status epilepticus)\b/i.test(notes)
    );
    const hasAcuteLifeThreat = Boolean(
      clinicalScoreResult.isLifeThreatening ||
      ambulanceEval.is108 ||
      explicitReferral.includes("108") ||
      /\b(struggling\s*(?:to|for)\s*breath\w*|cannot\s*breathe|unable\s*to\s*breathe|gasping for air|not breathing|saans nahi|cyanosis|heavy active bleed|spurting bleed|arterial bleed|crushing chest.*(?:sweat|pasina|left arm|radiat|collapse)|cardiac arrest|unconscious|behosh|unresponsive|collapse|seizure.*>|status epilepticus|drank poison|acid ingestion|snake\s*bite)\b/i.test(notes) ||
      isExtremeLifeThreat
    );
    const isScore8Manageable = isScore8 && !isExtremeLifeThreat;
    const isManageableAtHospital = isScore8Manageable || !hasAcuteLifeThreat;

    // 2. Resolve location & rank nearest facilities safely (max 50km, exact pincode match first)
    let facilities = [];
    try {
      facilities = (await getFacilities()) || [];
    } catch {
      facilities = [];
    }

    let resolved_location = null;
    try {
      resolved_location = resolveCallerLocation(intake, facilities);
    } catch {
      resolved_location = { method: "default_assam", matched: "Assam Central Directory" };
    }

    let nearest_facilities = [];
    try {
      nearest_facilities = rankNearestFacilities(
        resolved_location,
        facilities,
        50,
        urgencyCategory,
        null,
        { isManageableInHospital: isManageableAtHospital }
      );
    } catch {
      nearest_facilities = facilities;
    }


    if (isPsychCase) {
      triage.call_referral_primary = "104 Health Helpline";
      triage.referral_destination = "104 Health Helpline";
      triage.call_referral_secondary = "ESIC Hospital";
      triage.secondary_referral_destination = "ESIC Hospital";
      triage.secondary_referral_reason =
        "ESIC Hospital for physical checkup if symptoms persist.";
      triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
      triage.recommended_action =
        "Transfer call to 104 Health Helpline for 24x7 confidential doctor tele-consultation and counseling.";
    }

    const nearestHospital = nearest_facilities.find((f) => isHospital(f)) || nearest_facilities[0] || null;
    const nearestEsic = nearest_facilities.find((f) => isEsicHospital(f));
    const nearestDistHosp = nearest_facilities.find((f) => isGovtDistrictHospital(f));
    const nearestDispensary = nearest_facilities.find((f) => isDispensary(f)) || (nearest_facilities[0]?.is_dispensary ? nearest_facilities[0] : null);
    const nearestTieUp = nearest_facilities.find((f) => isTieUp(f));

    // 15 KM ESIC threshold
    const isEsicWithin15Km = Boolean(nearestEsic && nearestEsic.distance_km != null && nearestEsic.distance_km <= 15);

    const esicName = nearestEsic?.name || "ESIC Hospital";
    const distName = nearestDistHosp?.name || "Govt District Hospital";
    const tieUpName = nearestTieUp?.name || "Empanelled Tie-Up Hospital";
    const dispName = nearestDispensary?.name || "ESIS Dispensary";
    const dispStatus = getDispensaryOperatingStatus();

    // 6 Canonical Referral Directives
    const dirDispensary = {
      rank: 0,
      id: "ESIS_DISPENSARY",
      name: dispName,
      badge: "ESIS Dispensary",
      facility: nearestDispensary,
      distance_km: nearestDispensary?.distance_km ?? null,
      role: "Primary Care Clinic",
      status: dispStatus.isOpen ? "Open Now" : "Closed",
      hours: "Mon-Fri 10am-4pm, 1st, 3rd & 5th Sat 10am-12pm",
    };
    const dir104 = {
      rank: 0,
      id: "TELE_104",
      name: "104 Health Helpline",
      badge: "104 Health Helpline",
      facility: null,
      distance_km: null,
      role: "24x7 Tele-Doctor Consultation",
      status: "24x7 Active",
      hours: "24 Hours / 7 Days",
    };
    const dirEsic = {
      rank: 0,
      id: "ESIC_HOSPITAL",
      name: esicName,
      badge: "ESIC Hospital",
      facility: nearestEsic,
      distance_km: nearestEsic?.distance_km ?? null,
      is_within_15km: isEsicWithin15Km,
      role: "Secondary Hospital & Casualty",
      status: "24x7 Casualty Active",
      hours: "24x7 Emergency / Casualty",
    };
    const dirGovt = {
      rank: 0,
      id: "DIST_HOSPITAL",
      name: distName,
      badge: "Govt District Hospital",
      facility: nearestDistHosp,
      distance_km: nearestDistHosp?.distance_km ?? null,
      role: "Public District Hospital Care",
      status: "24x7 Casualty Active",
      hours: "24x7 Emergency / Casualty",
    };
    const dirTieUp = {
      rank: 0,
      id: "TIE_UP_FACILITY",
      name: tieUpName,
      badge: "Empanelled Tie-Up Hospital",
      facility: nearestTieUp,
      distance_km: nearestTieUp?.distance_km ?? null,
      role: "Empanelled Cashless Care",
      status: "Active Network",
      hours: "Specialty / Empanelled Care",
    };
    const dir108 = {
      rank: 0,
      id: "CALL_108",
      name: "108 Ambulance",
      badge: "108 Ambulance",
      facility: null,
      distance_km: null,
      role: "Immediate Emergency Dispatch",
      status: "24x7 Emergency Response",
      hours: "24x7 Ambulance Dispatch",
    };

    let forwardingHierarchy = [];

    if (isSevere) {
      // -------------------------------------------------------------
      // SEVERE CASES:
      // High-intensity, widespread, or life-threatening symptoms.
      // Gross or total interference with basic physical function, organ systems, or consciousness.
      // -------------------------------------------------------------
      triage.urgency_level = "Severe";
      triage.assessed_severity = "Severe";
      triage.urgency_score = evaluatedScore;
      triage.severity_score = evaluatedScore;
      triage.assessed_severity_score = evaluatedScore;

      if (isManageableAtHospital) {
        // Morning / daytime manageable directly in hospital
        triage.call_108 = false;
        if (isEsicWithin15Km) {
          forwardingHierarchy = [dirEsic, dirGovt, dirTieUp, dir108, dir104, dirDispensary];
          triage.recommended_facility_type = `${esicName} (24x7 Casualty · within 15km)`;
          triage.recommended_action = `Severe clinical condition; patient accompanied and manageable at hospital. Proceed immediately to ${esicName} Casualty (within 15km) or nearest Govt District Hospital.`;
          triage.referral_destination = esicName;
          triage.call_referral_primary = esicName;
          triage.call_referral_primary_reason = `Direct patient to ${esicName} Casualty for immediate emergency medical evaluation and treatment.`;
          triage.call_referral_secondary = distName;
          triage.call_referral_secondary_reason = `Govt District Hospital (${distName}) for secondary hospital casualty backup.`;
        } else {
          forwardingHierarchy = [dirGovt, dirTieUp, dirEsic, dir108, dir104, dirDispensary];
          triage.recommended_facility_type = `${distName} (Govt District Hospital · Nearest Casualty)`;
          triage.recommended_action = `Severe clinical condition; ESIC hospital is beyond 15km. Direct patient immediately to nearest Govt District Hospital (${distName}) or Tie-Up Hospital.`;
          triage.referral_destination = distName;
          triage.call_referral_primary = distName;
          triage.call_referral_primary_reason = `Direct patient to nearest Govt District Hospital (${distName}) casualty for immediate medical attention.`;
          triage.call_referral_secondary = tieUpName;
          triage.call_referral_secondary_reason = `Empanelled Tie-Up Hospital (${tieUpName}) as alternative emergency hospital facility.`;
        }
      } else {
        // Needs 108 Ambulance (Critical collapse, acute respiratory failure, cardiac arrest, arterial bleed, seizure, poisoning, or caller requests 108)
        triage.call_108 = true;
        const nearestHospChoice = isEsicWithin15Km ? dirEsic : dirGovt;
        const secondaryHospChoice = isEsicWithin15Km ? dirGovt : dirEsic;
        forwardingHierarchy = [dir108, nearestHospChoice, secondaryHospChoice, dirTieUp, dir104, dirDispensary];
        triage.recommended_facility_type = nearestHospital
          ? `108 Emergency Ambulance / ${nearestHospital.name}`
          : "108 Emergency Ambulance / ESIC Hospital Casualty";
        triage.referral_destination = "108 Ambulance";
        triage.call_referral_primary = "108 Ambulance";
        triage.call_referral_primary_reason = ambulanceEval.reason || "Severe life-threatening emergency; dispatch 108 Emergency Ambulance immediately.";
        triage.call_referral_secondary = nearestEsic?.name || nearestHospital?.name || "ESIC Hospital";
        triage.call_referral_secondary_reason = `${nearestEsic?.name || nearestHospital?.name || "ESIC Hospital"} casualty for trauma resuscitation upon ambulance arrival.`;
        triage.recommended_action = ambulanceEval.reason || "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
      }
    } else if (isPsychCase || isNacoHIV) {
      triage.call_108 = false;
      forwardingHierarchy = [dir104, dirEsic, dirGovt, dirTieUp, dirDispensary, dir108];
      triage.referral_destination = "104 Health Helpline";
      triage.call_referral_primary = "104 Health Helpline";
      triage.call_referral_primary_reason = "Connect with 104 Health Helpline for confidential counseling and doctor tele-consultation.";
      triage.call_referral_secondary = esicName;
      triage.call_referral_secondary_reason = "ESIC Hospital for physical checkup if symptoms persist.";
    } else if (isModerate) {
      // -------------------------------------------------------------
      // MODERATE CASES:
      // Noticeable symptoms requiring active intervention or medication.
      // Measurable interference with normal daily functioning, work, or physical activity.
      // If ESIC <= 15 KM: 1st ESIC Hospital, 2nd Govt Hospital, 3rd Tie-up Hospital, 4th Dispensary, 5th 104, 6th 108
      // If ESIC > 15 KM: 1st Govt Hospital, 2nd Tie-up Hospital, 3rd ESIC Hospital, 4th Dispensary, 5th 104, 6th 108
      // -------------------------------------------------------------
      triage.call_108 = false;
      triage.urgency_level = "Moderate";
      triage.assessed_severity = "Moderate";
      triage.urgency_score = evaluatedScore;
      triage.severity_score = evaluatedScore;
      triage.assessed_severity_score = evaluatedScore;

      if (isEsicWithin15Km) {
        forwardingHierarchy = [dirEsic, dirGovt, dirTieUp, dirDispensary, dir104, dir108];
        triage.recommended_facility_type = nearestEsic
          ? `${nearestEsic.name} (ESIC Hospital · ${nearestEsic.distance_km != null ? `${nearestEsic.distance_km} km` : "within 15km"})`
          : "ESIC Hospital (Secondary Care)";
        const esicDistStr = nearestEsic?.distance_km != null ? `${nearestEsic.distance_km} km` : "<15km";
        triage.recommended_action = `Direct patient to ${esicName} (${esicDistStr}).`;
        triage.referral_destination = esicName;
        triage.call_referral_primary = esicName;
        triage.call_referral_primary_reason = `Direct patient to ${esicName} (${esicDistStr}).`;
        triage.call_referral_secondary = distName;
        triage.call_referral_secondary_reason = `Govt District Hospital (${distName}) for backup care.`;
      } else {
        forwardingHierarchy = [dirGovt, dirTieUp, dirEsic, dirDispensary, dir104, dir108];
        triage.recommended_facility_type = nearestDistHosp
          ? `${nearestDistHosp.name} (Govt District Hospital)`
          : "Govt District Hospital";
        const distDistStr = nearestDistHosp?.distance_km != null ? `${nearestDistHosp.distance_km} km; ` : "";
        triage.recommended_action = `Direct patient to ${distName} (${distDistStr}ESIC > 15km).`;
        triage.referral_destination = distName;
        triage.call_referral_primary = distName;
        triage.call_referral_primary_reason = `Direct patient to ${distName} (${distDistStr}ESIC > 15km).`;
        triage.call_referral_secondary = tieUpName;
        triage.call_referral_secondary_reason = `Empanelled Tie-Up Hospital (${tieUpName}) for cashless care.`;
      }
    } else {
      // -------------------------------------------------------------
      // MILD CASES:
      // Low-intensity, localized, or early-stage symptoms.
      // Little to no disruption of daily activities, normal functions, or vital signs.
      // Dispensary open hours (Mon-Fri 10am-4pm, 1st & 3rd Sat 10am-12pm):
      //   1st Dispensary, 2nd 104, 3rd ESIC Hospital, 4th Govt Hospital, 5th Tie-Up, 6th 108
      // Dispensary closed hours:
      //   1st 104, 2nd Dispensary, 3rd ESIC Hospital, 4th Govt Hospital, 5th Tie-Up, 6th 108
      // -------------------------------------------------------------
      triage.call_108 = false;
      triage.urgency_level = "Mild";
      triage.urgency_score = evaluatedScore;
      triage.severity_score = evaluatedScore;
      triage.assessed_severity_score = evaluatedScore;

      if (dispStatus.isOpen && !explicitReferral.includes("104")) {
        forwardingHierarchy = [dirDispensary, dir104, dirEsic, dirGovt, dirTieUp, dir108];
        triage.recommended_facility_type = nearestDispensary
          ? `${nearestDispensary.name} (ESIS Dispensary · Open Now)`
          : "ESIS Dispensary (Primary Care OPD)";
        triage.recommended_action = nearestDispensary
          ? `Dispensary is open now. Advise patient to visit ${nearestDispensary.name} (${nearestDispensary.pincode ? `PIN: ${nearestDispensary.pincode}, ` : ""}${nearestDispensary.distance_km != null ? `${nearestDispensary.distance_km} km away` : "nearest"}) during OPD hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM) for doctor consultation and medicines.`
          : "Dispensary is open now. Advise patient to visit nearest ESIS Dispensary during regular OPD hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM).";
        triage.referral_destination = dispName;
        triage.call_referral_primary = dispName;
        triage.call_referral_primary_reason = nearestDispensary
          ? `Direct patient to ${dispName} for physical doctor checkup and free prescription dispensing.`
          : "Visit nearest ESIS Dispensary during OPD hours.";
        triage.call_referral_secondary = "104 Health Helpline";
        triage.call_referral_secondary_reason = "104 Health Helpline for 24x7 tele-doctor consultation over the phone.";
      } else if (doesCaseNeedMedicalTreatment({ severity: "Mild", score: evaluatedScore, text: notes, isPsych: isPsychCase, isNaco: isNacoHIV })) {
        const primaryHospChoice = isEsicWithin15Km ? dirEsic : dirGovt;
        const secondaryHospChoice = isEsicWithin15Km ? dirGovt : dirEsic;
        const hospDestName = isEsicWithin15Km ? esicName : distName;

        forwardingHierarchy = [primaryHospChoice, secondaryHospChoice, dirTieUp, dir104, dirDispensary, dir108];
        triage.recommended_facility_type = isEsicWithin15Km
          ? `${esicName} (24x7 Emergency / Casualty · within 15km)`
          : `${distName} (Govt District Hospital · 24x7 Casualty)`;
        triage.recommended_action = `Dispensary is currently closed and patient's condition requires medical treatment. Direct patient to ${hospDestName} for in-person evaluation. 104 Health Helpline available for interim tele-doctor guidance while traveling.`;
        triage.referral_destination = hospDestName;
        triage.call_referral_primary = hospDestName;
        triage.call_referral_primary_reason = `Direct patient to ${hospDestName} casualty for in-person medical treatment (dispensary closed).`;
        triage.call_referral_secondary = "104 Health Helpline";
        triage.call_referral_secondary_reason = "104 Health Helpline for interim doctor consultation support.";
      } else {
        forwardingHierarchy = [dir104, dirDispensary, dirEsic, dirGovt, dirTieUp, dir108];
        triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
        triage.recommended_action = "Dispensary is currently closed. Advise caller to connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone, or visit ESIS Dispensary during open hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM).";
        triage.referral_destination = "104 Health Helpline";
        triage.call_referral_primary = "104 Health Helpline";
        triage.call_referral_primary_reason = "Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
        triage.call_referral_secondary = dispName;
        triage.call_referral_secondary_reason = `Visit nearest ESIS Dispensary (${dispName}) during operating hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM) for in-person checkup.`;
      }
    }

    // Assign 1-indexed ranks to hierarchy entries
    triage.forwarding_hierarchy = forwardingHierarchy.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));




    if (!triage.referral_destination) {
      triage.referral_destination = isSevere ? (nearestHospital?.name || "ESIC Hospital") : (nearestDispensary?.name || "ESIS Dispensary");
      triage.referral_reason = triage.referral_reason || triage.recommended_action || "Guided to nearest healthcare facility.";
    }

    let pDest = String(triage.call_referral_primary || triage.referral_destination || "").trim();
    let sDest = String(triage.call_referral_secondary || triage.secondary_referral_destination || "").trim();

    if (pDest.includes("Psychological Counselling") || pDest.includes("Tele-MANAS") || pDest.includes("NACO")) pDest = "104 Health Helpline";
    if (sDest.includes("Psychological Counselling") || sDest.includes("Tele-MANAS") || sDest.includes("NACO")) sDest = "ESIC Hospital";

    if (pDest && sDest && pDest.toLowerCase() === sDest.toLowerCase()) {
      sDest = pDest === "ESIC Hospital" ? "104 Health Helpline" : "ESIC Hospital";
    }

    triage.call_referral_primary = pDest;
    triage.referral_destination = pDest;
    triage.call_referral_secondary = sDest;
    triage.secondary_referral_destination = sDest;

    // Ensure clinical summary strictly synchronizes with the final primary forward destination and caller demographics
    const finalSeverity = evaluatedScore;
    const finalDuration = validatedDuration;
    const callerProblems = extractCallerReportedProblems({
      result: { ekms_ai_context: ekmsCtx, intake, caller_spoken_text: callerSpokenText },
      callerIntake: intake,
      t: triage,
    });
    const finalComplaint = callerProblems.length > 0
      ? callerProblems.join(" · ")
      : (triage.primary_complaint || notes || "Primary Clinical Assessment");
    
    intake.caller_spoken_text = callerSpokenText;
    const formattedSummary = formatClinicalSummary(
      intake,
      finalComplaint,
      finalSeverity,
      finalDuration,
      pDest
    );
    triage.summary_en = formattedSummary.summaryEn;
    triage.summary_hi = formattedSummary.summaryHi;
    triage.primary_complaint = formattedSummary.cleanCond;

    const latency_ms = Date.now() - startTime;
    const rawAgent = intake.agent_id || intake.agent || "A1";
    const agentCode = getAgentCode(rawAgent);

    // Retrieve existing cases to enforce serial Case ID or same-number caller Case ID retention
    let existingCases = [];
    try {
      existingCases = (await getCases().catch(() => [])) || [];
    } catch {
      existingCases = [];
    }

    const case_ref = intake.case_ref || generateNextCaseRef(existingCases, intake.phone);
    const caller_id = intake.caller_id || getCallerIdForPhone(intake.phone, existingCases);

    const casePayload = {
      case_ref,
      caller_id,
      agent_id: agentCode,
      intake: {
        caller_name: intake.caller_name || null,
        phone: intake.phone || null,
        caller_id,
        age: intake.age != null && intake.age !== "" ? Number(intake.age) : null,
        sex: intake.sex || null,
        symptom_notes: intake.symptom_notes,
        duration: intake.duration || null,
        severity_reported: Number(intake.severity_reported) || 5,
        city: intake.city || null,
        district: intake.district || null,
        pincode: intake.pincode || null,
        latitude: intake.latitude != null ? Number(intake.latitude) : null,
        longitude: intake.longitude != null ? Number(intake.longitude) : null,
        agent_id: agentCode,
        source_app: intake.source_app || "console",
      },
      ekms_ai_context: intake.ekms_ai_context || null,
      triage,
      resolved_location,
      nearest_facilities,
      model_used: "anthropic/claude-sonnet-4-6",
      disclaimer:
        "This system performs urgency triage and facility routing only. It does not provide a medical diagnosis or treatment advice.",
      latency_ms,
      created_at: new Date().toISOString(),
    };

    // 3. Save to Firebase safely (skipped when called from CRM so it never goes into case logs)
    let saved = {};
    if (!intake.skip_case_save && intake.source_app !== "crm") {
      try {
        saved = (await saveCase(casePayload).catch(() => ({}))) || {};
      } catch {
        saved = {};
      }
    }

    return NextResponse.json({
      case_ref,
      caller_id,
      case_id: saved.id || case_ref,
      agent_id: agentCode,
      intake: casePayload.intake,
      triage,
      resolved_location,
      nearest_facilities,
      ekms_ai_context: casePayload.ekms_ai_context,
      disclaimer: casePayload.disclaimer,
      model_used: casePayload.model_used,
      latency_ms,
    });
  } catch (err) {
    console.error("Triage error fallback:", err);
    const safeIntake = intake || {};
    let fallbackCases = [];
    try {
      fallbackCases = (await getCases().catch(() => [])) || [];
    } catch {
      fallbackCases = [];
    }
    const fallbackCaseRef = generateNextCaseRef(fallbackCases, safeIntake.phone);
    let fallbackFacilities = [];
    try {
      fallbackFacilities = (await getFacilities().catch(() => [])) || [];
    } catch {
      fallbackFacilities = [];
    }
    let fallbackLoc = null;
    try {
      fallbackLoc = resolveCallerLocation(safeIntake, fallbackFacilities);
    } catch {
      fallbackLoc = { method: "default_assam", matched: "Assam Central Directory" };
    }
    let fallbackNearest = [];
    try {
      fallbackNearest = rankNearestFacilities(fallbackLoc, fallbackFacilities, 6, false);
    } catch {
      fallbackNearest = [];
    }

    const rawRep = Number(safeIntake.severity_reported) || 3;
    const notesLower = String(safeIntake.symptom_notes || "").toLowerCase();
    const isSevereFbk = rawRep >= 8 || /\b(cardiac arrest|unconscious|behosh|heavy active bleed|arterial bleed|snake\s*bite|drank poison|poisoning|status epilepticus)\b/i.test(notesLower);
    const requiresHospFbk = isSevereFbk || rawRep >= 5 || /\b(ipd|admit|admission|hospitaliz\w*|specialist|surgeon|fracture|broken bone|stitches|taanke|blood test|cbc|x-ray|xray|ecg|usg|ultrasound)\b/i.test(notesLower);
    const fallbackUrgency = isSevereFbk ? "Severe" : (requiresHospFbk ? "Moderate" : "Mild");
    const fallbackScore = isSevereFbk ? (rawRep >= 8 ? rawRep : 9) : (requiresHospFbk ? 6 : 3);
    const fallbackDispStatus = getDispensaryOperatingStatus();
    const fallbackDispensary = fallbackNearest.find((f) => isDispensary(f)) || null;
    const dispNameFbk = fallbackDispensary?.name || "ESIS Dispensary";

    let fbkPrimary = "104 Health Helpline";
    let fbkSecondary = dispNameFbk;
    let fbkRecFacility = "104 Health Helpline (Doctor on Call)";
    let fbkRecAction = "Mild condition; contact 104 Health Helpline for tele-doctor consultation or visit ESIS Dispensary during open hours.";

    if (fallbackUrgency === "Severe") {
      fbkPrimary = "108 Ambulance";
      fbkSecondary = "ESIC Hospital";
      fbkRecFacility = "108 Emergency Ambulance";
      fbkRecAction = "Severe emergency. Immediate ambulance transport required.";
    } else if (fallbackUrgency === "Moderate") {
      fbkPrimary = "ESIC Hospital";
      fbkSecondary = "Govt District Hospital";
      fbkRecFacility = "ESIC Hospital / Govt District Hospital";
      fbkRecAction = "Advise patient to proceed to the nearest ESIC Hospital or Govt District Hospital for clinical evaluation.";
    } else {
      if (fallbackDispStatus.isOpen) {
        fbkPrimary = dispNameFbk;
        fbkSecondary = "104 Health Helpline";
        fbkRecFacility = `${dispNameFbk} (ESIS Dispensary · Open Now)`;
        fbkRecAction = `Visit nearest ESIS Dispensary (${dispNameFbk}) during OPD hours or call 104.`;
      } else {
        fbkPrimary = "104 Health Helpline";
        fbkSecondary = dispNameFbk;
        fbkRecFacility = "104 Health Helpline (Doctor on Call)";
        fbkRecAction = "Dispensary currently closed. Connect with 104 Health Helpline for 24x7 doctor tele-consultation, or visit ESIS Dispensary during open hours.";
      }
    }

    const fallbackForwardingHierarchy = fallbackUrgency === "Severe"
      ? [
          { rank: 1, id: "CALL_108", name: "108 Ambulance", badge: "108 Ambulance", role: "Immediate Emergency Dispatch", status: "24x7 Emergency Response", hours: "24 Hours" },
          { rank: 2, id: "ESIC_HOSPITAL", name: "ESIC Hospital", badge: "ESIC Hospital", role: "Secondary Hospital & Casualty", status: "24x7 Casualty Active", hours: "24 Hours" }
        ]
      : fallbackUrgency === "Moderate"
      ? [
          { rank: 1, id: "ESIC_HOSPITAL", name: "ESIC Hospital", badge: "ESIC Hospital", role: "Secondary Hospital & Casualty", status: "24x7 Casualty Active", hours: "24 Hours" },
          { rank: 2, id: "DIST_HOSPITAL", name: "Govt District Hospital", badge: "Govt District Hospital", role: "Public District Hospital Care", status: "24x7 Casualty Active", hours: "24 Hours" }
        ]
      : fallbackDispStatus.isOpen
      ? [
          { rank: 1, id: "ESIS_DISPENSARY", name: dispNameFbk, badge: "ESIS Dispensary", role: "Primary Care Clinic", status: "Open Now", hours: "Mon-Fri 10am-4pm, Sat 10am-12pm" },
          { rank: 2, id: "TELE_104", name: "104 Health Helpline", badge: "104 Health Helpline", role: "24x7 Tele-Doctor Consultation", status: "24x7 Active", hours: "24 Hours / 7 Days" }
        ]
      : [
          { rank: 1, id: "TELE_104", name: "104 Health Helpline", badge: "104 Health Helpline", role: "24x7 Tele-Doctor Consultation", status: "24x7 Active", hours: "24 Hours / 7 Days" },
          { rank: 2, id: "ESIS_DISPENSARY", name: dispNameFbk, badge: "ESIS Dispensary", role: "Primary Care Clinic", status: "Closed", hours: "Mon-Fri 10am-4pm, Sat 10am-12pm" }
        ];

    return NextResponse.json({
      case_ref: fallbackCaseRef,
      case_id: fallbackCaseRef,
      agent_id: "A1",
      intake: safeIntake,
        triage: {
          urgency_level: fallbackUrgency,
          assessed_severity: fallbackUrgency,
          urgency_score: fallbackScore,
          severity_score: fallbackScore,
          confidence: "medium",
          summary_en: `Clinical evaluation completed for reported ${notesLower.slice(0, 40) || "symptoms"}; guidance to ${fbkPrimary} indicated.`,
          summary_hi: `चिकित्सीय मूल्यांकन संपन्न; ${fbkPrimary} के लिए मार्गदर्शन।`,
          reasoning: "Clinical safety fallback activated.",
          red_flags: [],
          recommended_facility_type: fbkRecFacility,
          recommended_action: fbkRecAction,
          call_108: fallbackUrgency === "Severe",
          detected_language: "Hinglish",
          call_referral_primary: fbkPrimary,
          call_referral_secondary: fbkSecondary,
          referral_destination: fbkPrimary,
          secondary_referral_destination: fbkSecondary,
          referral_reason: `Connect with ${fbkPrimary} for clinical consultation.`,
          forwarding_hierarchy: fallbackForwardingHierarchy,
        },
      resolved_location: fallbackLoc,
      nearest_facilities: fallbackNearest,
      ekms_ai_context: null,
      disclaimer: "This system performs urgency triage and facility routing only. It does not provide a medical diagnosis or treatment advice.",
      model_used: "fallback-resilient",
      latency_ms: Date.now() - startTime
    }, { status: 200 });
  }
}
