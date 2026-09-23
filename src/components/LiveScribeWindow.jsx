"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  FileText,
  Languages,
  Mic,
  PhoneCall,
  Sparkles,
  User,
  Volume2,
  Headphones,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { speakText } from "@/lib/speechRecognition";

export const LiveScribeWindow = ({
  transcripts = [],
  interimTranscript = null,
  isCallActive = false,
  callDuration = 0,
  activeCaller = null,
  onInsertToComplaint,
  onLanguageChange,
  currentLanguage = "en-IN",
}) => {
  const [copied, setCopied] = useState(false);
  const chatContainerRef = useRef(null);

  // Auto-scroll ONLY the chat container, preventing the browser page from jumping to the Run button
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcripts, interimTranscript]);

  const formatTimer = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleCopy = () => {
    if (!transcripts.length) return;
    const formatted = transcripts
      .map(
        (t) =>
          `[${t.speakerName || (t.speaker === "caller" ? "Caller (IP)" : "Agent (You)")}]: ${t.text}`
      )
      .join("\n");
    navigator.clipboard?.writeText(formatted);
    setCopied(true);
    toast.success("Call transcript copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertComplaint = () => {
    // Collect caller's spoken symptoms
    const callerSpeech = transcripts
      .filter((t) => t.speaker === "caller")
      .map((t) => t.text)
      .join(". ");

    if (callerSpeech) {
      onInsertToComplaint?.(callerSpeech);
      toast.success("Caller symptoms inserted into Complaint Notes");
    } else if (transcripts.length > 0) {
      const allSpeech = transcripts
        .map((t) => `${t.speaker === "caller" ? "Caller" : "Agent"}: ${t.text}`)
        .join("\n");
      onInsertToComplaint?.(allSpeech);
      toast.success("Conversation inserted into Complaint Notes");
    } else {
      toast.info("No spoken dialogue transcribed yet");
    }
  };

  return (
    <div className="panel flex flex-col h-[600px] overflow-hidden border border-border shadow-md">
      {/* 1. Header Bar */}
      <div className="border-b border-border bg-secondary/30 px-3.5 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status & Caller Info */}
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              {isCallActive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isCallActive ? "bg-emerald-500" : "bg-muted-foreground/50"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  Live Call Scribe
                </h3>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                  {isCallActive ? "LIVE" : "RECORDED"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {activeCaller?.caller_name || "IP Caller"} · {formatTimer(callDuration)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Language Selector */}
            <div className="flex items-center rounded-lg border border-border/80 bg-background px-1.5 py-0.5 text-xs">
              <Languages className="mr-1 h-3 w-3 text-muted-foreground" />
              <select
                value={currentLanguage}
                onChange={(e) => onLanguageChange?.(e.target.value)}
                className="bg-transparent text-[10px] sm:text-[11px] font-semibold text-foreground outline-none cursor-pointer"
                title="Scribe Speech Language"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hinglish / हिंदी</option>
                <option value="as-IN">Assamese / অসমীয়া</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            {/* Insert into complaint button */}
            <button
              type="button"
              onClick={handleInsertComplaint}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-50 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
              title="Auto-fill complaint notes from transcribed caller speech"
            >
              <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Use in</span> Complaint
            </button>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-muted-foreground transition hover:text-foreground hover:bg-secondary"
              title="Copy conversation transcript"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Audio Waveform Banner when call is active */}
        {isCallActive && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-1.5">
              <Mic className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>Two-way voice streaming live · Caller (IP) on left, Agent on right.</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="h-1.5 w-0.5 bg-emerald-500 animate-pulse" />
              <span className="h-3 w-0.5 bg-emerald-500 animate-pulse delay-75" />
              <span className="h-2 w-0.5 bg-emerald-500 animate-pulse delay-150" />
              <span className="h-3.5 w-0.5 bg-emerald-500 animate-pulse delay-100" />
              <span className="h-1.5 w-0.5 bg-emerald-500 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* 2. Live Chat Dialogue Feed with internal scrolling */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/20 scroll-smooth"
      >
        {transcripts.length === 0 && !interimTranscript ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border/80 text-muted-foreground">
              <PhoneCall className="h-5 w-5 text-primary/70 animate-bounce" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">
              Listening to Call Dialogue...
            </h4>
            <p className="mt-1 max-w-xs text-[11px] text-muted-foreground leading-relaxed">
              When the caller (IP) speaks, their words appear on the{" "}
              <strong className="text-foreground">left</strong>. When the agent speaks,
              their words appear on the{" "}
              <strong className="text-foreground">right</strong>.
            </p>
          </div>
        ) : (
          <>
            {transcripts.map((item, idx) => {
              const isCaller = item.speaker === "caller";
              return (
                <div
                  key={item.id || idx}
                  className={`flex items-start gap-1.5 sm:gap-2 ${
                    isCaller ? "justify-start" : "justify-end"
                  } animate-in fade-in duration-150`}
                >
                  {/* Caller Avatar (Left) */}
                  {isCaller && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}

                  {/* Compact Message Bubble */}
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-1.5 shadow-2xs ${
                      isCaller
                        ? "rounded-tl-xs bg-white text-slate-900 border border-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
                        : "rounded-tr-xs bg-primary text-primary-foreground shadow-xs"
                    }`}
                  >
                    {/* Slim Inline Header: Speaker Name + Time + TTS Button */}
                    <div className="flex items-center justify-between gap-2.5 text-[10px] leading-tight mb-0.5">
                      <span
                        className={`font-bold uppercase tracking-wider ${
                          isCaller
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-primary-foreground/90 font-extrabold"
                        }`}
                      >
                        {isCaller ? (item.speakerName || "Caller (IP)") : "Agent (You)"}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-mono text-[9px] ${
                            isCaller
                              ? "text-muted-foreground/80"
                              : "text-primary-foreground/75"
                          }`}
                        >
                          {new Date(item.timestamp || Date.now()).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => speakText(item.text, currentLanguage)}
                          className={`rounded p-0.5 transition hover:opacity-100 opacity-60 ${
                            isCaller
                              ? "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                              : "text-primary-foreground hover:text-white"
                          }`}
                          title="Listen audio (Text-to-speech)"
                        >
                          <Volume2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs leading-normal font-normal whitespace-pre-wrap">
                      {item.text}
                    </p>
                  </div>

                  {/* Agent Avatar (Right) */}
                  {!isCaller && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 mt-0.5">
                      <Headphones className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Interim Speech Preview (Active utterance currently being spoken) */}
            {interimTranscript && (
              <div
                className={`flex items-start gap-1.5 sm:gap-2 ${
                  interimTranscript.speaker === "caller"
                    ? "justify-start"
                    : "justify-end"
                } opacity-90`}
              >
                {interimTranscript.speaker === "caller" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 mt-0.5">
                    <User className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-xl px-3 py-1.5 border border-dashed animate-pulse ${
                    interimTranscript.speaker === "caller"
                      ? "rounded-tl-xs bg-emerald-50/80 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "rounded-tr-xs bg-primary/90 text-primary-foreground border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px] mb-0.5 font-bold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>
                      {interimTranscript.speaker === "caller"
                        ? "Caller speaking..."
                        : "You speaking..."}
                    </span>
                  </div>
                  <p className="text-xs italic leading-normal">
                    {interimTranscript.text}...
                  </p>
                </div>

                {interimTranscript.speaker !== "caller" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 mt-0.5">
                    <Headphones className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Footer Bar */}
      <div className="border-t border-border bg-background px-3.5 py-2 sm:px-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3 text-primary" />
          <span>{transcripts.length} utterances captured</span>
        </span>
        <span className="text-[10px] font-mono">
          Web Speech &amp; Gemini AI
        </span>
      </div>
    </div>
  );
};
