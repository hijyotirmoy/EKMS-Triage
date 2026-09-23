// WebRTC & Web Audio Real-Time Voice Calling Service
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:openrelay.metered.ca:80" },
  ],
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
    audioCtx.resume();
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
  constructor({ role, onStateChange, onRemoteStream }) {
    this.role = role; // 'caller' | 'agent'
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
    this.pendingCandidates = [];
    this.nextPlayTime = 0;

    // Web Audio cross-tab streaming nodes
    this.audioProcessor = null;
    this.audioSource = null;
    this.audioGain = null;

    // Cross-tab Signaling Channel
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("ekms-call-channel");
      this.channel.onmessage = (event) => this.handleBroadcastMessage(event.data);

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
          if (this.state === "connected" || this.state === "on_hold" || this.state === "calling" || this.state === "ringing" || this.state === "incoming_call") {
            this.endCall(false);
          }
        } else if (d.type === "audio-chunk") {
          this.handleAudioChunk(d);
        }
      };
    }
  }

  setState(newState, details = {}) {
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
      throw new Error("Microphone permission required for online voice calling");
    }
  }

  // Cross-Tab Direct Audio Streaming: captures mic PCM and broadcasts directly
  startCrossTabAudio(stream) {
    if (typeof window === "undefined" || this.audioProcessor) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        if (this.state !== "connected" || this.isMuted || this.isOnHold) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Transfer copy to audio channel
        this.audioChannel?.postMessage({
          type: "audio-chunk",
          role: this.role,
          callId: this.callId,
          samples: Array.from(inputData),
        });
      };

      // Mute local loop so speaker doesn't feed back mic on the same tab
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
    if (data.role === this.role) return; // Ignore own voice
    if (this.state !== "connected" || this.isOnHold) return;

    // If WebRTC is natively connected, skip cross-tab audio to prevent double-audio
    if (this.peerConnection && this.peerConnection.connectionState === "connected" && this.remoteStream) {
      return;
    }

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

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

  // Add ICE candidate with queuing support
  async addCandidate(candidate) {
    if (!candidate) return;
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

    // Send local ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callId) {
        this.sendSignal({
          action: "candidate",
          callId: this.callId,
          data: { role: this.role, candidate: event.candidate },
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
    audioEl.play().catch(() => {
      const unlockAudio = () => {
        audioEl.play().catch(() => {});
        window.removeEventListener("click", unlockAudio);
      };
      window.addEventListener("click", unlockAudio, { once: true });
    });
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

      this.callId = "call-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6);

      // Transmit initiate signal
      const signalPayload = {
        action: "initiate",
        callId: this.callId,
        data: {
          callerInfo,
          offer: { type: offer.type, sdp: offer.sdp },
        },
      };

      await this.sendSignal(signalPayload);
      this.setState("ringing", { callId: this.callId, callerInfo });

      // 45-second Ringing Timeout: auto-cut if agent doesn't answer within 45s
      if (this.ringTimeout) clearTimeout(this.ringTimeout);
      this.ringTimeout = setTimeout(() => {
        if (this.state === "calling" || this.state === "ringing") {
          console.log("Call auto-disconnected after 45s ringing timeout");
          this.endCall(true);
        }
      }, 45000);

      // Poll for Agent's Answer (Fast polling every 600ms)
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

    if (msg.data?.answer && this.peerConnection && !this.peerConnection.currentRemoteDescription) {
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data.answer));
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
      this.setState("connected", { callId: this.callId, callerInfo: callData.callerInfo });
      this.startInCallHeartbeat();

      // Broadcast immediate acceptance to caller so caller stops ringing right away!
      const acceptPayload = { action: "call_accepted", callId: this.callId };
      this.channel?.postMessage(acceptPayload);
      this.audioChannel?.postMessage({ type: "call_accepted", callId: this.callId });
      fetch("/api/call/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", callId: this.callId }),
      }).catch(() => {});

      await this.getMicrophone();
      const pc = this.initPeerConnection();

      // Set Remote Description (Caller's offer)
      if (callData.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        await this.drainPendingCandidates();

        // Create WebRTC Answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send Answer signal
        await this.sendSignal({
          action: "answer",
          callId: this.callId,
          data: { answer: { type: answer.type, sdp: answer.sdp } },
        });
      }
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

  // Handle incoming broadcast messages
  async handleBroadcastMessage(msg) {
    if (!msg || !msg.action) return;

    // Universal Hangup: if any hangup signal arrives and we are in an active call, terminate immediately
    if (msg.action === "hangup" || msg.action === "reject") {
      if (this.state === "connected" || this.state === "on_hold" || this.state === "calling" || this.state === "ringing" || this.state === "incoming_call") {
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
      if (msg.action === "initiate" && (this.state === "idle" || this.state === "ended")) {
        playRingtone("incoming");
        this.setState("incoming_call", { callData: msg.data ? { ...msg.data, id: msg.callId } : null });
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

  // Poll for answer (Fast polling every 600ms)
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
      if (!this.callId || (this.state !== "connected" && this.state !== "on_hold")) {
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
    this.sendSignal({
      action: this.isOnHold ? "hold" : "resume",
      callId: this.callId,
    });
    this.setState(this.isOnHold ? "on_hold" : "connected");
    return this.isOnHold;
  }

  endCall(notifyRemote = true) {
    stopRingtone();
    clearInterval(this.pollInterval);
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }

    const activeCallId = this.callId;

    if (notifyRemote) {
      try {
        this.channel?.postMessage({ action: "hangup", callId: activeCallId });
      } catch (e) {}
      try {
        this.audioChannel?.postMessage({ type: "hangup", callId: activeCallId });
      } catch (e) {}
      if (activeCallId) {
        this.sendSignal({ action: "hangup", callId: activeCallId });
      }
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
    this.setState("ended");
    setTimeout(() => this.setState("idle"), 800);
  }
}
