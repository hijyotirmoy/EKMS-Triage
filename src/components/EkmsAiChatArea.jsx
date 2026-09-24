"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, RotateCcw, Sparkles, CheckCircle2, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";
import {
  extractClinicalEntities,
  getClinicalQuestionData,
  getDiseaseProbingProtocol,
  detectSeverityAnswer,
  detectMedicationAnswer,
  detectDurationAnswer,
  detectAssociatedAnswer,
  CLINICAL_DOMAINS,
  DOMAIN_LABELS,
} from "@/lib/clinicalAdaptiveEngine";

const INITIAL_SYMPTOM_SHORTCUTS = [
  {
    icon: "❤️",
    label: "Chest Pain",
    text: "Chest Pain",
  },
  {
    icon: "🌡️",
    label: "Fever",
    text: "Fever",
  },
  {
    icon: "🤕",
    label: "Headache",
    text: "Headache",
  },
  {
    icon: "🤢",
    label: "Gastric / Abdominal Pain",
    text: "Abdominal Pain",
  },
  {
    icon: "🩺",
    label: "Blood Pressure (High/Low)",
    text: "Blood Pressure issue",
  },
  {
    icon: "🤧",
    label: "Cough & Cold",
    text: "Cough & Cold",
  },
  {
    icon: "🫁",
    label: "Breathlessness / Asthma",
    text: "Breathlessness / Asthma",
  },
  {
    icon: "⚡",
    label: "Cut / Injury at work",
    text: "Cut / Injury at work",
  },
  {
    icon: "🧪",
    label: "Pesticide Exposure",
    text: "Pesticide Exposure",
  },
  {
    icon: "🏃",
    label: "Body Ache & Fatigue",
    text: "Body Ache & Fatigue",
  },
];

