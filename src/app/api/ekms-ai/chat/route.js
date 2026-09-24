import { NextResponse } from "next/server";
import {
  detectClinicalDomain,
  DOMAIN_LABELS,
  extractSeverityAndDuration,
  getClinicalQuestionData,
  extractClinicalEntities,
  detectSeverityAnswer,
  detectDurationAnswer,
  detectAssociatedAnswer,
} from "@/lib/clinicalAdaptiveEngine";

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

    // If currently at symptom stage, verify that a clear clinical symptom/complaint is present.
    // If not recognized or ambiguous, stay at 'symptom' stage and ask clarifying questions with options.
    if (prevStage === "symptom") {
      const nlp = extractClinicalEntities(prompt, "symptom", currentTriage);
      if (!nlp.primarySymptom) {
        const stepData = getClinicalQuestionData({
          domain: "general",
          stage: "symptom",
          prompt,
          history,
          currentTriage,
        });

        return NextResponse.json({
          agentScript: stepData.agentScript,
          answer: stepData.agentScript,
          options: stepData.options,
          probingQuestions: stepData.probingQuestions,
          stage: "symptom",
          isMultiSelect: false,
          isComplete: false,
          conditionLabel: null,
          detectedSeverity: null,
          detectedDuration: null,
          triageSummary: currentTriage,
          decision: null,
        });
      }
    }

    // Direct Anthropic API call if ANTHROPIC_API_KEY is configured
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 700,
            system: `You are EKMS AI adaptive clinical questioning assistant for ESIC/ESIS Assam call center.
Guide the operator through 4 steps:
Step 1: Symptom
Step 2: Severity
Step 3: Duration
Step 4: Associated (multi-select)
After Step 4 is answered, stage is 'complete'. In 'complete' stage, agentScript MUST be short and what the agent should say to the IP, e.g.: 'Ask the IP: "Please wait for a minute while I check your details and find the nearest facility for you."'

Output strictly valid JSON with keys:
{
  "agentScript": "The script for the agent to speak to the IP",
  "stage": "symptom" | "severity" | "duration" | "associated" | "complete",
  "isMultiSelect": boolean,
  "options": array of strings,
  "probingQuestions": array of 2-3 clinical probing questions in bilingual format 'Hindi (English)',
  "detectedSeverity": integer 1-10,
  "detectedDuration": string matching one of: ["Less than 2 hours", "Today", "1 day", "2-3 days", "4-7 days", "More than a week", "More than a month"],
  "triageSummary": {
    "symptom": string,
    "severity": string,
    "duration": string,
    "associated": array of strings
  }
}`,
            messages: [
              ...history.map((h) => ({
                role: h.role === "bot" || h.role === "assistant" ? "assistant" : "user",
                content: h.content,
              })),
              { role: "user", content: prompt },
            ],
          }),
        });

        if (anthropicRes.ok) {
          const aData = await anthropicRes.json();
          const text = aData.content?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
            const dynamicProbing =
              parsed.probingQuestions && parsed.probingQuestions.length > 0
                ? parsed.probingQuestions
                : getClinicalQuestionData({
                    domain,
                    stage: parsed.stage || "severity",
                    prompt,
                    history,
                    currentTriage: { ...currentTriage, condition: conditionLabel },
                  }).probingQuestions;

            return NextResponse.json({
              ...parsed,
              probingQuestions: dynamicProbing,
              conditionLabel,
              detectedSeverity: parsed.detectedSeverity || detectedSeverity,
              detectedDuration: parsed.detectedDuration || detectedDuration,
            });
          }
        }
      } catch (aErr) {
        console.warn("Direct Anthropic chat call notice:", aErr.message);
      }
    }

    // Advance through the 4-step adaptive clinical flow
    let nextStage = "severity";
    let isMultiSelect = false;
    let agentScript = "";
    let options = [];
    let probingQuestions = [];
    let isComplete = false;

    let triageSummary = {
      symptom: currentTriage.symptom || prompt,
      severity: currentTriage.severity || null,
      duration: currentTriage.duration || null,
      associated: Array.isArray(currentTriage.associated) ? [...currentTriage.associated] : [],
      condition: currentTriage.condition || conditionLabel,
      domain,
    };

    if (prevStage === "symptom") {
      // Transition to Step 2: Severity
      const nlp = extractClinicalEntities(prompt, "symptom", currentTriage);
      nextStage = "severity";
      triageSummary.symptom = nlp.primarySymptom || prompt;
      triageSummary.condition = nlp.conditionLabel || conditionLabel;
      triageSummary.domain = nlp.domain || domain;

      const stepData = getClinicalQuestionData({
        domain: triageSummary.domain,
        stage: "severity",
        prompt,
        history,
        currentTriage: triageSummary,
      });

      agentScript = stepData.agentScript;
      options = stepData.options;
      probingQuestions = stepData.probingQuestions;
    } else if (prevStage === "severity") {
      const currentStepData = getClinicalQuestionData({
        domain,
        stage: "severity",
        prompt,
        history,
        currentTriage: triageSummary,
      });

      const detectedSev = detectSeverityAnswer(prompt, currentStepData.options || []);
      const detectedDur = detectDurationAnswer(prompt, []);

      if (detectedDur && !triageSummary.duration) {
        triageSummary.duration = detectedDur;
      }

      if (!detectedSev) {
        nextStage = "severity";
        agentScript =
          "Ask the IP: 'Could you please rate or describe how severe the symptoms are? (Is it High, Moderate, or Mild?)'";
        options = currentStepData.options || ["High", "Moderate", "Mild"];
        probingQuestions = currentStepData.probingQuestions || [];
      } else {
        const sevLabel = detectedSev.label || String(detectedSev);
        const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
        triageSummary.severity = sevLabel;
        detectedSeverity = sevScore;
        if (!triageSummary.duration) {
          nextStage = "duration";
          const durStepData = getClinicalQuestionData({
            domain,
            stage: "duration",
            prompt,
            history,
            currentTriage: triageSummary,
          });
          agentScript = durStepData.agentScript;
          options = durStepData.options;
          probingQuestions = durStepData.probingQuestions;
        } else {
          nextStage = "associated";
          isMultiSelect = true;
          const assocStepData = getClinicalQuestionData({
            domain,
            stage: "associated",
            prompt,
            history,
            currentTriage: triageSummary,
          });
          agentScript = assocStepData.agentScript;
          options = assocStepData.options;
          probingQuestions = assocStepData.probingQuestions;
        }
      }
    } else if (prevStage === "duration") {
      const currentStepData = getClinicalQuestionData({
        domain,
        stage: "duration",
        prompt,
        history,
        currentTriage: triageSummary,
      });

      const detectedDur = detectDurationAnswer(prompt, currentStepData.options || []);

      if (!detectedDur) {
        nextStage = "duration";
        agentScript =
          "Ask the IP: 'Could you please specify how long you have had this condition? Exactly when did it start?'";
        options = currentStepData.options || [
          "Less than 2 hours (Sudden / Recent)",
          "Today (A few hours)",
          "1 day (Started yesterday)",
          "2-3 days",
          "4-7 days",
          "More than a week",
        ];
        probingQuestions = currentStepData.probingQuestions || [];
      } else {
        triageSummary.duration = detectedDur;
        detectedDuration = detectedDur;
        nextStage = "associated";
        isMultiSelect = true;

        const assocStepData = getClinicalQuestionData({
          domain,
          stage: "associated",
          prompt,
          history,
          currentTriage: triageSummary,
        });
        agentScript = assocStepData.agentScript;
        options = assocStepData.options;
        probingQuestions = assocStepData.probingQuestions;
      }
    } else if (prevStage === "associated") {
      const nlp = extractClinicalEntities(prompt, "associated", currentTriage);
      const lower = prompt.toLowerCase();
      const detectedDur = detectDurationAnswer(prompt, []);
      const isNoneOrNegative =
        lower.includes("none") ||
        lower.includes("nahi") ||
        lower.includes("no other") ||
        lower.includes("kuch nahi") ||
        lower.includes("not present") ||
        lower.includes("nothing else");

      const currentStepData = getClinicalQuestionData({
        domain,
        stage: "associated",
        prompt,
        history,
        currentTriage: triageSummary,
      });

      if (detectedDur && !isNoneOrNegative && (!nlp.companionSymptoms || nlp.companionSymptoms.length === 0)) {
        triageSummary.duration = detectedDur;
        nextStage = "associated";
        isMultiSelect = true;
        agentScript = `Ask the IP: "Duration noted as ${detectedDur}. Are you experiencing any of these companion symptoms? (Select all that apply)"`;
        options = currentStepData.options;
        probingQuestions = currentStepData.probingQuestions;
      } else {
        const detectedAssoc = detectAssociatedAnswer(prompt, currentStepData.options || [], nlp.companionSymptoms);

        if (!detectedAssoc) {
          nextStage = "associated";
          isMultiSelect = true;
          agentScript =
            "Ask the IP: 'Are you experiencing any companion symptoms? (Please select from the options below or select None of these)'";
          options = currentStepData.options;
          probingQuestions = currentStepData.probingQuestions;
        } else {
          nextStage = "complete";
          isComplete = true;
          triageSummary.associated = Array.from(new Set([...(currentTriage.associated || []), ...detectedAssoc.items]));
          agentScript =
            'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."';
          options = [];
          probingQuestions = [];
        }
      }
    } else if (prevStage === "complete") {
      nextStage = "complete";
      isComplete = true;
      agentScript =
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."';
      options = [];
      probingQuestions = [];
    }

    return NextResponse.json({
      agentScript,
      answer: agentScript,
      options,
      probingQuestions,
      stage: nextStage,
      isMultiSelect,
      isComplete,
      isReadyToShowResult: nextStage === "complete",
      conditionLabel,
      detectedSeverity,
      detectedDuration,
      triageSummary,
      decision: triageSummary.condition ? { condition: triageSummary.condition } : null,
    });
  } catch (err) {
    console.error("EKMS AI chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

