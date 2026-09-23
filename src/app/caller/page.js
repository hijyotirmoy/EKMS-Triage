"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Languages, Mic, MicOff, Phone, PhoneCall, PhoneOff, ShieldAlert, Sparkles, Volume2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { unlockMobileAudio, WebRtcCallSession } from "@/lib/webrtc";
import { SpeechStreamController } from "@/lib/speechRecognition";
import { getFirestoreDb } from "@/lib/firebase";
import { doc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";

export default function IpCallerPage() {
  const [phone, setPhone] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Agent 1");

  const [callState, setCallState] = useState("idle"); // 'idle' | 'calling' | 'ringing' | 'connected' | 'on_hold' | 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callerLang, setCallerLang] = useState("en-IN");
  const [liveTranscript, setLiveTranscript] = useState("");

  const callSessionRef = useRef(null);
  const speechCtrlRef = useRef(null);
  const bChannelRef = useRef(null);
  const scribeChannelRef = useRef(null);
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const callerLangRef = useRef(callerLang);
  useEffect(() => {
    callerLangRef.current = callerLang;
    speechCtrlRef.current?.setLanguage(callerLang);
  }, [callerLang]);

  const startSpeechRecognition = (callId) => {
    if (speechCtrlRef.current) {
      speechCtrlRef.current.stop();
    }
    const ctrl = new SpeechStreamController({
      lang: callerLangRef.current || "en-IN",
      onInterim: (text) => {
        setLiveTranscript(text);
        const activeCallId = callId || callSessionRef.current?.callId;
        const msg = {
          type: "transcript_interim",
          callId: activeCallId,
          speaker: "caller",
          speakerName: "Caller (IP)",
          text,
          timestamp: Date.now(),
        };
        // Notify Agent that caller is actively speaking right now
        bChannelRef.current?.postMessage({
          type: "caller_speaking",
          callId: activeCallId,
          text,
          active: true,
          timestamp: Date.now(),
        });
        bChannelRef.current?.postMessage(msg);
        scribeChannelRef.current?.postMessage(msg);
        try {
          localStorage.setItem("ekms_scribe_sync", JSON.stringify({ ...msg, _ts: Date.now() }));
        } catch (e) {}
        if (activeCallId) {
          try {
            const db = getFirestoreDb();
            setDoc(doc(db, "calls", activeCallId), {
              interimTranscript: msg,
              updatedAt: Date.now(),
            }, { merge: true }).catch(() => {});
          } catch (e) {}
          try {
            fetch("/api/call/signal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "transcript", callId: activeCallId, data: { transcript: msg } }),
            }).catch(() => {});
          } catch (e) {}
        }
      },
      onFinal: (text) => {
        setLiveTranscript("");
        const activeCallId = callId || callSessionRef.current?.callId;
        const msg = {
          id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "transcript_final",
          callId: activeCallId,
          speaker: "caller",
          speakerName: "Caller (IP)",
          text,
          isFinal: true,
          timestamp: Date.now(),
        };
        bChannelRef.current?.postMessage({
          type: "caller_speaking",
          callId: activeCallId,
          text,
          active: false,
          timestamp: Date.now(),
        });
        bChannelRef.current?.postMessage(msg);
        scribeChannelRef.current?.postMessage(msg);
        try {
          localStorage.setItem("ekms_scribe_sync", JSON.stringify({ ...msg, _ts: Date.now() }));
        } catch (e) {}
        if (activeCallId) {
          try {
            const db = getFirestoreDb();
            setDoc(doc(db, "calls", activeCallId), {
              transcripts: arrayUnion(msg),
              interimTranscript: null,
              updatedAt: Date.now(),
            }, { merge: true }).catch(() => {});
          } catch (e) {}
          try {
            fetch("/api/call/signal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "transcript", callId: activeCallId, data: { transcript: msg } }),
            }).catch(() => {});
          } catch (e) {}
        }
      },
    });
    speechCtrlRef.current = ctrl;
    ctrl.start();
  };

  // Main session lifecycle on mount
  useEffect(() => {
    // Set browser tab title
    document.title = "Triage Caller";

    if (typeof window !== "undefined") {
      try {
        bChannelRef.current = new BroadcastChannel("ekms-call-channel");
        scribeChannelRef.current = new BroadcastChannel("ekms-scribe-channel");
      } catch (e) {}
    }

    callSessionRef.current = new WebRtcCallSession({
      role: "caller",
      onStateChange: (state, details) => {
        setCallState(state);
        if (state === "calling" || state === "ringing") {
          if (!ringTimeoutRef.current) {
            ringTimeoutRef.current = setTimeout(() => {
              callSessionRef.current?.endCall(true);
              toast.error("No answer from operator (45s timeout). Call ended.");
            }, 45000);
          }
        } else if (state === "connected") {
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          toast.success("Connected with Triage Operator! Speak now.", { id: "caller-status" });
          startTimer();
          startSpeechRecognition(details?.callId || callSessionRef.current?.callId);
        } else if (state === "on_hold") {
          toast.warning("Call put on hold by Operator", { id: "caller-status" });
        } else if (state === "ended" || state === "idle") {
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          if (state === "ended") toast.info("Call ended", { id: "caller-status" });
          stopTimer();
          speechCtrlRef.current?.stop();
          setLiveTranscript("");
        }
      },
    });

    return () => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      speechCtrlRef.current?.stop();
      bChannelRef.current?.close();
      scribeChannelRef.current?.close();
      callSessionRef.current?.endCall();
      stopTimer();
    };
  }, []);

  // Ensure speech recognition remains active when caller tab is focused, tapped, or visible
  useEffect(() => {
    const handleCallerWakeup = () => {
      if (callState === "connected") {
        if (!speechCtrlRef.current || !speechCtrlRef.current.isListening) {
          startSpeechRecognition(callSessionRef.current?.callId);
        } else {
          speechCtrlRef.current.ensureListening();
        }
      }
    };

    window.addEventListener("focus", handleCallerWakeup);
    window.addEventListener("click", handleCallerWakeup);
    document.addEventListener("visibilitychange", handleCallerWakeup);

    const monitorInterval = setInterval(() => {
      if (callState === "connected") {
        speechCtrlRef.current?.ensureListening();
      }
    }, 1500);

    return () => {
      window.removeEventListener("focus", handleCallerWakeup);
      window.removeEventListener("click", handleCallerWakeup);
      document.removeEventListener("visibilitychange", handleCallerWakeup);
      clearInterval(monitorInterval);
    };
  }, [callState]);

  const startTimer = () => {
    stopTimer();
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTimer = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleStartCall = async () => {
    if (!phone.trim()) return toast.error("Please enter your phone number");
    try {
      unlockMobileAudio();
      await callSessionRef.current.startCall({
        phone: phone.trim(),
        name: "",
        targetAgent: selectedAgent,
      });
    } catch (err) {
      toast.error(err.message || "Failed to start call. Ensure microphone permissions are enabled.");
    }
  };

  const handleEndCall = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    callSessionRef.current?.endCall();
  };

  const handleToggleMute = () => {
    const muted = callSessionRef.current?.toggleMute();
    setIsMuted(muted);
    toast.info(muted ? "Microphone muted" : "Microphone unmuted");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30">
      <Toaster position="top-center" theme="dark" visibleToasts={1} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/logo.png" alt="EKMS Logo" className="h-7 w-7 sm:h-8 sm:w-8 object-contain" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white leading-none">EKMS Triage Caller</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs">
              <Languages className="mr-1 h-3 w-3 text-slate-400" />
              <select
                value={callerLang}
                onChange={(e) => setCallerLang(e.target.value)}
                className="bg-transparent text-[11px] font-semibold text-white outline-none cursor-pointer"
                title="Caller Spoken Language"
              >
                <option value="en-IN" className="bg-slate-900 text-white">English (India)</option>
                <option value="hi-IN" className="bg-slate-900 text-white">Hinglish / हिंदी</option>
                <option value="as-IN" className="bg-slate-900 text-white">Assamese / অসমীয়া</option>
              </select>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operator Online
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-4 sm:p-6">
        {callState === "idle" || callState === "ended" ? (
          /* Pre-Call Initiation Screen */
          <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-2xl shadow-emerald-950/20 backdrop-blur-md">
            <div className="text-center">
              <div className="mx-auto mb-3 sm:mb-4 flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <PhoneCall className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Call EKMS Helpline</h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Connect directly with a call-centre triage operator via real-time online voice call.
              </p>
            </div>

            <div className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4">
              {/* Agent Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Select Triage Operator Desk
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 px-3.5 text-base sm:text-sm font-semibold text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Agent 1">Agent 1 (Triage Desk 1)</option>
                  <option value="Agent 2">Agent 2 (Triage Desk 2)</option>
                  <option value="Agent 3">Agent 3 (Triage Desk 3)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Choose which active agent desk to connect your call to.
                </p>
              </div>

              {/* Phone input */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Mobile / Phone Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-semibold text-slate-400 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleStartCall()}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-14 pr-4 text-base font-mono font-medium text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Enter your 10-digit mobile number to connect directly with the EKMS triage operator.
                </p>
              </div>
            </div>

            <button
              onClick={handleStartCall}
              className="mt-5 sm:mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:brightness-110 active:scale-[0.98] touch-manipulation"
            >
              <Phone className="h-5 w-5 fill-current" />
              Call {selectedAgent} (Free Online Call)
            </button>

            <p className="mt-3.5 sm:mt-4 text-center text-[11px] text-slate-500">
              Microphone access required. Browser-to-browser encrypted voice communication.
            </p>
          </div>
        ) : (
          /* Active Call Screen (WhatsApp style) */
          <div className="flex flex-col items-center justify-between rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-5 sm:p-8 shadow-2xl min-h-[420px] sm:min-h-[500px]">
            {/* Top Status */}
            <div className="text-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  callState === "on_hold"
                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                    : "bg-slate-800/80 text-emerald-400"
                }`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                {callState === "calling" && `Dialing ${selectedAgent}...`}
                {callState === "ringing" && `Ringing ${selectedAgent}... (auto-cuts in 45s)`}
                {callState === "connected" && "Connected · Audio Live"}
                {callState === "on_hold" && "Call Placed On Hold by Operator"}
              </span>

              <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl font-bold text-white">EKMS Triage Control Room</h3>
              <p className="mt-1 text-xs text-slate-400">Operator: {selectedAgent} · Assam Tele-Triage Desk</p>

              {(callState === "connected" || callState === "on_hold") && (
                <p className="mt-2 text-2xl sm:text-3xl font-mono font-bold tracking-wider text-emerald-400">
                  {formatTimer(callDuration)}
                </p>
              )}
            </div>

            {/* Avatar & Pulse Waveform Animation */}
            <div className="relative my-6 sm:my-8 flex items-center justify-center">
              {/* Outer pulsing rings */}
              {callState !== "on_hold" && (
                <>
                  <div className="absolute h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-emerald-500/10 animate-ping" />
                  <div className="absolute h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-emerald-500/20 animate-pulse" />
                </>
              )}

              {/* Center avatar */}
              <div
                className={`relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full shadow-xl ring-4 ${
                  callState === "on_hold"
                    ? "bg-gradient-to-tr from-amber-600 to-yellow-500 ring-amber-500/30"
                    : "bg-gradient-to-tr from-emerald-600 to-teal-500 ring-emerald-500/30"
                }`}
              >
                <img src="/logo.png" alt="Triage Desk" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
              </div>
            </div>

            {/* Hold Banner or Audio Wave Bars */}
            {callState === "on_hold" ? (
              <div className="mb-4 sm:mb-6 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-amber-300 text-center">
                Agent placed call on hold · Please stay on the line
              </div>
            ) : callState === "connected" ? (
              <div className="mb-4 sm:mb-6 flex items-center gap-1.5">
                {[10, 20, 16, 26, 14, 20, 12, 24, 18].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 rounded-full bg-emerald-400 animate-pulse"
                  />
                ))}
              </div>
            ) : null}

            {/* Live speech feedback pill for caller */}
            {callState === "connected" && (
              <div className="mb-4 flex items-center justify-center max-w-full px-2">
                {liveTranscript ? (
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-3.5 py-1 text-xs text-emerald-300 font-medium animate-pulse shadow-sm">
                    <Mic className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="line-clamp-1 italic">&ldquo;{liveTranscript}&rdquo;</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-0.5 text-[11px] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Microphone Live · Speak your symptoms anytime</span>
                  </div>
                )}
              </div>
            )}

            {/* Call Action Controls */}
            <div className="flex items-center gap-5 sm:gap-6">
              {/* Mute Button */}
              <button
                onClick={handleToggleMute}
                disabled={callState !== "connected" && callState !== "on_hold"}
                className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95 touch-manipulation ${
                  isMuted
                    ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>

              {/* End Call Button */}
              <button
                onClick={handleEndCall}
                className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-950/60 transition-all duration-200 hover:bg-red-700 hover:scale-105 active:scale-95 touch-manipulation"
                title="End Call"
              >
                <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
