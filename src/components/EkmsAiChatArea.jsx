"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, RotateCcw, Sparkles, CheckCircle2, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";

const INITIAL_SYMPTOM_SHORTCUTS = [
  {
    icon: "❤️",
    label: "Chest Pain",
    text: "Bohot tej chhati me dard ho raha hai, baayein haath me dard aur thanda pasina aa raha hai.",
  },
  {
    icon: "🌡️",
    label: "Fever",
    text: "Char din se tez bukhar hai, sookhi khansi aur badan dard hai.",
  },
  {
    icon: "🤕",
    label: "Headache",
    text: "Subah se tez sar dard ho raha hai aur chakkar aa raha hai.",
  },
  {
    icon: "🤢",
    label: "Gastric / Abdominal Pain",
    text: "Pet me tez dard ho raha hai aur ulti jaisa lag raha hai.",
  },
  {
    icon: "🩺",
    label: "Blood Pressure (High/Low)",
    text: "Ghabrahat ho rahi hai, chakkar aa raha hai aur BP badha hua lag raha hai.",
  },
  {
    icon: "🤧",
    label: "Cough & Cold",
    text: "Khansi aur sardi hai, gale me kharash aur halka bukhar hai.",
  },
  {
    icon: "🫁",
    label: "Breathlessness / Asthma",
    text: "Achanak saans lene me bohot dikkat ho rahi hai aur seene se seeti ki aawaz aa rahi hai.",
  },
  {
    icon: "⚡",
    label: "Cut / Injury at work",
    text: "Kaam ke waqt haath par chot aur cut lag gaya hai, khoon nikal raha tha.",
  },
  {
    icon: "🧪",
    label: "Pesticide Exposure",
    text: "Kheti me spray karte waqt pesticide aankh aur sharir me chali gayi, jalan aur ulti ho rahi hai.",
  },
  {
    icon: "🦿",
    label: "Body Ache & Fatigue",
    text: "Pure sharir me tez dard aur kamzori mehsoos ho rahi hai.",
  },
];

export const EkmsAiChatArea = forwardRef(function EkmsAiChatArea(
  { onComplaintChange, onSyncFields, initialNotes },
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

  // Synchronize with parent intake form
  const notifyParent = (newMessages, newState) => {
    const userInputs = newMessages
      .filter((m) => m.sender === "user")
      .map((m) => m.text)
      .join(" | ");

    const summaryParts = [];
    if (newState.symptom) summaryParts.push(`Primary: ${newState.symptom}`);
    if (newState.severity) summaryParts.push(`Severity: ${newState.severity}`);
    if (newState.duration) summaryParts.push(`Duration: ${newState.duration}`);
    if (newState.associated?.length) summaryParts.push(`Associated: ${newState.associated.join(", ")}`);
    if (newState.condition) summaryParts.push(`Identified Condition: ${newState.condition}`);

    const compiledNotes = userInputs + (summaryParts.length ? `\n[EKMS AI Findings: ${summaryParts.join(" | ")}]` : "");

    onComplaintChange?.(compiledNotes, {
      triageState: newState,
      chatHistory: newMessages,
    });
  };

  const handleUserSubmit = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;
    setInputText("");

    const userMsg = {
      id: "user-" + Date.now(),
      sender: "user",
      text,
    };

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setLoading(true);

    try {
      const historyPayload = updatedMsgs.slice(-8).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await fetch("/api/ekms-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          lastAnswer: messages[messages.length - 1]?.text || "",
          history: historyPayload,
          sessionId,
          currentTriage: triageState,
          currentStage: stage,
        }),
      });

      const data = await res.json();

      let nextState = { ...triageState };
      if (data.triageSummary) {
        nextState = {
          ...nextState,
          ...data.triageSummary,
          associated: Array.isArray(data.triageSummary.associated)
            ? data.triageSummary.associated
            : nextState.associated,
        };
      }
      if (data.stage) {
        setStage(data.stage);
      }

      // Check for disease/condition identification
      if (data.decision || data.diagnosis || data.triageSummary?.condition) {
        nextState.condition =
          data.decision?.condition || data.diagnosis || data.triageSummary?.condition;
      }

      setTriageState(nextState);

      // Auto-sync severity and duration directly from the AI detection
      if (data.detectedSeverity && onSyncFields) {
        onSyncFields("severity_reported", data.detectedSeverity);
      }
      if (data.detectedDuration && onSyncFields) {
        onSyncFields("duration", data.detectedDuration);
      }

      if (data.isComplete || data.stage === "complete") {
        toast.success(
          `AI auto-detected: Severity (${data.detectedSeverity}/10) & Duration ("${data.detectedDuration}"). You can adjust them if needed.`
        );
      }

      const botReply = {
        id: "bot-" + Date.now(),
        sender: "bot",
        text: data.agentScript || data.answer || "Please provide further details regarding other symptoms.",
        options: data.options || [],
        probingQuestions: data.probingQuestions || [],
        stage: data.stage || null,
        isMultiSelect: !!data.isMultiSelect,
        decision: data.decision || null,
      };

      const finalMsgs = [...updatedMsgs, botReply];
      setMessages(finalMsgs);
      notifyParent(finalMsgs, nextState);
    } catch (err) {
      console.warn("EKMS AI chat error:", err);
      const fallbackBotMsg = {
        id: "bot-err-" + Date.now(),
        sender: "bot",
        text: "Understood. Can you state if there is any radiating pain, sweating, or fever?",
        options: ["Cold sweating & clamminess", "Radiating pain to left arm", "None of these"],
        probingQuestions: [
          "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
          "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
          "Kya unhe koi pehle se dil ki bimari ya high BP hai? (History of cardiac disease or hypertension?)",
        ],
        isMultiSelect: true,
      };
      const finalMsgs = [...updatedMsgs, fallbackBotMsg];
      setMessages(finalMsgs);
      notifyParent(finalMsgs, triageState);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    resetChat,
  }));

  const resetChat = () => {
    setMessages([]);
    setStage("symptom");
    setSelectedAssociatedOptions([]);
    const emptyState = { symptom: null, severity: null, duration: null, associated: [], condition: null };
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
      {(triageState.symptom || triageState.severity || triageState.duration || triageState.condition) && (
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
                  <span>{m.text}</span>
                </div>
              </div>

              {/* Render interactive options on the latest bot message */}
              {m.sender === "bot" && isLatest && m.options?.length > 0 && (
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
