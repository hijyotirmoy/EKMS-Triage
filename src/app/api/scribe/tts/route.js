import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get("text") || "";
    const lang = searchParams.get("lang") || "en-IN";

    if (!text.trim()) {
      return new NextResponse("Text parameter required", { status: 400 });
    }

    // Map language code for TTS
    let tl = "en";
    if (lang.startsWith("hi")) tl = "hi";
    else if (lang.startsWith("as") || lang.includes("assam")) tl = "as";
    else if (lang.startsWith("en-IN") || lang.includes("IN")) tl = "en-IN";
    else tl = "en";

    // Google TTS audio stream
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      tl
    )}&q=${encodeURIComponent(text.slice(0, 200))}`;

    const ttsRes = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!ttsRes.ok) {
      return new NextResponse("Failed to fetch TTS stream", { status: ttsRes.status });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.warn("TTS route error:", err.message);
    return new NextResponse(err.message, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { text, lang } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // If Gemini API key is configured, can use Gemini to synthesize concise clinical speech script
    let spokenText = text;
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Convert this clinical dialogue into a clear, natural spoken sentence for text-to-speech: "${text}". Keep it concise and natural.`,
                  },
                ],
              },
            ],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const clean = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (clean) spokenText = clean.trim();
        }
      } catch (e) {}
    }

    return NextResponse.json({
      spokenText,
      audioUrl: `/api/scribe/tts?text=${encodeURIComponent(spokenText)}&lang=${encodeURIComponent(
        lang || "en-IN"
      )}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
