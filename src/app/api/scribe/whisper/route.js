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
 * OpenAI Whisper Audio Transcription Flow
 * Seamlessly transcribes audio chunks from the client using OpenAI Whisper (whisper-1).
 * Features automatic high-speed fallback to Groq Whisper Large V3 if OpenAI quota is exhausted or offline.
 */
export async function POST(request) {
  try {
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

    const openAiKey =
      process.env.OPENAI_API_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    const groqKey =
      process.env.GROQ_API_KEY ||
      process.env.NEXT_PUBLIC_GROQ_API_KEY;

    // Default clinical prompt to boost medical and Indian vernacular recognition
    const medicalVocabularyPrompt =
      customPrompt ||
      "ESIC / ESIS Indian medical triage call consultation. Common terms: chest pain, seene mein dard, vomiting, ulti, bukhar, fever, chakkar, weakness, kamzori, khansi, cough, medicine, dawai, 104, 108 ambulance, hospital, dispensary, prescription, suicide, depression, accident, casualty, fracture.";

    const isoLang = lang && lang !== "auto" ? lang.split("-")[0].toLowerCase() : null;

    // 1. Try OpenAI Whisper (whisper-1)
    if (openAiKey) {
      try {
        const openAiFormData = new FormData();
        openAiFormData.append("file", audioFile, "audio.webm");
        openAiFormData.append("model", "whisper-1");
        openAiFormData.append("prompt", medicalVocabularyPrompt);
        if (isoLang && ["en", "hi", "as", "bn", "ta", "te", "mr", "gu", "kn", "pa"].includes(isoLang)) {
          openAiFormData.append("language", isoLang);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

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
          });
        } else {
          const errText = await openAiRes.text();
          console.warn("OpenAI Whisper returned non-OK status:", openAiRes.status, errText);
          // If quota exhausted (429) or other issue, proceed to Groq Whisper fallback
        }
      } catch (err) {
        console.warn("OpenAI Whisper fetch exception, falling back:", err.message);
      }
    }

    // 2. High-speed Fallback: Groq Whisper Large V3 (model: whisper-large-v3)
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        groqFormData.append("file", audioFile, "audio.webm");
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("prompt", medicalVocabularyPrompt);
        if (isoLang && ["en", "hi"].includes(isoLang)) {
          groqFormData.append("language", isoLang);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqFormData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqRes.ok) {
          const result = await groqRes.json();
          const cleanText = scrubWhisperHallucinations((result.text || "").trim());
          return NextResponse.json({
            text: cleanText,
            source: "groq-whisper",
            engine: "whisper-large-v3",
          });
        } else {
          const errText = await groqRes.text();
          console.warn("Groq Whisper error:", groqRes.status, errText);
        }
      } catch (err) {
        console.warn("Groq Whisper fallback exception:", err.message);
      }
    }

    return NextResponse.json(
      { error: "Whisper transcription service unavailable. Please check API keys." },
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
