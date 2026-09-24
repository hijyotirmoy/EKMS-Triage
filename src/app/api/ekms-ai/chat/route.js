import { NextResponse } from "next/server";
import { processDoctorConsultationTurn } from "@/lib/doctorChatEngine";

export async function POST(request) {
  try {
    const body = await request.json();
    const inputPrompt = body.prompt || body.message;

    if (!inputPrompt || typeof inputPrompt !== "string" || inputPrompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const {
      history = [],
      sessionId = "session-" + Date.now(),
      currentClinicalState = {},
      currentTriage = {},
    } = body;

    const state = {
      ...currentTriage,
      ...currentClinicalState,
    };

    const doctorResult = await processDoctorConsultationTurn({
      message: inputPrompt,
      history,
      currentClinicalState: state,
    });

    return NextResponse.json({
      probingQuestion: doctorResult.probingQuestion,
      agentScript: doctorResult.probingQuestion,
      answer: doctorResult.probingQuestion,
      options: doctorResult.suggestedAnswers,
      suggestedAnswers: doctorResult.suggestedAnswers,
      suspectedCondition: doctorResult.suspectedCondition,
      differentialDiagnosis: doctorResult.differentialDiagnosis,
      severity: doctorResult.severity,
      severityScore: doctorResult.severityScore,
      redFlagsDetected: doctorResult.redFlagsDetected,
      referralDestination: doctorResult.referralDestination,
      referralReason: doctorResult.referralReason,
      isPsychiatric: doctorResult.isPsychiatric,
      clinicalSummary: doctorResult.clinicalSummary,
      isReadyForSummary: doctorResult.isReadyForSummary,
      triageSummary: {
        symptom: state.symptom || doctorResult.suspectedCondition,
        condition: doctorResult.suspectedCondition,
        severity: doctorResult.severity,
        duration: doctorResult.duration,
        medication: doctorResult.medication,
        associated: doctorResult.redFlagsDetected,
        referralDestination: doctorResult.referralDestination,
        isPsychiatric: doctorResult.isPsychiatric,
      },
      decision: { condition: doctorResult.suspectedCondition },
    });
  } catch (err) {
    console.error("Doctor Chat API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
