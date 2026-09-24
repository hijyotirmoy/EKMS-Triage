// Web Speech API & Multi-lingual Speech-to-Text / Text-to-Speech Controller
// Supports Indian English (en-IN), Hindi/Hinglish (hi-IN), Assamese (as-IN), and English (en-US)

const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

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
      const rec = new SpeechRecognition();
      const isMobile = isMobileDevice();

      // On Android/mobile, continuous=true causes speech engine crashes or aborts.
      // continuous=false with instant auto-restart in onend provides rock-solid continuous listening.
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
              this.pendingInterim = "";
              this.onInterim?.("");
              this.onFinal?.(clean);
            }
          } else {
            interimTranscript += transcript;
          }
        }
        if (interimTranscript) {
          this.pendingInterim = interimTranscript;
          // Zero-delay interim emission as letters and words are spoken
          this.onInterim?.(interimTranscript);
        }
      };

      rec.onerror = (event) => {
        // "no-speech" and "aborted" are normal lifecycle events
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition notice:", event.error);
          this.onError?.(event.error);
        }
        if (event.error === "not-allowed") {
          this.shouldRestart = false;
        }
      };

      rec.onend = () => {
        // Commit any lingering interim speech before restarting to prevent dropped words in manual mode
        if (this.pendingInterim && this.pendingInterim.trim()) {
          const finalSpurt = this.pendingInterim.trim();
          this.pendingInterim = "";
          this.onInterim?.("");
          this.onFinal?.(finalSpurt);
        }
        this.isListening = false;
        this.isStarting = false;
        if (this.shouldRestart) {
          clearTimeout(this.restartTimeout);
          // 35ms ultra-fast restart delay gives audio driver time to cycle without perceptible gap
          this.restartTimeout = setTimeout(() => {
            if (this.shouldRestart) {
              this._createAndStart();
            }
          }, 35);
        }
      };

      this.recognition = rec;
      rec.start();
    } catch (err) {
      console.warn("Could not start speech recognition session:", err);
      this.isListening = false;
      this.isStarting = false;
      if (this.shouldRestart) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.shouldRestart) {
            this._createAndStart();
          }
        }, 200);
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

