"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, RotateCcw, Sparkles, CheckCircle2, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";
import {
  extractClinicalEntities,
  getClinicalQuestionData,
  detectSeverityAnswer,
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
    duration: null,
    associated: [],
    condition: null,
  });
  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));
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
          conditionLabel: null,
          stage: "symptom",
          isMultiSelect: false,
        };

        const updatedMsgs = [...curMessages, clarUserMsg, botReply];
        messagesRef.current = updatedMsgs;
        setMessages(updatedMsgs);
        setStage("symptom");
        return;
      }

      // Valid clinical symptom clearly understood!
      nextState.symptom = nlp.primarySymptom;
      nextState.condition = nlp.conditionLabel;
      nextState.domain = nlp.domain;
      const detectedSev = detectSeverityAnswer(rawText, currentStepData.options || []);
      if (detectedSev) {
        const sevLabel = detectedSev.label || String(detectedSev);
        const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
        nextState.severity = sevLabel;
        if (onSyncFields) onSyncFields("severity_reported", sevScore);
      }
      const detectedDur = detectDurationAnswer(rawText, []);
      if (detectedDur) {
        nextState.duration = detectedDur;
        if (onSyncFields) onSyncFields("duration", detectedDur);
      }
      if (nlp.companionSymptoms?.length > 0) {
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...nlp.companionSymptoms]));
      }

      if (!nextState.severity) {
        nextStage = "severity";
      } else if (!nextState.duration) {
        nextStage = "duration";
      } else {
        nextStage = "associated";
      }
    } else if (curStage === "severity") {
      // Step 2: Severity — MUST detect valid severity before advancing!
      const detectedSev = detectSeverityAnswer(rawText, currentStepData.options || []);
      const detectedDur = detectDurationAnswer(rawText, []);

      if (detectedDur && !nextState.duration) {
        nextState.duration = detectedDur;
        if (onSyncFields) onSyncFields("duration", detectedDur);
      }

      if (!detectedSev) {
        // User typed something unrelated or did not provide a severity answer!
        // DO NOT advance to duration! Stay in severity stage!
        const userMsg = {
          id: "user-" + Date.now(),
          sender: "user",
          text: displayText,
          rawText,
          isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
        };

        const botReply = {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: "Ask the IP: 'Could you please rate or describe how severe the symptoms are? (Is it High, Moderate, or Mild?)'",
          options: currentStepData.options || ["High", "Moderate", "Mild"],
          probingQuestions: currentStepData.probingQuestions || [],
          conditionLabel: nextState.condition || null,
          stage: "severity",
          isMultiSelect: false,
        };

        const updatedMsgs = [...curMessages, userMsg, botReply];
        messagesRef.current = updatedMsgs;
        setMessages(updatedMsgs);
        setStage("severity");
        return;
      }

      // Valid severity received!
      const sevLabel = detectedSev.label || String(detectedSev);
      const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
      nextState.severity = sevLabel;
      if (onSyncFields) {
        onSyncFields("severity_reported", sevScore);
      }
      userMsg.text = sevLabel;
      userMsg.isNlpExtracted = true;
      if (!nextState.duration) {
        nextStage = "duration";
      } else {
        nextStage = "associated";
      }
    } else if (curStage === "duration") {
      // Step 3: Duration — MUST detect valid duration before advancing!
      const detectedDur = detectDurationAnswer(rawText, currentStepData.options || []);
      const detectedSev = detectSeverityAnswer(rawText, []);

      if (detectedSev && !nextState.severity) {
        const sevLabel = detectedSev.label || String(detectedSev);
        const sevScore = detectedSev.score || (sevLabel === "High" ? 9 : sevLabel === "Moderate" ? 6 : 3);
        nextState.severity = sevLabel;
        if (onSyncFields) {
          onSyncFields("severity_reported", sevScore);
        }
      }

      if (!detectedDur) {
        // User typed something unrelated or did not provide a duration answer!
        // DO NOT advance to associated! Stay in duration stage!
        const userMsg = {
          id: "user-" + Date.now(),
          sender: "user",
          text: displayText,
          rawText,
          isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
        };

        const botReply = {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: "Ask the IP: 'Could you please specify how long you have had this condition? Exactly when did it start?'",
          options: currentStepData.options || [
            "Less than 2 hours (Sudden / Recent)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: currentStepData.probingQuestions || [],
          conditionLabel: nextState.condition || null,
          stage: "duration",
          isMultiSelect: false,
        };

        const updatedMsgs = [...curMessages, userMsg, botReply];
        messagesRef.current = updatedMsgs;
        setMessages(updatedMsgs);
        setStage("duration");
        return;
      }

      // Valid duration received! Advance to associated
      nextState.duration = detectedDur;
      if (onSyncFields) onSyncFields("duration", detectedDur);
      userMsg.text = detectedDur;
      userMsg.isNlpExtracted = true;
      if (nlp.companionSymptoms?.length > 0) {
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...nlp.companionSymptoms]));
      }
      nextStage = "associated";
    } else if (curStage === "associated") {
      // Step 4: Associated conditions
      const lower = rawText.toLowerCase();
      const detectedDur = detectDurationAnswer(rawText, []);
      const isNoneOrNegative =
        lower.includes("none") ||
        lower.includes("nahi") ||
        lower.includes("no other") ||
        lower.includes("kuch nahi") ||
        lower.includes("not present") ||
        lower.includes("nothing else");

      if (detectedDur && !isNoneOrNegative && (!nlp.companionSymptoms || nlp.companionSymptoms.length === 0)) {
        // User stated duration while on associated screen
        nextState.duration = detectedDur;
        nextStage = "associated";
        if (onSyncFields) onSyncFields("duration", detectedDur);
        userMsg.text = `Duration: ${detectedDur}`;
        userMsg.isNlpExtracted = true;
      } else {
        const detectedAssoc = detectAssociatedAnswer(rawText, currentStepData.options || [], nlp.companionSymptoms);

        if (!detectedAssoc) {
          // User typed something unrelated!
          // DO NOT advance to complete! Stay in associated stage!
          const userMsg = {
            id: "user-" + Date.now(),
            sender: "user",
            text: displayText,
            rawText,
            isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
          };

          const botReply = {
            id: "bot-" + Date.now(),
            sender: "bot",
            text: "Ask the IP: 'Are you experiencing any companion symptoms? (Please select from the options below or select None of these)'",
            options: currentStepData.options || [],
            probingQuestions: currentStepData.probingQuestions || [],
            conditionLabel: nextState.condition || null,
            stage: "associated",
            isMultiSelect: true,
          };

          const updatedMsgs = [...curMessages, userMsg, botReply];
          messagesRef.current = updatedMsgs;
          setMessages(updatedMsgs);
          setStage("associated");
          return;
        }

        // Valid associated response! Advance to complete
        nextStage = "complete";
        nextState.associated = Array.from(new Set([...(nextState.associated || []), ...detectedAssoc.items]));
        userMsg.text = detectedAssoc.isNone ? "None of these" : detectedAssoc.items.join(", ");
        userMsg.isNlpExtracted = true;
      }
    } else if (curStage === "complete") {
      nextStage = "complete";
      const dur = detectDurationAnswer(rawText, []);
      if (dur) nextState.duration = dur;
      const sev = detectSeverityAnswer(rawText, []);
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
      domain: nlp.domain || nextState.domain || "general",
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
          : nextStage === "severity"
          ? ["High", "Moderate", "Mild"]
          : (stepData.options || []),
      probingQuestions: nextStage === "complete" ? [] : (stepData.probingQuestions || []),
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
      if (currentStage === "severity") {
        return Boolean(detectSeverityAnswer(clean, currentStepData.options || []));
      }
      if (currentStage === "duration") {
        return Boolean(detectDurationAnswer(clean, currentStepData.options || []));
      }
      if (currentStage === "associated") {
        const dur = detectDurationAnswer(clean, []);
        const nlp = extractClinicalEntities(clean, "associated", triageStateRef.current);
        const isNone = /\b(none|nahi|no other|kuch nahi|not present|nothing else)\b/i.test(clean);
        if (dur && !isNone && (!nlp.companionSymptoms || nlp.companionSymptoms.length === 0)) {
          return true;
        }
        return Boolean(detectAssociatedAnswer(clean, currentStepData.options || [], nlp.companionSymptoms));
      }
      return false;
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
    lastProcessedSpeechRef.current = "";
    stageRef.current = "symptom";
    messagesRef.current = [];
    const emptyState = { symptom: null, severity: null, duration: null, associated: [], condition: null };
    triageStateRef.current = emptyState;
    setTriageState(emptyState);
    onComplaintChange?.("", { triageState: emptyState, chatHistory: [] });
  };

  // 4 steps only (Assessment step removed as requested)
  const STAGES = [
    { id: "symptom", label: "1. Symptom" },
    { id: "severity", label: "2. Severity" },
    { id: "duration", label: "3. Duration" },
    { id: "associated", label: "4. Associated" },
  ];

  const STAGE_ORDER = ["symptom", "severity", "duration", "associated", "complete"];

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-card overflow-hidden shadow-sm">
      {/* 4-Step Progress Stepper Bar */}
      <div className="flex items-center justify-between gap-1 border-b border-border/50 bg-secondary/30 px-3 py-1.5 text-[10px] font-semibold">
        {STAGES.map((s) => {
          const currentIdx = STAGE_ORDER.indexOf(stage);
          const thisIdx = STAGE_ORDER.indexOf(s.id);
          const isPast = currentIdx > thisIdx;
          const isCurrent = stage === s.id;

          return (
            <span
              key={s.id}
              className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                isCurrent
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : isPast
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {isPast && <span className="font-bold">✓</span>}
              {s.label}
            </span>
          );
        })}
      </div>

      {/* Live state pill bar */}
      {(triageState.symptom || triageState.severity || triageState.duration || (triageState.associated && triageState.associated.length > 0) || triageState.condition) && (
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
                    <span className="font-bold">Ask the IP:</span> &ldquo;Hello, this is the ESIC Healthcare Assistance desk. How are you feeling today, and what primary health symptom or complaint are you experiencing?&rdquo;
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

          return (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-lg px-3.5 py-2.5 leading-relaxed ${
                  m.sender === "user"
                    ? "bg-primary text-primary-foreground font-medium shadow-xs"
                    : "border border-border/80 bg-secondary/40 text-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  {m.sender === "bot" && (
                    <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    {m.sender === "user" ? (
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
                    ) : (
                      <p>{m.text}</p>
                    )}
                    {m.sender === "bot" && isLatest && m.probingQuestions?.length > 0 && stage !== "complete" && (
                      <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between gap-1 mb-1.5 border-b border-emerald-500/20 pb-1">
                          <p className="font-bold text-emerald-900 dark:text-emerald-200 text-[11px] flex items-center gap-1">
                            <span>🔍 Probing Questions to Ask IP:</span>
                          </p>
                          {(m.conditionLabel || triageState.condition) && (
                            <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                              {m.conditionLabel || triageState.condition}
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1.5 text-emerald-950/90 dark:text-emerald-300 text-[11px]">
                          {m.probingQuestions.map((q, qIdx) => (
                            <li key={qIdx} className="flex items-start gap-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                              <span className="leading-snug">{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Render interactive options on the latest bot message */}
              {m.sender === "bot" && isLatest && m.options?.length > 0 && stage !== "complete" && (
                isMulti ? (
                  /* Step 4 Associated: Multi-selection chips */
                  <div className="mt-2.5 max-w-[98%] space-y-2 pl-2">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Select all associated symptoms that apply:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.options.map((opt, idx) => {
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
                ) : (
                  /* Single select chips for Severity & Duration steps */
                  <div className="mt-2 flex max-w-[95%] flex-wrap gap-1.5 pl-2">
                    {m.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleUserSubmit(opt)}
                        className="group flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-50/60 px-3 py-1 text-[11px] font-medium text-emerald-900 transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-100 hover:shadow-xs dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        <span>{opt}</span>
                      </button>
                    ))}
                  </div>
                )
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
