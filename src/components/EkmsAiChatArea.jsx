"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, RotateCcw, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export const EkmsAiChatArea = ({ onComplaintChange, onSyncFields, initialNotes }) => {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: "Namaste! Type caller's symptoms or complaint in English, Hindi or Hinglish to start EKMS AI adaptive questioning.",
      options: [
        "Chhati me dard ho raha hai (Chest Pain)",
        "Tez bukhar aur khansi hai (Fever & Cough)",
        "Kaam ke waqt chot lagi (Minor injury / Cut)",
        "Kheti me spray dawai chali gayi (Pesticide exposure)",
      ],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("symptom");
  const [triageState, setTriageState] = useState({
    symptom: null,
    severity: null,
    duration: null,
    associated: [],
    condition: null,
  });
  const [sessionId] = useState(() => "session-" + Math.random().toString(36).substring(2, 9));
  const messagesEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle external preset loaded
  useEffect(() => {
    if (initialNotes && initialNotes.trim()) {
      handleUserSubmit(initialNotes);
    }
  }, [initialNotes]);

  // Synchronize with parent intake form
  const notifyParent = (newMessages, newState) => {
    // Generate clean combined symptom notes from user complaints and verified answers
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

    // Auto-sync severity slider and duration dropdown if matched
    if (newState.duration && onSyncFields) {
      onSyncFields("duration", newState.duration);
    }
    if (newState.severity && onSyncFields) {
      const s = String(newState.severity).toLowerCase();
      if (s.includes("crushing") || s.includes("severe") || s.includes("high") || s.includes("unbearable")) {
        onSyncFields("severity_reported", 9);
      } else if (s.includes("moderate")) {
        onSyncFields("severity_reported", 6);
      } else if (s.includes("mild")) {
        onSyncFields("severity_reported", 3);
      }
    }
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
      const historyPayload = updatedMsgs.slice(-6).map((m) => ({
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

      const botReply = {
        id: "bot-" + Date.now(),
        sender: "bot",
        text: data.agentScript || data.answer || "Please provide further details regarding other symptoms.",
        options: data.options || [],
        stage: data.stage || null,
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
        options: ["Yes, sweating & pain", "Mild fever", "No other symptoms"],
      };
      const finalMsgs = [...updatedMsgs, fallbackBotMsg];
      setMessages(finalMsgs);
      notifyParent(finalMsgs, triageState);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    const welcome = [
      {
        id: "welcome-" + Date.now(),
        sender: "bot",
        text: "Chat cleared. Type caller's complaint notes to start a fresh adaptive triage questioning.",
        options: [
          "Chhati me dard ho raha hai (Chest Pain)",
          "Tez bukhar aur khansi hai (Fever & Cough)",
          "Kaam ke waqt chot lagi (Minor injury / Cut)",
          "Kheti me spray dawai chali gayi (Pesticide exposure)",
        ],
      },
    ];
    setMessages(welcome);
    setStage("symptom");
    const emptyState = { symptom: null, severity: null, duration: null, associated: [], condition: null };
    setTriageState(emptyState);
    onComplaintChange?.("", { triageState: emptyState, chatHistory: welcome });
  };

  const STAGES = [
    { id: "symptom", label: "1. Symptom" },
    { id: "severity", label: "2. Severity" },
    { id: "duration", label: "3. Duration" },
    { id: "associated", label: "4. Associated" },
    { id: "navigation", label: "5. Assessment" },
  ];

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-card overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-emerald-50/40 px-3.5 py-2.5 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="EKMS AI" className="h-5 w-5 object-contain" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-emerald-900 dark:text-emerald-300">
              EKMS AI Adaptive Questioning
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={resetChat}
          title="Restart Chat"
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Stepper bar */}
      <div className="flex items-center justify-between gap-1 border-b border-border/50 bg-secondary/30 px-3 py-1.5 text-[10px] font-semibold">
        {STAGES.map((s) => {
          const isActive = stage === s.id;
          return (
            <span
              key={s.id}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                isActive
                  ? "bg-emerald-500 text-white shadow-xs font-bold"
                  : "text-muted-foreground"
              }`}
            >
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

      {/* Chat scroll box */}
      <div className="max-h-[340px] min-h-[220px] space-y-3 overflow-y-auto p-3.5 text-xs sm:text-sm">
        {messages.map((m) => (
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

            {/* Render interactive quick-selection option chips */}
            {m.sender === "bot" && m.options?.length > 0 && (
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
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
            <span>EKMS AI is analyzing symptoms and adapting question...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
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
};
