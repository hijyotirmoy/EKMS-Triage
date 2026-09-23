import { NextResponse } from "next/server";
import { getCases } from "@/lib/db";

function normalizePhone(p) {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get("phone") || "";
  const queryPhone = normalizePhone(rawPhone);

  if (!queryPhone || queryPhone.length < 6) {
    return NextResponse.json({ found: false, detail: "Invalid or missing phone number" });
  }

  try {
    const allCases = await getCases();
    // Cases are sorted descending by created_at, find all matching cases for this caller
    const matchingCases = allCases.filter((c) => {
      const casePhone = normalizePhone(c.intake?.phone);
      if (!casePhone) return false;
      return casePhone === queryPhone;
    });

    if (matchingCases.length === 0) {
      return NextResponse.json({ found: false });
    }

    const latest = matchingCases[0];
    const intake = latest.intake || {};
    const resLoc = latest.resolved_location || {};

    const history = matchingCases.map((c) => ({
      case_ref: c.case_ref || "",
      created_at: c.created_at || "",
      caller_name: c.intake?.caller_name || "",
      reason: c.intake?.symptom_notes || c.triage?.summary_en || "",
      summary: c.triage?.summary_en || "",
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
        caller_name: intake.caller_name || "",
        phone: intake.phone || rawPhone,
        age: intake.age != null ? String(intake.age) : "",
        sex: intake.sex || "",
        city: intake.city || "",
        district: intake.district || "",
        pincode: intake.pincode || "",
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
    return NextResponse.json({ found: false, error: err.message }, { status: 500 });
  }
}
