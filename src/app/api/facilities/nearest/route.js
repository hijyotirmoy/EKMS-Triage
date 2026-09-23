import { NextResponse } from "next/server";
import { getFacilities } from "@/lib/db";
import { resolveCallerLocation, rankNearestFacilities } from "@/lib/geo";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("latitude");
  const lon = searchParams.get("longitude");
  const pincode = searchParams.get("pincode");
  const district = searchParams.get("district");
  const city = searchParams.get("city");

  const facilities = await getFacilities();
  const callerLoc = resolveCallerLocation(
    { latitude: lat, longitude: lon, pincode, district, city },
    facilities
  );

  const nearest = rankNearestFacilities(callerLoc, facilities, 5);

  return NextResponse.json({
    resolved_location: callerLoc,
    nearest_facilities: nearest,
  });
}
