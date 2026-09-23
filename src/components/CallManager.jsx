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
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { SpeechStreamController } from "@/lib/speechRecognition";

export const CallManager = ({ agentId = "Agent 1", onCallerConnected, onCallUpdate }) => {
  const [callState, setCallState] = useState("idle"); // 'idle' | 'incoming' | 'connected' | 'on_hold' | 'ended'
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [activeCaller, setActiveCaller] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  // Live Scribe & Speech-to-Text State
  const [transcripts, setTranscripts] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState(null);
  const [agentLang, setAgentLang] = useState("en-IN");

  // Draggable window state
  const [dragPos, setDragPos] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, width: 350, height: 200 });
  const popupRef = useRef(null);

  const callSessionRef = useRef(null);
  const speechCtrlRef = useRef(null);
  const bChannelRef = useRef(null);
  const scribeChannelRef = useRef(null);
  const activeCallIdRef = useRef(null);
  const callDocUnsubRef = useRef(null);
  const timerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const lastCallerSpeechRef = useRef({ text: "", timestamp: 0, active: false });
  const callerSpeakingUntilRef = useRef(0);
  const remoteAnalyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const onCallerConnectedRef = useRef(onCallerConnected);
  const onCallUpdateRef = useRef(onCallUpdate);

  // Setup Web Audio VAD on incoming caller stream to identify caller voice
  const setupRemoteAudioAnalysis = (stream) => {
    if (!stream) return;
    try {
      cleanupRemoteAudio();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      remoteAnalyserRef.current = { ctx, source, analyser };
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = setInterval(() => {
        if (!remoteAnalyserRef.current?.analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        let maxVal = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > maxVal) maxVal = dataArray[i];
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // When remote caller audio energy is detected (voice arriving over WebRTC)
        if (avg > 3 || maxVal > 18) {
          // Incoming caller voice is active! Hold caller attribution window for 2.5s
          callerSpeakingUntilRef.current = Date.now() + 2500;
          lastCallerSpeechRef.current = {
            text: "",
            timestamp: Date.now(),
            active: true,
          };
        }
      }, 50);
    } catch (err) {
      console.warn("Remote audio analysis notice:", err);
    }
  };

  const cleanupRemoteAudio = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (remoteAnalyserRef.current) {
      try {
        remoteAnalyserRef.current.source?.disconnect();
        remoteAnalyserRef.current.ctx?.close();
      } catch (e) {}
      remoteAnalyserRef.current = null;
    }
  };

  // Keep callbacks updated
  useEffect(() => {
    onCallerConnectedRef.current = onCallerConnected;
  }, [onCallerConnected]);

  useEffect(() => {
    onCallUpdateRef.current = onCallUpdate;
  }, [onCallUpdate]);

  // Report call & transcript state to parent (AppShell & TriageConsole)
  useEffect(() => {
    onCallUpdateRef.current?.({
      callState,
      activeCaller,
      callDuration,
      transcripts,
      interimTranscript,
      agentLang,
      setAgentLang: (lang) => {
        setAgentLang(lang);
        speechCtrlRef.current?.setLanguage(lang);
      },
      callId: activeCallIdRef.current,
    });
  }, [callState, activeCaller, callDuration, transcripts, interimTranscript, agentLang]);

  // Start live speech stream - automatically attributes speech to Caller (IP) or Agent (You)
  const startAgentSpeech = (callId) => {
    if (speechCtrlRef.current) speechCtrlRef.current.stop();
    const ctrl = new SpeechStreamController({
      lang: agentLang,
      onInterim: (text) => {
        const clean = text.trim();
        if (!clean) return;
        const now = Date.now();
        const isCallerVoice = now < callerSpeakingUntilRef.current;
        const speaker = isCallerVoice ? "caller" : "agent";
        const speakerName = isCallerVoice ? "Caller (IP)" : "Agent (You)";

        const interimMsg = {
          type: "transcript_interim",
          speaker,
          speakerName,
          text: clean,
          timestamp: now,
        };
        setInterimTranscript(interimMsg);
        bChannelRef.current?.postMessage(interimMsg);
        scribeChannelRef.current?.postMessage(interimMsg);
        const curCallId = callId || activeCallIdRef.current;
        if (curCallId) {
          try {
            const db = getFirestoreDb();
            updateDoc(doc(db, "calls", curCallId), {
              interimTranscript: interimMsg,
              updatedAt: Date.now(),
            }).catch(() => {});
          } catch (e) {}
        }
      },
      onFinal: (text) => {
        const clean = text.trim();
        if (!clean) return;
        const now = Date.now();
        const isCallerVoice = now < callerSpeakingUntilRef.current;
        const speaker = isCallerVoice ? "caller" : "agent";
        const speakerName = isCallerVoice ? "Caller (IP)" : "Agent (You)";

        setInterimTranscript(null);
        const finalMsg = {
          id: `${speaker === "caller" ? "c" : "a"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "transcript_final",
          speaker,
          speakerName,
          text: clean,
          isFinal: true,
          timestamp: now,
        };
        setTranscripts((prev) => {
          if (
            prev.some(
              (t) =>
                t.id === finalMsg.id ||
                (t.text.toLowerCase() === finalMsg.text.toLowerCase() &&
                  Math.abs((t.timestamp || 0) - finalMsg.timestamp) < 1800)
            )
          ) {
            return prev;
          }
          return [...prev, finalMsg];
        });
        bChannelRef.current?.postMessage(finalMsg);
        scribeChannelRef.current?.postMessage(finalMsg);
        const curCallId = callId || activeCallIdRef.current;
        if (curCallId) {
          try {
            const db = getFirestoreDb();
            updateDoc(doc(db, "calls", curCallId), {
              transcripts: arrayUnion(finalMsg),
              interimTranscript: null,
              updatedAt: Date.now(),
            }).catch(() => {});
          } catch (e) {}
        }
      },
    });
    speechCtrlRef.current = ctrl;
    ctrl.start();
  };

  // Cross-tab broadcast channel & Storage event listeners for 100% reliable caller sync
  useEffect(() => {
    const handleIncomingTranscript = (msg) => {
      if (!msg) return;

      // Caller active speaking broadcast notification
      if (msg.type === "caller_speaking") {
        lastCallerSpeechRef.current = {
          text: (msg.text || "").toLowerCase().trim(),
          timestamp: Date.now(),
          active: !!msg.active,
        };
        if (msg.active) {
          callerSpeakingUntilRef.current = Date.now() + 2200;
        }
        return;
      }

      if (msg.speaker === "caller" || msg.type === "transcript_final" || msg.type === "transcript_interim") {
        if (msg.speaker === "caller") {
          callerSpeakingUntilRef.current = Date.now() + 2200;
          lastCallerSpeechRef.current = {
            text: (msg.text || "").toLowerCase().trim(),
            timestamp: Date.now(),
            active: msg.type === "transcript_interim",
          };
        }

        if (msg.type === "transcript_interim" || msg.isFinal === false) {
          if (msg.speaker === "caller") {
            setInterimTranscript(msg);
          }
        } else if (msg.type === "transcript_final" || msg.isFinal === true) {
          if (msg.speaker === "caller") {
            setInterimTranscript((cur) => (cur?.speaker === "caller" ? null : cur));
            setTranscripts((prev) => {
              if (
                prev.some(
                  (t) =>
                    t.id === msg.id ||
                    (t.text === msg.text && Math.abs((t.timestamp || 0) - (msg.timestamp || 0)) < 1500)
                )
              ) {
                return prev;
              }
              return [...prev, msg];
            });
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      try {
        const channel1 = new BroadcastChannel("ekms-call-channel");
        bChannelRef.current = channel1;
        channel1.onmessage = (event) => handleIncomingTranscript(event.data);

        const channel2 = new BroadcastChannel("ekms-scribe-channel");
        scribeChannelRef.current = channel2;
        channel2.onmessage = (event) => handleIncomingTranscript(event.data);
      } catch (e) {}

      // Cross-tab window storage event listener (guaranteed delivery across tabs/browsers on same origin)
      const onStorage = (event) => {
        if (event.key === "ekms_scribe_sync" && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            handleIncomingTranscript(parsed);
          } catch (e) {}
        }
      };
      window.addEventListener("storage", onStorage);

      return () => {
        bChannelRef.current?.close();
        scribeChannelRef.current?.close();
        window.removeEventListener("storage", onStorage);
      };
    }
  }, []);

  // Ensure Agent's speech recognition stays alive on focus or interaction
  useEffect(() => {
    const handleAgentWakeup = () => {
      if (callState === "connected") {
        speechCtrlRef.current?.ensureListening();
      }
    };
    window.addEventListener("focus", handleAgentWakeup);
    window.addEventListener("click", handleAgentWakeup);
    return () => {
      window.removeEventListener("focus", handleAgentWakeup);
      window.removeEventListener("click", handleAgentWakeup);
    };
  }, [callState]);

  useEffect(() => {
    const session = new WebRtcCallSession({
      role: "agent",
      agentId: agentId || "Agent 1",
      onRemoteStream: (stream) => {
        setupRemoteAudioAnalysis(stream);
      },
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
          toast.success("Voice call connected! Audio is live.", { id: "call-status" });

          const curId = details?.callId || incomingCallData?.id;
          activeCallIdRef.current = curId;

          // Clear old transcripts on brand new call connection
          setTranscripts([]);
          setInterimTranscript(null);

          // Setup incoming caller voice stream detection
          if (session.remoteStream) {
            setupRemoteAudioAnalysis(session.remoteStream);
          }

          // Start agent voice transcription
          startAgentSpeech(curId);

          // Subscribe to remote caller's Firestore transcript chunks
          if (curId) {
            try {
              const db = getFirestoreDb();
              callDocUnsubRef.current = onSnapshot(doc(db, "calls", curId), (snap) => {
                if (snap.exists()) {
                  const data = snap.data();
                  if (data.transcripts && Array.isArray(data.transcripts)) {
                    setTranscripts((prev) => {
                      const map = new Map();
                      prev.forEach((t) => map.set(t.id, t));
                      data.transcripts.forEach((t) => map.set(t.id, t));
                      return Array.from(map.values()).sort(
                        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
                      );
                    });
                  }
                  if (data.interimTranscript && data.interimTranscript.speaker === "caller") {
                    setInterimTranscript(data.interimTranscript);
                  }
                }
              });
            } catch (e) {}
          }

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
          speechCtrlRef.current?.stop();
          cleanupRemoteAudio();
          if (callDocUnsubRef.current) {
            callDocUnsubRef.current();
            callDocUnsubRef.current = null;
          }
          toast.info("Call ended", { id: "call-status" });
          setTimeout(() => {
            setCallState("idle");
            setIncomingCallData(null);
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
                  // Targeted routing: ensure call is intended for this desk
                  const target = (callData.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
                  const myAgent = (agentId || "Agent 1").toLowerCase().replace(/\s+/g, "");
                  if (target !== myAgent) {
                    continue; // Skip calls intended for other agents
                  }

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
          const res = await fetch(`/api/call/signal?role=agent&agentId=${encodeURIComponent(agentId || "Agent 1")}`);
          const data = await res.json();
          if (data && data.activeCall && data.activeCall.status === "ringing") {
            const target = (data.activeCall.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
            const myAgent = (agentId || "Agent 1").toLowerCase().replace(/\s+/g, "");
            if (target === myAgent) {
              playRingtone("incoming");
              session.setState("incoming_call", { callData: data.activeCall });
              if (data.activeCall.callerInfo) {
                onCallerConnectedRef.current?.(data.activeCall.callerInfo);
              }
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
      cleanupRemoteAudio();
    };
  }, [agentId]); // Re-subscribe if active agent changes

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
    toast.info("Call declined", { id: "call-status" });
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
          className={`fixed z-[100] w-[calc(100vw-32px)] sm:w-[360px] max-w-[360px] overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-slate-950/95 p-3.5 sm:p-4 text-white shadow-2xl backdrop-blur-xl ring-2 ring-emerald-500/20 transition-all duration-75 ${
            dragPos.x === null ? "top-16 sm:top-20 right-4 sm:right-6 left-4 sm:left-auto" : ""
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
