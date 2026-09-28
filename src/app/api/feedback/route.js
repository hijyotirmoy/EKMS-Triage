import { NextResponse } from "next/server";
import {
  saveAgentFeedback,
  getLearningSystemStats,
  loadFeedbackFromDb,
  deleteFeedbackRule,
  getAllFeedbackRules,
} from "@/lib/feedbackLearningEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    await loadFeedbackFromDb();
    const stats = getLearningSystemStats();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const paginated = await getAllFeedbackRules(page, limit);

    return NextResponse.json({
      status: "ok",
      ...paginated,
      stats,
      totalFeedback: stats.totalFeedback,
      correctionsCount: stats.correctionsCount,
      positiveValidationCount: stats.positiveValidationCount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
    }

    const result = await saveAgentFeedback(body);
    const stats = getLearningSystemStats();

    return NextResponse.json({
      success: true,
      feedback: result.feedback,
      stats,
      totalFeedback: stats.totalFeedback,
      correctionsCount: stats.correctionsCount,
    });
  } catch (err) {
    console.error("[Feedback API Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Missing rule ID to delete" }, { status: 400 });
    }

    const res = await deleteFeedbackRule(id);
    const stats = getLearningSystemStats();

    return NextResponse.json({
      success: true,
      message: "Feedback rule deleted and unlearned successfully",
      id,
      stats,
      correctionsCount: stats.correctionsCount,
    });
  } catch (err) {
    console.error("[Feedback API DELETE Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

