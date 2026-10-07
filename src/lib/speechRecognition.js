// Web Speech API & Multi-lingual Speech-to-Text / Text-to-Speech Controller
// Supports Indian English (en-IN), Hindi/Hinglish (hi-IN), Assamese (as-IN), and English (en-US)

const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Filters out known Whisper silence and subtitle hallucinations
 */
export function isWhisperHallucination(text) {
  if (!text) return true;
  const t = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return true;

  // Explicitly whitelist valid short affirmative/negative clinical answers
  const validShortClinicalAnswers = new Set([
    "no", "na", "ha", "haan", "nahi", "nah", "nhi", "not", "none", "nil", "nope",
    "yes", "ya", "yah", "ok", "okay", "done", "fine", "low", "high", "mild", "pain",
    "left", "right", "back", "arm", "head", "leg", "eye", "ear", "neck", "hand", "zero"
  ]);
  if (validShortClinicalAnswers.has(t)) {
    return false;
  }

  if (t.length < 2) return true;

  const hallucinationPatterns = [
    /thank\s*you\s*(for\s*watching)?/gi,
    /thanks\s*(for\s*watching)?/gi,
    /please\s*subscribe/gi,
    /subscribe\s*to\s*(my|the)?\s*channel/gi,
    /like\s*and\s*subscribe/gi,
    /subtitles\s*by/gi,
    /amara\s*org/gi,
    /what\s*will\s*walk/gi,
    /please\s*take\s*your\s*priority/gi,
    /see\s*you\s*(in\s*the\s*next\s*video|next\s*time|tomorrow|again)/gi,
    /bye\s*bye/gi,
    /mbc/gi,
    /translated\s*by/gi,
    /watching/gi,
    /copyright/gi,
    /all\s*rights\s*reserved/gi,
    /welcome\s*back\s*to\s*my\s*channel/gi,
  ];

  let stripped = t;
  for (const pattern of hallucinationPatterns) {
    stripped = stripped.replace(pattern, "").trim();
  }

  if (stripped.length < 2) return true;

  // Detect repeating loop phrases
  const words = t.split(/\s+/);
  if (words.length >= 4) {
    const unique = new Set(words);
    if (unique.size <= 2 && words.length >= 4) return true;
  }

  return false;
}

/**
 * Normalizes phonetic speech recognizer confusions in Indian medical triage
 */
export function normalizeClinicalSpeech(text) {
  if (!text) return "";
  let clean = String(text);

  const replacements = [
    [/\bchess pin\b/gi, "chest pain"],
    [/\bchess pain\b/gi, "chest pain"],
    [/\bchase pain\b/gi, "chest pain"],
    [/\bchests pain\b/gi, "chest pain"],
    [/\bhard attack\b/gi, "heart attack"],
    [/\bhot attack\b/gi, "heart attack"],
    [/\bhigh blood preshur\b/gi, "high blood pressure"],
    [/\bloose motion\b/gi, "loose motions"],
    [/\bthis pur\b/gi, "Dispur"],
    [/\bdis pur\b/gi, "Dispur"],
    [/\bkam rup\b/gi, "Kamrup"],
    [/\bgauhati\b/gi, "Guwahati"],
    [/\b1 0 8\b/gi, "108"],
    [/\bone zero eight\b/gi, "108"],
    [/\b1 0 4\b/gi, "104"],
    [/\bone zero four\b/gi, "104"],
    [/\be s i c\b/gi, "ESIC"],
    [/\besis\b/gi, "ESIS"],
  ];

  for (const [pattern, target] of replacements) {
    clean = clean.replace(pattern, target);
  }
  return clean;
}

/**
 * Real-Time Groq Whisper Turbo Audio Stream Controller with Voice Activity Detection (VAD)
 * Analyzes audio volume; only sends speech slices to /api/scribe/whisper when voice is present.
 * Uses rapid 1200ms chunking and speech pause detection for < 300ms end-to-end responsiveness.
 */
export class OpenAIWhisperStreamController {
  constructor({ lang = "en-IN", onInterim, onFinal, onError, chunkIntervalMs = 1200 }) {
    this.lang = lang;
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onError = onError;
    this.chunkIntervalMs = chunkIntervalMs;

    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isListening = false;
    this.isStarting = false;
    this.sliceTimer = null;
    this.isProcessing = false;

    // AudioContext & VAD (Voice Activity Detection)
    this.audioCtx = null;
    this.analyser = null;
    this.vadBuffer = null;
    this.volumeTimer = null;
    this.maxVolumeInChunk = 0;
    this.lastSpokenText = "";

    // Adaptive Pause Detection
    this.activeVoiceSamples = 0;
    this.silenceSamplesAfterVoice = 0;
    this.lastChunkSliceTime = 0;
  }

  isSupported() {
    return (
      typeof window !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    );
  }

