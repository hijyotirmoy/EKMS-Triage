import { NextResponse } from "next/server";
import { getCaseByRef } from "@/lib/db";

export async function GET(request, { params }) {
  const { case_ref } = params;
  const caseItem = await getCaseByRef(case_ref);

  if (!caseItem) {
    return NextResponse.json({ detail: "Case not found" }, { status: 404 });
  }

  return NextResponse.json(caseItem);
}
