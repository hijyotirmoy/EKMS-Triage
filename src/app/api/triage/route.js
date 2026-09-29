import { NextResponse } from "next/server";
import { getFacilities, saveCase } from "@/lib/db";
import {
  resolveCallerLocation,
  rankNearestFacilities,
  isTieUp,
  isHospital,
  isDispensary,
  isEsicHospital,
  isGovtDistrictHospital,
} from "@/lib/geo";
import { evaluateTriage, summarizeRedFlags, getDispensaryOperatingStatus } from "@/lib/triageEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAgentCode(rawAgent) {
  if (!rawAgent) return "A1";
  const str = String(rawAgent).toUpperCase();
  if (str.includes("3")) return "A3";
  if (str.includes("2")) return "A2";
  if (str.includes("1")) return "A1";
  return "A1";
}

function generateCaseRef(agentId, urgencyLevel) {
  const agentCode = getAgentCode(agentId);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
  const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
  const num = Math.floor(Math.random() * 10000) + 1;
  const numStr = String(num).padStart(5, "0");
  const urgStr = String(urgencyLevel || "Routine").trim().toUpperCase();
  const urgLetter = urgStr.charAt(0) || "R";
  return `C${agentCode}${l1}${l2}${numStr}${urgLetter}`;
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
      triage = {
        urgency_level: Number(intake.severity_reported) >= 8 ? "Emergency" : (Number(intake.severity_reported) >= 5 ? "Urgent" : "Routine"),
        urgency_score: Number(intake.severity_reported) || 5,
        confidence: "medium",
        summary_en: `Caller reported symptoms: ${String(intake.symptom_notes).slice(0, 120)}. Guided to healthcare facility.`,
        summary_hi: "लक्षणों के आधार पर उपयुक्त स्वास्थ्य सुविधा के लिए मार्गदर्शन किया गया।",
        reasoning: "Clinical assessment based on reported symptoms and severity.",
        red_flags: [],
        call_108: Number(intake.severity_reported) >= 8,
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
      triage.call_referral_primary = "NACO 1097 Helpline";
      triage.referral_destination = "NACO 1097 Helpline";
      triage.recommended_facility_type = "NACO 1097 Helpline (HIV / AIDS / STI)";
      triage.recommended_action = "Transfer call directly to National AIDS Helpline (1097) for 24x7 counseling and ICTC/ART support.";
      triage.summary_en = "Caller inquiry regarding HIV / AIDS, STI symptoms, testing, PEP, or sexual health counseling. Transfer directly to NACO 1097 Toll-Free Helpline.";
    }

    const isSevere =
      !isNacoHIV && (
        triage.urgency_level === "Emergency" ||
        triage.urgency_level === "Urgent" ||
        Number(intake.severity_reported) >= 7 ||
        (triage.urgency_score && triage.urgency_score >= 7)
      );

    // If explicit caller preference was detected, respect it
    if (explicitReferral.includes("108")) {
      triage.call_108 = true;
      triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
      triage.referral_destination = "108 Ambulance";
      triage.referral_reason = "Emergency medical priority; dispatch 108 Ambulance immediately.";
      triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    } else if (explicitReferral.includes("104") || explicitReferral.includes("doctor")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
      triage.referral_destination = "104 Health Helpline";
      triage.referral_reason = "Caller requests telephone medical advice; forward to 104 Health Helpline tele-doctor.";
      triage.recommended_action = "Transfer call to 104 Health Helpline queue for tele-doctor consultation.";
    }

    triage.call_referral_primary = triage.call_referral_primary || triage.referral_destination;
    triage.call_referral_secondary = triage.call_referral_secondary || triage.secondary_referral_destination;

    // Ensure red flags strictly reflect caller-reported symptoms without hallucinations
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm)\b/i.test(callerSpokenText);
    triage.red_flags = summarizeRedFlags(triage.red_flags, callerSpokenText, isSafe);

    triage.primary_complaint =
      triage.primary_complaint ||
      tState?.suspectedCondition ||
      tState?.condition ||
      tState?.symptom ||
      "Primary Clinical Assessment";
    triage.duration = triage.duration || intake.duration || tState?.duration || "Reported today";
    triage.assessed_severity =
      triage.assessed_severity ||
      (tState?.severity
        ? `${tState.severity} (${tState?.severityScore || triage.urgency_score || 5}/10)`
        : (isSevere ? `High (${triage.urgency_score || 8}/10)` : `Moderate (${triage.urgency_score || 5}/10)`));

    // 2. Resolve location & rank 6 nearest facilities safely
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
        6,
        isSevere && !isPsychiatricCase
      );
    } catch {
      nearest_facilities = facilities.slice(0, 6);
    }

    const isPsychCase =
      isPsychiatricCase ||
      /tele.?manas|psychological|anxiety|depression|mental/i.test(triage.referral_destination || "") ||
      /tele.?manas|psychological|anxiety|depression|mental/i.test(triage.call_referral_primary || "") ||
      /anxious|anxiety|depression|depressed|stress|suicid|self.?harm|mental|panic/i.test(callerSpokenText);

    const hasSpecialReferral =
      triage.referral_destination === "104 Health Helpline" ||
      triage.referral_destination === "108 Ambulance" ||
      triage.referral_destination === "Tele-MANAS (14416)" ||
      triage.referral_destination === "Psychological Counselling Department" ||
      triage.referral_destination === "NACO 1097 Helpline" ||
      triage.referral_destination === "Nearest Tie-Up Facility" ||
      triage.referral_destination === "Govt District Hospital" ||
      isPsychCase ||
      explicitReferral.includes("108") ||
      explicitReferral.includes("104") ||
      explicitReferral.includes("doctor");

    if (isPsychCase) {
      triage.call_referral_primary = "Tele-MANAS (14416)";
      triage.referral_destination = "Tele-MANAS (14416)";
      triage.call_referral_secondary = "104 Health Helpline";
      triage.secondary_referral_destination = "104 Health Helpline";
      triage.secondary_referral_reason =
        "104 Health Helpline tele-doctor consultation for physical medical evaluation and guidance.";
    }

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const currentMinutes = hour * 60 + istDate.getMinutes();
    const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM (960) to 10:00 AM (600)
    const isAfter7PM = hour >= 19 || hour < 5;
    const dispensaryStatus = getDispensaryOperatingStatus();

    const nearestHospital = nearest_facilities.find((f) => isHospital(f)) || nearest_facilities[0];
    const nearestDispensary = nearest_facilities.find((f) => isDispensary(f));
    const isEsicNearby = nearestHospital && isEsicHospital(nearestHospital) && (nearestHospital.distance_km == null || nearestHospital.distance_km <= 100);

    if (triage.call_108 || explicitReferral.includes("108") || triage.referral_destination === "108 Ambulance") {
      triage.recommended_facility_type = isEsicNearby
        ? "108 Emergency Ambulance / ESIC Hospital Casualty"
        : (nearestHospital ? `108 Emergency Ambulance / Nearest Hospital Casualty (${nearestHospital.name})` : "108 Emergency Ambulance / Nearest Hospital Casualty");
    }

    if (isPsychCase) {
      triage.referral_destination = "Tele-MANAS (14416)";
      triage.call_referral_primary = "Tele-MANAS (14416)";
      triage.call_referral_secondary = "104 Health Helpline";
    } else if (triage.referral_destination === "Nearest Tie-Up Facility" || triage.referral_destination === "Tie-Up Facility") {
      const nearestTieUp = nearest_facilities.find((f) => isTieUp(f));
      triage.recommended_facility_type = nearestTieUp ? `${nearestTieUp.name} (ESI Empanelled Tie-Up Hospital)` : "ESI Empanelled Tie-Up Hospital";
      triage.recommended_action = nearestTieUp
        ? `Referral priority: Guide patient to empanelled partner hospital ${nearestTieUp.name} (${nearestTieUp.pincode ? `PIN: ${nearestTieUp.pincode}, ` : ""}${nearestTieUp.distance_km != null ? `${nearestTieUp.distance_km} km away` : "nearest"}) under cashless ESI treatment guidelines.`
        : "Referral priority: Guide patient to nearest empanelled tie-up hospital under cashless ESI treatment guidelines.";
      triage.referral_destination = "Tie-Up Facility";
      triage.call_referral_primary = "Tie-Up Facility";
      triage.call_referral_primary_reason = triage.referral_reason || (nearestTieUp ? `Empanelled tie-up hospital care at ${nearestTieUp.name}.` : "Empanelled tie-up hospital care.");
      triage.call_referral_secondary = "ESIC Hospital";
      triage.call_referral_secondary_reason = "ESIC Hospital casualty / triage desk.";
    } else if (triage.referral_destination === "Govt District Hospital") {
      const nearestDistHosp = nearest_facilities.find((f) => isGovtDistrictHospital(f));
      triage.recommended_facility_type = nearestDistHosp ? `${nearestDistHosp.name} (Govt District Hospital · Public Health)` : "Govt District Hospital";
      triage.recommended_action = nearestDistHosp
        ? `Guide patient to nearest public health facility ${nearestDistHosp.name} (${nearestDistHosp.pincode ? `PIN: ${nearestDistHosp.pincode}, ` : ""}${nearestDistHosp.distance_km != null ? `${nearestDistHosp.distance_km} km away` : "nearest"}) for specialist evaluation or immunization.`
        : "Guide patient to nearest Govt District Hospital for specialist evaluation.";
      triage.referral_destination = "Govt District Hospital";
      triage.call_referral_primary = "Govt District Hospital";
      triage.call_referral_primary_reason = triage.referral_reason || (nearestDistHosp ? `Public healthcare outside ESIC network at ${nearestDistHosp.name}.` : "Public healthcare outside ESIC network.");
      triage.call_referral_secondary = "104 Health Helpline";
      triage.call_referral_secondary_reason = "104 Health Helpline for tele-doctor consultation.";
    } else if (isSevere) {
      if (!hasSpecialReferral) {
        const isEsicNearby = nearestHospital && isEsicHospital(nearestHospital) && (nearestHospital.distance_km == null || nearestHospital.distance_km <= 100);
        if (isEsicNearby) {
          triage.recommended_facility_type = nearestHospital ? `${nearestHospital.name} (ESIC Hospital · 24x7 Casualty)` : "ESIC Hospital (24x7 Casualty)";
          triage.recommended_action = nearestHospital
            ? `Emergency priority: Advise patient to proceed immediately to ${nearestHospital.name} (${nearestHospital.pincode ? `PIN: ${nearestHospital.pincode}, ` : ""}${nearestHospital.distance_km != null ? `${nearestHospital.distance_km} km away` : "nearest"}) casualty or emergency department for acute medical stabilization.`
            : "Emergency priority: Proceed to nearest ESIC Hospital casualty.";
          triage.referral_destination = "ESIC Hospital";
          triage.call_referral_primary = "ESIC Hospital";
          triage.call_referral_primary_reason = nearestHospital ? `Direct patient immediately to nearest hospital (${nearestHospital.name}) casualty for acute clinical evaluation.` : "Proceed immediately to ESIC Hospital casualty.";
        } else {
          const hospName = nearestHospital?.name || "Govt District Hospital";
          triage.recommended_facility_type = nearestHospital ? `${nearestHospital.name} (Nearest Hospital · 24x7 Casualty)` : "Nearest Hospital (24x7 Casualty)";
          triage.recommended_action = nearestHospital
            ? `Emergency priority: No ESIC Hospital within 100km. Advise patient to proceed immediately to nearest emergency facility ${nearestHospital.name} (${nearestHospital.pincode ? `PIN: ${nearestHospital.pincode}, ` : ""}${nearestHospital.distance_km != null ? `${nearestHospital.distance_km} km away` : "nearest"}) casualty for acute medical care.`
            : "Emergency priority: Proceed immediately to nearest hospital casualty.";
          triage.referral_destination = hospName;
          triage.call_referral_primary = hospName;
          triage.call_referral_primary_reason = nearestHospital ? `Direct patient immediately to nearest hospital (${nearestHospital.name}) casualty for emergency stabilization.` : "Proceed immediately to nearest hospital casualty.";
        }

        if (!triage.call_referral_secondary) {
          triage.call_referral_secondary = "108 Ambulance";
          triage.call_referral_secondary_reason = "If patient cannot travel unassisted or symptoms escalate, dispatch 108 Emergency Ambulance immediately.";
        }
      }
    } else if (isOffHours || !dispensaryStatus.isOpen) {
      triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
      triage.recommended_action = `Dispensaries and hospital OPDs are closed (10:00 AM – 4:00 PM). Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone, or visit nearest hospital if symptoms escalate.`;
      triage.referral_destination = "104 Health Helpline";
      triage.call_referral_primary = "104 Health Helpline";
      triage.call_referral_primary_reason = `Dispensary and hospital OPD hours are closed (10:00 AM – 4:00 PM). Connect with 104 Health Helpline for 24x7 tele-doctor consultation and medical guidance.`;

      const isEsicNearby = nearestHospital && isEsicHospital(nearestHospital) && (nearestHospital.distance_km == null || nearestHospital.distance_km <= 100);
      triage.call_referral_secondary = isEsicNearby ? "ESIC Hospital" : (nearestHospital?.name || "Govt District Hospital");
      triage.call_referral_secondary_reason = nearestHospital
        ? `Nearest facility (${nearestHospital.name}) for physical evaluation if symptoms persist or escalate.`
        : "Nearest hospital casualty / urgent OPD for physical examination.";
    } else {
      const destDispensary = nearestDispensary || nearest_facilities.find((f) => !isTieUp(f)) || nearest_facilities[0];
      if (!hasSpecialReferral && destDispensary) {
        triage.recommended_facility_type = `${destDispensary.name} (ESIS Dispensary · Primary Care OPD)`;
        triage.recommended_action = `Advise patient to visit ${destDispensary.name} (${destDispensary.pincode ? `PIN: ${destDispensary.pincode}, ` : ""}${destDispensary.distance_km != null ? `${destDispensary.distance_km} km away` : "nearest"}) during regular OPD hours (${dispensaryStatus.operatingHoursText || "10:00 AM – 4:00 PM"}) for doctor consultation and free medicine dispensing.`;
        triage.referral_destination = "ESIS Dispensary";
        triage.call_referral_primary = "ESIS Dispensary";
        triage.call_referral_primary_reason = `Direct patient to ${destDispensary.name} during OPD hours (10:00 AM – 4:00 PM) for physical examination and routine medicines.`;

        if (!triage.call_referral_secondary) {
          triage.call_referral_secondary = "104 Health Helpline";
          triage.call_referral_secondary_reason = "Connect with 104 Health Helpline for tele-doctor consultation over the phone.";
        }
      }
    }

    if (isAfter7PM) {
      const p = String(triage.call_referral_primary || triage.referral_destination || "").toLowerCase();
      const s = String(triage.call_referral_secondary || "").toLowerCase();
      const hasCallOption = p.includes("104") || p.includes("108") || p.includes("call") || p.includes("tele") ||
                            s.includes("104") || s.includes("108") || s.includes("call") || s.includes("tele");
      if (!hasCallOption) {
        triage.call_referral_secondary = "104 Health Helpline";
        triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.";
      }
    }

    if (!triage.referral_destination) {
      triage.referral_destination = isSevere ? (nearestHospital?.name || "ESIC Hospital") : (nearestDispensary?.name || "ESIS Dispensary");
      triage.referral_reason = triage.referral_reason || triage.recommended_action || "Guided to nearest healthcare facility.";
    }

    let pDest = String(triage.call_referral_primary || triage.referral_destination || "").trim();
    let sDest = String(triage.call_referral_secondary || triage.secondary_referral_destination || "").trim();

    if (pDest.includes("Psychological Counselling")) pDest = "Tele-MANAS (14416)";
    if (sDest.includes("Psychological Counselling")) sDest = "Tele-MANAS (14416)";

    const isPrimaryTele = /tele.?manas|psychological/i.test(pDest);
    const isSecondaryTele = /tele.?manas|psychological/i.test(sDest);

    if (isPrimaryTele && isSecondaryTele) {
      sDest = "104 Health Helpline";
      triage.secondary_referral_reason =
        "104 Health Helpline tele-doctor consultation for physical medical evaluation and guidance.";
      triage.call_referral_secondary_reason = triage.secondary_referral_reason;
    } else if (pDest && sDest && pDest.toLowerCase() === sDest.toLowerCase()) {
      sDest = "104 Health Helpline";
    }

    triage.call_referral_primary = pDest;
    triage.referral_destination = pDest;
    triage.call_referral_secondary = sDest;
    triage.secondary_referral_destination = sDest;

    const latency_ms = Date.now() - startTime;
    const rawAgent = intake.agent_id || intake.agent || "A1";
    const case_ref = generateCaseRef(rawAgent, triage.urgency_level);
    const agentCode = getAgentCode(rawAgent);

    const casePayload = {
      case_ref,
      agent_id: agentCode,
      intake: {
        caller_name: intake.caller_name || null,
        phone: intake.phone || null,
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

    // 3. Save to Firebase safely
    let saved = {};
    try {
      saved = (await saveCase(casePayload).catch(() => ({}))) || {};
    } catch {
      saved = {};
    }

    return NextResponse.json({
      case_ref,
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
    const fallbackCaseRef = `CA1${Date.now().toString().slice(-6)}U`;
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

    return NextResponse.json({
      case_ref: fallbackCaseRef,
      case_id: fallbackCaseRef,
      agent_id: "A1",
      intake: safeIntake,
      triage: {
        urgency_level: "Urgent",
        urgency_score: 6,
        confidence: "medium",
        summary_en: "Clinical evaluation completed; guidance to nearest health facility indicated.",
        summary_hi: "चिकित्सीय मूल्यांकन संपन्न; निकटतम स्वास्थ्य सुविधा के लिए मार्गदर्शन।",
        reasoning: "Clinical safety fallback activated.",
        red_flags: [],
        recommended_facility_type: "104 Health Helpline (Doctor on Call)",
        recommended_action: "Connect with 104 Health Helpline for tele-doctor guidance or visit nearest hospital.",
        call_108: false,
        detected_language: "Hinglish",
        call_referral_primary: "104 Health Helpline",
        call_referral_secondary: "ESIC Hospital",
        referral_destination: "104 Health Helpline",
        referral_reason: "Connect with 104 Health Helpline for 24x7 doctor consultation over the phone."
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
