"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Activity,
  FileText,
  RotateCcw,
  ArrowRight,
  PhoneForwarded,
  ThumbsUp,
  ThumbsDown,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { extractClinicalEntities } from "@/lib/clinicalAdaptiveEngine";
import { isWhisperHallucination } from "@/lib/speechRecognition";
import { detectDirectCallerReferralIntent } from "@/lib/doctorChatEngine";
import {
  getCachedAiChatSession,
  setCachedAiChatSession,
  clearCachedAiChatSession,
} from "@/lib/clientCache";
import { normalizeUrgency } from "@/lib/api";

const INITIAL_SYMPTOM_SHORTCUTS = [
  { icon: "❤️", label: "Chest Pain / Pressure", text: "Chest pain and pressure" },
  { icon: "⚡", label: "Weakness & Dizziness", text: "Weakness and dizziness" },
  { icon: "🌡️", label: "Fever & Chills", text: "Fever and chills" },
  { icon: "🤢", label: "Vomiting & Nausea", text: "Vomiting and nausea" },
  { icon: "🤕", label: "Severe Headache", text: "Headache and discomfort" },
  { icon: "🥘", label: "Abdominal / Stomach Pain", text: "Abdominal / stomach pain" },
  { icon: "🩸", label: "Workplace Injury / Cut", text: "Workplace injury and cut" },
];

const MOBILE_SYMPTOM_SHORTCUTS = [
  { icon: "❤️", label: "Chest Pain / Pressure", text: "Chest pain and pressure" },
  { icon: "🌡️", label: "Fever & Chills", text: "Fever and chills" },
  { icon: "⚡", label: "Weakness & Dizziness", text: "Weakness and dizziness" },
  { icon: "🤢", label: "Vomiting & Nausea", text: "Vomiting and nausea" },
  { icon: "🤕", label: "Severe Headache", text: "Headache and discomfort" },
  { icon: "🥘", label: "Abdominal Pain", text: "Abdominal / stomach pain" },
];

function formatReferralDestination(dest) {
  return dest || "";
}

function formatReferralReason(reason) {
  return reason || "";
}

