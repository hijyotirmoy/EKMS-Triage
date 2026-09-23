// WebRTC Audio Calling and Signaling Service
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// Web Audio API Procedural Tone Synthesizer
let audioCtx = null;
let ringOscillator = null;

function getAudioContext() {
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

    gain.gain.value = 0.08; // Gentle volume

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
    this.state = "idle"; // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
    this.isMuted = false;
    this.isOnHold = false;
    this.pollInterval = null;

    // Cross-tab Broadcast Channel
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("ekms-call-channel");
      this.channel.onmessage = (event) => this.handleBroadcastMessage(event.data);
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
      return stream;
    } catch (err) {
      console.error("Microphone access denied:", err);
      throw new Error("Microphone permission required for online voice calling");
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
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.endCall();
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
      document.body.appendChild(audioEl);
    }
    audioEl.muted = false;
    audioEl.volume = 1.0;
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {
      // Audio autoplay policy fallback: unlock on first document click
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

      // Poll for Agent's Answer
      this.startPollingAnswer();
    } catch (err) {
      stopRingtone();
      this.setState("idle");
      throw err;
    }
  }

  // 2. Agent accepts the incoming call
  async acceptCall(callData) {
    try {
      stopRingtone();
      this.callId = callData.id;
      this.setState("connecting", { callId: this.callId });

      await this.getMicrophone();
      const pc = this.initPeerConnection();

      // Set Remote Description (Caller's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

      // Add any queued caller ICE candidates
      if (callData.callerCandidates?.length) {
        for (const cand of callData.callerCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
      }

      // Create WebRTC Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send Answer signal
      await this.sendSignal({
        action: "answer",
        callId: this.callId,
        data: { answer: { type: answer.type, sdp: answer.sdp } },
      });

      this.setState("connected", { callId: this.callId, callerInfo: callData.callerInfo });
    } catch (err) {
      console.error("Accept call failed:", err);
      this.endCall();
    }
  }

  // Send signal to BroadcastChannel AND Serverless API
  async sendSignal(payload) {
    // 1. Broadcast locally
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

    if (this.role === "caller" && msg.callId === this.callId) {
      if (msg.action === "answer" && msg.data?.answer && this.peerConnection) {
        stopRingtone();
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data.answer));
          this.setState("connected", { callId: this.callId });
        } catch (e) {}
      } else if (msg.action === "hangup" || msg.action === "reject") {
        this.endCall(false);
      } else if (msg.action === "candidate" && msg.data?.candidate && this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
        } catch (e) {}
      } else if (msg.action === "hold") {
        this.setState("on_hold", { callId: this.callId });
      } else if (msg.action === "resume") {
        this.setState("connected", { callId: this.callId });
      }
    }

    if (this.role === "agent") {
      if (msg.action === "initiate" && (this.state === "idle" || this.state === "ended")) {
        playRingtone("incoming");
        this.setState("incoming_call", { callData: msg.data ? { ...msg.data, id: msg.callId } : null });
      } else if (msg.callId === this.callId) {
        if (msg.action === "hangup" || msg.action === "reject") {
          this.endCall(false);
        } else if (msg.action === "candidate" && msg.data?.candidate && this.peerConnection) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
          } catch (e) {}
        } else if (msg.action === "hold") {
          this.setState("on_hold", { callId: this.callId });
        } else if (msg.action === "resume") {
          this.setState("connected", { callId: this.callId });
        }
      }
    }
  }

  // Poll for answer (Fallback when not on same tab / cross-device)
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
        } else if (data.answer && this.peerConnection && !this.peerConnection.currentRemoteDescription) {
          stopRingtone();
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          this.setState("connected", { callId: this.callId });

          // Add Callee ICE candidates
          if (data.calleeCandidates?.length) {
            for (const cand of data.calleeCandidates) {
              try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }, 1200);
  }

  toggleMute() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.isMuted = !track.enabled;
      return this.isMuted;
    }
    return false;
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

    if (notifyRemote && this.callId) {
      this.sendSignal({ action: "hangup", callId: this.callId });
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    const audioEl = document.getElementById("webrtc-remote-audio");
    if (audioEl) {
      audioEl.srcObject = null;
    }

    this.callId = null;
    this.setState("ended");
    setTimeout(() => this.setState("idle"), 1500);
  }
}
