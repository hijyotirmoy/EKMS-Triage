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
} from "lucide-react";
import { toast } from "sonner";
import { extractClinicalEntities } from "@/lib/clinicalAdaptiveEngine";
import { isWhisperHallucination } from "@/lib/speechRecognition";
import { detectDirectCallerReferralIntent } from "@/lib/doctorChatEngine";

const INITIAL_SYMPTOM_SHORTCUTS = [
  { icon: "🧠", label: "Depression / Counselling", text: "Caller feels deeply depressed, hopeless, and crying" },
  { icon: "❤️", label: "Chest Pain / Pressure", text: "Severe chest pain and heavy pressure" },
  { icon: "⚡", label: "Weakness & Dizziness", text: "Patient has extreme weakness and dizziness" },
  { icon: "🌡️", label: "Fever & Chills", text: "High fever with chills and shivering" },
  { icon: "🤢", label: "Vomiting & Nausea", text: "Continuous vomiting and unable to keep fluids" },
  { icon: "🤕", label: "Severe Headache", text: "Severe throbbing headache and blurred vision" },
  { icon: "🥘", label: "Abdominal / Stomach Pain", text: "Severe stomach cramps and gastric pain" },
  { icon: "🩸", label: "Workplace Injury / Cut", text: "Deep cut and bleeding from injury at work" },
  { icon: "🎗️", label: "HIV / AIDS", text: "Caller inquiry regarding HIV / AIDS symptoms, testing, PEP, or sexual health counseling" },
];

const MOBILE_SYMPTOM_SHORTCUTS = [
  { icon: "❤️", label: "Chest Pain / Pressure", text: "Severe chest pain and heavy pressure" },
  { icon: "🌡️", label: "Fever & Chills", text: "High fever with chills and shivering" },
  { icon: "🎗️", label: "HIV / AIDS", text: "Caller inquiry regarding HIV / AIDS symptoms, testing, PEP, or sexual health counseling" },
  { icon: "⚡", label: "Weakness & Dizziness", text: "Patient has extreme weakness and dizziness" },
  { icon: "🤕", label: "Severe Headache", text: "Severe throbbing headache and blurred vision" },
  { icon: "🧠", label: "Depression / Counsel", text: "Caller feels deeply depressed, hopeless, and crying" },
];

function formatReferralDestination(dest) {
  return dest || "";
}

function formatReferralReason(reason) {
  return reason || "";
}

