import { NextResponse } from "next/server";
import { getCaseStats } from "@/lib/db";

export async function GET() {
  const stats = await getCaseStats();
  return NextResponse.json(stats);
}