export function cleanChipText(text = "") {
  if (!text || typeof text !== "string") return "";
  let clean = text
    .replace(/\s*\(\s*(?:emergency\s*-\s*108|emergency\s*sah|emergency|ambulance\s*dispatched|ambulance|call\s*108|108|severe)\s*\)/gi, "")
    .replace(/\s*-\s*108\b/gi, "")
    .replace(/\b108\b/gi, "")
    .replace(/\s*\(\s*emergency\s*\)/gi, "")
    .replace(/\bemergency\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  clean = clean.replace(/[\s\-,;:]+$/, "").replace(/^\s*[-–—]\s*/, "").trim();
  return clean || text.replace(/108/g, "").trim();
}

function formatMsgTime(m) {
  const ts = m?.timestamp || m?.created_at || m?.time;
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
  }
  if (m?.id) {
    const match = String(m.id).match(/\d{10,13}/);
    if (match) {
      const d = new Date(parseInt(match[0], 10));
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
  }
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export const EkmsAiChatArea = forwardRef(function EkmsAiChatArea(
  {
    title,
    chatSessionKey = "ekms_main_ai_chat_session",
    onComplaintChange,
    onSyncFields,
    initialNotes,
    onReadyToShowResult,
    onRunTriage,
    currentAgent,
    triageResult,
    activeDirective,
    fillHeight = false,
    className = "",
    customChatHeight = "",
  },
  ref
) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSummaryCard, setShowSummaryCard] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [showApiLimitPopup, setShowApiLimitPopup] = useState(false);
  const [recoverySeconds, setRecoverySeconds] = useState(0);

  // Auto-countdown timer for API limit recovery
  useEffect(() => {
    let timer;
    if (showApiLimitPopup && recoverySeconds > 0) {
      timer = setInterval(() => {
        setRecoverySeconds((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showApiLimitPopup, recoverySeconds]);

  const getActiveAgentLabel = () => {
    let agentId = currentAgent?.agentId;
    if (!agentId) {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          agentId = parsed?.agentId;
        }
      } catch (e) {}
    }
    if (!agentId) return "Admin 1";
    const clean = String(agentId).trim();
    const upper = clean.toUpperCase();
    if (upper === "ADMIN 1" || upper === "ADMIN1" || upper === "AD1") return "Admin 1";
    if (upper === "ADMIN 2" || upper === "ADMIN2" || upper === "AD2") return "Admin 2";
    if (upper === "AGENT 1" || upper === "AGENT1" || upper === "A1") return "Agent 1";
    if (upper === "AGENT 2" || upper === "AGENT2" || upper === "A2") return "Agent 2";
    if (upper === "AGENT 3" || upper === "AGENT3" || upper === "A3") return "Agent 3";
    return clean;
  };

  const [clinicalState, setClinicalState] = useState({
    suspectedCondition: null,
    differentialDiagnosis: [],
    severity: null,
    severityScore: null,
    redFlagsDetected: [],
    duration: null,
    medication: null,
    consultationAdvice: null,
    clinicalSummary: null,
    referralDestination: null,
    referralReason: null,
    isPsychiatric: false,
    isReadyForSummary: false,
  });

  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));
  const [questionFeedbackMap, setQuestionFeedbackMap] = useState({});
  const chatContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const lastProcessedSpeechRef = useRef("");
  const messagesRef = useRef(messages);
  const clinicalStateRef = useRef(clinicalState);

  const handleQuestionFeedback = async (m, isPositive) => {
    const key = m.id || m.text;
    if (questionFeedbackMap[key]) return;

    setQuestionFeedbackMap((prev) => ({
      ...prev,
      [key]: isPositive ? "positive" : "negative",
    }));

    try {
      const activeAgent = getActiveAgentLabel();
      const payload = {
        agent_id: activeAgent,
        type: "probing",
        symptom_notes: m.suspectedCondition || clinicalState.suspectedCondition || m.text,
        is_positive: isPositive,
        notes: isPositive
          ? `${activeAgent} approved probing question: "${m.text}"`
          : `${activeAgent} flagged question as low relevance: "${m.text}". Needs more direct triage focus.`,
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (isPositive) {
          toast.success("AI Learning: Probing question reinforced!");
        } else {
          toast.info("AI Learning: Irrelevant question logged. Probing priorities updated.");
        }
      }
    } catch {
      // ignore
    }
  };

  // 1. Restore chat messages and clinical state from local cash memory for THIS specific session key
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Clear legacy shared key so old crosstalk doesn't bleed through
        sessionStorage.removeItem("ekms_active_ai_chat_session");
      }
      const cached = getCachedAiChatSession(chatSessionKey);
      if (cached && Array.isArray(cached.messages) && cached.messages.length > 0) {
        setMessages(cached.messages);
        messagesRef.current = cached.messages;
        if (cached.clinicalState) {
          setClinicalState(cached.clinicalState);
          clinicalStateRef.current = cached.clinicalState;
        }
      } else {
        setMessages([]);
        messagesRef.current = [];
        const emptyState = {
          suspectedCondition: null,
          differentialDiagnosis: [],
          severity: null,
          severityScore: null,
          redFlagsDetected: [],
          duration: null,
          medication: null,
          consultationAdvice: null,
          clinicalSummary: null,
          referralDestination: null,
          referralReason: null,
          isPsychiatric: false,
          isReadyForSummary: false,
        };
        setClinicalState(emptyState);
        clinicalStateRef.current = emptyState;
      }
    } catch (_) {}
  }, [chatSessionKey]);

  // 2. Persist chat messages & clinical state to cash memory on every turn under THIS session key
  useEffect(() => {
    messagesRef.current = messages;
    clinicalStateRef.current = clinicalState;
    if (messages.length > 0) {
      setCachedAiChatSession({ messages, clinicalState }, chatSessionKey);
    } else {
      clearCachedAiChatSession(chatSessionKey);
    }
  }, [messages, clinicalState, chatSessionKey]);

  // Auto scroll inside chat container
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
    if (initialNotes && initialNotes.trim() && messages.length === 0) {
      handleUserSubmit(initialNotes.trim());
    }
  }, [initialNotes]);

  // Global Enter key support: submits selected options even if focus is on option button
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey && selectedOptions.length > 0 && !loading) {
        if (e.target && e.target.tagName === "INPUT" && e.target !== chatInputRef.current) {
          return;
        }
        e.preventDefault();
        const combined = inputText.trim()
          ? `${selectedOptions.join(", ")}, ${inputText.trim()}`
          : selectedOptions.join(", ");
        setSelectedOptions([]);
        handleUserSubmit(combined);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedOptions, inputText, loading]);

  // Sync findings to parent intake form
  const notifyParent = (newMessages, newState) => {
    const summary = newState.clinicalSummary
      ? newState.clinicalSummary
      : newState.suspectedCondition
      ? `${newState.suspectedCondition} (Severity: ${newState.severity}, Duration: ${newState.duration || "Noted"})`
      : "";

    onComplaintChange?.(summary, {
      triageState: {
        symptom: newState.suspectedCondition,
        condition: newState.suspectedCondition,
        suspectedCondition: newState.suspectedCondition,
        severity: newState.severity,
        severityScore: newState.severityScore,
        duration: newState.duration,
        comorbidity: newState.comorbidity || newState.comorbidities,
        comorbidities: newState.comorbidities || newState.comorbidity,
        allergies: newState.allergies,
        medication: newState.medication || newState.medications,
        medications: newState.medications || newState.medication,
        associated: newState.redFlagsDetected,
        redFlagsDetected: newState.redFlagsDetected,
        referralDestination: newState.referralDestination,
        referralReason: newState.referralReason,
        isPsychiatric: newState.isPsychiatric,
        clinicalSummary: newState.clinicalSummary,
      },
      chatHistory: newMessages,
    });
  };

  const handleUserSubmit = async (textToSend, isFromSpeech = false) => {
    let rawText = (typeof textToSend === "string" ? textToSend : inputText).trim();
    if (!rawText && selectedOptions.length > 0) {
      rawText = selectedOptions.join(", ");
      setSelectedOptions([]);
    } else if (textToSend === undefined && selectedOptions.length > 0 && rawText) {
      rawText = `${selectedOptions.join(", ")}, ${rawText}`;
      setSelectedOptions([]);
    } else if (selectedOptions.length > 0) {
      setSelectedOptions([]);
    }
    if (!rawText || loading) return;

    // Reject silence/subtitle hallucinations ONLY for speech recognition stream
    if (isFromSpeech && isWhisperHallucination(rawText)) {
      return;
    }

    const curMessages = messagesRef.current || messages;

    // Suppress duplicate identical consecutive user messages
    if (curMessages.length > 0) {
      const lastMsg = curMessages[curMessages.length - 1];
      if (lastMsg.sender === "user" && lastMsg.text?.trim().toLowerCase() === rawText.toLowerCase()) {
        return;
      }
    }

    setInputText("");

    const curState = clinicalStateRef.current || clinicalState;

    // Fast local NLP extraction for immediate client-side responsiveness
    const nlp = extractClinicalEntities(rawText, "probing", curState);
    if (isFromSpeech && !nlp.hasClinicalContent) {
      return;
    }

    const isVoiceInput = Boolean(isFromSpeech);
    const nowTime = Date.now();
    const userMsg = {
      id: "user-" + nowTime,
      timestamp: nowTime,
      created_at: new Date(nowTime).toISOString(),
      sender: "user",
      text: rawText,
      rawText,
      isVoice: isVoiceInput,
      isNlpExtracted: isVoiceInput,
      source: isVoiceInput ? "voice" : "manual",
    };

    const updatedMsgsWithUser = [...curMessages, userMsg];
    setMessages(updatedMsgsWithUser);
    messagesRef.current = updatedMsgsWithUser;
    setLoading(true);

    try {
      const response = await fetch("/api/ekms-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: rawText,
          history: updatedMsgsWithUser.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
          sessionId,
          currentClinicalState: curState,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.isSystemInbuiltFallback || data.apiLimitReached) {
        setShowApiLimitPopup(true);
        setRecoverySeconds(20);
        toast.warning(
          "LLM API Limit Reached — Switched to system in-built clinical probing questions. Please wait a few seconds for the limit to recover.",
          { id: "ekms-api-limit-recovery", duration: 6000 }
        );
      } else {
        // AI model responded directly without fallback
        setShowApiLimitPopup(false);
      }

      const userText = rawText.toLowerCase();
      const directIntent = detectDirectCallerReferralIntent(rawText);
      const userTurnsCount = updatedMsgsWithUser.filter((m) => m.sender === "user").length;

      const isSeverePhysicalEmergency =
        /\b(heart attack|crushing chest|cardiac arrest|unconscious|massive bleed|accident casualty)\b/i.test(userText);

      let effectiveReferral = null;
      let effectiveReason = null;

      if (directIntent) {
        effectiveReferral = directIntent.destination;
        effectiveReason = directIntent.reason;
      } else if (isSeverePhysicalEmergency) {
        effectiveReferral = "108 Ambulance";
        effectiveReason = "Life-threatening acute emergency or accident casualty; dispatch 108 Ambulance immediately.";
      } else if (userTurnsCount >= 3 || data.isReadyForSummary) {
        // Conclude referral destination from turn 3 or 4 onwards after thorough clinical assessment
        effectiveReferral = data.referralDestination || null;
        effectiveReason = data.referralReason || null;
      }

      const nextClinicalState = {
        suspectedCondition:
          data.suspectedCondition ||
          curState.suspectedCondition ||
          (directIntent ? directIntent.suspectedConditionSuffix : "Medical Consultation"),
        differentialDiagnosis: data.differentialDiagnosis || curState.differentialDiagnosis || [],
        severity:
          directIntent?.destination === "108 Ambulance" || directIntent?.destination === "ESIC Hospital"
            ? "High"
            : (data.severity || curState.severity || "Moderate"),
        severityScore:
          directIntent?.destination === "108 Ambulance" || directIntent?.destination === "ESIC Hospital"
            ? 9
            : (data.severityScore || (data.severity === "High" ? 9 : data.severity === "Moderate" ? 6 : 3)),
        redFlagsDetected: Array.from(new Set([...(curState.redFlagsDetected || []), ...(data.redFlagsDetected || [])])),
        duration: nlp.detectedDuration || data.duration || curState.duration,
        comorbidity: data.comorbidity || data.comorbidities || curState.comorbidity || curState.comorbidities,
        comorbidities: data.comorbidities || data.comorbidity || curState.comorbidities || curState.comorbidity,
        allergies: data.allergies || nlp.detectedAllergies || curState.allergies,
        medication: data.medication || data.medications || nlp.detectedMedications || curState.medication,
        medications: data.medications || data.medication || nlp.detectedMedications || curState.medications,
        clinicalSummary: data.clinicalSummary || curState.clinicalSummary,
        referralDestination: effectiveReferral,
        referralReason: effectiveReason,
        isPsychiatric: Boolean(
          data.isPsychiatric ??
          curState.isPsychiatric ??
          (directIntent?.destination === "Psychological Counselling Department")
        ),
        isReadyForSummary: Boolean(data.isReadyForSummary || (updatedMsgsWithUser.length >= 8) || Boolean(directIntent)),
        initialChiefComplaint: data.initialChiefComplaint || curState.initialChiefComplaint || curState.symptom || null,
        detectedLocation: data.detectedLocation || curState.detectedLocation || null,
        nearestFacility: data.nearestFacility || curState.nearestFacility || null,
      };

      setClinicalState(nextClinicalState);
      clinicalStateRef.current = nextClinicalState;

      // Auto-sync severity, duration, and detected location with the triage form
      if (nextClinicalState.severityScore && onSyncFields) {
        onSyncFields("severity_reported", nextClinicalState.severityScore);
      }
      if (nextClinicalState.duration && onSyncFields) {
        onSyncFields("duration", nextClinicalState.duration);
      }
      if (nextClinicalState.detectedLocation?.pincode && onSyncFields) {
        onSyncFields("pincode", nextClinicalState.detectedLocation.pincode);
      }
      if (nextClinicalState.detectedLocation?.name && onSyncFields) {
        onSyncFields("city", nextClinicalState.detectedLocation.name);
      }

      const botTime = Date.now();
      const botReply = {
        id: "bot-" + botTime,
        timestamp: botTime,
        created_at: new Date(botTime).toISOString(),
        sender: "bot",
        text: data.agentScript || data.answer || "Could you describe any other symptoms?",
        options: (data.options || data.suggestedAnswers || []).map(cleanChipText).filter(Boolean),
        suspectedCondition: nextClinicalState.suspectedCondition,
        severity: nextClinicalState.severity,
        referralDestination: nextClinicalState.referralDestination,
        referralReason: nextClinicalState.referralReason,
        isPsychiatric: nextClinicalState.isPsychiatric,
        clinicalSummary: nextClinicalState.clinicalSummary,
        isReadyForSummary: nextClinicalState.isReadyForSummary,
      };

      const finalMsgs = [...updatedMsgsWithUser, botReply];
      setMessages(finalMsgs);
      messagesRef.current = finalMsgs;
      notifyParent(finalMsgs, nextClinicalState);

      if (nextClinicalState.isReadyForSummary) {
        setShowSummaryCard(true);
      }
    } catch (err) {
      console.error("EKMS AI Chat Error:", err);
      setShowApiLimitPopup(true);
      setRecoverySeconds(20);
      toast.warning(
        "LLM API Limit Reached — Switched to system in-built clinical probing questions. Please wait a few seconds for the limit to recover.",
        { id: "ekms-api-limit-recovery", duration: 6000 }
      );
      // Fallback response if network disconnects
      const fallbackTime = Date.now();
      const fallbackReply = {
        id: "bot-" + fallbackTime,
        timestamp: fallbackTime,
        created_at: new Date(fallbackTime).toISOString(),
        sender: "bot",
        text: `Ask the IP: "Can you specify how long you have had this complaint, and what medicines have you taken so far?"`,
        options: [
          "Symptoms started today",
          "Ongoing for 2 to 3 days",
          "Taking prescribed daily medicines",
          "No medications taken yet",
        ],
        suspectedCondition: curState.suspectedCondition || "Health Complaint",
        severity: curState.severity || "Moderate",
        referralDestination: curState.referralDestination || "ESIS Dispensary",
        referralReason: curState.referralReason || "Primary clinical evaluation at local dispensary.",
        isPsychiatric: false,
      };

      const finalMsgs = [...updatedMsgsWithUser, fallbackReply];
      setMessages(finalMsgs);
      messagesRef.current = finalMsgs;
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    resetChat: () => {
      setMessages([]);
      setInputText("");
      setShowSummaryCard(false);
      lastProcessedSpeechRef.current = "";
      const emptyState = {
        suspectedCondition: null,
        differentialDiagnosis: [],
        severity: null,
        severityScore: null,
        redFlagsDetected: [],
        duration: null,
        medication: null,
        clinicalSummary: null,
        referralDestination: null,
        referralReason: null,
        isPsychiatric: false,
        isReadyForSummary: false,
      };
      setClinicalState(emptyState);
      clinicalStateRef.current = emptyState;
      clearCachedAiChatSession(chatSessionKey);
      onComplaintChange?.("", { triageState: emptyState, chatHistory: [] });
    },
    insertComplaintText: (text) => {
      if (text && text.trim()) {
        handleUserSubmit(text.trim(), false);
      }
    },
    canAnswerCurrentStage: () => true,
    processLiveSpeech: (speechText) => {
      if (!speechText || !speechText.trim()) return;
      const clean = speechText.trim();
      if (clean === lastProcessedSpeechRef.current) return;
      lastProcessedSpeechRef.current = clean;
      handleUserSubmit(clean, true);
    },
  }));

  const handleSendToRunTriage = () => {
    toast.success("Clinical Consultation complete — Sending details to Run Triage");
    const tState = {
      symptom: clinicalState.suspectedCondition,
      condition: clinicalState.suspectedCondition,
      severity: clinicalState.severity,
      duration: clinicalState.duration,
      medication: clinicalState.medication,
      associated: clinicalState.redFlagsDetected,
      referralDestination: clinicalState.referralDestination,
      referralReason: clinicalState.referralReason,
      isPsychiatric: clinicalState.isPsychiatric,
      notes: clinicalState.clinicalSummary,
    };
    onReadyToShowResult?.(tState);
    onRunTriage?.({ triageState: tState, chatHistory: messages });
  };

  const triage = triageResult?.triage;

  const effectiveCondition =
    triage?.primary_complaint ||
    triageResult?.primary_complaint ||
    clinicalState.suspectedCondition;

  const triageUrgency = triage?.urgency_level || triage?.assessed_severity;
  const rawSev = triageUrgency || clinicalState.severity;

  let effectiveSeverityLabel = null;
  let effectiveSeverityLevel = "Mild";

  if (rawSev) {
    effectiveSeverityLevel = normalizeUrgency(rawSev);
    effectiveSeverityLabel = effectiveSeverityLevel;
  }

  let effectiveReferral = null;
  if (triageResult) {
    // When formal triage result exists, dynamically show its primary referral destination
    effectiveReferral =
      triage?.call_referral_primary ||
      triage?.referral_destination ||
      (activeDirective?.badge ? activeDirective.badge : null) ||
      (clinicalState.referralDestination ? formatReferralDestination(clinicalState.referralDestination) : null);
  } else if (clinicalState.referralDestination) {
    // During live chat probing, update immediately on every caller turn
    effectiveReferral = formatReferralDestination(clinicalState.referralDestination);
  } else if (activeDirective?.badge && (!messages || !messages.length)) {
    effectiveReferral = activeDirective.badge;
  }

  return (
    <div
      className={`rounded-xl border border-emerald-500/30 bg-card overflow-hidden shadow-sm w-full max-w-full min-w-0 ${
        fillHeight ? "flex flex-col h-full min-h-0" : ""
      } ${className}`}
    >
      {/* 1. EKMS AI Triage & Referral Header */}
      <div className="border-b border-border/50 bg-secondary/30 px-3.5 py-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  {title || "EKMS AI"}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostic & Referral Status Indicators */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 max-w-[70%] sm:max-w-none">
            {effectiveSeverityLabel && (
              <span
                className={`rounded-md px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${
                  effectiveSeverityLevel === "Severe"
                    ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200"
                    : effectiveSeverityLevel === "Moderate"
                    ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
                }`}
              >
                {effectiveSeverityLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rate Limit Recovery Notice Banner / Popup */}
      {showApiLimitPopup && (
        <div className="mx-3 my-2 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 backdrop-blur-md p-3 sm:p-3.5 shadow-md shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-300 transition-all shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="rounded-xl bg-amber-500/20 p-1.5 sm:p-2 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 border border-amber-500/40 animate-pulse">
                <Clock className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-100">
                    LLM API Limit Reached
                  </span>
                  <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[9.5px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/40">
                    System In-Built Probing Active
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-950 dark:text-amber-200/90 leading-relaxed font-medium">
                  AI model limit reached. Switched to system in-built clinical probing questions. Please wait a few seconds for the limit to recover.
                </p>
                {recoverySeconds > 0 ? (
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="h-1.5 w-24 sm:w-36 rounded-full bg-amber-500/25 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${Math.max(5, ((20 - recoverySeconds) / 20) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300">
                      Auto-recovering in {recoverySeconds}s...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 pt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Limit window recovered — next query will connect to AI model</span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowApiLimitPopup(false)}
              className="rounded-lg p-1 text-amber-900/60 hover:text-amber-950 dark:text-amber-300/60 dark:hover:text-amber-100 hover:bg-amber-500/25 transition cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Chat Conversation Box */}
      <div
        ref={chatContainerRef}
        className={`${
          customChatHeight
            ? customChatHeight
            : fillHeight
            ? "flex-1 min-h-0"
            : "min-h-[380px] sm:min-h-[490px] max-h-[640px]"
        } space-y-3.5 p-3 sm:p-4 text-xs sm:text-sm overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        {/* Quick-Start Shortcuts */}
        {messages.length === 0 && (
          <div className="space-y-2.5 sm:space-y-3 py-2 sm:py-3 text-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-emerald-600/50 bg-emerald-50 px-3 py-2 sm:px-4 sm:py-2.5 text-[11px] sm:text-sm font-bold text-emerald-950 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-700 shrink-0" />
              <span>Type symptoms below or choose a primary complaint:</span>
            </div>

            {/* Mobile View: 6 Beautiful Small Symptom Pills in a clean 2-column grid */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 sm:hidden max-w-sm mx-auto">
              {MOBILE_SYMPTOM_SHORTCUTS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleUserSubmit(s.text)}
                  className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-foreground transition-all hover:border-emerald-600 hover:bg-emerald-50 active:scale-95 shadow-2xs text-left"
                >
                  <span className="text-xs shrink-0">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Desktop View: Beautiful Symptom Pills */}
            <div className="hidden sm:flex flex-wrap justify-center gap-2 pt-2.5 max-w-2xl mx-auto">
              {INITIAL_SYMPTOM_SHORTCUTS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleUserSubmit(s.text)}
                  className="group flex items-center gap-2 rounded-full border border-border/80 bg-white/95 pl-2.5 pr-4 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 shadow-2xs cursor-pointer"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] transition-colors group-hover:bg-emerald-100/90 shrink-0">
                    {s.icon}
                  </span>
                  <span className="tracking-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((m, mIdx) => {
          const isLatest = mIdx === messages.length - 1;
          const isCurrentActiveTurn = isLatest && (m.sender === "bot" || m.sender === "assistant");
          let cleanQuestionText = "";
          if (m.text) {
            cleanQuestionText = m.text.replace(/^Ask the (?:IP|caller|patient):\s*/i, "").trim();
            if (cleanQuestionText.startsWith('"') || cleanQuestionText.startsWith("'")) {
              cleanQuestionText = cleanQuestionText.replace(/^["']\s*/, "").replace(/["']\s*(\((?:Hinglish|Hindi):)/i, " $1");
            }
            cleanQuestionText = cleanQuestionText.replace(/(\((?:Hinglish|Hindi):\s*)["']/, "$1").replace(/["']\s*\)$/, ")");
          }

          return (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              {/* User Bubble */}
              {m.sender === "user" && (
                <div className="max-w-[85%] rounded-lg px-3.5 py-2.5 leading-relaxed bg-primary text-primary-foreground font-medium shadow-xs">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-primary-foreground/75 mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      <span>{getActiveAgentLabel()}</span>
                      <span className="font-normal opacity-80 normal-case tracking-normal">
                        &bull; {formatMsgTime(m)}
                      </span>
                    </div>
                    {(m.isVoice === true || m.source === "voice") && (
                      <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                        Voice NLP
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold">{m.text}</p>
                </div>
              )}

              {/* Previous Bot Turns (Collapsed in history) */}
              {m.sender === "bot" && !isCurrentActiveTurn && (
                <div className="max-w-[88%] rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5 text-foreground leading-relaxed">
                  <div className="flex items-start gap-2">
                    <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold mb-0.5">
                        <span className="text-emerald-800 dark:text-emerald-300 font-bold">EKMS AI Assistant</span>
                        <span className="font-normal text-muted-foreground">&bull; {formatMsgTime(m)}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium">
                        <span className="font-bold text-emerald-900">Ask the IP: </span>
                        &ldquo;{cleanQuestionText || m.text}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Probing Question Card (Doctronic style with smart suggestion chips) */}
              {isCurrentActiveTurn && (
                <div className="w-full rounded-xl border border-emerald-500/70 bg-emerald-50/70 p-3.5 shadow-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-950">
                            EKMS AI Assistant
                          </span>
                          <span className="text-[10px] font-medium text-emerald-850">
                            &bull; {formatMsgTime(m)}
                          </span>
                          {m.suspectedCondition && (
                            <span className="hidden sm:inline-flex text-[10px] font-bold text-emerald-900 bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-600/30">
                              Investigating: {m.suspectedCondition}
                            </span>
                          )}
                        </div>

                        {/* Relevance Feedback Buttons */}
                        <div className="flex items-center gap-1">
                          {questionFeedbackMap[m.id || m.text] ? (
                            <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                              {questionFeedbackMap[m.id || m.text] === "positive" ? "✓ Relevant" : "✓ Feedback noted"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground hidden sm:inline mr-0.5">Relevant?</span>
                              <button
                                type="button"
                                title="Mark question as clinically relevant"
                                onClick={() => handleQuestionFeedback(m, true)}
                                className="rounded p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-200/60 transition-colors cursor-pointer"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Mark question as irrelevant / improve"
                                onClick={() => handleQuestionFeedback(m, false)}
                                className="rounded p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-200/60 transition-colors cursor-pointer"
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">
                        {cleanQuestionText || m.text}
                      </p>
                    </div>
                  </div>

                  {/* Clickable Suggested Answers (Supports single or multi-selection) */}
                  {m.options && m.options.length > 0 && (
                    <div className="border-t border-emerald-500/30 pt-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-950">
                        <span className="flex items-center gap-1.5">
                          <span>Likely Answers from IP:</span>
                          <span className="text-[10px] font-normal text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-600/30">
                            Select one or more
                          </span>
                        </span>
                        {selectedOptions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedOptions([])}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
                          >
                            Clear selected ({selectedOptions.length})
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.options.map((rawOpt, idx) => {
                          const opt = cleanChipText(rawOpt);
                          if (!opt) return null;
                          const isSelected = selectedOptions.includes(opt);
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                setSelectedOptions((prev) => {
                                  if (prev.includes(opt)) {
                                    return prev.filter((o) => o !== opt);
                                  } else {
                                    return [...prev, opt];
                                  }
                                });
                              }}
                              className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10.5px] sm:text-[11px] font-semibold transition-all active:scale-95 text-left disabled:opacity-50 cursor-pointer ${
                                isSelected
                                  ? "border-emerald-700 bg-emerald-700 text-white shadow-xs font-bold"
                                  : "border-emerald-600/50 bg-white text-emerald-950 hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-50 hover:shadow-xs"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full border shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-white border-white"
                                    : "bg-emerald-600/20 border-emerald-600"
                                }`}
                              />
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Send Selected Options Button when 1 or more options selected */}
                      {selectedOptions.length > 0 && (
                        <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              const combined = selectedOptions.join(", ");
                              setSelectedOptions([]);
                              handleUserSubmit(combined);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            <span>
                              Submit Selected Answer{selectedOptions.length > 1 ? "s" : ""} ({selectedOptions.length})
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-500 italic">
                            or click any option again to deselect
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
            <span>EKMS AI is assessing and formulating next question...</span>
          </div>
        )}
      </div>

      {/* 4. Chat Input Box */}
      <div className="border-t border-border bg-secondary/30 p-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={chatInputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (selectedOptions.length > 0) {
                  const combined = inputText.trim()
                    ? `${selectedOptions.join(", ")}, ${inputText.trim()}`
                    : selectedOptions.join(", ");
                  setSelectedOptions([]);
                  handleUserSubmit(combined);
                } else if (inputText.trim()) {
                  handleUserSubmit();
                }
              }
            }}
            placeholder={
              selectedOptions.length > 0
                ? `${selectedOptions.length} option(s) selected — press Enter to submit...`
                : "Type what the caller said / answers (English / Hinglish)..."
            }
            className="flex-1 min-w-0 rounded-md border border-border/80 bg-background px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              if (selectedOptions.length > 0) {
                const combined = inputText.trim()
                  ? `${selectedOptions.join(", ")}, ${inputText.trim()}`
                  : selectedOptions.join(", ");
                setSelectedOptions([]);
                handleUserSubmit(combined);
              } else {
                handleUserSubmit();
              }
            }}
            disabled={loading || (!inputText.trim() && selectedOptions.length === 0)}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            title="Send answer to EKMS AI"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
