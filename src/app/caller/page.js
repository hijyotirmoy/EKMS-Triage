"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { unlockMobileAudio, WebRtcCallSession } from "@/lib/webrtc";

export default function IpCallerPage() {
  const [phone, setPhone] = useState("");

  const [callState, setCallState] = useState("idle"); // 'idle' | 'calling' | 'ringing' | 'connected' | 'on_hold' | 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const callSessionRef = useRef(null);
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  useEffect(() => {
    // Set browser tab title
    document.title = "triage caller";

    callSessionRef.current = new WebRtcCallSession({
      role: "caller",
      onStateChange: (state) => {
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
          toast.success("Connected with Triage Operator! Speak now.");
          startTimer();
        } else if (state === "on_hold") {
          toast.warning("Call put on hold by Operator");
        } else if (state === "ended" || state === "idle") {
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          if (state === "ended") toast.info("Call ended");
          stopTimer();
        }
      },
    });

    return () => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      callSessionRef.current?.endCall();
      stopTimer();
    };
  }, []);

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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30">
      <Toaster position="top-center" theme="dark" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="EKMS Logo" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="text-base font-bold text-white leading-none">EKMS Triage Caller</h1>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Operator Online
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-5 sm:p-6">
        {callState === "idle" || callState === "ended" ? (
          /* Pre-Call Initiation Screen */
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur-md">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <PhoneCall className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Call ESIC / ESIS Helpline</h2>
              <p className="mt-1.5 text-xs text-slate-400">
                Connect directly with a call-centre triage operator via real-time online voice call.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">
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
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Enter your 10-digit mobile number to connect directly with the ESIC/ESIS triage operator.
                </p>
              </div>
            </div>

            <button
              onClick={handleStartCall}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Phone className="h-5 w-5 fill-current" />
              Call Triage Operator (Free Online Call)
            </button>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Microphone access required. Browser-to-browser encrypted voice communication.
            </p>
          </div>
        ) : (
          /* Active Call Screen (WhatsApp style) */
          <div className="flex flex-col items-center justify-between rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-8 shadow-2xl min-h-[500px]">
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
                {callState === "calling" && "Dialing Operator..."}
                {callState === "ringing" && "Ringing Operator Console... (auto-cuts in 45s)"}
                {callState === "connected" && "Connected · Audio Live"}
                {callState === "on_hold" && "Call Placed On Hold by Operator"}
              </span>

              <h3 className="mt-4 text-xl font-bold text-white">EKMS Triage Control Room</h3>
              <p className="mt-1 text-xs text-slate-400">Operator: Assam Tele-Triage Desk</p>

              {(callState === "connected" || callState === "on_hold") && (
                <p className="mt-2 text-2xl font-mono font-bold tracking-wider text-emerald-400">
                  {formatTimer(callDuration)}
                </p>
              )}
            </div>

            {/* Avatar & Pulse Waveform Animation */}
            <div className="relative my-8 flex items-center justify-center">
              {/* Outer pulsing rings */}
              {callState !== "on_hold" && (
                <>
                  <div className="absolute h-40 w-40 rounded-full bg-emerald-500/10 animate-ping" />
                  <div className="absolute h-32 w-32 rounded-full bg-emerald-500/20 animate-pulse" />
                </>
              )}

              {/* Center avatar */}
              <div
                className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-xl ring-4 ${
                  callState === "on_hold"
                    ? "bg-gradient-to-tr from-amber-600 to-yellow-500 ring-amber-500/30"
                    : "bg-gradient-to-tr from-emerald-600 to-teal-500 ring-emerald-500/30"
                }`}
              >
                <img src="/logo.png" alt="Triage Desk" className="h-12 w-12 object-contain" />
              </div>
            </div>

            {/* Hold Banner or Audio Wave Bars */}
            {callState === "on_hold" ? (
              <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-300">
                Agent placed call on hold · Please stay on the line
              </div>
            ) : callState === "connected" ? (
              <div className="mb-6 flex items-center gap-1.5">
                {[12, 24, 18, 28, 16, 22, 14, 26, 20].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 rounded-full bg-emerald-400 animate-pulse"
                  />
                ))}
              </div>
            ) : null}

            {/* Call Action Controls */}
            <div className="flex items-center gap-6">
              {/* Mute Button */}
              <button
                onClick={handleToggleMute}
                disabled={callState !== "connected" && callState !== "on_hold"}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
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
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-950/60 transition-all duration-200 hover:bg-red-700 hover:scale-105 active:scale-95"
                title="End Call"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-5 py-4 text-center text-[11px] text-slate-500">
        EKMS Tele-Triage Helpline · Real-time Online Voice Portal
      </footer>
    </div>
  );
}
