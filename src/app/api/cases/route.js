import { NextResponse } from "next/server";
import { getCases, deleteCases } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const urgency = searchParams.get("urgency") || "all";
  const q = searchParams.get("q") || "";

  const cases = await getCases({ urgency, q });
  return NextResponse.json(cases, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const refs = Array.isArray(body?.case_refs)
      ? body.case_refs
      : body?.case_ref
      ? [body.case_ref]
      : [];

    if (!refs.length) {
      return NextResponse.json(
        { detail: "No case references provided for deletion" },
        { status: 400 }
      );
    }

    const count = await deleteCases(refs);
    return NextResponse.json({
      success: true,
      deleted: count,
      message: `Successfully deleted ${count} cases`,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Failed to delete cases: ${err.message}` },
      { status: 500 }
    );
  }
}

