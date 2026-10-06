import { NextResponse } from "next/server";
import { getCases } from "@/lib/db";
import { getCallerIdForPhone } from "@/lib/callerId";

function normalizePhone(p) {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function cleanNameOrField(val) {
  if (!val) return "";
  const trimmed = String(val).trim();
  if (
    trimmed === "." ||
    trimmed === "," ||
    trimmed === ";" ||
    trimmed === "'" ||
    trimmed === '"' ||
    trimmed === "-" ||
    trimmed === "--" ||
    trimmed.toLowerCase() === "n/a" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return "";
  }
  return trimmed;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get("phone") || "";
  const queryPhone = normalizePhone(rawPhone);

  if (!queryPhone || queryPhone.length !== 10) {
    return NextResponse.json({ found: false, detail: "Phone number must be at least 10 digits" });
  }

  try {
    const allCases = await getCases();
    // Cases are sorted descending by created_at, find all matching cases for this caller
    const matchingCases = allCases.filter((c) => {
      const casePhone = normalizePhone(c.intake?.phone);
      if (!casePhone || casePhone.length !== 10) return false;
      return casePhone === queryPhone;
    });

    const callerId = getCallerIdForPhone(queryPhone, allCases);

    if (matchingCases.length === 0) {
      return NextResponse.json({ found: false, caller_id: callerId });
    }

    // Sort descending by created_at so most recent is first
    matchingCases.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const latest = matchingCases[0];
    const intake = latest.intake || {};
    const resLoc = latest.resolved_location || {};

    const history = matchingCases.map((c) => ({
      case_ref: c.case_ref || "",
      caller_id: c.caller_id || c.intake?.caller_id || callerId,
      created_at: c.created_at || "",
      caller_name: c.intake?.caller_name || "",
      chief_complaint: c.triage?.primary_complaint || c.intake?.symptom_notes || c.triage?.summary_en || "",
      reason: c.intake?.symptom_notes || c.triage?.summary_en || "",
      summary: c.triage?.summary_en || "",
      red_flags: Array.isArray(c.triage?.red_flags) && c.triage.red_flags.length > 0
        ? c.triage.red_flags
        : (c.ekms_ai_context?.triageState?.redFlagsDetected || []),
      urgency_level: c.triage?.urgency_level || "Routine",
      urgency_score: c.triage?.urgency_score || 0,
      navigation: c.triage?.recommended_action || c.triage?.recommended_facility_type || "",
      recommended_action: c.triage?.recommended_action || "",
      recommended_facility_type: c.triage?.recommended_facility_type || "",
      nearest_facility: c.nearest_facilities?.[0]?.name || "",
      severity_reported: c.intake?.severity_reported,
      duration: c.intake?.duration,
    }));

    return NextResponse.json({
      found: true,
      caller: {
        caller_name: cleanNameOrField(intake.caller_name),
        phone: rawPhone,
        caller_id: latest.caller_id || latest.intake?.caller_id || callerId,
        age: cleanNameOrField(intake.age),
        sex: cleanNameOrField(intake.sex),
        city: cleanNameOrField(intake.city),
        district: cleanNameOrField(intake.district),
        pincode: cleanNameOrField(intake.pincode),
        latitude: intake.latitude != null ? String(intake.latitude) : (resLoc.latitude != null ? String(resLoc.latitude) : ""),
        longitude: intake.longitude != null ? String(intake.longitude) : (resLoc.longitude != null ? String(resLoc.longitude) : ""),
        last_case_ref: latest.case_ref || "",
        last_case_date: latest.created_at || "",
        case_count: matchingCases.length,
      },
      history,
    });
  } catch (err) {
    console.error("Caller lookup error:", err);
    return NextResponse.json({ found: false, history: [] }, { status: 200 });
  }
}
