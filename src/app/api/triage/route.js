import { NextResponse } from "next/server";
import { getFacilities, saveCase } from "@/lib/db";
import { resolveCallerLocation, rankNearestFacilities } from "@/lib/geo";
import { evaluateTriage } from "@/lib/triageEngine";

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

    // Prioritize appropriate channel based on clinical presentation
    if (isPsychiatricCase) {
      triage.is_psychiatric = true;
      triage.call_108 = false;
      triage.recommended_facility_type = "Psychological Counselling Department / Tele-MANAS (14416)";
      triage.recommended_action =
        "Transfer call immediately to Psychological Counselling Department or Toll-Free 14416 (National Tele-MANAS). Speak with calm empathy and do not disconnect.";
    } else if (explicitReferral.includes("108")) {
      triage.call_108 = true;
      triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
      triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    } else if (explicitReferral.includes("104")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
      triage.recommended_action = "Transfer call to 104 Health Helpline queue for tele-doctor consultation.";
    } else if (explicitReferral.includes("sanjeevani")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "e-Sanjeevani National Telemedicine Portal";
      triage.recommended_action = "Advise caller to use government e-Sanjeevani portal/app for online doctor consultation.";
    } else if (explicitReferral.includes("pharmacy")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "Empanelled Pharmacy / ESIS Dispensary Store";
      triage.recommended_action = "Guide caller to nearest empanelled chemist for prescribed medications and refills.";
    } else if (explicitReferral.includes("doctor")) {
      triage.call_108 = false;
      triage.recommended_facility_type = "On-Duty Medical Officer Escalation";
      triage.recommended_action = "Forward call directly to on-duty ESIC Medical Officer workstation.";
    } else if (isSevere) {
      triage.recommended_facility_type = "Nearest ESIC Hospital / Emergency Casualty";
      if (!triage.recommended_action || !triage.recommended_action.toLowerCase().includes("hospital")) {
        triage.recommended_action = "Advise patient to proceed immediately to the nearest ESIC Hospital casualty or urgent OPD today.";
      }
    }

    // 2. Resolve location & rank nearest facilities (always nearest from pincode, hospital first if severe physical case)
    const facilities = await getFacilities();
    const resolved_location = resolveCallerLocation(intake, facilities);
    const nearest_facilities = rankNearestFacilities(resolved_location, facilities, 5, isSevere && !isPsychiatricCase);

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
