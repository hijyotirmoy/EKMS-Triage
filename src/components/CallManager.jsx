"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Play,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { playRingtone, stopRingtone, WebRtcCallSession } from "@/lib/webrtc";

export const CallManager = ({ onCallerConnected }) => {
  const [callState, setCallState] = useState("idle"); // 'idle' | 'incoming' | 'connected' | 'on_hold' | 'ended'
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeCaller, setActiveCaller] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  const callSessionRef = useRef(null);
  const timerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const session = new WebRtcCallSession({
      role: "agent",
      onStateChange: (state, details) => {
        if (state === "incoming_call") {
          setCallState("incoming");
          setIncomingCallData(details.callData);
        } else if (state === "connected") {
          setCallState("connected");
          setIsOnHold(false);
          setActiveCaller(details.callerInfo || incomingCallData?.callerInfo);
          startTimer();
          toast.success("Voice call connected! Audio is live.");

          // Auto-fill Agent's intake form with caller phone/details
          const caller = details.callerInfo || incomingCallData?.callerInfo;
          if (caller) {
            onCallerConnected?.(caller);
          }
        } else if (state === "on_hold") {
          setCallState("on_hold");
          setIsOnHold(true);
        } else if (state === "ended") {
          setCallState("ended");
          stopTimer();
          toast.info("Call terminated");
          setTimeout(() => {
            setCallState("idle");
            setIncomingCallData(null);
            setActiveCaller(null);
            setIsOnHold(false);
            setIsMuted(false);
          }, 1200);
        }
      },
    });

    callSessionRef.current = session;

    // Periodic check for remote calls initiated from other devices/browsers
    pollIntervalRef.current = setInterval(async () => {
      if (session.state === "idle") {
        try {
          const res = await fetch("/api/call/signal?role=agent");
          const data = await res.json();
          if (data && data.activeCall && data.activeCall.status === "ringing") {
            playRingtone("incoming");
            session.setState("incoming_call", { callData: data.activeCall });
          }
        } catch (e) {}
      }
    }, 2000);

    return () => {
      clearInterval(pollIntervalRef.current);
      session.endCall();
      stopTimer();
      stopRingtone();
    };
  }, [onCallerConnected]);

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

  const handleAccept = async () => {
    if (!incomingCallData) return;
    try {
      await callSessionRef.current.acceptCall(incomingCallData);
    } catch (err) {
      toast.error(err.message || "Could not accept call. Please check microphone permission.");
    }
  };

  const handleDecline = () => {
    stopRingtone();
    if (incomingCallData?.id) {
      callSessionRef.current.sendSignal({ action: "reject", callId: incomingCallData.id });
    }
    setCallState("idle");
    setIncomingCallData(null);
    toast.info("Call declined");
  };

  const handleHangup = () => {
    callSessionRef.current?.endCall();
  };

  const handleToggleMute = () => {
    const muted = callSessionRef.current?.toggleMute();
    setIsMuted(muted);
    toast.info(muted ? "Microphone muted" : "Microphone active");
  };

  const handleToggleHold = () => {
    const held = callSessionRef.current?.toggleHold();
    setIsOnHold(held);
    toast.info(held ? "Call placed on hold" : "Call resumed");
  };

  const currentPhone =
    activeCaller?.phone ||
    incomingCallData?.callerInfo?.phone ||
    "9876543210";

  return (
    <>
      {/* 1. INCOMING CALL MODAL OVERLAY */}
      {callState === "incoming" && incomingCallData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-emerald-500/50 bg-card p-6 shadow-2xl ring-4 ring-emerald-500/20">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
                <span className="absolute h-full w-full rounded-full bg-emerald-400/40 animate-ping" />
                <PhoneIncoming className="relative h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Incoming IP Call
                </p>
                <h3 className="text-base font-extrabold text-foreground leading-snug">
                  +91 {currentPhone}
                </h3>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              An insured person is calling the triage helpline. Answer to start live two-way voice.
            </p>

            {/* Accept / Decline actions */}
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDecline}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
              >
                <PhoneOff className="h-4 w-4" /> Decline
              </button>

              <button
                type="button"
                onClick={handleAccept}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 active:scale-95"
              >
                <Phone className="h-4 w-4 fill-current animate-bounce" /> Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOP-RIGHT ACTIVE CALL POP-UP WINDOW */}
      {(callState === "connected" || callState === "on_hold") && (
        <aside
          role="dialog"
          aria-label="Active Voice Call Controls"
          className="fixed top-18 right-4 sm:right-6 z-50 w-[320px] sm:w-[350px] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl ring-1 ring-white/10 animate-in slide-in-from-top-3 duration-300"
        >
          {/* Top Row: Live/Hold status & Duration Timer */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              {isOnHold ? (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Pause className="h-2.5 w-2.5" /> Call On Hold
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Audio
                </span>
              )}
            </div>

            <span className="font-mono text-xs font-bold text-emerald-400">
              {formatTimer(callDuration)}
            </span>
          </div>

          {/* Caller Info & Visualizer */}
          <div className="my-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isOnHold
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 leading-none">
                  IP Caller
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-white leading-none">
                  +91 {currentPhone}
                </p>
              </div>
            </div>

            {/* Audio Wave Bars */}
            {!isOnHold ? (
              <div className="flex items-center gap-1">
                {[10, 20, 14, 24, 12, 18, 8].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 rounded-full bg-emerald-400 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <span className="text-[10px] font-medium text-amber-400">Paused</span>
            )}
          </div>

          {/* Action Buttons: Cut, Mute, Hold */}
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {/* 1. Mute Button */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition ${
                isMuted
                  ? "border border-amber-500 bg-amber-500/20 text-amber-300"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
              title={isMuted ? "Unmute your microphone" : "Mute your microphone"}
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {isMuted ? "Muted" : "Mute"}
            </button>

            {/* 2. Hold Button */}
            <button
              type="button"
              onClick={handleToggleHold}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition ${
                isOnHold
                  ? "border border-amber-500 bg-amber-500 text-slate-950 font-extrabold"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
              title={isOnHold ? "Resume call" : "Put call on hold"}
            >
              {isOnHold ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
              {isOnHold ? "Resume" : "Hold"}
            </button>

            {/* 3. Cut (Hang up) Button */}
            <button
              type="button"
              onClick={handleHangup}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2 px-2 text-xs font-bold text-white shadow-md shadow-red-950/50 transition hover:bg-red-700 active:scale-95"
              title="Hang up call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              Cut
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
