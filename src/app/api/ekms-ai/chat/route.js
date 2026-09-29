import { NextResponse } from "next/server";
import { processDoctorConsultationTurn } from "@/lib/doctorChatEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      is_dual_protocol: doctorResult.is_dual_protocol || false,
      call_referral_secondary: doctorResult.call_referral_secondary || null,
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
    return NextResponse.json({
      probingQuestion: 'Ask the IP: "Since when have you been having these symptoms, and how severe is the discomfort?" (Hinglish: "Yeh takleef kab se shuru hui hai aur kitna zyada dard/pareshani mehsoos ho rahi hai?")',
      agentScript: 'Ask the IP: "Since when have you been having these symptoms, and how severe is the discomfort?" (Hinglish: "Yeh takleef kab se shuru hui hai aur kitna zyada dard/pareshani mehsoos ho rahi hai?")',
      answer: 'Ask the IP: "Since when have you been having these symptoms, and how severe is the discomfort?" (Hinglish: "Yeh takleef kab se shuru hui hai aur kitna zyada dard/pareshani mehsoos ho rahi hai?")',
      options: ["Started today", "1-2 days ago", "Mild discomfort", "Severe pain / distress"],
      suggestedAnswers: ["Started today", "1-2 days ago", "Mild discomfort", "Severe pain / distress"],
      suspectedCondition: "Clinical Evaluation",
      severity: "Moderate",
      severityScore: 5,
      redFlagsDetected: [],
      referralDestination: "104 Health Helpline",
      referralReason: "Connect with 104 Health Helpline for tele-doctor consultation.",
      isPsychiatric: false,
      is_dual_protocol: false,
      call_referral_secondary: "ESIC Hospital",
      clinicalSummary: "Clinical consultation in progress.",
      isReadyForSummary: false,
      triageSummary: {
        symptom: "Reported symptoms",
        condition: "Clinical Evaluation",
        severity: "Moderate",
        duration: "Reported today",
        medication: "None",
        associated: [],
        referralDestination: "104 Health Helpline",
        isPsychiatric: false,
      },
      decision: { condition: "Clinical Evaluation" },
    }, { status: 200 });
  }
}
