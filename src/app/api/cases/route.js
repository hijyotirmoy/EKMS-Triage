import { NextResponse } from "next/server";
import { getCases, deleteCases, updateCase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const urgency = searchParams.get("urgency") || "all";
  const q = searchParams.get("q") || "";
  const since = searchParams.get("since") || null;

  const cases = await getCases({ urgency, q, since });
  return NextResponse.json(cases, {
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
    },
  });
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const caseRef = body?.case_ref || body?.id;
    if (!caseRef) {
      return NextResponse.json(
        { detail: "No case reference or ID provided for update" },
        { status: 400 }
      );
    }
    const updates = body?.updates || body;
    const updated = await updateCase(caseRef, updates);
    return NextResponse.json({
      success: true,
      case: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Failed to update case: ${err.message}` },
      { status: 500 }
    );
  }
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

