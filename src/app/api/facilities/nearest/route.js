import { NextResponse } from "next/server";
import { getFacilities } from "@/lib/db";
import { resolveCallerLocation, rankNearestFacilities } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("latitude");
    const lon = searchParams.get("longitude");
    const pincode = searchParams.get("pincode");
    const district = searchParams.get("district");
    const city = searchParams.get("city");

    const facilities = (await getFacilities().catch(() => [])) || [];
    const callerLoc = resolveCallerLocation(
      { latitude: lat, longitude: lon, pincode, district, city },
      facilities
    );

    const isSevere =
      searchParams.get("severe") === "true" ||
      Number(searchParams.get("severity") || 0) >= 7 ||
      ["emergency", "urgent", "high"].includes(
        (searchParams.get("urgency") || "").toLowerCase()
      );

    const nearest = rankNearestFacilities(callerLoc, facilities, 6, isSevere);

    return NextResponse.json({
      resolved_location: callerLoc,
      nearest_facilities: nearest,
    });
  } catch (err) {
    console.error("Facilities nearest API error:", err);
    return NextResponse.json({
      resolved_location: {
        latitude: 26.1217525702644,
        longitude: 91.8085511242569,
        pincode: "781022",
        district: "Kamrup Metropolitan",
        method: "default",
        matched: "ESIC Hospital Beltola (781022)",
      },
      nearest_facilities: [],
    }, { status: 200 });
  }
}