export const EkmsAiChatArea = forwardRef(function EkmsAiChatArea(
  { onComplaintChange, onSyncFields, initialNotes, onReadyToShowResult, onRunTriage },
  ref
) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSummaryCard, setShowSummaryCard] = useState(false);

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
  const chatContainerRef = useRef(null);
  const lastProcessedSpeechRef = useRef("");
  const messagesRef = useRef(messages);
  const clinicalStateRef = useRef(clinicalState);

  useEffect(() => {
    messagesRef.current = messages;
    clinicalStateRef.current = clinicalState;
  }, [messages, clinicalState]);

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

  // Sync findings to parent intake form
  const notifyParent = (newMessages, newState) => {
    const summary = newState.clinicalSummary
      ? `[Clinical Findings: ${newState.clinicalSummary}]`
      : newState.suspectedCondition
      ? `[Suspected: ${newState.suspectedCondition} | Severity: ${newState.severity} | Duration: ${newState.duration || "Noted"}]`
      : "";

    onComplaintChange?.(summary, {
      triageState: {
        symptom: newState.suspectedCondition,
        condition: newState.suspectedCondition,
        suspectedCondition: newState.suspectedCondition,
        severity: newState.severity,
        severityScore: newState.severityScore,
        duration: newState.duration,
        medication: newState.medication,
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
    const rawText = (textToSend || inputText).trim();
    if (!rawText || loading) return;

    // Reject silence/subtitle hallucinations
    if (isWhisperHallucination(rawText)) {
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

    const userMsg = {
      id: "user-" + Date.now(),
      sender: "user",
      text: rawText,
      rawText,
      isNlpExtracted: Boolean(nlp.hasClinicalContent && nlp.cleanKeywords),
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
        medication: data.medication || curState.medication,
        clinicalSummary: data.clinicalSummary || curState.clinicalSummary,
        referralDestination: effectiveReferral,
        referralReason: effectiveReason,
        isPsychiatric: Boolean(
          data.isPsychiatric ??
          curState.isPsychiatric ??
          (directIntent?.destination === "Psychological Counselling Department")
        ),
        isReadyForSummary: Boolean(data.isReadyForSummary || (updatedMsgsWithUser.length >= 8) || Boolean(directIntent)),
      };

      setClinicalState(nextClinicalState);
      clinicalStateRef.current = nextClinicalState;

      // Auto-sync severity and duration with the triage form
      if (nextClinicalState.severityScore && onSyncFields) {
        onSyncFields("severity_reported", nextClinicalState.severityScore);
      }
      if (nextClinicalState.duration && onSyncFields) {
        onSyncFields("duration", nextClinicalState.duration);
      }

      const botReply = {
        id: "bot-" + Date.now(),
        sender: "bot",
        text: data.agentScript || data.answer || "Could you describe any other symptoms?",
        options: data.options || data.suggestedAnswers || [],
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
      // Fallback response if network disconnects
      const fallbackReply = {
        id: "bot-" + Date.now(),
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

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card overflow-hidden shadow-sm w-full max-w-full min-w-0">
      {/* 1. EKMS AI Triage & Referral Header */}
      <div className="border-b border-border/50 bg-secondary/30 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  EKMS AI
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostic & Referral Status Indicators */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 max-w-[70%] sm:max-w-none">
            {clinicalState.suspectedCondition && (
              <span className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100/90 px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-[11px] font-bold text-emerald-950 shadow-2xs">
                <Activity className="h-3 w-3 text-emerald-700 shrink-0" />
                <span className="max-w-[100px] sm:max-w-[170px] truncate">{clinicalState.suspectedCondition}</span>
              </span>
            )}
            {clinicalState.severity && messages.length > 0 && (
              <span
                className={`rounded-md px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${
                  clinicalState.severity === "High"
                    ? "bg-rose-100 text-rose-950 border-rose-300"
                    : clinicalState.severity === "Moderate"
                    ? "bg-amber-100 text-amber-950 border-amber-300"
                    : "bg-emerald-100 text-emerald-950 border-emerald-300"
                }`}
              >
                {clinicalState.severity}
              </span>
            )}
            {clinicalState.referralDestination && (
              <span className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-bold text-primary shadow-2xs">
                <PhoneForwarded className="h-3 w-3 shrink-0" />
                <span className="max-w-[110px] sm:max-w-[280px] truncate">{formatReferralDestination(clinicalState.referralDestination)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Chat Conversation Box */}
      <div
        ref={chatContainerRef}
        className="min-h-[380px] sm:min-h-[490px] max-h-[640px] space-y-3.5 p-3 sm:p-4 text-xs sm:text-sm overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
          const isCurrentActiveTurn = isLatest && m.sender === "bot";
          const cleanQuestionText = m.text ? m.text.replace(/^Ask the (IP|caller|patient):\s*['"]?|['"]?$/gi, "").trim() : "";

          return (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              {/* User Bubble */}
              {m.sender === "user" && (
                <div className="max-w-[85%] rounded-lg px-3.5 py-2.5 leading-relaxed bg-primary text-primary-foreground font-medium shadow-xs">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground/75 mb-0.5">
                    <Sparkles className="h-3 w-3" />
                    <span>Caller Response</span>
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
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-950">
                          Ask the IP:
                        </span>
                        {m.suspectedCondition ? (
                          <span className="hidden sm:inline-flex text-[10px] font-bold text-emerald-900 bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-600/30">
                            Investigating: {m.suspectedCondition}
                          </span>
                        ) : (
                          <div />
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">
                        {cleanQuestionText || m.text}
                      </p>
                    </div>
                  </div>

                  {/* Clickable Suggested Answers */}
                  {m.options && m.options.length > 0 && (
                    <div className="border-t border-emerald-500/30 pt-2.5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-950">
                        <span>Likely Answers from IP (Click to select):</span>
                        <span className="text-[10px] text-slate-600 font-medium">
                          or type exact answer below
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.options.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={loading}
                            onClick={() => handleUserSubmit(opt)}
                            className="group flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10.5px] sm:text-[11px] font-semibold text-emerald-950 transition-all hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-100 hover:shadow-xs active:scale-95 text-left disabled:opacity-50"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
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
            placeholder="Type what the caller said / answers (English / हिंदी / Hinglish)..."
            className="flex-1 min-w-0 rounded-md border border-border/80 bg-background px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => handleUserSubmit()}
            disabled={loading || !inputText.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
            title="Send answer to EKMS AI"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
