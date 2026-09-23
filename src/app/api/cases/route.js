import { NextResponse } from "next/server";
import { getCases } from "@/lib/db";

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

