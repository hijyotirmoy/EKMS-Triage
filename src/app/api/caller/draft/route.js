import { NextResponse } from "next/server";
import { getCases, saveCase } from "@/lib/db";
import { generateNextCaseRef } from "@/lib/caseId";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = body.phone ? String(body.phone).trim() : "";
    const cleanPhone = phone.replace(/\D/g, "");

    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json({ success: false, detail: "10-digit phone number required" }, { status: 400 });
    }

    const caller_name = body.caller_name || "Caller";
    const symptom_notes = body.symptom_notes || "Triage consultation in progress";
    const severity_reported = Number(body.severity_reported) || 5;

    // Retrieve existing cases to generate case_ref
    let existingCases = [];
    try {
      existingCases = (await getCases().catch(() => [])) || [];
    } catch {
      existingCases = [];
    }

    // Check if an existing case for this phone already exists within the last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const query10 = cleanPhone.slice(-10);
    const recentCase = existingCases.find((c) => {
      const cp = String(c.intake?.phone || "").replace(/\D/g, "");
      const cp10 = cp.length >= 10 ? cp.slice(-10) : "";
      return cp10.length === 10 && cp10 === query10 && (c.created_at || "") > tenMinAgo;
    });

    if (recentCase) {
      return NextResponse.json({
        success: true,
        reused: true,
        case_ref: recentCase.case_ref,
      });
    }

    const case_ref = generateNextCaseRef(existingCases, phone);
    const urgency_level = severity_reported >= 8 ? "Emergency" : (severity_reported >= 5 ? "Urgent" : "Routine");

    const draftRecord = {
      case_ref,
      agent_id: body.agent_id || "A1",
      intake: {
        caller_name: caller_name,
        phone: phone,
        age: body.age != null && body.age !== "" ? Number(body.age) : null,
        sex: body.sex || null,
        symptom_notes: symptom_notes,
        duration: body.duration || null,
        severity_reported: severity_reported,
        city: body.city || null,
        district: body.district || null,
        pincode: body.pincode || null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        source_app: "console_draft",
      },
      triage: {
        urgency_level: urgency_level,
        urgency_score: severity_reported,
        confidence: "medium",
        summary_en: `${caller_name} reports ${symptom_notes}. Case recorded in triage.`,
        summary_hi: "लक्षण दर्ज किए गए।",
        primary_complaint: symptom_notes.slice(0, 100),
        reasoning: "Triage session recorded in database.",
        red_flags: body.red_flags || [],
        recommended_action: "Proceed with clinical triage consultation.",
        recommended_facility_type: "ESIS Dispensary / 104 Health Helpline",
      },
      resolved_location: body.city || body.district ? { matched: body.city || body.district } : null,
      nearest_facilities: [],
      ekms_ai_context: body.ekms_ai_context || null,
      created_at: new Date().toISOString(),
    };

    const saved = await saveCase(draftRecord);
    return NextResponse.json({
      success: true,
      case_ref,
      case_id: saved.id || case_ref,
      case: draftRecord,
    });
  } catch (err) {
    console.warn("Draft save non-fatal error:", err.message);
    return NextResponse.json({ success: false, detail: err.message }, { status: 500 });
  }
}
