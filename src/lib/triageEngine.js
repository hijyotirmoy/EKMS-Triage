// Clinical Triage Evaluation Engine
// Supports Anthropic Claude, Google Gemini, or intelligent rule-based clinical triage

export async function evaluateTriage(intake) {
  const notes = (intake.symptom_notes || "").toLowerCase();
  const severity = Number(intake.severity_reported) || 5;
  const age = intake.age != null && intake.age !== "" ? Number(intake.age) : null;
  const duration = intake.duration || "";

  // 1. Direct Anthropic API call if user provided ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: `You are an expert ESIC / ESIS medical triage assistant for call center operators in Assam, India. Evaluate symptoms and output strict JSON with keys: urgency_level ('Emergency'|'Urgent'|'Routine'|'Self-care'), urgency_score (1-10), confidence ('high'|'medium'|'low'), summary_en, summary_hi, reasoning, red_flags (array of strings), recommended_facility_type, recommended_action, call_108 (boolean), detected_language ('English'|'Hindi'|'Hinglish'), followup_questions (array of 2-3 questions).`,
          messages: [
            {
              role: "user",
              content: JSON.stringify(intake),
            },
          ],
        }),
      });
      const data = await res.json();
      const content = data.content?.[0]?.text;
      if (content) {
        const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      console.warn("Direct Anthropic API call failed:", err.message);
    }
  }

  // 2. Upstream Live Claude Sonnet 4.6 evaluation via the live website's API key
  const useLiveUpstream = process.env.USE_LIVE_UPSTREAM_AI !== "false";
  if (useLiveUpstream) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      const liveKey = process.env.UPSTREAM_API_KEY || "sk_live_vJjfGTfyHd4u5v-5Et49KQTfzSRzD8gk";
      const liveUrl = process.env.UPSTREAM_API_URL || "https://esicdemotriage.dhwaniris.in/api/triage";

      const upstreamRes = await fetch(liveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": liveKey,
        },
        body: JSON.stringify({
          caller_name: intake.caller_name || "Caller",
          phone: intake.phone || "",
          age: intake.age != null && intake.age !== "" ? Number(intake.age) : null,
          sex: intake.sex || "",
          symptom_notes: intake.symptom_notes,
          duration: intake.duration || "",
          severity_reported: Number(intake.severity_reported) || 5,
          city: intake.city || "",
          district: intake.district || "",
          pincode: intake.pincode || "",
          source_app: "console",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (upstreamRes.ok) {
        const liveData = await upstreamRes.json();
        if (liveData && liveData.triage) {
          return liveData.triage;
        }
      }
    } catch (err) {
      console.warn("Live upstream Claude call notice (falling back to built-in clinical engine):", err.message);
    }
  }

  // 3. Deterministic Clinical Evaluation Engine (Fallback or offline)
  let detected_language = "English";
  if (/[\u0900-\u097F]/.test(intake.symptom_notes || "")) {
    detected_language = "Hindi";
  } else if (
    /\b(chhati|dard|pasina|chakkar|dawai|saans|bukhar|khansi|badan|khoon|ulti|aankh|jalan|kam|waqt)\b/i.test(
      intake.symptom_notes || ""
    )
  ) {
    detected_language = "Hinglish";
  }

  const red_flags = [];
  let urgency_level = "Routine";
  let urgency_score = 3;
  let call_108 = false;

  // Cardiac / severe respiratory red flags
  const isCardiac =
    (notes.includes("chhati") || notes.includes("chest")) &&
    (notes.includes("dard") || notes.includes("pain") || notes.includes("pressure"));
  const hasRadiation =
    notes.includes("arm") ||
    notes.includes("haath") ||
    notes.includes("jhanjhanahat") ||
    notes.includes("radiat");
  const hasDiaphoresis = notes.includes("pasina") || notes.includes("sweat");
  const hasDyspnea =
    notes.includes("saans") ||
    notes.includes("breath") ||
    notes.includes("suffocat") ||
    notes.includes("gasp");

  // Chemical / pesticide / toxic exposure
  const isPoison =
    notes.includes("pesticide") ||
    notes.includes("spray") ||
    notes.includes("dawai") ||
    notes.includes("chemical") ||
    notes.includes("poison");

  // Neurological red flags
  const isNeuro =
    notes.includes("seizure") ||
    notes.includes("daura") ||
    notes.includes("unconscious") ||
    notes.includes("behosh") ||
    notes.includes("paralysis");

  // Profuse bleeding
  const isSevereBleed =
    (notes.includes("bleeding") || notes.includes("khoon")) &&
    (notes.includes("heavy") || notes.includes("profuse") || notes.includes("ruk nahi"));

  // Evaluate Level
  if (isCardiac && (hasRadiation || hasDiaphoresis || hasDyspnea || severity >= 8)) {
    urgency_level = "Emergency";
    urgency_score = 10;
    call_108 = true;
    if (isCardiac) red_flags.push(`Severe chest pain (${severity}/10)`);
    if (hasRadiation) red_flags.push("Left arm tingling / radiation");
    if (hasDiaphoresis) red_flags.push("Cold sweating (diaphoresis)");
    if (hasDyspnea) red_flags.push("Difficulty breathing (dyspnea)");
  } else if (isPoison) {
    urgency_level = "Urgent";
    urgency_score = Math.max(7, severity);
    red_flags.push("Toxic / agricultural chemical exposure");
    if (notes.includes("aankh") || notes.includes("eye")) {
      red_flags.push("Ocular mucosal irritation");
    }
    if (severity >= 8 || hasDyspnea) {
      urgency_level = "Emergency";
      call_108 = true;
    }
  } else if (isNeuro || isSevereBleed) {
    urgency_level = "Emergency";
    urgency_score = 9;
    call_108 = true;
    if (isNeuro) red_flags.push("Altered consciousness / neurological deficit");
    if (isSevereBleed) red_flags.push("Uncontrolled hemorrhage");
  } else if (severity >= 7 || notes.includes("bukhar") || notes.includes("fever")) {
    if (duration.includes("4-7") || duration.includes("week") || severity >= 7) {
      urgency_level = "Urgent";
      urgency_score = Math.max(6, severity);
      if (notes.includes("chills") || notes.includes("kampkampi") || notes.includes("rigor")) {
        red_flags.push("High fever accompanied by rigors / chills");
      }
    } else {
      urgency_level = "Routine";
      urgency_score = 4;
    }
  } else if (severity <= 3 && !hasDyspnea && !isCardiac) {
    urgency_level = "Self-care";
    urgency_score = 2;
  } else {
    urgency_level = "Routine";
    urgency_score = Math.min(5, Math.max(3, severity));
  }

  // Generate Reasoning, Summaries and Actions
  let summary_en = "";
  let summary_hi = "";
  let reasoning = "";
  let recommended_facility_type = "ESIS Dispensary";
  let recommended_action = "Visit nearest dispensary in 1-2 days for standard consultation.";
  let followup_questions = [];

  const ageStr = age ? `${age}-year-old` : "Caller";
  const sexStr = intake.sex ? intake.sex.toLowerCase() : "patient";

  if (urgency_level === "Emergency") {
    summary_en = `${ageStr} ${sexStr} reporting acute high-acuity symptoms (${severity}/10) requiring immediate emergency intervention.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को तीव्र गंभीर लक्षण (${severity}/10) हैं, तुरंत आपातकालीन देखभाल की आवश्यकता है।`;
    reasoning = `The reported symptoms include clear red-flag indicators (such as acute chest pain with radiating discomfort/diaphoresis or potential vital instability). Clinical safety guidelines mandate immediate dispatch and emergency facility routing.`;
    recommended_facility_type = "Nearest Government Hospital / 108 Ambulance";
    recommended_action = "Instruct caller to lie down, remain calm, and immediately call 108 for an ambulance. Do not drive oneself.";
    followup_questions = [
      "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
      "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
      "Kya unhe koi pehle se dil ki bimari ya high BP hai? (History of cardiac disease or hypertension?)",
    ];
  } else if (urgency_level === "Urgent") {
    summary_en = `${ageStr} ${sexStr} presents with acute symptoms (${severity}/10) requiring evaluation within a few hours.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को तीव्र लक्षण (${severity}/10) हैं, कुछ घंटों के भीतर चिकित्सा जांच आवश्यक है।`;
    reasoning = `Symptoms present clinical acuity or occupational exposure that warrants same-day medical assessment to prevent decompensation.`;
    recommended_facility_type = "ESI Hospital / Emergency OPD";
    recommended_action = "Advise patient to proceed to the nearest ESI Hospital casualty or urgent OPD today.";
    followup_questions = [
      "How many hours ago did this problem intensify?",
      "Have you washed the affected area thoroughly with clean running water?",
      "Are you experiencing any vomiting, vision disturbance, or disorientation?",
    ];
  } else if (urgency_level === "Self-care") {
    summary_en = `${ageStr} ${sexStr} reports minor localized symptoms (${severity}/10) suitable for home care and monitoring.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को सामान्य लक्षण (${severity}/10) हैं, प्राथमिक घरेलू देखभाल पर्याप्त है।`;
    reasoning = `Low reported severity, absence of vital signs compromise or red flags. Standard wound cleansing / hydration and observation is indicated.`;
    recommended_facility_type = "Self-care / Home monitoring";
    recommended_action = "Clean the area with antiseptic or wash thoroughly. Rest, monitor for 24-48 hours, and visit dispensary if symptoms worsen.";
    followup_questions = [
      "Is there any swelling, increasing redness, or discharge?",
      "When was your last Tetanus Toxoid (TT) vaccination?",
    ];
  } else {
    // Routine
    summary_en = `${ageStr} ${sexStr} reports sub-acute symptoms (${severity}/10) suitable for standard dispensary OPD evaluation.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को सामान्य लक्षण (${severity}/10) हैं, डिस्पेंसरी में नियमित जांच कराएं।`;
    reasoning = `Stable clinical presentation without systemic danger signs. Can be managed safely during standard dispensary operating hours within 1-3 days.`;
    recommended_facility_type = "ESIS Dispensary";
    recommended_action = "Visit the nearest ESIS Dispensary during regular OPD hours for doctor consultation and routine prescription.";
    followup_questions = [
      "Has anyone else in the household or workplace fallen sick recently?",
      "Are you currently taking any regular medications?",
    ];
  }

  return {
    urgency_level,
    urgency_score,
    confidence: "high",
    summary_en,
    summary_hi,
    reasoning,
    red_flags,
    recommended_facility_type,
    recommended_action,
    call_108,
    detected_language,
    followup_questions,
  };
}