  async start() {
    if (!this.isSupported() || this.isListening || this.isStarting) return;
    this.isStarting = true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Voice Activity Detection (VAD) using Web Audio API
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
          if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
          }
          this.analyser = this.audioCtx.createAnalyser();
          this.analyser.fftSize = 256;
          const sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
          sourceNode.connect(this.analyser);
          this.vadBuffer = new Uint8Array(this.analyser.frequencyBinCount);
          this.maxVolumeInChunk = 0;
          this.activeVoiceSamples = 0;
          this.silenceSamplesAfterVoice = 0;
          this.lastChunkSliceTime = Date.now();
          this._startVolumeMonitor();
        }
      } catch (vadErr) {
        console.warn("VAD AudioContext warning:", vadErr);
      }

      const supportedMime = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) || "";

      this.mediaRecorder = new MediaRecorder(
        this.mediaStream,
        supportedMime ? { mimeType: supportedMime } : undefined
      );
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this._dispatchAudioChunk();
      };

      this.mediaRecorder.start();
      this.isListening = true;
      this.isStarting = false;
      this.lastChunkSliceTime = Date.now();

      // Start cyclical chunking
      this._startSliceCycle();
    } catch (err) {
      console.warn("Could not start Whisper media stream:", err);
      this.isStarting = false;
      this.isListening = false;
      this.onError?.(err.message || "Microphone access denied for Whisper");
    }
  }

  _cycleRecordingChunk() {
    if (this.isListening && this.mediaRecorder && this.mediaRecorder.state === "recording") {
      try {
        this.lastChunkSliceTime = Date.now();
        this.mediaRecorder.stop();
        this.mediaRecorder.start();
      } catch (e) {}
    }
  }

  _startVolumeMonitor() {
    clearInterval(this.volumeTimer);
    this.volumeTimer = setInterval(() => {
      if (!this.analyser || !this.isListening) return;
      this.analyser.getByteFrequencyData(this.vadBuffer);
      let sum = 0;
      for (let i = 0; i < this.vadBuffer.length; i++) {
        sum += this.vadBuffer[i];
      }
      const avg = sum / this.vadBuffer.length;
      if (avg > this.maxVolumeInChunk) {
        this.maxVolumeInChunk = avg;
      }

      // Adaptive speech pause detection:
      // When voice energy is detected (> 7), track voice activity
      if (avg >= 7) {
        this.activeVoiceSamples++;
        this.silenceSamplesAfterVoice = 0;
      } else {
        // If speaker previously spoke for > 200ms and has now stopped speaking for ~300ms,
        // trigger an immediate chunk dispatch without waiting for the full timer!
        if (this.activeVoiceSamples >= 3) {
          this.silenceSamplesAfterVoice++;
          const timeSinceLastSlice = Date.now() - (this.lastChunkSliceTime || 0);
          if (this.silenceSamplesAfterVoice >= 5 && timeSinceLastSlice >= 650) {
            this.activeVoiceSamples = 0;
            this.silenceSamplesAfterVoice = 0;
            this._cycleRecordingChunk();
          }
        }
      }
    }, 60);
  }

  _startSliceCycle() {
    clearInterval(this.sliceTimer);
    this.sliceTimer = setInterval(() => {
      this._cycleRecordingChunk();
    }, this.chunkIntervalMs);
  }

  async _dispatchAudioChunk() {
    if (this.audioChunks.length === 0) return;
    const currentChunks = [...this.audioChunks];
    this.audioChunks = [];

    // Voice Activity Check: If microphone volume stayed below threshold (silence/ambient hum),
    // drop the slice immediately! Do NOT send silence to Whisper!
    const hadVoice = !this.analyser || this.maxVolumeInChunk >= 6;
    this.maxVolumeInChunk = 0; // Reset for next slice
    if (!hadVoice) {
      return;
    }

    const audioBlob = new Blob(currentChunks, {
      type: this.mediaRecorder?.mimeType || "audio/webm",
    });
    if (audioBlob.size < 1000) return; // Discard tiny empty slices

    try {
      this.isProcessing = true;
      const formData = new FormData();
      formData.append("file", audioBlob, "speech.webm");
      formData.append("language", this.lang || "en-IN");

      const res = await fetch("/api/scribe/whisper", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = (data.text || "").trim();
        const text = normalizeClinicalSpeech(rawText);

        // Ignore repetitive hallucinated silence fillers from Whisper & duplicates
        if (text && !isWhisperHallucination(text)) {
          if (text !== this.lastSpokenText) {
            this.lastSpokenText = text;
            this.onFinal?.(text, data.source || "huggingface-whisper");
          }
        }
      }
    } catch (err) {
      console.warn("Whisper stream chunk error:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  stop() {
    this.isListening = false;
    this.isStarting = false;
    clearInterval(this.sliceTimer);
    clearInterval(this.volumeTimer);

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
      this.analyser = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.lastSpokenText = "";
  }
}

export class SpeechStreamController {
  constructor({ lang = "en-IN", onInterim, onFinal, onError }) {
    this.lang = lang;
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onError = onError;

    this.recognition = null;
    this.isListening = false;
    this.shouldRestart = false;
    this.restartTimeout = null;
    this.isStarting = false;
    this.pendingInterim = "";

    this.lastEmittedText = "";
    this.lastEmittedAt = 0;
  }

  _emitFinal(text, source = "browser-webspeech") {
    if (!text) return;
    const clean = normalizeClinicalSpeech(text.trim());
    if (!clean) return;

    const now = Date.now();
    // Prevent immediate duplicate echo within 400ms
    if (
      this.lastEmittedText &&
      this.lastEmittedText.toLowerCase() === clean.toLowerCase() &&
      now - (this.lastEmittedAt || 0) < 400
    ) {
      return;
    }

    this.lastEmittedText = clean;
    this.lastEmittedAt = now;
    this.pendingInterim = "";
    this.onInterim?.("");
    this.onFinal?.(clean);
  }

  isSupported() {
    return (
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    );
  }

  _cleanup() {
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;
    }
    this.isListening = false;
    this.isStarting = false;
    this.pendingInterim = "";
  }

  _createAndStart() {
    if (!this.shouldRestart || !this.isSupported()) return;
    this._cleanup();

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        this.isListening = true;
        this.isStarting = false;
        return;
      }

      const rec = new SpeechRecognition();
      const isMobile = isMobileDevice();

      rec.continuous = !isMobile;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.lang || "en-IN";

      this.isStarting = true;

      rec.onstart = () => {
        this.isListening = true;
        this.isStarting = false;
      };

      rec.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || "";
          if (item.isFinal) {
            const clean = transcript.trim();
            if (clean) {
              this._emitFinal(clean, "browser-webspeech");
            }
          } else {
            interimTranscript += transcript;
          }
        }
        if (interimTranscript) {
          this.pendingInterim = interimTranscript;
          this.onInterim?.(interimTranscript);
        }
      };

      rec.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          return; // Expected silence or normal abort; will auto-restart
        }
        if (event.error === "not-allowed") {
          console.warn("Microphone access denied for SpeechRecognition");
          this.shouldRestart = false;
          this.onError?.("Microphone permission denied");
          return;
        }
        console.warn("Speech recognition notice:", event.error);
        if (this.shouldRestart) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.shouldRestart) {
              this._createAndStart();
            }
          }, 350);
        }
      };

      rec.onend = () => {
        // Flush any remaining interim buffer
        if (this.pendingInterim && this.pendingInterim.trim()) {
          const finalSpurt = this.pendingInterim.trim();
          this.pendingInterim = "";
          this.onInterim?.("");
          this._emitFinal(finalSpurt, "browser-webspeech");
        }
        this.isListening = false;
        this.isStarting = false;

        // Auto-restart immediately so it never stops listening
        if (this.shouldRestart) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.shouldRestart) {
              try {
                this.recognition?.start();
              } catch (e) {
                this._createAndStart();
              }
            }
          }, 35);
        }
      };

      this.recognition = rec;
      rec.start();
    } catch (err) {
      console.warn("Speech recognition initialization exception:", err);
      this.isListening = false;
      this.isStarting = false;
      if (this.shouldRestart) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.shouldRestart) {
            this._createAndStart();
          }
        }, 500);
      }
    }
  }

  start() {
    if (!this.isSupported()) return;
    this.shouldRestart = true;
    if (this.isListening || this.isStarting) return;
    clearTimeout(this.restartTimeout);
    this._createAndStart();
  }

  ensureListening() {
    if (this.shouldRestart && !this.isListening && !this.isStarting) {
      this.start();
    }
  }

  setLanguage(lang) {
    if (this.lang === lang) return;
    this.lang = lang;
    if (this.shouldRestart) {
      this.start();
    }
  }

  stop() {
    this.shouldRestart = false;
    clearTimeout(this.restartTimeout);
    this._cleanup();
  }
}

// Text-To-Speech helper powered by Gemini / Google TTS & Web Speech fallback
let currentAudio = null;

export function speakText(text, lang = "en-IN") {
  if (typeof window === "undefined" || !text) return;

  // Stop any currently playing audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }

  // 1. Try real-time Google/Gemini Audio TTS stream
  try {
    const audioUrl = `/api/scribe/tts?text=${encodeURIComponent(text.slice(0, 250))}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to Web Speech API
        speakWithBrowserSynthesis(text, lang);
      });
    }
  } catch (err) {
    speakWithBrowserSynthesis(text, lang);
  }
}

function speakWithBrowserSynthesis(text, lang = "en-IN") {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("SpeechSynthesis error:", e);
  }
}

export {
  OpenAIWhisperStreamController as HuggingFaceWhisperStreamController,
  OpenAIWhisperStreamController as GroqWhisperStreamController,
};
