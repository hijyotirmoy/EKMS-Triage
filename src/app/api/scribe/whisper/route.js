import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Eliminates Whisper silence/subtitle hallucinations such as
 * "Thank you for watching", "Please subscribe", loops, etc.
 */
function scrubWhisperHallucinations(rawText) {
  if (!rawText) return "";
  const text = String(rawText).trim();
  if (!text) return "";

  // Strip punctuation and multiple spaces to check for hallucination fingerprints
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 2) return "";

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

  let stripped = normalized;
  for (const pattern of hallucinationPatterns) {
    stripped = stripped.replace(pattern, "").trim();
  }

  // If there's barely anything left after removing the hallucination phrases, discard completely
  if (stripped.length < 3) {
    return "";
  }

  // Detect repeating loop phrases (e.g. "Thank you for watching! Thank you for watching.")
  const words = normalized.split(/\s+/);
  if (words.length >= 4) {
    const unique = new Set(words);
    if (unique.size <= 2 && words.length >= 4) {
      return "";
    }
  }

  return text;
}

/**
 * Audio Transcription using Hugging Face Whisper Large Models
 * Models: openai/whisper-large-v3-turbo, openai/whisper-large-v3
 * Groq is exclusively reserved for clinical triage and LLM chat; voice-to-text uses Hugging Face.
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data with an audio blob in 'file' field." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("file");
    const lang = formData.get("language") || "";
    const customPrompt = formData.get("prompt") || "";

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file blob is required in 'file' field." },
        { status: 400 }
      );
    }

    const hfKey =
      process.env.HUGGINGFACE_API_KEY ||
      process.env.HF_TOKEN ||
      process.env.HUGGING_FACE_TOKEN ||
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;

    const openAiKey =
      process.env.OPENAI_API_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    // Convert incoming file to audio buffer
    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(audioBytes);
    const audioMime = audioFile.type || "audio/webm";

    // 1. PRIMARY: Hugging Face Whisper Large Model
    if (hfKey) {
      const hfModels = ["openai/whisper-large-v3-turbo", "openai/whisper-large-v3"];

      for (const hfModel of hfModels) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);

          const hfRes = await fetch(
            `https://router.huggingface.co/hf-inference/models/${hfModel}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${hfKey.trim()}`,
                "Content-Type": audioMime,
                "x-wait-for-model": "true",
                "x-use-cache": "false",
              },
              body: audioBuffer,
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (hfRes.ok) {
            const result = await hfRes.json();
            const rawText = result.text || "";
            const cleanText = scrubWhisperHallucinations(rawText.trim());
            return NextResponse.json({
              text: cleanText,
              source: "huggingface-whisper",
              model: hfModel,
            });
          } else {
            const errBody = await hfRes.text();
            console.warn(`Hugging Face (${hfModel}) status ${hfRes.status}:`, errBody);
          }
        } catch (hfErr) {
          console.warn(`Hugging Face fetch error on ${hfModel}:`, hfErr.message);
        }
      }
    }

    // 2. SECONDARY FALLBACK: OpenAI Whisper (whisper-1) if configured
    if (openAiKey) {
      try {
        const medicalVocabularyPrompt =
          customPrompt ||
          "ESIC Indian emergency medical triage consultation. Terms: chest pain, seene mein dard, vomiting, ulti, bukhar, sir dard, chakkar, kamzori, Guwahati, Dispur, Beltola, 108 ambulance, 104 helpline.";

        const isoLang = lang && lang !== "auto" ? lang.split("-")[0].toLowerCase() : null;

        const openAiFormData = new FormData();
        openAiFormData.append("file", audioFile, "audio.webm");
        openAiFormData.append("model", "whisper-1");
        openAiFormData.append("prompt", medicalVocabularyPrompt);
        if (isoLang && ["en", "hi", "as", "bn", "ta", "te", "mr", "gu", "kn", "pa"].includes(isoLang)) {
          openAiFormData.append("language", isoLang);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const openAiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
          },
          body: openAiFormData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (openAiRes.ok) {
          const result = await openAiRes.json();
          const cleanText = scrubWhisperHallucinations((result.text || "").trim());
          return NextResponse.json({
            text: cleanText,
            duration: result.duration || null,
            language: result.language || lang,
            source: "openai-whisper",
            engine: "whisper-1",
          });
        }
      } catch (err) {
        console.warn("OpenAI Whisper fallback exception:", err.message);
      }
    }

    return NextResponse.json(
      {
        error: "Hugging Face Whisper transcription unavailable. Please verify HUGGINGFACE_API_KEY in .env.local",
      },
      { status: 503 }
    );
  } catch (err) {
    console.error("Whisper route exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to transcribe audio via Whisper" },
      { status: 500 }
    );
  }
}
