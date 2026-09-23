"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { playRingtone, stopRingtone, WebRtcCallSession } from "@/lib/webrtc";

export const CallManager = ({ onCallerConnected }) => {
  const [callState, setCallState] = useState("idle"); // 'idle' | 'incoming' | 'connected' | 'ended'
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeCaller, setActiveCaller] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

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
          setActiveCaller(details.callerInfo || incomingCallData?.callerInfo);
          startTimer();
          toast.success("Voice call connected! Audio is live.");

          // Auto-fill Agent's intake form with caller details
          if (details.callerInfo || incomingCallData?.callerInfo) {
            onCallerConnected?.(details.callerInfo || incomingCallData.callerInfo);
          }
        } else if (state === "ended") {
          setCallState("ended");
          stopTimer();
          toast.info("Call terminated");
          setTimeout(() => {
            setCallState("idle");
            setIncomingCallData(null);
            setActiveCaller(null);
          }, 1500);
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

  return (
    <>
      {/* 1. INCOMING CALL MODAL OVERLAY */}
      {callState === "incoming" && incomingCallData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/50 bg-card p-6 shadow-2xl ring-4 ring-emerald-500/20">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
                <span className="absolute h-full w-full rounded-full bg-emerald-400/40 animate-ping" />
                <PhoneIncoming className="relative h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Incoming Voice Call
                </p>
                <h3 className="text-lg font-extrabold text-foreground leading-snug">
                  {incomingCallData.callerInfo?.name || "Insured Person (IP)"}
                </h3>
              </div>
            </div>

            {/* Caller details preview */}
            <div className="mt-4 space-y-1.5 rounded-lg border border-border/80 bg-secondary/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone Number:</span>
                <span className="font-semibold">{incomingCallData.callerInfo?.phone || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-semibold">
                  {[incomingCallData.callerInfo?.city, incomingCallData.callerInfo?.district]
                    .filter(Boolean)
                    .join(", ") || "Assam"}
                </span>
              </div>
              {incomingCallData.callerInfo?.symptoms && (
                <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Complaint:</span>{" "}
                  {incomingCallData.callerInfo.symptoms}
                </div>
              )}
            </div>

            {/* Accept / Decline actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecline}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-3 text-xs font-bold text-red-700 transition hover:bg-red-100"
              >
                <PhoneOff className="h-4 w-4" /> Decline
              </button>

              <button
                type="button"
                onClick={handleAccept}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 active:scale-95"
              >
                <Phone className="h-4 w-4 fill-current animate-bounce" /> Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE IN-CALL FLOATING STATUS BAR (Sticky at top of console) */}
      {callState === "connected" && (
        <div className="sticky top-[69px] z-20 border-b border-emerald-500/40 bg-emerald-950/90 text-white backdrop-blur-md px-5 py-2.5 shadow-md">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
            {/* Left: Caller info & Timer */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <p className="text-xs font-extrabold leading-none text-emerald-200">
                  Call in Progress: {activeCaller?.name || "Insured Person"}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-400 font-mono">
                  Duration: {formatTimer(callDuration)} · {activeCaller?.city || "Guwahati"}
                </p>
              </div>
            </div>

            {/* Audio visualization animation */}
            <div className="hidden sm:flex items-center gap-1">
              {[8, 16, 12, 20, 10, 18, 14].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}px` }}
                  className="w-1 rounded-full bg-emerald-400 animate-pulse"
                />
              ))}
            </div>

            {/* Right: In-call controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isMuted ? "bg-amber-500 text-black font-bold" : "bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800"
                }`}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isMuted ? "Unmute" : "Mute"}
              </button>

              <button
                type="button"
                onClick={handleHangup}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95 shadow-sm"
              >
                <PhoneOff className="h-3.5 w-3.5" /> End Call
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