export const EkmsAiChatArea = forwardRef(function EkmsAiChatArea(
  { onComplaintChange, onSyncFields, initialNotes, onReadyToShowResult, onRunTriage },
  ref
) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("symptom");
  const [selectedAssociatedOptions, setSelectedAssociatedOptions] = useState([]);
  const [triageState, setTriageState] = useState({
    symptom: null,
    severity: null,
    medication: null,
    duration: null,
    associated: [],
    condition: null,
  });
  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));
  const [activeProbingQuestionId, setActiveProbingQuestionId] = useState(null);
  const chatContainerRef = useRef(null);

  // Auto scroll ONLY inside the chat container, never jumping the page window down!
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Handle external preset loaded
  useEffect(() => {
    if (initialNotes && initialNotes.trim()) {
      handleUserSubmit(initialNotes);
    }
  }, [initialNotes]);

  // Synchronize with parent intake form with clean clinical findings
  const notifyParent = (newMessages, newState) => {
    const summaryParts = [];
    if (newState.symptom) summaryParts.push(`Primary: ${newState.symptom}`);
    if (newState.severity) summaryParts.push(`Severity: ${newState.severity}`);
    if (newState.medication) summaryParts.push(`Medication: ${newState.medication}`);
    if (newState.duration) summaryParts.push(`Duration: ${newState.duration}`);
    if (newState.associated?.length) summaryParts.push(`Associated: ${newState.associated.join(", ")}`);
    if (newState.condition) summaryParts.push(`Condition: ${newState.condition}`);

    // Clean clinical summary without messy conversational chatter
    const compiledNotes = summaryParts.length
      ? `[EKMS AI Findings: ${summaryParts.join(" | ")}]`
      : "";

    onComplaintChange?.(compiledNotes, {
      triageState: newState,
      chatHistory: newMessages,
    });
  };

  const lastProcessedSpeechRef = useRef("");
  const stageRef = useRef(stage);
  const triageStateRef = useRef(triageState);
  const messagesRef = useRef(messages);

  useEffect(() => {
    stageRef.current = stage;
    triageStateRef.current = triageState;
    messagesRef.current = messages;
  }, [stage, triageState, messages]);

  const handleUserSubmit = async (textToSend, isFromSpeech = false, preNlp = null) => {
    const rawText = (textToSend || inputText).trim();
    if (!rawText) return;
    setInputText("");

    const curStage = stageRef.current || stage;
    const curTriage = triageStateRef.current || triageState;
    const curMessages = messagesRef.current || messages;

    // Real-Time NLP Clinical Entity Extractor (0ms execution)
    const nlp = preNlp || extractClinicalEntities(rawText, curStage, curTriage);

    // If incoming input is from speech stream, only act if meaningful clinical entities are present
    if (isFromSpeech && !nlp.hasClinicalContent) {
      return;
    }

    // Determine clean clinical text to show in the UI card/bubble (strictly keywords, no filler)
    const displayText = nlp.hasClinicalContent && nlp.cleanKeywords
      ? nlp.cleanKeywords
      : rawText;

    const userMsg = {
      id: "user-" + Date.now(),
      sender: "user",
      text: displayText,
      rawText,
      isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
    };

    // Calculate updated triage state
    let nextState = { ...curTriage };
    let nextStage = curStage;

    const currentStepData = getClinicalQuestionData({
      domain: curTriage.domain || nlp.domain || "general",
      stage: curStage,
      prompt: rawText,
      history: curMessages,
      currentTriage: curTriage,
    });
    const probingOptions = (currentStepData.probingQuestionsWithAnswers || []).flatMap((q) => q.options || []);
    const combinedOptions = Array.from(new Set([...(currentStepData.options || []), ...probingOptions]));

    if (curStage === "symptom") {
      const hasIdentifiedSymptom = Boolean(nlp.primarySymptom);

      if (!hasIdentifiedSymptom) {
        // If from speech but completely devoid of any clinical content, ignore small talk
        if (isFromSpeech && !nlp.hasClinicalContent) {
          return;
        }

        // Unrecognized or ambiguous input: DO NOT advance to severity! Stay in symptom stage!
        // Ask clarifying question and offer symptom choices based on the typed text!
        const stepData = getClinicalQuestionData({
          domain: "general",
          stage: "symptom",
          prompt: rawText,
          history: curMessages,
          currentTriage: curTriage,
        });

        const clarUserMsg = {
          id: "user-" + Date.now(),
          sender: "user",
          text: displayText,
          rawText,
          isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
          isClarificationPrompt: true,
        };

        const botReply = {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: stepData.agentScript,
          options: stepData.options,
          probingQuestions: stepData.probingQuestions,
          probingQuestionsWithAnswers: stepData.probingQuestionsWithAnswers || [],
          conditionLabel: null,
          stage: "symptom",
          isMultiSelect: false,
        };

        if (stepData.probingQuestionsWithAnswers?.length > 0) {
          setActiveProbingQuestionId(stepData.probingQuestionsWithAnswers[0].id);
        }

        const updatedMsgs = [...curMessages, clarUserMsg, botReply];
        messagesRef.current = updatedMsgs;
        setMessages(updatedMsgs);
        setStage("symptom");
        return;
      }

      // Valid clinical symptom clearly understood!
      nextState.symptom = nlp.primarySymptom;
      nextState.condition = nlp.conditionLabel;
      nextState.domain = nlp.domain || "general";
      nextState.probingStepIndex = 0;
      nextStage = "probing_0";

      const detectedSev = detectSeverityAnswer(rawText, combinedOptions);
      if (detectedSev) {
        const sevLabel = detectedSev.label || String(detectedSev);
        const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
        nextState.severity = sevLabel;
        if (onSyncFields) onSyncFields("severity_reported", sevScore);
      }
      const detectedDur = detectDurationAnswer(rawText, combinedOptions);
      if (detectedDur) {
        nextState.duration = detectedDur;
        if (onSyncFields) onSyncFields("duration", detectedDur);
      }
      if (nlp.companionSymptoms?.length > 0) {
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...nlp.companionSymptoms]));
      }
    } else if (curStage !== "complete") {
      // Progressive Clinical Probing Protocol (5 disease-tailored steps)
      const lower = rawText.toLowerCase();

      // Clinical Severity extraction from choice or user explanation
      if (
        /emergency|red flag|critical|fracture|dvt|cellulitis|blood|coffee|unconscious|unable to put any weight|unable to walk|shivering & rigors|severe/i.test(lower)
      ) {
        nextState.severity = "High";
        if (onSyncFields) onSyncFields("severity_reported", 9);
      } else if (/moderate|sprain|limp|bile|body ache/i.test(lower)) {
        if (!nextState.severity || nextState.severity === "Mild") {
          nextState.severity = "Moderate";
          if (onSyncFields) onSyncFields("severity_reported", 6);
        }
      } else if (/mild|no blood|no trauma|no swelling|manageable|no calf|clear/i.test(lower)) {
        if (!nextState.severity) {
          nextState.severity = "Mild";
          if (onSyncFields) onSyncFields("severity_reported", 3);
        }
      } else {
        const detectedSev = detectSeverityAnswer(rawText, combinedOptions);
        if (detectedSev) {
          const sevLabel = detectedSev.label || String(detectedSev);
          const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
          nextState.severity = sevLabel;
          if (onSyncFields) onSyncFields("severity_reported", sevScore);
        }
      }

      // Duration extraction
      const detectedDur = detectDurationAnswer(rawText, combinedOptions);
      if (detectedDur) {
        nextState.duration = detectedDur;
        if (onSyncFields) onSyncFields("duration", detectedDur);
      }

      // Medication extraction
      const detectedMed = detectMedicationAnswer(rawText, combinedOptions);
      if (detectedMed && !detectedMed.isBareYes) {
        nextState.medication = detectedMed.text;
      } else if (/paracetamol|dolo|crocin|aspirin|sorbitrate|ondansetron|vomikind|ors|antibiotic|insulin|inhaler/i.test(lower)) {
        nextState.medication = rawText;
      } else if (/no medication|no medicine|nahi li|kuch nahi|not taken/i.test(lower)) {
        nextState.medication = "No medications taken";
      }

      // Companion symptom extraction
      if (nlp.companionSymptoms?.length > 0) {
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...nlp.companionSymptoms]));
      }

      // Keep user choice intact in the message bubble
      userMsg.text = rawText;
      userMsg.isNlpExtracted = true;

      // Advance to next probing step
      const currentIdx = typeof curTriage.probingStepIndex === "number" ? curTriage.probingStepIndex : 0;
      const nextIdx = currentIdx + 1;
      const protocol = getDiseaseProbingProtocol(nextState.domain, nextState);

      if (nextIdx < protocol.length) {
        nextState.probingStepIndex = nextIdx;
        nextStage = "probing_" + nextIdx;
      } else {
        nextState.probingStepIndex = protocol.length;
        nextStage = "complete";
      }
    } else {
      nextStage = "complete";
      const dur = detectDurationAnswer(rawText, combinedOptions);
      if (dur) nextState.duration = dur;
      const sev = detectSeverityAnswer(rawText, combinedOptions);
      if (sev) nextState.severity = sev;
      if (nlp.companionSymptoms?.length > 0) {
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...nlp.companionSymptoms]));
      }
    }

    if (nextStage !== curStage) {
      lastProcessedSpeechRef.current = "";
    }
    stageRef.current = nextStage;
    triageStateRef.current = nextState;
    setStage(nextStage);
    setTriageState(nextState);

    if (nextStage === "complete") {
      onReadyToShowResult?.(nextState);
    }

    // Auto-sync severity & duration fields with intake form
    if (nlp.detectedSeverity && onSyncFields) {
      onSyncFields("severity_reported", nlp.detectedSeverity);
    }
    if (nextState.duration && onSyncFields) {
      onSyncFields("duration", nextState.duration);
    }

    // 0ms Super-Fast Adaptive Probing Questions Generation
    const stepData = getClinicalQuestionData({
      domain: nextState.domain || nlp.domain || "general",
      stage: nextStage,
      prompt: displayText,
      history: curMessages,
      currentTriage: nextState,
    });

    const botReply = {
      id: "bot-" + Date.now(),
      sender: "bot",
      text:
        nextStage === "complete"
          ? 'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."'
          : stepData.agentScript || "Please describe any additional details or symptoms.",
      options:
        nextStage === "complete"
          ? []
          : (stepData.options && stepData.options.length > 0)
          ? stepData.options
          : ["High", "Moderate", "Mild"],
      probingQuestions: nextStage === "complete" ? [] : (stepData.probingQuestions || []),
      probingQuestionsWithAnswers: nextStage === "complete" ? [] : (stepData.probingQuestionsWithAnswers || []),
      conditionLabel: nextState.condition || nlp.conditionLabel || null,
      stage: nextStage,
      isMultiSelect: nextStage === "associated",
      decision: nextState.condition ? { condition: nextState.condition } : null,
    };

    const updatedMsgs = [...curMessages, userMsg, botReply];
    messagesRef.current = updatedMsgs;
    setMessages(updatedMsgs);
    notifyParent(updatedMsgs, nextState);

    // Background sync to /api/ekms-ai/chat (async, non-blocking)
    try {
      fetch("/api/ekms-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: displayText,
          lastAnswer: rawText,
          sessionId,
          currentTriage: nextState,
          currentStage: stage,
        }),
      }).catch(() => {});
    } catch (e) {}
  };

  useImperativeHandle(ref, () => ({
    resetChat,
    insertComplaintText: (text) => {
      if (text && text.trim()) {
        handleUserSubmit(text.trim(), false);
      }
    },
    canAnswerCurrentStage: (speechText) => {
      if (!speechText || !speechText.trim()) return false;
      const currentStage = stageRef.current || stage;
      if (currentStage === "complete") return false;
      const clean = speechText.trim();

      const currentStepData = getClinicalQuestionData({
        domain: triageStateRef.current?.domain || "general",
        stage: currentStage,
        prompt: clean,
        history: messages,
        currentTriage: triageStateRef.current,
      });

      if (currentStage === "symptom") {
        const nlp = extractClinicalEntities(clean, "symptom", triageStateRef.current);
        return Boolean(nlp.primarySymptom);
      }
      return true;
    },
    processLiveSpeech: (speechText) => {
      if (!speechText || !speechText.trim()) return;
      const clean = speechText.trim();
      const currentStage = stageRef.current || stage;
      if (currentStage === "complete") return;

      if (clean === lastProcessedSpeechRef.current) return;

      const nlp = extractClinicalEntities(clean, currentStage, triageStateRef.current);
      if (!nlp.hasClinicalContent) return;

      lastProcessedSpeechRef.current = clean;
      handleUserSubmit(clean, true, nlp);
    },
  }));

  const resetChat = () => {
    setMessages([]);
    setStage("symptom");
    setSelectedAssociatedOptions([]);
    setActiveProbingQuestionId(null);
    lastProcessedSpeechRef.current = "";
    stageRef.current = "symptom";
    messagesRef.current = [];
    const emptyState = { symptom: null, severity: null, medication: null, duration: null, associated: [], condition: null };
    triageStateRef.current = emptyState;
    setTriageState(emptyState);
    onComplaintChange?.("", { triageState: emptyState, chatHistory: [] });
  };

  // Dynamic progressive clinical protocol stepper
  const currentProbingIdx = typeof triageState.probingStepIndex === "number" ? triageState.probingStepIndex : 0;
  const protocol = triageState.domain ? getDiseaseProbingProtocol(triageState.domain, triageState) : [];

  const displayStages = [
    { id: "symptom", label: "1. Symptom", isCurrent: stage === "symptom", isPast: stage !== "symptom" },
    ...(protocol.length > 0
      ? protocol.map((p, idx) => ({
          id: `probing_${idx}`,
          label: `${idx + 2}. ${p.title || `Check ${idx + 1}`}`,
          isCurrent: stage !== "symptom" && stage !== "complete" && currentProbingIdx === idx,
          isPast: stage === "complete" || (stage !== "symptom" && currentProbingIdx > idx),
        }))
      : [
          { id: "probing_0", label: "2. Red Flags", isCurrent: false, isPast: false },
          { id: "probing_1", label: "3. Clinical Check", isCurrent: false, isPast: false },
          { id: "probing_2", label: "4. Systemic Check", isCurrent: false, isPast: false },
          { id: "probing_3", label: "5. Hydration", isCurrent: false, isPast: false },
          { id: "probing_4", label: "6. Meds / History", isCurrent: false, isPast: false },
        ]),
  ];

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-card overflow-hidden shadow-sm">
      {/* Dynamic Progressive Clinical Stepper Bar */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto border-b border-border/50 bg-secondary/30 px-3 py-1.5 text-[10px] font-semibold [scrollbar-width:none]">
        {displayStages.map((s) => (
          <span
            key={s.id}
            className={`flex items-center gap-1 rounded px-2 py-0.5 whitespace-nowrap transition-colors ${
              s.isCurrent
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : s.isPast
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {s.isPast && <span className="font-bold">✓</span>}
            {s.label}
          </span>
        ))}
      </div>

      {/* Live state pill bar */}
      {(triageState.symptom || triageState.severity || triageState.medication || triageState.duration || (triageState.associated && triageState.associated.length > 0) || triageState.condition) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 bg-secondary/20 px-3 py-1 text-[11px]">
          {triageState.symptom && (
            <span className="rounded bg-emerald-100/70 px-2 py-0.5 font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300">
              Symptom: {triageState.symptom}
            </span>
          )}
          {triageState.severity && (
            <span className="rounded bg-blue-100/70 px-2 py-0.5 font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-300">
              Severity: {triageState.severity}
            </span>
          )}
          {triageState.medication && (
            <span className="rounded bg-indigo-100/70 px-2 py-0.5 font-medium text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-300">
              Medication: {triageState.medication}
            </span>
          )}
          {triageState.duration && (
            <span className="rounded bg-amber-100/70 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
              Duration: {triageState.duration}
            </span>
          )}
          {triageState.associated && triageState.associated.length > 0 && (
            <span className="rounded bg-teal-100/70 px-2 py-0.5 font-semibold text-teal-900 dark:bg-teal-900/40 dark:text-teal-300">
              Associated: {triageState.associated.join(", ")}
            </span>
          )}
          {triageState.condition && (
            <span className="rounded bg-purple-100/70 px-2 py-0.5 font-bold text-purple-900 dark:bg-purple-900/40 dark:text-purple-300">
              Condition: {triageState.condition}
            </span>
          )}
        </div>
      )}

      {/* Chat box - normally big and expands with conversation with no scroll bar showing */}
      <div
        ref={chatContainerRef}
        className="min-h-[460px] space-y-3 p-4 text-xs sm:text-sm transition-all duration-300 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <div className="max-w-[95%] rounded-xl border border-emerald-500/40 bg-emerald-50/60 p-3.5 text-foreground dark:bg-emerald-950/30 dark:border-emerald-800/60 shadow-xs">
              <div className="flex items-start gap-2.5">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-1 text-xs sm:text-sm">
                  <p className="font-medium text-emerald-950 dark:text-emerald-200">
                    <span className="font-bold">Ask the IP:</span> &ldquo;Namaskar, Welcome to Assam ESI Helpline, how may I help you?&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="pl-0.5">
              <div className="flex flex-wrap gap-2">
                {INITIAL_SYMPTOM_SHORTCUTS.map((sc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleUserSubmit(sc.text)}
                    className="group flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950 hover:shadow-xs dark:bg-secondary/30 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-200"
                  >
                    <span>{sc.icon}</span>
                    <span>{sc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, mIdx) => {
          const isLatest = mIdx === messages.length - 1;
          const isMulti = m.isMultiSelect || m.stage === "associated" || stage === "associated";
          const isCurrentActiveTurn = isLatest && m.sender === "bot" && stage !== "complete";

          // Extract clean question text without leading/trailing quotes or "Ask the IP:" prefix
          const cleanQuestionText = m.text
            ? m.text.replace(/^Ask the IP:\s*['"]?|['"]?$/gi, "").trim()
            : "";

          return (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              {/* User message in conversation history */}
              {m.sender === "user" && (
                <div className="max-w-[88%] rounded-lg px-3.5 py-2.5 leading-relaxed bg-primary text-primary-foreground font-medium shadow-xs">
                  <div>
                    {m.isNlpExtracted && (
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground/75 mb-0.5">
                        <Sparkles className="h-3 w-3" />
                        <span>NLP Clinical Standard</span>
                      </div>
                    )}
                    <p className="text-xs sm:text-sm font-semibold">{m.text}</p>
                    {m.rawText && m.rawText.toLowerCase().trim() !== m.text.toLowerCase().trim() && (
                      <p className="text-[10px] text-primary-foreground/85 italic mt-0.5">
                        Heard: &ldquo;{m.rawText}&rdquo; &rarr; Standard: <strong>{m.text}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Bot history message (when previous turn or when intake is complete) */}
              {m.sender === "bot" && !isCurrentActiveTurn && (
                <div className="max-w-[88%] rounded-lg border border-border/80 bg-secondary/40 px-3.5 py-2.5 text-foreground leading-relaxed">
                  <div className="flex items-start gap-2">
                    <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs sm:text-sm font-medium">
                        <span className="font-bold text-emerald-800 dark:text-emerald-400">Ask the IP: </span>
                        &ldquo;{cleanQuestionText || m.text}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ONLY ONE Active Question Card for the active bot turn (NO duplicate speech bubble above it!) */}
              {isCurrentActiveTurn && (
                <div className="w-full rounded-xl border border-emerald-500/40 bg-emerald-50/50 p-3.5 dark:border-emerald-800/50 dark:bg-emerald-950/30 shadow-xs space-y-3">
                  {/* Clean Question Header */}
                  <div className="flex items-start gap-2.5">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="space-y-0.5 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                        Ask the IP:
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                        {cleanQuestionText || m.text}
                      </p>
                    </div>
                  </div>

                  {/* Possible Answers directly below the question line */}
                  {isMulti ? (
                    /* Step 5: Associated Companion Symptoms Multi-select */
                    <div className="border-t border-emerald-500/20 pt-2.5 space-y-2">
                      <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                        Select all associated symptoms that apply:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.options?.map((opt, idx) => {
                          const isNone = opt.toLowerCase().includes("none");
                          const isSelected = selectedAssociatedOptions.includes(opt);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isNone) {
                                  setSelectedAssociatedOptions([]);
                                  handleUserSubmit("None of these");
                                  return;
                                }
                                setSelectedAssociatedOptions((prev) =>
                                  prev.includes(opt)
                                    ? prev.filter((item) => item !== opt)
                                    : [...prev.filter((item) => !item.toLowerCase().includes("none")), opt]
                                );
                              }}
                              className={`group flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-xs font-semibold ring-1 ring-emerald-500"
                                  : "border border-emerald-500/40 bg-emerald-50/70 text-emerald-900 transition-all hover:bg-emerald-100 hover:-translate-y-0.5 dark:bg-emerald-950/40 dark:text-emerald-200"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Confirm submission button */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            const toSubmit =
                              selectedAssociatedOptions.length > 0
                                ? selectedAssociatedOptions.join(", ")
                                : "None of these";
                            setSelectedAssociatedOptions([]);
                            handleUserSubmit(toSubmit);
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {selectedAssociatedOptions.length > 0
                              ? `Submit Selected (${selectedAssociatedOptions.length})`
                              : "Submit Selected / Continue"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssociatedOptions([]);
                            handleUserSubmit("None of these");
                          }}
                          className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          None of these
                        </button>
                      </div>
                    </div>
                  ) : m.options?.length > 0 ? (
                    /* Single-select chips directly below the question */
                    <div className="border-t border-emerald-500/20 pt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                        <span>Possible Answers from IP:</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Click choice or type in box below
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.options.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleUserSubmit(opt)}
                            className="group flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-background/90 px-3 py-1 text-[11px] font-medium text-emerald-950 transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-100 hover:shadow-xs dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60 active:scale-95 text-left"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Ready to show result panel when intake & associated conditions are recorded */}
              {m.sender === "bot" && isLatest && stage === "complete" && (
                <div className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 shadow-sm text-foreground space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                        Intake Assessment Complete — Ready to Show Result
                      </span>
                    </div>
                    <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-background/80 p-2 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Primary Symptom</span>
                      <span className="font-bold text-foreground">{triageState.symptom || "Not specified"}</span>
                    </div>
                    <div className="rounded-md bg-background/80 p-2 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Condition</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{triageState.condition || "Clinical Assessment"}</span>
                    </div>
                    <div className="rounded-md bg-background/80 p-2 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Severity &amp; Duration</span>
                      <span className="font-semibold text-foreground">{triageState.severity || "5/10"} · {triageState.duration || "Today"}</span>
                    </div>
                    <div className="rounded-md bg-background/80 p-2 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Associated Conditions</span>
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {triageState.associated?.length > 0 ? triageState.associated.join(", ") : "None reported"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
            <span>EKMS AI is analyzing symptoms and adapting question...</span>
          </div>
        )}
      </div>

      {/* Chat input area */}
      <div className="border-t border-border bg-secondary/30 p-2.5">
        <div className="flex items-center gap-2">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUserSubmit();
              }
            }}
            placeholder="Type caller's complaint / answer (English / हिंदी / Hinglish)..."
            className="flex-1 rounded-md border border-border/80 bg-background px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => handleUserSubmit()}
            disabled={loading || !inputText.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
            title="Send to EKMS AI"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
