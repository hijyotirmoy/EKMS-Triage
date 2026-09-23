import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    const { text, action, targetLang } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ result: "" });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
      const prompt =
        action === "translate"
          ? `Translate and format the following Indian clinical call dialogue to ${targetLang || "English"} clearly while preserving all symptoms: "${text}"`
          : `Format and correct this medical transcription from a call between an IP patient and an ESIC triage operator (English/Hinglish/Assamese): "${text}". Keep it concise and clinical.`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (output) {
          return NextResponse.json({ result: output.trim(), source: "gemini" });
        }
      }
    }

    // Direct clean fallback
    return NextResponse.json({ result: text.trim(), source: "client" });
  } catch (err) {
    console.warn("Gemini scribe API notice:", err.message);
    return NextResponse.json({ result: "", error: err.message }, { status: 500 });
  }
}
