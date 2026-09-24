import { NextResponse } from "next/server";
import {
  detectClinicalDomain,
  DOMAIN_LABELS,
  extractSeverityAndDuration,
  getClinicalQuestionData,
  getDiseaseProbingProtocol,
  extractClinicalEntities,
  detectSeverityAnswer,
  detectMedicationAnswer,
  detectDurationAnswer,
  detectAssociatedAnswer,
} from "@/lib/clinicalAdaptiveEngine";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      prompt,
      lastAnswer = "",
      history = [],
      sessionId = "session-" + Date.now(),
      currentTriage = {},
      currentStage = "symptom",
    } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Combine all conversation text to perform accurate whole-dialogue symptom detection
    const fullConversationText = [
      ...history.map((h) => h.content || ""),
      prompt,
    ].join(" ");

    let { detectedSeverity, detectedDuration } = extractSeverityAndDuration(fullConversationText);
    const domain = detectClinicalDomain(fullConversationText, currentTriage);
    const conditionLabel = DOMAIN_LABELS[domain] || "General Medical Complaint";

    const prevStage = currentStage || currentTriage?.stage || "symptom";
    let nextStage = prevStage;
    let agentScript = "";
    let options = [];
    let probingQuestions = [];
    let isMultiSelect = false;
    let isComplete = false;

    let triageSummary = {
      symptom: currentTriage.symptom || null,
      severity: currentTriage.severity || null,
      medication: currentTriage.medication || null,
      duration: currentTriage.duration || null,
      associated: Array.isArray(currentTriage.associated) ? [...currentTriage.associated] : [],
      condition: currentTriage.condition || conditionLabel,
      domain: currentTriage.domain || domain,
      probingStepIndex: typeof currentTriage.probingStepIndex === "number" ? currentTriage.probingStepIndex : 0,
    };

    if (prevStage === "symptom") {
      const nlp = extractClinicalEntities(prompt, "symptom", currentTriage);
      if (!nlp.primarySymptom) {
        // Clarify symptom
        const stepData = getClinicalQuestionData({
          domain: "general",
          stage: "symptom",
          prompt,
          history,
          currentTriage,
        });

        return NextResponse.json({
          agentScript: stepData.agentScript.replace(/Doctor Probing:\s*/gi, ""),
          answer: stepData.agentScript.replace(/Doctor Probing:\s*/gi, ""),
          options: stepData.options,
          probingQuestions: stepData.probingQuestions,
          stage: "symptom",
          isMultiSelect: false,
          isComplete: false,
          conditionLabel: null,
          detectedSeverity: null,
          detectedMedication: null,
          detectedDuration: null,
          triageSummary,
          decision: null,
        });
      }

      triageSummary.symptom = nlp.primarySymptom || prompt;
      triageSummary.condition = nlp.conditionLabel || conditionLabel;
      triageSummary.domain = nlp.domain || domain;
      triageSummary.probingStepIndex = 0;
      nextStage = "probing_0";

      const stepData = getClinicalQuestionData({
        domain: triageSummary.domain,
        stage: "probing_0",
        prompt,
        history,
        currentTriage: triageSummary,
      });

      agentScript = stepData.agentScript.replace(/Doctor Probing:\s*/gi, "");
      options = stepData.options;
      probingQuestions = stepData.probingQuestions;
    } else if (prevStage !== "complete") {
      const lower = prompt.toLowerCase();

      // Detect severity
      if (
        /emergency|red flag|critical|fracture|dvt|cellulitis|blood|coffee|unconscious|unable to put any weight|unable to walk|shivering & rigors|severe/i.test(lower)
      ) {
        triageSummary.severity = "High";
        detectedSeverity = 9;
      } else if (/moderate|sprain|limp|bile|body ache/i.test(lower)) {
        if (!triageSummary.severity || triageSummary.severity === "Mild") {
          triageSummary.severity = "Moderate";
          detectedSeverity = 6;
        }
      } else if (/mild|no blood|no trauma|no swelling|manageable|no calf|clear/i.test(lower)) {
        if (!triageSummary.severity) {
          triageSummary.severity = "Mild";
          detectedSeverity = 3;
        }
      } else {
        const detectedSev = detectSeverityAnswer(prompt, []);
        if (detectedSev) {
          const sevLabel = detectedSev.label || String(detectedSev);
          triageSummary.severity = sevLabel;
          detectedSeverity = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
        }
      }

      // Detect duration
      const detectedDur = detectDurationAnswer(prompt, []);
      if (detectedDur) {
        triageSummary.duration = detectedDur;
        detectedDuration = detectedDur;
      }

      // Detect medication
      const detectedMed = detectMedicationAnswer(prompt, []);
      if (detectedMed && !detectedMed.isBareYes) {
        triageSummary.medication = detectedMed.text;
      } else if (/paracetamol|dolo|crocin|aspirin|sorbitrate|ondansetron|vomikind|ors|antibiotic|insulin|inhaler/i.test(lower)) {
        triageSummary.medication = prompt;
      } else if (/no medication|no medicine|nahi li|kuch nahi|not taken/i.test(lower)) {
        triageSummary.medication = "No medications taken";
      }

      // Detect companion symptoms
      const nlp = extractClinicalEntities(prompt, "probing", currentTriage);
      if (nlp.companionSymptoms?.length > 0) {
        triageSummary.associated = Array.from(new Set([...triageSummary.associated, ...nlp.companionSymptoms]));
      }

      // Advance to next step in the protocol
      const curIdx = typeof currentTriage?.probingStepIndex === "number" ? currentTriage.probingStepIndex : 0;
      const nextIdx = curIdx + 1;
      const protocol = getDiseaseProbingProtocol(triageSummary.domain, triageSummary);

      if (nextIdx < protocol.length) {
        triageSummary.probingStepIndex = nextIdx;
        nextStage = "probing_" + nextIdx;
        const stepData = getClinicalQuestionData({
          domain: triageSummary.domain,
          stage: nextStage,
          prompt,
          history,
          currentTriage: triageSummary,
        });
        agentScript = stepData.agentScript.replace(/Doctor Probing:\s*/gi, "");
        options = stepData.options;
        probingQuestions = stepData.probingQuestions;
      } else {
        triageSummary.probingStepIndex = protocol.length;
        nextStage = "complete";
        isComplete = true;
        agentScript =
          'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."';
        options = [];
        probingQuestions = [];
      }
    } else {
      nextStage = "complete";
      isComplete = true;
      agentScript =
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."';
      options = [];
      probingQuestions = [];
    }

    const currentProbingData = getClinicalQuestionData({
      domain: triageSummary.domain,
      stage: nextStage,
      prompt,
      history,
      currentTriage: triageSummary,
    });

    return NextResponse.json({
      agentScript,
      answer: agentScript,
      options,
      probingQuestions: currentProbingData.probingQuestions || probingQuestions,
      probingQuestionsWithAnswers: nextStage === "complete" ? [] : (currentProbingData.probingQuestionsWithAnswers || []),
      stage: nextStage,
      isMultiSelect,
      isComplete,
      isReadyToShowResult: nextStage === "complete",
      conditionLabel: triageSummary.condition,
      detectedSeverity: detectedSeverity || (triageSummary.severity === "High" ? 9 : triageSummary.severity === "Moderate" ? 6 : 3),
      detectedMedication: triageSummary.medication,
      detectedDuration: triageSummary.duration || detectedDuration,
      triageSummary,
      decision: triageSummary.condition ? { condition: triageSummary.condition } : null,
    });
  } catch (err) {
    console.error("EKMS AI chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
