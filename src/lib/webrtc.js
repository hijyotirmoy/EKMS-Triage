// WebRTC & Web Audio Real-Time Voice Calling Service
import { getFirestoreDb } from "./firebase";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";

// High-reliability STUN & TURN servers for mobile carrier CGNAT / Symmetric NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

// Web Audio API Procedural Tone Synthesizer
let audioCtx = null;
let ringOscillator = null;

// Audio unlock helper for iOS Safari and Android Chrome
export function unlockMobileAudio() {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    let audioEl = document.getElementById("webrtc-remote-audio");
    if (!audioEl && typeof document !== "undefined") {
      audioEl = document.createElement("audio");
      audioEl.id = "webrtc-remote-audio";
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.setAttribute("playsinline", "true");
      audioEl.setAttribute("webkit-playsinline", "true");
      document.body.appendChild(audioEl);
    }
    if (audioEl) {
      audioEl.play().catch(() => {});
    }
  } catch (e) {}
}

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playRingtone(type = "incoming") {
  try {
    stopRingtone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "outgoing") {
      // Ringback tone: 400Hz + 450Hz
      osc1.frequency.value = 400;
      osc2.frequency.value = 450;
    } else {
      // Incoming ring: pleasant phone ring 440Hz + 480Hz
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
    }

    gain.gain.value = 0.08;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    ringOscillator = { osc1, osc2, gain };
  } catch (e) {
    console.warn("Could not start audio tone:", e.message);
  }
}

export function stopRingtone() {
  if (ringOscillator) {
    try {
      ringOscillator.osc1.stop();
      ringOscillator.osc2.stop();
      ringOscillator.gain.disconnect();
    } catch (e) {}
    ringOscillator = null;
  }
}

