import { NextResponse } from "next/server";
import { getFacilities, deleteFacilities } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const district = searchParams.get("district") || "all";
  const facility_type = searchParams.get("facility_type") || "all";

  const list = await getFacilities({ q, district, facility_type });
  return NextResponse.json(list);
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids
      : body?.id
      ? [body.id]
      : [];

    if (!ids.length) {
      return NextResponse.json(
        { detail: "No facility IDs specified for deletion" },
        { status: 400 }
      );
    }

    const deleted = await deleteFacilities(ids);
    return NextResponse.json({
      success: true,
      deleted,
      message: `Successfully deleted ${deleted} facilities`,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Failed to delete facilities: ${err.message}` },
      { status: 500 }
    );
  }
}

