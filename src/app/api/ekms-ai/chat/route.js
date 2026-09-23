import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt, lastAnswer = "", history = [], sessionId = "session-" + Date.now(), currentTriage = {} } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    try {
      const response = await fetch("https://ai.ekms.in/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          lastAnswer,
          history,
          sessionId,
          currentTriage,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (fetchErr) {
      console.warn("Call to ai.ekms.in failed, activating intelligent clinical fallback:", fetchErr.message);
    }

    // Fallback response generator if upstream is slow or offline
    const p = prompt.toLowerCase();
    let stage = "severity";
    let agentScript = "Can you describe how intense the symptoms are, and if they are getting worse?";
    let options = ["Mild — manageable", "Moderate — uncomfortable", "Severe — distressing", "Extremely severe — unable to function"];
    let triageSummary = { symptom: prompt, severity: null, duration: null, associated: [] };

    if (p.includes("chest") || p.includes("chhati") || p.includes("heart")) {
      agentScript = "How would you describe the chest pain and sensation?";
      options = [
        "Heavy crushing / Squeezing pressure",
        "Sharp stabbing / Worsens with deep breath",
        "Burning / Acidity sensation",
        "Mild ache / Muscular tightness",
      ];
      triageSummary.symptom = "Chest Pain";
    } else if (p.includes("bukhar") || p.includes("fever") || p.includes("temp")) {
      agentScript = "How high is the fever, and are you having shivering or body chills?";
      options = [
        "Mild (99°F - 100°F)",
        "Moderate (100.5°F - 102°F)",
        "High Grade (>102°F)",
        "Continuous with Shivering & Rigors",
      ];
      triageSummary.symptom = "Fever";
    } else if (p.includes("crushing") || p.includes("pressure") || p.includes("severe") || p.includes("moderate")) {
      stage = "duration";
      agentScript = "How long have you been experiencing this discomfort?";
      options = [
        "Just started (< 30 mins)",
        "1 to 2 hours continuous",
        "A few hours on and off",
        "> 1 day (Comes and goes)",
      ];
      triageSummary.severity = prompt;
    } else if (p.includes("hour") || p.includes("minute") || p.includes("day") || p.includes("started")) {
      stage = "associated";
      agentScript = "Are there any associated symptoms like sweating, breathing difficulty, dizziness, or vomiting?";
      options = [
        "Sweating & Left arm tingling",
        "Shortness of breath / Cough",
        "Dizziness & Nausea",
        "None of these",
      ];
      triageSummary.duration = prompt;
    }

    return NextResponse.json({
      agentScript,
      answer: agentScript,
      options,
      stage,
      triageSummary,
      decision: null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