export class WebRtcCallSession {
  constructor({ role, agentId = "Agent 1", onStateChange, onRemoteStream }) {
    this.role = role; // 'caller' | 'agent'
    this.agentId = agentId;
    this.onStateChange = onStateChange;
    this.onRemoteStream = onRemoteStream;

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callId = null;
    this.state = "idle"; // 'idle' | 'calling' | 'ringing' | 'connected' | 'on_hold' | 'ended'
    this.isMuted = false;
    this.isOnHold = false;
    this.pollInterval = null;
    this.ringTimeout = null;
    this.pendingCandidates = [];
    this.processedCandidates = new Set();
    this.nextPlayTime = 0;
    this.unsubscribeDoc = null;

    // Web Audio cross-tab streaming nodes
    this.audioProcessor = null;
    this.audioSource = null;
    this.audioGain = null;

    // Cross-tab Signaling Channel (for testing across tabs on same machine)
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel("ekms-call-channel");
        this.channel.onmessage = (event) =>
          this.handleBroadcastMessage(event.data);

        // Dedicated Cross-tab Audio Channel
        this.audioChannel = new BroadcastChannel("ekms-call-audio");
        this.audioChannel.onmessage = (event) => {
          const d = event.data;
          if (!d) return;

          if (d.type === "call_accepted") {
            if (this.role === "caller") {
              this.handleRemoteAccepted(d);
            }
          } else if (d.type === "hangup") {
            if (
              this.state === "connected" ||
              this.state === "on_hold" ||
              this.state === "calling" ||
              this.state === "ringing" ||
              this.state === "incoming_call"
            ) {
              this.endCall(false);
            }
          } else if (d.type === "audio-chunk") {
            this.handleAudioChunk(d);
          }
        };
      } catch (e) {}
    }
  }

  setState(newState, details = {}) {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChange?.(newState, details);
  }

  // Acquire Microphone Stream
  async getMicrophone() {
    if (this.localStream) return this.localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;
      this.startCrossTabAudio(stream);
      return stream;
    } catch (err) {
      console.error("Microphone access denied:", err);
      throw new Error(
        "Microphone permission required for online voice calling"
      );
    }
  }

  // Cross-Tab Direct Audio Streaming: captures mic PCM and broadcasts directly for local tab pairing
  startCrossTabAudio(stream) {
    if (typeof window === "undefined" || this.audioProcessor) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        if (this.state !== "connected" || this.isMuted || this.isOnHold) return;
        const inputData = e.inputBuffer.getChannelData(0);
        this.audioChannel?.postMessage({
          type: "audio-chunk",
          role: this.role,
          callId: this.callId,
          samples: Array.from(inputData),
        });
      };

      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      source.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);

      this.audioProcessor = processor;
      this.audioSource = source;
      this.audioGain = gain;
    } catch (e) {
      console.warn("Could not start audio streamer:", e);
    }
  }

  // Play audio chunk received from the other tab with scheduled continuous playback
  handleAudioChunk(data) {
    if (data.role === this.role) return;
    if (this.state !== "connected" || this.isOnHold) return;

    // If WebRTC is natively connected with remote stream, skip cross-tab audio to prevent double-audio
    if (
      this.peerConnection &&
      this.peerConnection.connectionState === "connected" &&
      this.remoteStream
    ) {
      return;
    }

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const samples = new Float32Array(data.samples);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = this.isMuted ? 0.0 : 1.0;
      source.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now;
      }
      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (e) {}
  }

  // Add ICE candidate with queuing and deduplication
  async addCandidate(candidate) {
    if (!candidate) return;
    const candKey = candidate.candidate || JSON.stringify(candidate);
    if (this.processedCandidates.has(candKey)) return;
    this.processedCandidates.add(candKey);

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Add ICE candidate failed:", e.message);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  async drainPendingCandidates() {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      while (this.pendingCandidates.length > 0) {
        const c = this.pendingCandidates.shift();
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {}
      }
    }
  }

  // Create RTCPeerConnection
  initPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Remote audio track received
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(this.remoteStream);
        this.playRemoteAudio(this.remoteStream);
      }
    };

    // Send local ICE candidates to Firestore, BroadcastChannel, and HTTP
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callId) {
        const candJSON = event.candidate.toJSON();

        // 1. Direct Firestore arrayUnion for instantaneous delivery across devices
        try {
          const db = getFirestoreDb();
          const docRef = doc(db, "calls", this.callId);
          const field =
            this.role === "caller" ? "callerCandidates" : "calleeCandidates";
          updateDoc(docRef, {
            [field]: arrayUnion(candJSON),
            updatedAt: Date.now(),
          }).catch(() => {});
        } catch (e) {}

        // 2. BroadcastChannel & HTTP fallback
        this.sendSignal({
          action: "candidate",
          callId: this.callId,
          data: { role: this.role, candidate: candJSON },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        stopRingtone();
        this.setState("connected", { callId: this.callId });
      }
    };

    this.peerConnection = pc;
    return pc;
  }

  playRemoteAudio(stream) {
    if (typeof window === "undefined") return;
    let audioEl = document.getElementById("webrtc-remote-audio");
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "webrtc-remote-audio";
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.setAttribute("playsinline", "true");
      audioEl.setAttribute("webkit-playsinline", "true");
      document.body.appendChild(audioEl);
    }
    audioEl.muted = false;
    audioEl.volume = 1.0;
    audioEl.srcObject = stream;

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(
          "Mobile browser audio autoplay paused until user tap. Setting unlock listener.",
          err
        );
        const unlock = () => {
          audioEl.play().catch(() => {});
          window.removeEventListener("click", unlock);
          window.removeEventListener("touchstart", unlock);
        };
        window.addEventListener("click", unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });
      });
    }
  }

  // Real-time Firestore snapshot listener for active call
  subscribeFirestoreCall(callId) {
    if (typeof window === "undefined" || !callId) return;
    try {
      const db = getFirestoreDb();
      const docRef = doc(db, "calls", callId);

      this.unsubscribeDoc = onSnapshot(
        docRef,
        async (docSnap) => {
          if (!docSnap.exists()) return;
          const data = docSnap.data();

          // Remote hangup
          if (data.status === "ended") {
            if (this.state !== "idle" && this.state !== "ended") {
              this.endCall(false);
            }
            return;
          }

          // Caller receiving Agent's answer and calleeCandidates
          if (this.role === "caller") {
            if (data.status === "connected" || data.answer) {
              if (this.state === "calling" || this.state === "ringing") {
                await this.handleRemoteAccepted({
                  data: { answer: data.answer },
                });
              } else if (
                data.answer &&
                this.peerConnection &&
                !this.peerConnection.currentRemoteDescription
              ) {
                try {
                  await this.peerConnection.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                  );
                  await this.drainPendingCandidates();
                } catch (e) {}
              }
            }

            if (data.calleeCandidates && Array.isArray(data.calleeCandidates)) {
              for (const cand of data.calleeCandidates) {
                await this.addCandidate(cand);
              }
            }

            if (data.onHold !== undefined) {
              if (data.onHold && !this.isOnHold) {
                this.isOnHold = true;
                this.setState("on_hold", { callId: this.callId });
              } else if (!data.onHold && this.isOnHold) {
                this.isOnHold = false;
                this.setState("connected", { callId: this.callId });
              }
            }
          }

          // Agent receiving Caller's candidate updates
          if (this.role === "agent") {
            if (data.callerCandidates && Array.isArray(data.callerCandidates)) {
              for (const cand of data.callerCandidates) {
                await this.addCandidate(cand);
              }
            }

            if (data.onHold !== undefined) {
              if (data.onHold && !this.isOnHold) {
                this.isOnHold = true;
                this.setState("on_hold", { callId: this.callId });
              } else if (!data.onHold && this.isOnHold) {
                this.isOnHold = false;
                this.setState("connected", { callId: this.callId });
              }
            }
          }
        },
        (error) => {
          console.warn("Firestore call snapshot notice:", error.message);
        }
      );
    } catch (err) {
      console.warn("Could not set up Firestore call listener:", err.message);
    }
  }

  // 1. Caller starts the call
  async startCall(callerInfo = {}) {
    try {
      this.setState("calling");
      playRingtone("outgoing");

      await this.getMicrophone();
      const pc = this.initPeerConnection();

      // Create WebRTC Offer
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      this.callId =
        "call-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).substring(2, 6);

      // 1. Create document directly in Firestore for real-time cross-device listening
      const now = Date.now();
      const targetAgent = callerInfo.targetAgent || "Agent 1";
      const callData = {
        id: this.callId,
        callerInfo,
        targetAgent,
        offer: { type: offer.type, sdp: offer.sdp },
        answer: null,
        callerCandidates: [],
        calleeCandidates: [],
        status: "ringing",
        createdAt: now,
        updatedAt: now,
      };

      try {
        const db = getFirestoreDb();
        await setDoc(doc(db, "calls", this.callId), callData);
      } catch (e) {
        console.warn("Direct Firestore initiate save warning:", e.message);
      }

      // 2. BroadcastChannel & HTTP Serverless API
      this.sendSignal({
        action: "initiate",
        callId: this.callId,
        data: {
          callerInfo,
          targetAgent,
          offer: { type: offer.type, sdp: offer.sdp },
        },
      });

      this.setState("ringing", { callId: this.callId, callerInfo });

      // Subscribe to real-time updates on Firestore
      this.subscribeFirestoreCall(this.callId);

      // 45-second Ringing Timeout: auto-cut if agent doesn't answer within 45s
      if (this.ringTimeout) clearTimeout(this.ringTimeout);
      this.ringTimeout = setTimeout(() => {
        if (this.state === "calling" || this.state === "ringing") {
          console.log("Call auto-disconnected after 45s ringing timeout");
          this.endCall(true);
        }
      }, 45000);

      // Fallback polling for Agent's Answer (every 600ms)
      this.startPollingAnswer();
    } catch (err) {
      stopRingtone();
      this.setState("idle");
      throw err;
    }
  }

  // Helper when remote Agent accepts call
  async handleRemoteAccepted(msg = {}) {
    stopRingtone();
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }
    clearInterval(this.pollInterval);
    this.setState("connected", { callId: this.callId });
    this.startInCallHeartbeat();

    if (
      msg.data?.answer &&
      this.peerConnection &&
      !this.peerConnection.currentRemoteDescription
    ) {
      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(msg.data.answer)
        );
        await this.drainPendingCandidates();
      } catch (e) {
        console.warn("Set answer description failed:", e);
      }
    }
  }

  // 2. Agent accepts the incoming call
  async acceptCall(callData) {
    try {
      stopRingtone();
      this.callId = callData.id;
      this.setState("connected", {
        callId: this.callId,
        callerInfo: callData.callerInfo,
      });
      this.startInCallHeartbeat();

      await this.getMicrophone();
      const pc = this.initPeerConnection();

      // Set Remote Description (Caller's offer)
      if (callData.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        await this.drainPendingCandidates();

        // Create WebRTC Answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const answerData = { type: answer.type, sdp: answer.sdp };

        // 1. Direct Firestore update so caller receives answer instantaneously
        try {
          const db = getFirestoreDb();
          await updateDoc(doc(db, "calls", this.callId), {
            answer: answerData,
            status: "connected",
            updatedAt: Date.now(),
          });
        } catch (e) {
          console.warn("Direct Firestore accept update warning:", e.message);
        }

        // 2. BroadcastChannel & HTTP Serverless API
        const acceptPayload = {
          action: "answer",
          callId: this.callId,
          data: { answer: answerData },
        };
        this.channel?.postMessage({
          action: "call_accepted",
          callId: this.callId,
        });
        this.audioChannel?.postMessage({
          type: "call_accepted",
          callId: this.callId,
        });
        await this.sendSignal(acceptPayload);
      }

      // Subscribe to real-time updates for caller's candidates and hangup
      this.subscribeFirestoreCall(this.callId);
    } catch (err) {
      console.warn("Accept call warning:", err);
    }
  }

  // Send signal to BroadcastChannel AND Serverless API
  async sendSignal(payload) {
    // 1. Broadcast locally across tabs
    try {
      this.channel?.postMessage(payload);
    } catch (e) {}

    // 2. HTTP Serverless API
    try {
      await fetch("/api/call/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {}
  }

  // Handle incoming broadcast messages (for local same-browser tabs)
  async handleBroadcastMessage(msg) {
    if (!msg || !msg.action) return;

    if (msg.action === "hangup" || msg.action === "reject") {
      if (
        this.state === "connected" ||
        this.state === "on_hold" ||
        this.state === "calling" ||
        this.state === "ringing" ||
        this.state === "incoming_call"
      ) {
        this.endCall(false);
        return;
      }
    }

    if (this.role === "caller") {
      if (msg.action === "call_accepted" || msg.action === "answer") {
        await this.handleRemoteAccepted(msg);
      } else if (msg.action === "candidate" && msg.data?.candidate) {
        await this.addCandidate(msg.data.candidate);
      } else if (msg.action === "hold") {
        this.isOnHold = true;
        this.setState("on_hold", { callId: this.callId });
      } else if (msg.action === "resume") {
        this.isOnHold = false;
        this.setState("connected", { callId: this.callId });
      }
    }

    if (this.role === "agent") {
      if (
        msg.action === "initiate" &&
        (this.state === "idle" || this.state === "ended")
      ) {
        const target = (msg.data?.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
        const myAgent = (this.agentId || "Agent 1").toLowerCase().replace(/\s+/g, "");
        if (target !== myAgent) return;

        playRingtone("incoming");
        this.setState("incoming_call", {
          callData: msg.data ? { ...msg.data, id: msg.callId } : null,
        });
      } else if (msg.callId === this.callId) {
        if (msg.action === "candidate" && msg.data?.candidate) {
          await this.addCandidate(msg.data.candidate);
        } else if (msg.action === "hold") {
          this.isOnHold = true;
          this.setState("on_hold", { callId: this.callId });
        } else if (msg.action === "resume") {
          this.isOnHold = false;
          this.setState("connected", { callId: this.callId });
        }
      }
    }
  }

  // Fallback poll for answer (every 600ms)
  startPollingAnswer() {
    clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      if (!this.callId || this.state === "connected" || this.state === "ended") {
        clearInterval(this.pollInterval);
        return;
      }
      try {
        const res = await fetch(`/api/call/signal?callId=${this.callId}`);
        const data = await res.json();

        if (data.status === "ended") {
          this.endCall(false);
        } else if (data.status === "connected" || data.answer) {
          await this.handleRemoteAccepted({ data: { answer: data.answer } });
        }
      } catch (e) {}
    }, 600);
  }

  // Heartbeat while call is active
  startInCallHeartbeat() {
    clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      if (
        !this.callId ||
        (this.state !== "connected" && this.state !== "on_hold")
      ) {
        clearInterval(this.pollInterval);
        return;
      }
      try {
        const res = await fetch(`/api/call/signal?callId=${this.callId}`);
        const data = await res.json();
        if (data && data.status === "ended") {
          this.endCall(false);
        }
      } catch (e) {}
    }, 1200);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted && !this.isOnHold;
      });
    }
    return this.isMuted;
  }

  toggleHold() {
    this.isOnHold = !this.isOnHold;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isOnHold && !this.isMuted;
      });
    }
    const audioEl = document.getElementById("webrtc-remote-audio");
    if (audioEl) {
      audioEl.muted = this.isOnHold;
    }

    try {
      const db = getFirestoreDb();
      updateDoc(doc(db, "calls", this.callId), {
        onHold: this.isOnHold,
        updatedAt: Date.now(),
      }).catch(() => {});
    } catch (e) {}

    this.sendSignal({
      action: this.isOnHold ? "hold" : "resume",
      callId: this.callId,
    });
    this.setState(this.isOnHold ? "on_hold" : "connected");
    return this.isOnHold;
  }

  endCall(notifyRemote = true) {
    if (this.state === "idle" || this.state === "ended") return;
    stopRingtone();
    clearInterval(this.pollInterval);
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }

    if (this.unsubscribeDoc) {
      try {
        this.unsubscribeDoc();
      } catch (e) {}
      this.unsubscribeDoc = null;
    }

    const activeCallId = this.callId;

    if (notifyRemote && activeCallId) {
      // 1. Direct Firestore status update
      try {
        const db = getFirestoreDb();
        updateDoc(doc(db, "calls", activeCallId), {
          status: "ended",
          updatedAt: Date.now(),
        }).catch(() => {});
      } catch (e) {}

      // 2. BroadcastChannel & HTTP
      try {
        this.channel?.postMessage({ action: "hangup", callId: activeCallId });
      } catch (e) {}
      try {
        this.audioChannel?.postMessage({
          type: "hangup",
          callId: activeCallId,
        });
      } catch (e) {}
      this.sendSignal({ action: "hangup", callId: activeCallId });
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      this.localStream = null;
    }

    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
        this.audioSource?.disconnect();
        this.audioGain?.disconnect();
      } catch (e) {}
      this.audioProcessor = null;
    }

    const audioEl = document.getElementById("webrtc-remote-audio");
    if (audioEl) {
      audioEl.srcObject = null;
    }

    this.callId = null;
    this.isMuted = false;
    this.isOnHold = false;
    this.nextPlayTime = 0;
    this.pendingCandidates = [];
    this.processedCandidates.clear();
    this.setState("ended");
    setTimeout(() => this.setState("idle"), 800);
  }
}
