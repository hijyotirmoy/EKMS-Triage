"use client";

import { useEffect, useRef, useState } from "react";
import {
  GripHorizontal,
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
import { playRingtone, stopRingtone, unlockMobileAudio, WebRtcCallSession } from "@/lib/webrtc";
import { getFirestoreDb } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export const CallManager = ({ onCallerConnected }) => {
  const [callState, setCallState] = useState("idle"); // 'idle' | 'incoming' | 'connected' | 'on_hold' | 'ended'
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeCaller, setActiveCaller] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  // Draggable window state
  const [dragPos, setDragPos] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, width: 350, height: 200 });
  const popupRef = useRef(null);

  const callSessionRef = useRef(null);
  const timerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const onCallerConnectedRef = useRef(onCallerConnected);

  // Keep callback ref updated without triggering re-initialization
  useEffect(() => {
    onCallerConnectedRef.current = onCallerConnected;
  }, [onCallerConnected]);

  useEffect(() => {
    const session = new WebRtcCallSession({
      role: "agent",
      onStateChange: (state, details) => {
        if (state === "incoming_call") {
          setCallState("incoming");
          setIncomingCallData(details.callData);
          if (details.callData?.callerInfo) {
            onCallerConnectedRef.current?.(details.callData.callerInfo);
          }
        } else if (state === "connected") {
          setCallState("connected");
          setIsOnHold(false);
          const caller = details.callerInfo || incomingCallData?.callerInfo;
          setActiveCaller(caller);
          startTimer();
          toast.success("Voice call connected! Audio is live.");

          // Auto-fill Agent's intake form with caller phone/details via ref
          if (caller) {
            onCallerConnectedRef.current?.(caller);
          }
        } else if (state === "on_hold") {
          setCallState("on_hold");
          setIsOnHold(true);
        } else if (state === "ended") {
          setCallState("ended");
          stopTimer();
          toast.info("Call ended");
          setTimeout(() => {
            setCallState("idle");
            setIncomingCallData(null);
            setActiveCaller(null);
            setIsOnHold(false);
            setIsMuted(false);
            setDragPos({ x: null, y: null }); // Reset position for next call
          }, 800);
        }
      },
    });

    callSessionRef.current = session;

    // 1. Direct Real-Time Firestore listener for incoming calls across devices/browsers
    let unsubscribeIncoming = null;
    try {
      const db = getFirestoreDb();
      const q = query(
        collection(db, "calls"),
        where("status", "==", "ringing")
      );
      unsubscribeIncoming = onSnapshot(
        q,
        (snapshot) => {
          if (session.state === "idle" || session.state === "ended") {
            const now = Date.now();
            for (const change of snapshot.docChanges()) {
              if (change.type === "added" || change.type === "modified") {
                const callData = change.doc.data();
                if (
                  callData &&
                  callData.status === "ringing" &&
                  now - (callData.updatedAt || callData.createdAt || 0) < 60000
                ) {
                  playRingtone("incoming");
                  session.setState("incoming_call", { callData });
                  if (callData.callerInfo) {
                    onCallerConnectedRef.current?.(callData.callerInfo);
                  }
                  break;
                }
              }
            }
          }
        },
        (err) => {
          console.warn("Firestore incoming calls listener notice:", err.message);
        }
      );
    } catch (e) {
      console.warn("Could not set up Firestore listener in CallManager:", e.message);
    }

    // 2. Periodic check fallback for remote calls
    pollIntervalRef.current = setInterval(async () => {
      if (session.state === "idle") {
        try {
          const res = await fetch("/api/call/signal?role=agent");
          const data = await res.json();
          if (data && data.activeCall && data.activeCall.status === "ringing") {
            playRingtone("incoming");
            session.setState("incoming_call", { callData: data.activeCall });
            if (data.activeCall.callerInfo) {
              onCallerConnectedRef.current?.(data.activeCall.callerInfo);
            }
          }
        } catch (e) {}
      }
    }, 2000);

    return () => {
      if (unsubscribeIncoming) {
        try {
          unsubscribeIncoming();
        } catch (e) {}
      }
      clearInterval(pollIntervalRef.current);
      session.endCall();
      stopTimer();
      stopRingtone();
    };
  }, []); // Run once on mount!

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
      unlockMobileAudio();
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

  const handleToggleMute = (e) => {
    e.stopPropagation();
    const muted = callSessionRef.current?.toggleMute();
    setIsMuted(muted);
    toast.info(muted ? "Microphone muted" : "Microphone active");
  };

  const handleToggleHold = (e) => {
    e.stopPropagation();
    const held = callSessionRef.current?.toggleHold();
    setIsOnHold(held);
    toast.info(held ? "Call placed on hold" : "Call resumed");
  };

  // Draggable Window handlers
  const handleDragStart = (e) => {
    // Only primary mouse button or touch
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const el = popupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      boxX: rect.left,
      boxY: rect.top,
      width: rect.width,
      height: rect.height,
    };

    setIsDragging(true);

    const handleMouseMove = (moveEvent) => {
      const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = curX - dragStartRef.current.mouseX;
      const deltaY = curY - dragStartRef.current.mouseY;

      const newLeft = Math.max(
        10,
        Math.min(window.innerWidth - dragStartRef.current.width - 10, dragStartRef.current.boxX + deltaX)
      );
      const newTop = Math.max(
        10,
        Math.min(window.innerHeight - dragStartRef.current.height - 10, dragStartRef.current.boxY + deltaY)
      );

      setDragPos({ x: newLeft, y: newTop });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);
  };

  const currentPhone =
    activeCaller?.phone ||
    incomingCallData?.callerInfo?.phone ||
    "";

  return (
    <>
      {/* 1. INCOMING CALL MODAL OVERLAY */}
      {callState === "incoming" && incomingCallData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
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

      {/* 2. TOP-RIGHT ACTIVE CALL POP-UP WINDOW (DRAGGABLE) */}
      {(callState === "connected" || callState === "on_hold") && (
        <aside
          ref={popupRef}
          role="dialog"
          aria-label="Active Voice Call Controls"
          style={
            dragPos.x !== null
              ? { left: `${dragPos.x}px`, top: `${dragPos.y}px`, right: "auto", bottom: "auto" }
              : undefined
          }
          className={`fixed z-[100] w-[330px] sm:w-[360px] overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl ring-2 ring-emerald-500/20 transition-all duration-75 ${
            dragPos.x === null ? "top-20 right-6" : ""
          } ${isDragging ? "ring-emerald-400 select-none shadow-emerald-500/30" : ""}`}
        >
          {/* Top Row: Drag Handle, Status Badge & Duration Timer */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-grab active:cursor-grabbing select-none"
            title="Click and drag to move window"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-400 hover:text-white transition">
                <GripHorizontal className="h-3.5 w-3.5" />
                <span className="text-[9px] uppercase font-bold tracking-wider">Move</span>
              </div>

              {isOnHold ? (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Pause className="h-2.5 w-2.5" /> On Hold
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                  IP Caller Mobile
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
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
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
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
              }`}
              title={isOnHold ? "Resume call" : "Put call on hold"}
            >
              {isOnHold ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
              {isOnHold ? "Resume" : "Hold"}
            </button>

            {/* 3. Cut (Hang up) Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleHangup();
              }}
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
