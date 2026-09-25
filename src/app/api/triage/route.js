import { NextResponse } from "next/server";
import { getFacilities, saveCase } from "@/lib/db";
import { resolveCallerLocation, rankNearestFacilities, isTieUp } from "@/lib/geo";
import { evaluateTriage, summarizeRedFlags } from "@/lib/triageEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function generateCaseRef() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CASE-${yy}${mm}${dd}-${rand}`;
}

export async function POST(request) {
  const startTime = Date.now();
  try {
    const intake = await request.json();

    if (!intake.symptom_notes || intake.symptom_notes.trim().length < 3) {
      return NextResponse.json(
        { detail: "Enter complaint notes (minimum 3 characters)" },
        { status: 400 }
      );
    }

    // 1. Perform clinical triage evaluation
    const triage = await evaluateTriage(intake);

    const ekmsCtx = intake.ekms_ai_context || {};
    const tState = ekmsCtx.triageState || ekmsCtx;
    const explicitReferral = (tState?.referralDestination || "").toLowerCase();
    const notes = `${intake.symptom_notes || ""} ${tState?.symptom || ""} ${tState?.condition || ""}`.toLowerCase();

    const isPsychiatricCase = Boolean(
      triage.is_psychiatric ||
      tState?.isPsychiatric ||
      ekmsCtx?.isPsychiatric ||
      explicitReferral.includes("psych") ||
      explicitReferral.includes("counsel") ||
      explicitReferral.includes("manas") ||
      explicitReferral.includes("14416") ||
      /\b(suicid|mar ja|jaan de dunga|depress|udaas|hopeless|anxiety|ghabrahat|die\b|kill myself|self-harm|self harm|crying)\b/i.test(notes)
    );

    const isSevere =
      triage.urgency_level === "Emergency" ||
      triage.urgency_level === "Urgent" ||
      Number(intake.severity_reported) >= 7 ||
      (triage.urgency_score && triage.urgency_score >= 7);

    // If explicit caller preference was detected, respect it
    if (explicitReferral.includes("108")) {
      triage.call_108 = true;
      triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
      triage.referral_destination = "108 Ambulance";
      triage.referral_reason = "Emergency medical priority; dispatch 108 Ambulance immediately.";
      triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    } else if (explicitReferral.includes("104")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
      triage.referral_destination = "104 Medical Team";
      triage.referral_reason = "Caller requests telephone medical advice; forward to 104 Health Helpline tele-doctor.";
      triage.recommended_action = "Transfer call to 104 Health Helpline queue for tele-doctor consultation.";
    } else if (explicitReferral.includes("sanjeevani")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "e-Sanjeevani National Telemedicine Portal";
      triage.referral_destination = "e-Sanjeevani";
      triage.referral_reason = "Routine condition manageable via online government telemedicine consultation.";
      triage.recommended_action = "Advise caller to use government e-Sanjeevani portal/app for online doctor consultation.";
    } else if (explicitReferral.includes("pharmacy")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "Empanelled Pharmacy / ESIS Dispensary Store";
      triage.referral_destination = "Nearest Pharmacy";
      triage.referral_reason = "Prescription refill, OTC medication, or first-aid supply guidance.";
      triage.recommended_action = "Guide caller to nearest empanelled chemist for prescribed medications and refills.";
    } else if (explicitReferral.includes("doctor")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "On-Duty Medical Officer Escalation";
      triage.referral_destination = "Forward to Doctor";
      triage.referral_reason = "Clinical ambiguity requiring physician review; forward to on-duty Medical Officer.";
      triage.recommended_action = "Forward call directly to on-duty ESIC Medical Officer workstation.";
    }

    triage.call_referral_primary = triage.call_referral_primary || triage.referral_destination;
    triage.call_referral_secondary = triage.call_referral_secondary || triage.secondary_referral_destination;

    // Ensure red flags strictly reflect caller-reported symptoms without hallucinations
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm)\b/i.test(notes);
    triage.red_flags = summarizeRedFlags(triage.red_flags, notes, isSafe);

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

    // 2. Resolve location & rank nearest facilities (always nearest from pincode, hospital first if severe, dispensary first if normal/moderate)
    const facilities = await getFacilities();
    const resolved_location = resolveCallerLocation(intake, facilities);
    const nearest_facilities = rankNearestFacilities(resolved_location, facilities, 5, isSevere && !isPsychiatricCase);

    const topFacility = nearest_facilities?.[0];
    const hasSpecialReferral =
      triage.referral_destination === "104 Medical Team" ||
      triage.referral_destination === "108 Ambulance" ||
      triage.referral_destination === "Psychological Counselling Department" ||
      triage.referral_destination === "NACO 1097 Helpline" ||
      triage.referral_destination === "e-Sanjeevani" ||
      triage.referral_destination === "Nearest Pharmacy" ||
      triage.referral_destination === "Forward to Doctor" ||
      isPsychiatricCase ||
      explicitReferral.includes("108") ||
      explicitReferral.includes("104") ||
      explicitReferral.includes("sanjeevani") ||
      explicitReferral.includes("pharmacy") ||
      explicitReferral.includes("doctor");

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isAfter7PM = hour >= 19 || hour < 5;

    // Check if direct ESIS or ESIC facility is available in caller vicinity (within 35 km)
    const hasNearbyEsicOrEsis = nearest_facilities.some(
      (f) => !isTieUp(f) && f.distance_km != null && f.distance_km <= 35
    );
    const nearbyTieUp = nearest_facilities.find((f) => isTieUp(f));

    // If neither ESIS nor ESIC facility is available nearby, route to nearest Empanelled Tie-Up Facility
    if (!hasNearbyEsicOrEsis && nearbyTieUp && !hasSpecialReferral) {
      triage.recommended_facility_type = `${nearbyTieUp.name} (Empanelled Tie-Up Facility)`;
      triage.recommended_action = `Refer caller to nearest empanelled tie-up facility: ${nearbyTieUp.name} (${nearbyTieUp.pincode ? `PIN: ${nearbyTieUp.pincode}, ` : ""}${nearbyTieUp.distance_km != null ? `${nearbyTieUp.distance_km} km` : "nearest"}) with Pehchan card for cashless medical treatment as no direct ESIC/ESIS facility is within immediate reach.`;
      triage.referral_destination = nearbyTieUp.name || "Tie-Up Facility";
      triage.call_referral_primary = nearbyTieUp.name || "Tie-Up Facility";
      triage.call_referral_primary_reason = `Direct to nearest empanelled tie-up hospital (${nearbyTieUp.name}) for cashless medical care with Pehchan card.`;
      if (isAfter7PM) {
        triage.call_referral_secondary = "104 Medical Team";
        triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline (Doctor on Call) for immediate tele-consultation over the phone.";
      }
    } else if (topFacility && !hasSpecialReferral) {
      const isTopTieUp = isTieUp(topFacility);
      if (isTopTieUp) {
        triage.recommended_facility_type = `${topFacility.name} (Empanelled Tie-Up Facility)`;
        triage.recommended_action = `Advise patient to visit nearest empanelled tie-up facility: ${topFacility.name} (${topFacility.pincode ? `PIN: ${topFacility.pincode}, ` : ""}${topFacility.distance_km != null ? `${topFacility.distance_km} km` : "nearest"}) with Pehchan card for cashless medical treatment.`;
        triage.referral_destination = topFacility.name || "Tie-Up Facility";
        triage.call_referral_primary = topFacility.name || "Tie-Up Facility";
        triage.call_referral_primary_reason = `Direct to nearest empanelled tie-up hospital (${topFacility.name}) for cashless medical care with Pehchan card.`;
        if (isAfter7PM) {
          triage.call_referral_secondary = "104 Medical Team";
          triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline (Doctor on Call) for tele-consultation over the phone.";
        }
      } else if (isSevere) {
        triage.recommended_facility_type = `${topFacility.name} (Emergency Hospital)`;
        triage.recommended_action = `Advise patient to proceed immediately to ${topFacility.name} (${topFacility.pincode ? `PIN: ${topFacility.pincode}, ` : ""}${topFacility.distance_km != null ? `${topFacility.distance_km} km` : "nearest"}) casualty or emergency OPD.`;
        if (isAfter7PM && !triage.call_referral_secondary) {
          triage.call_referral_secondary = "104 Medical Team";
          triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline (Doctor on Call) for immediate tele-consultation.";
        }
      } else {
        triage.recommended_facility_type = `${topFacility.name} (Primary Care Dispensary)`;
        triage.recommended_action = `Advise patient to visit ${topFacility.name} (${topFacility.pincode ? `PIN: ${topFacility.pincode}, ` : ""}${topFacility.distance_km != null ? `${topFacility.distance_km} km` : "nearest"}) during regular OPD hours for doctor examination and prescription.`;
        if (isAfter7PM && !triage.call_referral_secondary) {
          triage.call_referral_secondary = "104 Medical Team";
          triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline (Doctor on Call) for tele-consultation over the phone.";
        }
      }
    }

    // After 7 PM: Guarantee at least 1 call referral option
    if (isAfter7PM) {
      const p = (triage.call_referral_primary || triage.referral_destination || "").toLowerCase();
      const s = (triage.call_referral_secondary || "").toLowerCase();
      const hasCallOption = p.includes("104") || p.includes("108") || p.includes("call") || p.includes("tele") ||
                            s.includes("104") || s.includes("108") || s.includes("call") || s.includes("tele");
      if (!hasCallOption) {
        triage.call_referral_secondary = "104 Medical Team";
        triage.call_referral_secondary_reason = "After 7:00 PM: Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.";
      }
    }

    if (!triage.referral_destination) {
      triage.referral_destination = isSevere ? "ESIC Hospital" : "ESIS Dispensary";
      triage.referral_reason = triage.referral_reason || triage.recommended_action || "Guided to nearest healthcare facility.";
    }

    const latency_ms = Date.now() - startTime;
    const case_ref = generateCaseRef();

    const casePayload = {
      case_ref,
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
        agent_id: intake.agent_id || null,
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

    // 3. Save to Firebase / storage
    const saved = await saveCase(casePayload);

    return NextResponse.json({
      case_ref,
      case_id: saved.id || case_ref,
      triage,
      resolved_location,
      nearest_facilities,
      ekms_ai_context: casePayload.ekms_ai_context,
      disclaimer: casePayload.disclaimer,
      model_used: casePayload.model_used,
      latency_ms,
    });
  } catch (err) {
    console.error("Triage error:", err);
    return NextResponse.json(
      { detail: `Triage evaluation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
