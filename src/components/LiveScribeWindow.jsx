"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  FileText,
  Languages,
  Mic,
  PhoneCall,
  User,
  Volume2,
  Headphones,
  Check,
  Square,
  Play,
  Sparkles,
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
  transcribeMode = "live_call", // 'live_call' | 'manual_room'
  onTranscribeModeChange,
  currentManualSpeaker = "caller",
  onManualSpeakerToggle,
  onClearTranscripts,
  isManualRecording = false,
  onStartManualRecording,
  onStopManualRecording,
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
    if (!transcripts.length && !interimTranscript?.text) return;
    const allText = transcripts.map((t) => t.text).join(" ");
    const formatted =
      transcribeMode === "manual_room"
        ? allText
        : transcripts
            .map(
              (t) =>
                `[${t.speakerName || (t.speaker === "caller" ? "Caller (IP)" : "Agent (You)")}]: ${t.text}`
            )
            .join("\n");

    navigator.clipboard?.writeText(formatted);
    setCopied(true);
    toast.success("Transcript copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopAndSave = () => {
    onStopManualRecording?.();
    const fullSpeech = transcripts.map((t) => t.text).join(" ").trim();
    const fullWithInterim = interimTranscript?.text
      ? `${fullSpeech} ${interimTranscript.text}`.trim()
      : fullSpeech;

    if (fullWithInterim) {
      onInsertToComplaint?.(fullWithInterim);
      toast.success("Recording stopped & conversation saved to Complaint Notes!");
    } else {
      toast.info("Recording stopped. No spoken dialogue was recorded.");
    }
  };

  return (
    <div className="panel flex flex-col h-[600px] overflow-hidden border border-border shadow-md w-full max-w-full min-w-0">
      {/* 1. Header Bar */}
      <div className="border-b border-border bg-secondary/30 px-3.5 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status & Caller Info */}
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              {(isCallActive || transcribeMode === "manual_room") && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${transcribeMode === "manual_room" ? "bg-indigo-500" : "bg-emerald-500"} opacity-75`} />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  transcribeMode === "manual_room"
                    ? "bg-indigo-500"
                    : isCallActive
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/50"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  {transcribeMode === "manual_room" ? "Room Scribe" : "Live Call Scribe"}
                </h3>
                <span className={`rounded-full border px-1.5 py-0.2 text-[9px] font-bold ${
                  transcribeMode === "manual_room"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-950"
                    : isCallActive
                    ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                    : "bg-secondary border-border text-foreground/75"
                }`}>
                  {transcribeMode === "manual_room" ? "ROOM MIC LIVE" : isCallActive ? "LIVE" : "RECORDED"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {transcribeMode === "manual_room"
                  ? "Real-time speech to text (No call required)"
                  : `${activeCaller?.caller_name || "IP Caller"} · ${formatTimer(callDuration)}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mode Switcher: Live Call vs. Manual Room Transcribe */}
            <div className="flex items-center rounded-lg border border-border/80 bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onTranscribeModeChange?.("live_call")}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition ${
                  transcribeMode === "live_call"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Live Call Mode: 2-way digital stream (Headset mic = Agent, Remote stream = Caller)"
              >
                <Headphones className="h-3 w-3" />
                <span className="hidden sm:inline">Live Call</span>
              </button>
              <button
                type="button"
                onClick={() => onTranscribeModeChange?.("manual_room")}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition ${
                  transcribeMode === "manual_room"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Manual Room Mode: Single Agent Mic listens to both Agent & Caller in room and auto-detects"
              >
                <Mic className="h-3 w-3" />
                <span className="hidden sm:inline">Manual Room</span>
              </button>
            </div>

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
          </div>
        </div>

        {/* Audio Waveform / Mode Banner */}
        {transcribeMode === "manual_room" ? (
          <div className={`mt-2 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition shadow-2xs ${
            isManualRecording
              ? "bg-rose-50 border-rose-300 text-rose-950"
              : "bg-indigo-50 border-indigo-300 text-indigo-950"
          }`}>
            <div className="flex items-center gap-1.5">
              {isManualRecording ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                  <Mic className="h-3 w-3 text-rose-600 animate-pulse" />
                  <span>
                    <strong>Recording Active:</strong> Listening live · Words typed immediately. Click <strong>Stop &amp; Save</strong> in the dictation box when done.
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                  </span>
                  <Mic className="h-3 w-3 text-indigo-600" />
                  <span>
                    <strong>Manual Room Standby:</strong> Click <strong>Start Recording</strong> below to begin voice typing.
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {onClearTranscripts && transcripts.length > 0 && (
                <button
                  type="button"
                  onClick={onClearTranscripts}
                  className="flex items-center gap-1 rounded bg-secondary hover:bg-secondary/80 border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Clear current transcript"
                >
                  Clear Scribe
                </button>
              )}
            </div>
          </div>
        ) : isCallActive ? (
          <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-400 px-2.5 py-1 text-[10px] text-emerald-950 font-bold shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Headphones className="h-3 w-3 text-emerald-700 animate-pulse shrink-0" />
              <span className="truncate sm:whitespace-normal">Two-way live call · Headset mic = Agent (You), Remote stream = Caller (IP)</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="h-1.5 w-0.5 bg-emerald-600 animate-pulse" />
              <span className="h-3 w-0.5 bg-emerald-600 animate-pulse delay-75" />
              <span className="h-2 w-0.5 bg-emerald-600 animate-pulse delay-150" />
              <span className="h-3.5 w-0.5 bg-emerald-600 animate-pulse delay-100" />
              <span className="h-1.5 w-0.5 bg-emerald-600 animate-pulse" />
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. Dialogue / Voice Typing Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/70 scroll-smooth"
      >
        {transcribeMode === "manual_room" ? (
          /* Voice Typing Mode: Single unified continuous real-time typing */
          <div className="h-full flex flex-col">
            {!isManualRecording && transcripts.length === 0 && !interimTranscript ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-6 space-y-3">
                <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border ${
                  isManualRecording
                    ? "bg-rose-50 border-rose-300 text-rose-700"
                    : "bg-indigo-50 border-indigo-300 text-indigo-700"
                }`}>
                  {isManualRecording && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-2xl bg-rose-400 opacity-20" />
                  )}
                  <Mic className={`h-7 w-7 ${isManualRecording ? "animate-pulse text-rose-700" : "text-indigo-700"}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {isManualRecording ? "Listening & Typing Live..." : "Manual Room Voice Scribe"}
                  </h4>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
                    {isManualRecording
                      ? "Start speaking. Words and letters are transcribed and typed out in real time without delay. Click 'Stop & Save' when done."
                      : "Click 'Start Recording' to begin speech-to-text dictation. When finished speaking, click 'Stop & Save' to save directly into Complaint Notes."}
                  </p>
                </div>
                {isManualRecording ? (
                  <button
                    type="button"
                    onClick={handleStopAndSave}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition animate-pulse cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Stop &amp; Save Conversation</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStartManualRecording}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>Start Recording</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-indigo-500/25 bg-card p-4 sm:p-5 shadow-xs overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-border text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold text-indigo-700">
                    <span className={`h-2 w-2 rounded-full ${isManualRecording ? "bg-rose-500 animate-ping" : "bg-indigo-600"}`} />
                    {isManualRecording ? "Live Dictation Feed (Recording)" : "Recorded Dictation Feed"}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{transcripts.length} segments recorded</span>
                    {isManualRecording ? (
                      <button
                        type="button"
                        onClick={handleStopAndSave}
                        className="flex items-center gap-1 rounded bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 text-[10px] font-bold transition shadow-xs cursor-pointer animate-pulse"
                      >
                        <Square className="h-2.5 w-2.5 fill-white" />
                        Stop &amp; Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onStartManualRecording}
                        className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 text-[10px] font-bold transition shadow-xs cursor-pointer"
                      >
                        <Play className="h-2.5 w-2.5 fill-white" />
                        Resume Recording
                      </button>
                    )}
                    {onClearTranscripts && (
                      <button
                        type="button"
                        onClick={onClearTranscripts}
                        className="text-[10px] text-muted-foreground hover:text-red-500 transition underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-sm sm:text-base leading-relaxed tracking-normal font-normal text-foreground select-text whitespace-pre-wrap flex-1">
                  {transcripts.map((item, idx) => (
                    <span key={item.id || idx} className="inline mr-1.5">
                      {item.text}
                    </span>
                  ))}

                  {/* Real-time live words typing out with pulsating cursor */}
                  {interimTranscript ? (
                    <span className="inline font-medium text-indigo-700">
                      {interimTranscript.text}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-600 animate-pulse align-middle rounded-xs" />
                    </span>
                  ) : (
                    transcripts.length === 0 && (
                      <span className="inline text-muted-foreground italic text-xs sm:text-sm">
                        🎙️ Listening to room speech... Start speaking now
                        <span className="inline-block w-1.5 h-3.5 ml-1.5 bg-rose-500 animate-pulse align-middle rounded-xs" />
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Live Call Mode: Two-way dialogue with Caller & Agent bubbles */
          <>
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
                      } animate-in fade-in duration-150 mb-2`}
                    >
                      {/* Caller Avatar (Left) */}
                      {isCaller && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-950 border border-emerald-400 mt-0.5 shadow-2xs">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}

                      {/* Compact Message Bubble */}
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-1.5 shadow-2xs ${
                          isCaller
                            ? "rounded-tl-xs bg-white text-slate-900 border border-slate-300"
                            : "rounded-tr-xs bg-primary text-primary-foreground shadow-xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2.5 text-[10px] leading-tight mb-0.5">
                          <span
                            className={`font-extrabold uppercase tracking-wider ${
                              isCaller
                                ? "text-emerald-800"
                                : "text-primary-foreground/95 font-extrabold"
                            }`}
                          >
                            {isCaller ? (item.speakerName || "Caller (IP)") : "Agent (You)"}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-mono text-[9px] ${
                                isCaller
                                  ? "text-slate-600 font-semibold"
                                  : "text-primary-foreground/80"
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
                              className={`rounded p-0.5 transition hover:opacity-100 opacity-70 ${
                                isCaller
                                  ? "text-slate-700 hover:text-slate-950"
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
                      className={`max-w-[80%] rounded-xl px-3 py-1.5 border border-dashed animate-pulse shadow-2xs ${
                        interimTranscript.speaker === "caller"
                          ? "rounded-tl-xs bg-emerald-50 text-emerald-950 border-emerald-400"
                          : "rounded-tr-xs bg-primary text-primary-foreground border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] mb-0.5 font-bold uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                        <span>
                          {interimTranscript.speaker === "caller"
                            ? "Caller speaking..."
                            : "You speaking..."}
                        </span>
                      </div>
                      <p className="text-xs italic leading-normal flex items-center flex-wrap">
                        <span>{interimTranscript.text}</span>
                        <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-600 animate-pulse shrink-0 rounded-xs" />
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
          </>
        )}
      </div>

      {/* 3. Footer Bar */}
      <div className="border-t border-border bg-background px-3.5 py-2 sm:px-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3 text-primary" />
          <span>{transcripts.length} utterances captured</span>
        </span>
      </div>
    </div>
  );
};
