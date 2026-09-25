import { NextResponse } from "next/server";
import { getFacilities } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const facilities = await getFacilities();
  const districts = [...new Set(facilities.map((f) => f.district).filter(Boolean))].sort();
  const pincodes = [...new Set(facilities.map((f) => f.pincode).filter(Boolean))].sort();
  const facility_types = [
    ...new Set(
      facilities
        .map((f) => (f.facility_type === "Tie-Up Hospital" ? "Tie-Up Facility" : f.facility_type))
        .filter(Boolean)
    ),
  ].sort();

  return NextResponse.json({
    districts,
    pincodes,
    facility_types,
    facility_count: facilities.length,
    urgency_levels: ["Emergency", "Urgent", "Routine", "Self-care"],
    durations: [
      "Less than 2 hours",
      "Today",
      "1 day",
      "2-3 days",
      "4-7 days",
      "More than a week",
      "More than a month",
    ],
    model: "anthropic/claude-sonnet-4-6",
  });
}
