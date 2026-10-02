import { NextResponse } from "next/server";
import { getFacilities, saveCase, getCases } from "@/lib/db";
import { generateNextCaseRef } from "@/lib/caseId";
import {
  resolveCallerLocation,
  rankNearestFacilities,
  isTieUp,
  isHospital,
  isDispensary,
  isEsicHospital,
  isGovtDistrictHospital,
} from "@/lib/geo";
import { evaluateTriage, summarizeRedFlags, getDispensaryOperatingStatus, isLifeThreateningAmbulanceCase } from "@/lib/triageEngine";

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
      triage.call_referral_primary = "104 Health Helpline";
      triage.referral_destination = "104 Health Helpline";
      triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
      triage.recommended_action = "Transfer call directly to 104 Health Helpline for 24x7 confidential doctor counseling, STI guidance, and testing support.";
      triage.summary_en = "Caller inquiry regarding HIV / AIDS, STI symptoms, testing, PEP, or sexual health counseling. Transfer directly to 104 Health Helpline.";
      triage.summary_hi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी परामर्श चाहता है; 104 हेल्पलाइन से संपर्क आवश्यक है।";
    }

    const isEmergency =
      !isNacoHIV && (
        triage.urgency_level === "Emergency" ||
        Number(intake.severity_reported) >= 8 ||
        triage.call_108 ||
        explicitReferral.includes("108")
      );

    const isSevere = isEmergency;

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

    const hasExplicitSpecialReferral =
      isNacoHIV ||
      isPsychCase ||
      explicitReferral.includes("108") ||
      explicitReferral.includes("104");

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
    const isEsicWithin25Km = Boolean(nearestEsic && nearestEsic.distance_km != null && nearestEsic.distance_km <= 25);

    const ambulanceEval = isLifeThreateningAmbulanceCase(
      notes,
      triage.urgency_score || intake.severity_reported,
      intake,
      tState
    );

    const chatChoseHospital =
      explicitReferral.includes("hospital") ||
      (tState?.referralDestination || "").toLowerCase().includes("hospital") ||
      (triage.referral_destination || "").toLowerCase().includes("hospital");

    if (chatChoseHospital && !ambulanceEval.is108) {
      triage.call_108 = false;
      triage.referral_destination = "ESIC Hospital";
      triage.call_referral_primary = "ESIC Hospital";
      triage.call_referral_secondary = "104 Health Helpline";
      triage.recommended_facility_type = nearestEsic
        ? `${nearestEsic.name} (ESIC Hospital · 24x7 Casualty)`
        : "ESIC Hospital (24x7 Casualty)";
      triage.recommended_action = nearestEsic
        ? `Direct patient immediately to ${nearestEsic.name} (${nearestEsic.pincode ? `PIN: ${nearestEsic.pincode}, ` : ""}${nearestEsic.distance_km != null ? `${nearestEsic.distance_km} km away` : "within 25km"}) casualty for acute medical evaluation.`
        : "Direct patient immediately to nearest ESIC Hospital casualty.";
    } else if (ambulanceEval.is108) {
      triage.call_108 = true;
      triage.recommended_facility_type = nearestHospital
        ? `108 Emergency Ambulance / ${nearestHospital.name}`
        : "108 Emergency Ambulance / Nearest Hospital Casualty";
      triage.referral_destination = "108 Ambulance";
      triage.call_referral_primary = "108 Ambulance";
      triage.call_referral_secondary = nearestHospital?.name || "ESIC Hospital";
      triage.recommended_action = ambulanceEval.reason || "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    } else if (isPsychCase || isNacoHIV) {
      triage.call_108 = false;
      triage.referral_destination = "104 Health Helpline";
      triage.call_referral_primary = "104 Health Helpline";
      triage.call_referral_secondary = "ESIC Hospital";
    } else if (isEmergency) {
      // -------------------------------------------------------------
      // EMERGENCY CASES:
      // Refer to ESIC Hospital if <= 25 KM; if no ESIC Hospital under 25 KM, refer to Govt District Hospital
      // -------------------------------------------------------------
      if (!hasExplicitSpecialReferral) {
        if (isEsicWithin25Km) {
          triage.recommended_facility_type = nearestEsic
            ? `${nearestEsic.name} (ESIC Hospital · 24x7 Casualty)`
            : "ESIC Hospital (24x7 Casualty)";
          triage.recommended_action = nearestEsic
            ? `Emergency priority: Advise patient to proceed immediately to ${nearestEsic.name} (${nearestEsic.pincode ? `PIN: ${nearestEsic.pincode}, ` : ""}${nearestEsic.distance_km != null ? `${nearestEsic.distance_km} km away` : "within 25km"}) casualty for acute medical stabilization.`
            : "Emergency priority: Proceed to nearest ESIC Hospital casualty.";
          triage.referral_destination = "ESIC Hospital";
          triage.call_referral_primary = "ESIC Hospital";
          triage.call_referral_primary_reason = nearestEsic
            ? `Direct patient immediately to ESIC Hospital (${nearestEsic.name}) casualty for emergency stabilization.`
            : "Proceed immediately to ESIC Hospital casualty.";
          triage.call_referral_secondary = "108 Ambulance";
          triage.call_referral_secondary_reason = "If patient cannot travel unassisted or symptoms escalate, dispatch 108 Emergency Ambulance immediately.";
        } else {
          const hospName = nearestDistHosp?.name || nearestHospital?.name || "Govt District Hospital";
          triage.recommended_facility_type = nearestDistHosp || nearestHospital
            ? `${hospName} (Govt District Hospital · 24x7 Casualty)`
            : "Nearest Govt District Hospital / 24x7 Casualty";
          triage.recommended_action = nearestDistHosp || nearestHospital
            ? `Emergency priority: No ESIC Hospital within 25km. Advise patient to proceed immediately to nearest hospital ${hospName} (${nearestDistHosp?.pincode ? `PIN: ${nearestDistHosp.pincode}, ` : ""}${nearestDistHosp?.distance_km != null ? `${nearestDistHosp.distance_km} km away` : "nearest"}) casualty for acute emergency care.`
            : "Emergency priority: Proceed immediately to nearest hospital emergency casualty or dispatch 108 Emergency Ambulance. Enter caller pincode below to view local emergency facilities.";
          triage.referral_destination = "Govt District Hospital";
          triage.call_referral_primary = "Govt District Hospital";
          triage.call_referral_primary_reason = `Direct patient immediately to nearest hospital (${hospName}) casualty for emergency stabilization.`;
          triage.call_referral_secondary = "108 Ambulance";
          triage.call_referral_secondary_reason = "If patient cannot travel unassisted or symptoms escalate, dispatch 108 Emergency Ambulance immediately.";
        }
      }
    } else {
      // -------------------------------------------------------------
      // NON-EMERGENCY / NORMAL CASES (No major emergency, mild to moderate):
      // 1. After 4:00 PM (and weekends / closed OPD hours):
      //    Always prefer 104 Health Helpline (24x7 Doctor on Call) as Primary Immediate Destination!
      //    Secondary Destination: ESIC Hospital (for escalation / in-person checkup).
      // 2. Before 4:00 PM (regular Daytime OPD):
      //    - Priority 1: ESIS Dispensary (if open / nearby)
      //    - Priority 2: ESIC Hospital (if within 25 KM)
      //    - Priority 3: District Hospital / Tie-Up Hospital
      // -------------------------------------------------------------
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
      const istMinutes = istDate.getHours() * 60 + istDate.getMinutes();
      const isAfter4pmOrOffHours = istMinutes >= 960 || istMinutes < 600 || istDate.getDay() === 0 || istDate.getDay() === 6;

      if (!hasExplicitSpecialReferral) {
        if (isAfter4pmOrOffHours) {
          // After 4:00 PM: Always route non-emergency callers to 104 Health Helpline
          triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
          triage.recommended_action = "After 4:00 PM (regular OPD closed), advise caller to connect with 104 Health Helpline for 24x7 confidential doctor tele-consultation over the phone, or visit ESIC Hospital if symptoms escalate.";
          triage.referral_destination = "104 Health Helpline";
          triage.call_referral_primary = "104 Health Helpline";
          triage.call_referral_primary_reason = "After 4:00 PM (regular OPD closed), connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
          triage.call_referral_secondary = "ESIC Hospital";
          triage.call_referral_secondary_reason = "Guide to ESIC Hospital for in-person doctor checkup if symptoms persist or escalate.";
        } else if (nearestDispensary || explicitReferral.includes("dispensary") || !nearest_facilities.length) {
          // Priority 1: ESIS Dispensary during regular daytime OPD hours
          const disp = nearestDispensary;
          triage.recommended_facility_type = disp
            ? `${disp.name} (ESIS Dispensary · Primary Care OPD)`
            : "ESIS Dispensary (Primary Care OPD)";
          triage.recommended_action = disp
            ? `Advise patient to visit ${disp.name} (${disp.pincode ? `PIN: ${disp.pincode}, ` : ""}${disp.distance_km != null ? `${disp.distance_km} km away` : "nearest"}) during regular OPD hours (Mon–Fri 10:00 AM – 4:00 PM) for doctor consultation and routine medicines.`
            : "Advise patient to visit their nearest local ESIS Dispensary during regular OPD hours (Mon–Fri 10:00 AM – 4:00 PM) for doctor consultation and free medicine dispensing. Enter caller pincode below to locate exact nearest facility.";
          triage.referral_destination = "ESIS Dispensary";
          triage.call_referral_primary = "ESIS Dispensary";
          triage.call_referral_primary_reason = disp
            ? `Direct patient to ${disp.name} for physical doctor checkup and free prescription dispensing.`
            : "Visit nearest ESIS Dispensary during OPD hours.";
          triage.call_referral_secondary = "104 Health Helpline";
          triage.call_referral_secondary_reason = "104 Health Helpline for 24x7 tele-doctor consultation over the phone.";
        } else if (isEsicWithin25Km) {
          // Priority 2: ESIC Hospital within 25 KM during regular daytime OPD
          triage.recommended_facility_type = nearestEsic
            ? `${nearestEsic.name} (ESIC Hospital · Secondary Care)`
            : "ESIC Hospital";
          triage.recommended_action = nearestEsic
            ? `Referral priority: Guide patient to nearest ESIC Hospital (${nearestEsic.name}${nearestEsic.pincode ? `, PIN: ${nearestEsic.pincode}` : ""}${nearestEsic.distance_km != null ? `, ${nearestEsic.distance_km} km away` : ""}) for doctor consultation and treatment under ESIC coverage.`
            : "Guide patient to nearest ESIC Hospital.";
          triage.referral_destination = "ESIC Hospital";
          triage.call_referral_primary = "ESIC Hospital";
          triage.call_referral_primary_reason = nearestEsic
            ? `Refer patient to ESIC Hospital ${nearestEsic.name} (${nearestEsic.distance_km != null ? `${nearestEsic.distance_km} km away` : "within 25km"}) for clinical consultation.`
            : "Refer patient to nearest ESIC Hospital within 25km.";
          triage.call_referral_secondary = "104 Health Helpline";
          triage.call_referral_secondary_reason = "104 Health Helpline for tele-doctor consultation over the phone.";
        } else {
          // Priority 3: District Hospital or Tie-Up Hospital (whichever is closer)
          let topAlt = nearestDistHosp;
          let secAlt = nearestTieUp;
          if (
            nearestTieUp &&
            (!nearestDistHosp ||
              (nearestTieUp.distance_km != null &&
                nearestDistHosp.distance_km != null &&
                nearestTieUp.distance_km < nearestDistHosp.distance_km))
          ) {
            topAlt = nearestTieUp;
            secAlt = nearestDistHosp;
          }
          topAlt = topAlt || nearest_facilities[0];
          const isAltTieUp = isTieUp(topAlt);

          triage.recommended_facility_type = topAlt
            ? `${topAlt.name} (${isAltTieUp ? "ESIC Tie-Up Hospital" : "Govt District Hospital"})`
            : "Govt District Hospital";
          triage.recommended_action = topAlt
            ? `No ESIC Hospital or dispensary available within 25km. Guide patient to ${isAltTieUp ? "empanelled tie-up hospital" : "Govt district hospital"} ${topAlt.name} (${topAlt.pincode ? `PIN: ${topAlt.pincode}, ` : ""}${topAlt.distance_km != null ? `${topAlt.distance_km} km away` : "nearest"}) for medical care.`
            : "Guide patient to nearest Govt District Hospital or Tie-Up Hospital.";
          triage.referral_destination = isAltTieUp ? "Tie-Up Facility" : "Govt District Hospital";
          triage.call_referral_primary = isAltTieUp ? "Tie-Up Facility" : "Govt District Hospital";
          triage.call_referral_primary_reason = topAlt
            ? `Refer patient to ${topAlt.name} (${topAlt.distance_km != null ? `${topAlt.distance_km} km away` : "nearest"}) for clinical care.`
            : "Refer to nearest district or tie-up facility.";
          triage.call_referral_secondary = secAlt ? secAlt.name : "104 Health Helpline";
          triage.call_referral_secondary_reason = "104 Health Helpline for tele-doctor guidance.";
        }
      }
    }




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

    const case_ref = generateNextCaseRef(existingCases, intake.phone);

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
