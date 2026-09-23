import { NextResponse } from "next/server";
import { getFacilities } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const district = searchParams.get("district") || "all";
  const facility_type = searchParams.get("facility_type") || "all";

  const list = await getFacilities({ q, district, facility_type });
  return NextResponse.json(list);
}
