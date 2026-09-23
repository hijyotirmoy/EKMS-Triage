import { NextResponse } from "next/server";
import { getFacilities, saveCase } from "@/lib/db";
import { resolveCallerLocation, rankNearestFacilities } from "@/lib/geo";
import { evaluateTriage } from "@/lib/triageEngine";

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

    // 1. Resolve location & rank nearest facilities
    const facilities = await getFacilities();
    const resolved_location = resolveCallerLocation(intake, facilities);
    const nearest_facilities = rankNearestFacilities(resolved_location, facilities, 5);

    // 2. Perform clinical triage evaluation
    const triage = await evaluateTriage(intake);

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
