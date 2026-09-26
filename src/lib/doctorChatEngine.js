// EKMS AI Call Triage & Forwarding Assistant
// Advanced Clinical Probing Engine with Doctor-like Empathy, Context Analysis & Anti-Repetition
// Detects physical and psychiatric conditions, screens for suicidal ideation/depression,
// and recommends call routing (108 Ambulance / ESIC Hospital / ESIS Dispensary / 104 Medical Team / Counselling Department)
// Strictly NO medical prescription or doctor treatment advice.

import {
  extractClinicalEntities,
  detectClinicalDomain,
  DOMAIN_LABELS,
  getDiseaseProbingProtocol,
} from "./clinicalAdaptiveEngine.js";
import { getDispensaryOperatingStatus, getHospitalOpdOperatingStatus } from "./triageEngine.js";
import { groqChatCompletion } from "./groqPool.js";

const SYSTEM_PROMPT = `You are EKMS AI, a world-class clinical triage and call-forwarding assistant for ESIC / ESIS helpline operators in Assam, India.
YOU SPEAK WITH THE COMPASSION, WARMTH, AND CLINICAL SHARPNESS OF AN EXPERIENCED DOCTOR.

CORE CLINICAL RULES:
1. INTERVIEW CALLER: Ask focused clinical probing questions to uncover main complaint, duration, triggers, and severity. Do NOT give medical advice, drug prescriptions, or dosages.
2. ONE-QUESTION-AT-A-TIME: Ask EXACTLY ONE single, clear clinical question per turn. Never combine multiple inquiries.
3. LANGUAGE PROTOCOL (ENGLISH + HINGLISH ONLY):
   - Formulate the probing question in English, followed by a concise Romanized Hinglish translation in parentheses:
     Format: Ask the IP: "<English Question>" (Hinglish: <Romanized Hinglish Question>)
   - DO NOT USE DEVANAGARI HINDI SCRIPT. Use ONLY English and Latin-script Hinglish!
4. RELEVANT SUGGESTED ANSWERS: Provide 3 to 4 realistic suggestedAnswers in English/Hinglish directly answering your exact single question.
5. IDENTITY ASSUMPTION: Assume caller is conscious and is the patient (IP) themselves unless they explicitly state calling for a family member. NEVER ask "Are you conscious?".
6. ANTI-REPETITION: Never repeat or re-ask questions that were already answered in the chat.
7. EMPATHY & EMOTIONAL REASSURANCE:
   - For distress, pain, or suicidal crisis: Express immediate heartfelt sympathy and reassurance before asking your question.
   - Dual Emergency: If acute self-harm/physical trauma + psychiatric crisis, prioritize physical emergency dispatch (108 Ambulance) with concurrent psychiatric counselling support.
8. REFERRAL TIMING: On Turns 1-2, return referralDestination: null unless acute 108 emergency or direct caller preference. On Turn 3+, synthesize findings for referral recommendation.

OUTPUT STRICT VALID JSON OBJECT ONLY (no markdown, no backticks):
{
  "probingQuestion": "Ask the IP: '...' (Hinglish: ...)",
  "suggestedAnswers": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "suspectedCondition": "Primary suspected condition",
  "isPsychiatric": true | false,
  "severity": "High" | "Moderate" | "Mild",
  "referralDestination": "108 Ambulance" | "Psychological Counselling Department" | "NACO 1097 Helpline" | "ESIC Hospital" | "ESIS Dispensary" | "104 Medical Team" | "e-Sanjeevani" | "Nearest Pharmacy" | "Forward to Doctor" | null,
  "referralReason": "Clear action for operator" | null,
  "redFlagsDetected": ["ONLY acute red flags explicitly reported by caller; NEVER include denied symptoms like 'no/nehi fever'"],
  "duration": "detected duration or accident time",
  "isReadyForSummary": true | false,
  "clinicalSummary": "Concise structured triage summary in English"
}`;

/**
 * Detects if user input is an off-topic non-medical inquiry
 */
export function isNonMedicalQuery(text) {
  if (!text) return false;
  const clean = text.toLowerCase().trim();

  const offTopicPatterns = [
    /\b(weather|barish|mausam|temperature outside|rain today)\b/i,
    /\b(cricket|football|ipl|score|match|who won|who won the match)\b/i,
    /\b(politics|election|vote|minister|bjp|congress|government policy)\b/i,
    /\b(tell me a joke|joke sunao|entertain me|sing a song)\b/i,
    /\b(capital of|who is the president|who is the prime minister|history of|geography of)\b/i,
    /\b(write code|python code|javascript|html|software|programming)\b/i,
    /\b(recipe|how to cook|biryani recipe|food recipe)\b/i,
    /\b(movie|cinema|actor|actress|bollywood|hollywood)\b/i,
    /\b(how are you doing today|what is your name|who made you)\b/i,
  ];

  const hasMedicalKeywords = /\b(pain|dard|fever|bukhar|cough|khansi|sick|ill|bimar|vomit|ulti|headache|chest|heart|doctor|medicine|dawai|hospital|dispensary|ambulance|injury|chot|accident|bleeding|mental|depress|suicid|104|108|weakness|kamzori|stone|rash|allergy|hopeless|lonely|anxiety)\b/i.test(clean);

  return offTopicPatterns.some((pattern) => pattern.test(clean)) && !hasMedicalKeywords;
}

/**
 * Detects if the caller's message expresses an explicit preference for a specific facility or action.
 */
export function detectDirectCallerReferralIntent(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // 1. Direct Hospital Intent
  if (
    /\b(hospital|aspatal|hospital jaana|hospital jana|visit hospital|esic hospital|admit|bada aspatal|hospital me dikhana|hospital me dikhana hai|hospital jana chahta|hospital jana chahti|hospital jaana chahunga|hospital jana chahunga|hospital jaana chahungi|hospital jana chahungi|hospital me admit|emergency ward|emergency casualty)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "ESIC Hospital",
      reason:
        "Caller explicitly requested to visit ESIC Hospital; guide caller to nearest ESIC Hospital for examination today.",
      suspectedConditionSuffix: "Hospital Visit Consultation",
      suggestedQuestion:
        'Ask the IP: "Which district or location are you calling from so we can guide you to the nearest ESIC Hospital?" (Hinglish: "Aap kis district ya location se bol rahe hain taaki hum nearest ESIC Hospital ka pata bata sakein?")',
      suggestedAnswers: [
        "Need address of nearest ESIC Hospital",
        "Have severe symptoms needing hospital OPD today",
        "Carrying Pehchan card and doctor prescription",
        "Need emergency casualty directions",
      ],
    };
  }

  // 2. Direct Dispensary Intent
  if (
    /\b(dispensary|esis dispensary|esi dispensary|local clinic|chhota hospital|dispensary jaana|dispensary jana|visit dispensary|dispensary me dikhana)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "ESIS Dispensary",
      reason:
        "Caller requested local ESIS Dispensary visit; provide dispensary timings and Pehchan card check.",
      suspectedConditionSuffix: "ESIS Dispensary Visit",
      suggestedQuestion:
        'Ask the IP: "Do you have your ESIC Pehchan card with you, and do you know your local dispensary timings?" (Hinglish: "Kya aapke paas ESIC Pehchan card hai aur local dispensary timings pata hain?")',
      suggestedAnswers: [
        "Need local dispensary address and OPD timings",
        "Have Pehchan card ready",
        "Need routine doctor checkup and medicines",
        "First time visiting ESIS dispensary",
      ],
    };
  }

  // 3. Direct 108 / Ambulance Intent
  if (
    /\b(108|ambulance|emergency ambulance|urgent vehicle|ambulance bulao|ambulance chahiye|call 108|108 call)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "108 Ambulance",
      reason:
        "Caller requested 108 Ambulance; immediately collect location landmarks and coordinate 108 dispatch.",
      suspectedConditionSuffix: "108 Emergency Ambulance Dispatch",
      suggestedQuestion:
        'Ask the IP: "What is your exact location and landmark right now for 108 Ambulance dispatch?" (Hinglish: "108 Ambulance bhejne ke liye apna exact location aur landmark batayein?")',
      suggestedAnswers: [
        "Emergency at home — Need immediate ambulance",
        "Accident on road / highway — Casualties present",
        "Patient unconscious / unable to move",
        "Landmark details provided",
      ],
    };
  }

  // 4. Direct 104 Phone Doctor Intent
  if (
    /\b(104|phone consultation|phone doctor|tele consultation|tele-consultation|tele doctor|tele-doctor|call with 104|104 doctor|doctor on call|telephonic doctor|phone pe doctor|phone par doctor|call.*104|104 call)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "104 Medical Team",
      reason:
        "Caller requested tele-doctor phone consultation; transfer call queue to 104 Medical Team.",
      suspectedConditionSuffix: "104 Tele-Doctor Consultation",
      suggestedQuestion:
        'Ask the IP: "Could you briefly state your main symptom so 104 medical team is ready when connected?" (Hinglish: "Kripya apna main symptom batayein taaki 104 medical team connect hote hi madad kar sake?")',
      suggestedAnswers: [
        "Fever / cold / mild body ache",
        "Stomach upset / nausea / weakness",
        "Need advice on existing BP / Sugar medicine",
        "General health consultation",
      ],
    };
  }

  // 5. Direct e-Sanjeevani Intent
  if (
    /\b(e sanjeevani|esanjeevani|online doctor|video consultation|video doctor|telemedicine)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "e-Sanjeevani",
      reason:
        "Caller requested government online telemedicine consultation; advise e-Sanjeevani portal/app.",
      suspectedConditionSuffix: "e-Sanjeevani Telemedicine Guidance",
      suggestedQuestion:
        'Ask the IP: "Do you have an Android/iOS smartphone with internet to consult the doctor via e-Sanjeevani?" (Hinglish: "Kya aapke paas e-Sanjeevani par online doctor se baat karne ke liye smartphone aur internet hai?")',
      suggestedAnswers: [
        "Yes, have smartphone with internet connection",
        "Need help registering on esanjeevani.in",
        "Want free OPD specialist video call",
        "Prefer physical clinic if connection fails",
      ],
    };
  }

  // 6. Direct Pharmacy / Medicine Refill Intent
  if (
    /\b(pharmacy|chemist|dawai store|medicine refill|prescribe refill|dawai leni hai|dispensary store|dawai chahiye|medicine chahiye)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "Nearest Pharmacy",
      reason:
        "Caller requested medicine dispensing / refill; guide to nearest empanelled chemist or dispensary pharmacy.",
      suspectedConditionSuffix: "Pharmacy Prescription Refill",
      suggestedQuestion:
        'Ask the IP: "Do you have an ESIC doctor prescription or Pehchan card for getting medicines?" (Hinglish: "Kya aapke paas dawai lene ke liye doctor ka parcha ya Pehchan card hai?")',
      suggestedAnswers: [
        "Yes, have valid doctor prescription",
        "Need regular BP / Diabetes monthly medicines",
        "Need OTC cold / fever medicines",
        "Dispensary pharmacy timing inquiry",
      ],
    };
  }

  // 7. Direct Mental Health / Counselling / Tele-MANAS Intent
  if (
    /\b(tele manas|tele-manas|14416|counsellor|psychiatrist|counseling|counselling|dimag ke doctor|mental doctor|depression doctor|manorog)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "Psychological Counselling Department",
      reason:
        "Caller explicitly requested psychological counselling / emotional support; forward to Psychological Counselling Department (Tele-MANAS 14416).",
      suspectedConditionSuffix: "Psychological Counselling Support",
      suggestedQuestion:
        'Ask the IP: "We are connecting you with our compassionate mental health counselling team. Are you in a comfortable place to speak freely?" (Hinglish: "Hum aapko counselling team se connect kar rahe hain. Kya aap bina kisi jhijhak ke akele me baat karne ke liye safe jagah par hain?")',
      suggestedAnswers: [
        "Yes, please connect to counsellor now",
        "Experiencing extreme stress and anxiety",
        "Feeling deeply depressed and hopeless",
        "Need confidential counselling",
      ],
    };
  }

  // 8. Direct Medical Officer Escalation
  if (
    /\b(forward to doctor|talk to doctor|medical officer|on-duty doctor|senior doctor|physician talk)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "Forward to Doctor",
      reason:
        "Forward call directly to on-duty ESIC Medical Officer workstation.",
      suspectedConditionSuffix: "Medical Officer Escalation",
      suggestedQuestion:
        'Ask the IP: "Connecting your call to our on-duty Medical Officer. Please stay on the line." (Hinglish: "Aapka call on-duty Medical Officer ko transfer kiya ja raha hai, kripya line par bane rahein.")',
      suggestedAnswers: [
        "Urgent doctor review needed",
        "Need physician opinion on lab reports",
        "Unresponsive to primary treatment",
        "Direct clinical discussion",
      ],
    };
  }

  // 9. Direct NACO 1097 / HIV / AIDS / Sexual Disease Intent
  if (
    /\b(naco|1097|hiv|aids|gupt rog|sexual health|sexually transmitted|std\b|sti\b|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "NACO 1097 Helpline",
      reason:
        "Caller inquiring about HIV/AIDS, STI, or sexual health; transfer call to National AIDS Helpline (Toll-Free 1097) for 24x7 confidential counselling and testing guidance.",
      suspectedConditionSuffix: "HIV / AIDS & Sexual Health Guidance",
      suggestedQuestion:
        'Ask the IP: "Your consultation is completely confidential. Are you seeking free HIV/STI testing information, counseling, or emergency PEP guidance?" (Hinglish: "Aapki baatcheet bilkul confidential hai. Kya aap free HIV/STI test, counselling ya emergency PEP guidance chahte hain?")',
      suggestedAnswers: [
        "Need confidential HIV counseling & testing center info",
        "Recent possible exposure — need emergency PEP guidance (< 72 hrs)",
        "Experiencing symptoms of sexually transmitted infection",
        "Need routine information on NACO toll-free 1097 services",
      ],
    };
  }

  return null;
}

/**
 * Execute EKMS AI Triage Consultation turn across AI providers (Groq -> Fallback)
 */
export async function processDoctorConsultationTurn({
  message,
  history = [],
  currentClinicalState = {},
}) {
  const cleanInput = (message || "").trim();

  // Instant Non-Medical Topic Guard: Firmly redirect back to healthcare/triage without engaging
  if (isNonMedicalQuery(cleanInput)) {
    return {
      probingQuestion:
        'Ask the IP: "This helpline is exclusively dedicated to healthcare, medical triage, and ESIC clinical assistance. Please state what health symptoms or medical concerns you are facing." (Hinglish: "Yeh helpline keval swasthya aur medical triage ke liye hai. Kripya apni bimari ya lakshan batayein.")',
      suggestedAnswers: [
        "Physical symptoms or pain",
        "Need ESIC Doctor / Dispensary visit",
        "Emotional distress / Counselling",
        "Emergency ambulance assistance",
      ],
      suspectedCondition: "Non-Health Query (Redirected to Medical)",
      differentialDiagnosis: [],
      severity: "Moderate",
      severityScore: 3,
      redFlagsDetected: [],
      referralDestination: "ESIS Dispensary",
      referralReason: "Non-medical query received. Guided caller to restrict inquiry to health and clinical triage matters only.",
      isPsychiatric: false,
      isReadyForSummary: false,
      clinicalSummary: "Caller asked an off-topic non-medical question; agent instructed to redirect to healthcare issues.",
    };
  }

  // Extract all questions already asked in this session to enforce anti-repetition
  const askedQuestionsList = history
    .filter((m) => m.sender === "bot" || m.sender === "assistant" || m.role === "assistant" || m.role === "bot")
    .map((m) => (m.text || m.content || "").replace(/^Ask the IP:\s*["']?/i, "").replace(/["']?\s*$/i, "").trim())
    .filter((q) => q.length > 5);

  const userTurnsCount = history.filter((m) => m.sender === "user" || m.role === "user").length + 1;

  // =========================================================================
  // MULTI-PROVIDER AI CASCADE ARCHITECTURE
  // Priority: 1. Groq Multi-Key Pool (qwen/qwen3.8-27b, 30+ Keys failover, instant ~400ms)
  //           2. Google Gemini Flash (gemini-2.0-flash / gemini-1.5-flash)
  //           3. OpenAI (gpt-4o-mini / gpt-4o)
  //           4. Anthropic Claude (via Dhwani ESIC Proxy / Direct)
  //           5. Local Deterministic Clinical Engine
  // =========================================================================

  // --- Priority 1: Groq Cloud AI API with Multi-Key Pool (Ultra-fast, high clinical accuracy) ---
  try {
    const conversationMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-3).map((m) => ({
        role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : m.text || "",
      })),
      {
        role: "user",
        content: `Caller: "${cleanInput}".
Clinical Context: Condition: "${currentClinicalState.suspectedCondition || "Not yet determined"}", RedFlags: ${JSON.stringify(currentClinicalState.redFlagsDetected || [])}, Turn: ${userTurnsCount}.
Already asked: ${JSON.stringify(askedQuestionsList)}.

Respond strictly in valid JSON format:
{ "probingQuestion": "Ask the IP: ... (Hinglish: ...)", "suggestedAnswers": [...], "suspectedCondition": "...", "isPsychiatric": false, "severity": "High/Moderate/Mild", "referralDestination": "..." or null, "referralReason": "..." or null, "redFlagsDetected": [], "duration": "...", "isReadyForSummary": false, "clinicalSummary": "..." }`,
      },
    ];

    const groqResult = await groqChatCompletion({
      messages: conversationMessages,
      candidateModels: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 384,
      timeoutMs: 6500,
    });

    if (groqResult?.content) {
      const parsed = JSON.parse(groqResult.content);
      if (parsed && (parsed.probingQuestion || parsed.clinicalSummary)) {
        return normalizeDoctorOutput(parsed, cleanInput, currentClinicalState, askedQuestionsList, history);
      }
    }
  } catch (groqErr) {
    console.warn("[AI Cascade] Groq multi-key pool fallback:", groqErr.message);
  }

  // --- Priority 2: Google Gemini AI API ---
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    for (const model of geminiModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const conversationText = history
          .slice(-3)
          .map((m) => `${m.sender === "user" || m.role === "user" ? "Caller" : "Doctor"}: ${m.text || m.content || ""}`)
          .join("\n");

        const promptText = `${SYSTEM_PROMPT}

CONVERSATION HISTORY (Last 3 Turns):
${conversationText}

CURRENT CALLER INPUT: "${cleanInput}"
CLINICAL CONTEXT: Suspected: "${currentClinicalState.suspectedCondition || "Not yet determined"}", RedFlags: ${JSON.stringify(currentClinicalState.redFlagsDetected || [])}, Turn: ${userTurnsCount}
ALREADY ASKED QUESTIONS: ${JSON.stringify(askedQuestionsList)}

Strictly return a JSON object with:
{
  "probingQuestion": "Ask the IP: ... (Hinglish: ...)",
  "suggestedAnswers": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "suspectedCondition": "Primary suspected condition",
  "isPsychiatric": false,
  "severity": "High" | "Moderate" | "Mild",
  "referralDestination": "..." | null,
  "referralReason": "..." | null,
  "redFlagsDetected": [],
  "duration": "...",
  "isReadyForSummary": false,
  "clinicalSummary": "..."
}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 384 },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed && (parsed.probingQuestion || parsed.clinicalSummary)) {
              return normalizeDoctorOutput(parsed, cleanInput, currentClinicalState, askedQuestionsList, history);
            }
          }
        } else {
          console.warn(`[AI Cascade] Gemini (${model}) status ${res.status}`);
          if (res.status === 429) break;
        }
      } catch (err) {
        console.warn(`[AI Cascade] Gemini (${model}) error:`, err.message);
      }
    }
  }

  // --- Priority 3: OpenAI API (gpt-4o-mini / gpt-4o) ---
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    const openAiModels = ["gpt-4o-mini", "gpt-4o"];
    for (const model of openAiModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const conversationMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-3).map((m) => ({
            role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
            content: typeof m.content === "string" ? m.content : m.text || "",
          })),
          {
            role: "user",
            content: `Caller: "${cleanInput}".
Clinical Context: Condition: "${currentClinicalState.suspectedCondition || "Not yet determined"}", RedFlags: ${JSON.stringify(currentClinicalState.redFlagsDetected || [])}, Turn: ${userTurnsCount}.
Already asked: ${JSON.stringify(askedQuestionsList)}.

Respond strictly in valid JSON format:
{ "probingQuestion": "Ask the IP: ... (Hinglish: ...)", "suggestedAnswers": [...], "suspectedCondition": "...", "isPsychiatric": false, "severity": "High/Moderate/Mild", "referralDestination": "..." or null, "referralReason": "..." or null, "redFlagsDetected": [], "duration": "...", "isReadyForSummary": false, "clinicalSummary": "..." }`,
          },
        ];

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: conversationMessages,
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 384,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed && (parsed.probingQuestion || parsed.clinicalSummary)) {
              return normalizeDoctorOutput(parsed, cleanInput, currentClinicalState, askedQuestionsList, history);
            }
          }
        } else {
          console.warn(`[AI Cascade] OpenAI (${model}) limit/status ${res.status}, auto-shifting to Anthropic...`);
          if (res.status === 429) break;
        }
      } catch (err) {
        console.warn(`[AI Cascade] OpenAI (${model}) error:`, err.message);
      }
    }
  }

  // --- Priority 4: Anthropic Claude via Dhwani ESIC Proxy ---
  // Using user key: X-API-Key: sk_live_vJjfGTfyHd4u5v-5Et49KQTfzSRzD8gk
  const dhwaniApiKey =
    process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || "sk_live_vJjfGTfyHd4u5v-5Et49KQTfzSRzD8gk";
  if (dhwaniApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const conversationContext = history
        .slice(-6)
        .map((m) => `${m.sender === "user" || m.role === "user" ? "Caller" : "Doctor"}: ${m.text || m.content || ""}`)
        .join("\n");
      const fullNotes = conversationContext ? `${cleanInput}\n[Context]: ${conversationContext}` : cleanInput;

      const res = await fetch("https://esicdemotriage.dhwaniris.in/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": dhwaniApiKey,
        },
        body: JSON.stringify({
          symptom_notes: fullNotes,
          age: currentClinicalState.age ? Number(currentClinicalState.age) : null,
          sex: currentClinicalState.sex || null,
          severity_reported: currentClinicalState.severityScore || 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const tr = data.triage || {};
        const questions = tr.followup_questions || [];
        const unaskedQ =
          questions.find((q) => !askedQuestionsList.some((asked) => asked.includes(q.slice(0, 20)))) || questions[0];

        if (unaskedQ) {
          let cleanQ = unaskedQ;
          if (!cleanQ.startsWith("Ask the IP:")) {
            cleanQ = `Ask the IP: "${cleanQ.replace(/^["']|["']$/g, "")}"`;
          }
          cleanQ = enforceSingleQuestion(cleanQ);
          cleanQ = sanitizeClinicalQuestion(cleanQ, fullNotes, cleanInput);
          cleanQ = enforceSingleQuestion(cleanQ);

          // Add empathetic Hinglish translation if Dhwani returns only English
          if (!/\((?:Hinglish|Hindi|हिन्दी):/i.test(cleanQ)) {
            if (/\bwhat symptoms are present\b/i.test(cleanQ)) {
              cleanQ = cleanQ.replace(/["']?\s*$/, ' (Hinglish: "Aapko abhi is samay kya-kya lakshan ya takleef mehsoos ho rahi hai?")"');
            } else if (/\bhow long ago did the bite happen\b/i.test(cleanQ)) {
              cleanQ = cleanQ.replace(/["']?\s*$/, ' (Hinglish: "Saanp ne kitni der pehle kaata tha?")"');
            } else if (/\bwhere.*bite occur\b/i.test(cleanQ)) {
              cleanQ = cleanQ.replace(/["']?\s*$/, ' (Hinglish: "Saanp ne sharir ke kis hisse par kaata hai?")"');
            } else if (/\bdescribe the snake\b/i.test(cleanQ)) {
              cleanQ = cleanQ.replace(/["']?\s*$/, ' (Hinglish: "Kya aapne saanp ko dekha tha, uska rang ya aakaar kaisa tha?")"');
            }
          }

          let conditionLabel = "Clinical Triage Evaluation";
          if (/\b(snake|saap|saanp|bite|envenomation)\b/i.test(fullNotes)) {
            conditionLabel = "Snake Bite (Type undetermined) / Local Tissue Reaction";
          } else if (/\b(fall|fell|falling|gira|giri|bed)\b/i.test(fullNotes)) {
            conditionLabel = "Traumatic Fall / Impact Injury Assessment";
          } else if (/\b(chest pain|chhati|heart)\b/i.test(fullNotes)) {
            conditionLabel = "Suspected Acute Coronary Syndrome";
          } else if (tr.summary_en) {
            const cleaned = tr.summary_en.replace(/^caller reports (?:an? )?/i, "").replace(/[.;].*$/, "");
            conditionLabel = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          }

          const contextualAns = generateContextualAnswers(cleanQ, cleanInput, Boolean(tr.is_psychiatric), fullNotes);

          const anthropicParsed = {
            probingQuestion: cleanQ,
            suggestedAnswers: contextualAns,
            suspectedCondition: conditionLabel,
            severity: tr.urgency_level === "Emergency" ? "High" : tr.urgency_level === "Urgent" ? "Moderate" : "Mild",
            severityScore: tr.urgency_score || (tr.urgency_level === "Emergency" ? 9 : 5),
            referralDestination: tr.recommended_facility_type || "ESIS Dispensary",
            referralReason: tr.reasoning || tr.recommended_action || null,
            redFlagsDetected: tr.red_flags || [],
            isPsychiatric: Boolean(tr.is_psychiatric),
            clinicalSummary: tr.reasoning || tr.summary_en || "",
            isReadyForSummary: userTurnsCount >= 3,
          };
          return normalizeDoctorOutput(anthropicParsed, cleanInput, currentClinicalState, askedQuestionsList, history);
        }
      } else {
        console.warn(`[AI Cascade] Dhwani Anthropic HTTP ${res.status}, auto-shifting to Local Dynamic Engine...`);
      }
    } catch (err) {
      console.warn("[AI Cascade] Dhwani Anthropic error:", err.message);
    }
  }

  // --- Priority 5: Local Dynamic Clinical Engine (<1ms, Guaranteed 100% Non-Repeating) ---
  return buildLocalDoctorConsultationFallback(cleanInput, history, currentClinicalState);
}

/**
 * Generates highly realistic, question-relevant answer chips if LLM returns empty or off-topic options
 */
export function generateContextualAnswers(questionText, userInput = "", isPsych = false, fullContextText = "") {
  const q = (questionText || "").toLowerCase();
  const u = (userInput || "").toLowerCase();
  const ctx = (fullContextText || "").toLowerCase();
  const qu = `${q} ${u} ${ctx}`;

  // 1. Age Inquiry (for third-party inquiries about relatives/patients)
  if (/\b(how old|what is (?:his|her|the|their|your) age|age of|patient'?s? age|father'?s? age|mother'?s? age|child'?s? age|kitni umar)\b/i.test(q)) {
    return [
      "Over 65 years (Elderly)",
      "40 to 60 years (Adult)",
      "18 to 40 years (Young adult)",
      "Under 18 years (Child / Minor)",
    ];
  }

  // 2. Casualties / Disaster / Workplace Mass Accident (STRICT: Never match "how many" alone!)
  if (
    /\b(how many\s+(?:people|persons?|casualties|workers?|victims?)|kitne log ghayal|kitne log hain|how many.*(?:injured|casualties|victims|trapped))\b/i.test(q) ||
    (/\b(casualties|disaster|accident|explosion|collapse)\b/i.test(q) && /\b(injured|casualties|trapped|victim)\b/i.test(q))
  ) {
    return [
      "1 person injured — conscious with severe pain",
      "2 or more casualties — multiple people hurt",
      "Victim is unconscious / not responding",
      "Person trapped in vehicle / machinery",
    ];
  }

  // 3. Fever & Body Pain Duration (Directly answers "how many days has this fever and body pain been continuing?")
  if (
    /\b(how long|how many days|since when|when did|duration|kab se|kitne din|kitna samay)\b/i.test(q) &&
    /\b(fever|bukhar|temperature|body pain|badan dard|pain|dard|ache)\b/i.test(qu)
  ) {
    return [
      "Started earlier today (< 24 hours)",
      "Since yesterday (1 to 2 days)",
      "For 3 to 5 days",
      "More than a week (Persistent fever)",
    ];
  }

  // 4. Fever Severity / High Temperature / Thermometer / Chills / Shivering
  if (/\b(how high|temperature|thermometer|degree|chills|shivering|sweating|kitna bukhar|kapkapi|thand)\b/i.test(q)) {
    return [
      "High fever over 102°F with severe shivering/chills",
      "Moderate fever (100°F - 101°F) with body ache",
      "Haven't measured with thermometer, but body feels very hot",
      "Fever comes and goes with heavy sweating",
    ];
  }

  // 5. Fever Associated Red Flags (Breathing, Rash, Stiff Neck, Confusion, Vomiting)
  if (
    /\b(fever|bukhar)\b/i.test(qu) &&
    /\b(rash|spots|breathing|breathless|stiff neck|confusion|vomiting|dane|saans)\b/i.test(q)
  ) {
    return [
      "Yes, feeling breathless / chest tightness",
      "Yes, vomiting and severe body weakness",
      "Notice red spots / skin rash",
      "No rash or breathing trouble, only fever and body ache",
    ];
  }

  // 6. Fall / Bed Fall / Impact Injury / Head Strike
  if (
    /\b(fall|fell|falling|gira|giri|bed|slip|tripped|hit your head|injure.*body|when you fell|unable to get up|floor)\b/i.test(q) ||
    /\b(fall|fell|falling|gira|giri|bed)\b/i.test(u)
  ) {
    if (/\b(head|vomit|vision|sar par|sir par)\b/i.test(q)) {
      return [
        "Hit my head, feeling dizzy or dazed",
        "Feeling nauseous / vomited once",
        "Severe headache and blurred vision",
        "No head injury, head is completely fine",
      ];
    }
    if (/\b(stand|walk|limb|weight|khade|pair)\b/i.test(q)) {
      return [
        "Cannot bear any weight on leg / hip",
        "Suspected fracture / limb swollen",
        "Able to stand up with support",
        "Can walk slowly with mild pain",
      ];
    }
    return [
      "Hit my head, feeling dizzy or dazed",
      "Severe pain in arm / leg / back",
      "Unable to get up from the floor",
      "Bruised and sore, but can move limbs",
    ];
  }

  // 7. General Duration for any symptom (When did it start / How long)
  if (/\b(when did|how long|how many (?:hours|days|weeks|months)|duration|since when|kab se|kitne din|kitna samay)\b/i.test(q)) {
    return [
      "Started earlier today (< 24 hours)",
      "1 to 3 days (Recent)",
      "About 1 to 2 weeks",
      "Chronic problem (More than a month)",
    ];
  }

  // 8. Snake Bite / Animal Bite Location
  if (/\b(where.*bite|bite.*located|where on your body|body part|kahan par kaata|shareer ke kis hisse|bite happen)\b/i.test(q)) {
    return [
      "Bite is on foot / ankle",
      "Bite is on lower leg",
      "Bite is on hand / fingers",
      "Bite is on arm / wrist",
    ];
  }

  // 9. Snake Bite / Envenomation Symptoms (swelling, numbness, breathing, present symptoms)
  if (
    (/\b(snake|saap|saanp|bite|envenomation)\b/i.test(qu)) &&
    (/\b(swelling|numbness|swollen|sujan|sunnta|symptoms|lakshan|present right now|experiencing|what symptoms)\b/i.test(q) ||
     /\bwhat symptoms are present\b/i.test(q))
  ) {
    return [
      "Rapid swelling & intense burning pain around bite",
      "Numbness, tingling, or weakness spreading in leg",
      "Difficulty breathing, dizziness, or blurred vision",
      "No severe symptoms, only local puncture pain",
    ];
  }

  // 10. Snake appearance / identification
  if (/\b(see the snake|what did the snake look like|color of the snake|saamp kaisa tha)\b/i.test(q)) {
    return [
      "Could not see the snake clearly",
      "Saw a dark brown / black snake",
      "Saw a green / striped snake",
      "Snake had a hood / raised head",
    ];
  }

  // 11. Loss of consciousness / Blackout / Syncope
  if (/\b(lose consciousness|loss of consciousness|blacked out|black out|passed out|pass out|behosh|hosh khona)\b/i.test(q)) {
    return [
      "Yes, blacked out for a few moments",
      "No loss of consciousness, remained awake",
      "Felt very dazed and disoriented",
      "Do not remember right after the event",
    ];
  }

  // 12. Dizziness / Faintness / Lightheadedness
  if (/\b(dizzy|faint|lightheaded|chakkar|unsteady|room spinning)\b/i.test(q)) {
    return [
      "Yes, feeling very dizzy and faint",
      "A little faint, but conscious and alert",
      "No dizziness, feeling relatively stable",
      "Vision is getting blurry / feeling cold",
    ];
  }

  // 13. Bleeding / Pressure on wound / First aid / Blood
  if (/\b(bleed|wound|pressure|cloth|wrist|laceration|cut|bandage|dabav|khoon)\b/i.test(q)) {
    return [
      "Holding firm pressure with clean cloth",
      "Heavy bleeding soaking through cloth",
      "Bleeding is beginning to slow down",
      "Hands are shaking / hard to press",
    ];
  }

  // 14. Alone / Anyone with them / Companion
  if (/\b(alone|anyone with you|family|koi hai|saath|parivaar|friend)\b/i.test(q)) {
    return [
      "I am completely alone right now",
      "A family member is with me",
      "Neighbor / colleague is nearby",
      "Someone is arriving soon",
    ];
  }

  // 15. Paramedics / Ambulance / Location
  if (/\b(ambulance|paramedics|address|location|landmark|reach directly|pahunch sakti)\b/i.test(q)) {
    return [
      "Ambulance can reach directly on main road",
      "Waiting at the entrance gate to guide them",
      "Arranging local vehicle to hospital",
      "Need ambulance dispatch right now",
    ];
  }

  // 16. Chest pressure / Cardiac ischemia
  if (/\b(crushing|heavy pressure|radiat|chhati|heart|seene me dard)\b/i.test(q)) {
    return [
      "Heavy crushing pressure radiating to left arm",
      "Sharp stinging chest pain when breathing in",
      "Burning sensation / acidity feeling",
      "Dull tightness across center of chest",
    ];
  }

  // 17. Respiratory / Breathlessness / Cough
  if (/\b(breath|breathing|saans|wheez|dyspnea)\b/i.test(q)) {
    return [
      "Severe breathlessness even while resting",
      "Breathlessness when speaking or walking",
      "Wheezing sound with tight chest feeling",
      "Breathing is stable / manageable",
    ];
  }

  if (/\b(cough|cold|phlegm|sputum|throat|khansi|balgam|gale me)\b/i.test(q)) {
    return [
      "Dry persistent cough with sore throat",
      "Cough with thick yellow / green phlegm",
      "Cough causes chest tightness / breathlessness",
      "No cough, only fever and body ache",
    ];
  }

  // 18. Stress / Psychological triggers
  if (/\b(stress|causing you the most|worry|trouble|family|work pressure|tanaav)\b/i.test(q)) {
    return [
      "Heavy work pressure & workplace stress",
      "Family dispute / Relationship difficulties",
      "Financial burden & debt worries",
      "Chronic illness / Physical health distress",
    ];
  }

  // 19. Self-harm / Thoughts of giving up
  if (/\b(harm|giving up|give up|jan dene|thoughts of|nuksaan|suicid)\b/i.test(q)) {
    return [
      "Yes, having thoughts of self-harm",
      "No thoughts of self-harm, just deeply exhausted",
      "Feeling severe anxiety and panic attacks",
      "Need to talk to a counselor right now",
    ];
  }

  // 20. Safe place / Counselling connection
  if (/\b(safe place|surakshit|tele-manas|counsel|transfer)\b/i.test(q)) {
    return [
      "Yes, please connect me to the counsellor right now",
      "I am at home alone, please connect urgently",
      "Family member is with me, please guide transfer",
      "Will stay on the line for counselling team",
    ];
  }

  // 21. Medication / Treatment taken
  if (/\b(medicine|medication|dawa|tablet|paracetamol|painkiller|treatment|doctor ko dikhaya|taken anything)\b/i.test(q)) {
    return [
      "Took Paracetamol, but fever came back",
      "Took painkiller, only gave temporary relief",
      "Haven't taken any medicines yet",
      "Visited local clinic / chemist earlier today",
    ];
  }

  // 22. Pre-existing medical conditions
  if (/\b(pre-existing|history of|diabetes|bp|hypertension|blood pressure|asthma|heart disease|bimari)\b/i.test(q)) {
    return [
      "Yes, have diabetes / high blood pressure",
      "Yes, history of asthma / heart disease",
      "No prior health conditions",
      "Not sure / haven't had recent checkup",
    ];
  }

  // 23. Vomiting / diarrhea / loose stools
  if (/\b(vomit\w*|ulti\w*|diarrhea\w*|loose motion\w*|stool\w*|dast|nausea\w*)\b/i.test(q)) {
    if (/\b(how many times|how many|frequency|kitni bar|times today)\b/i.test(q)) {
      return [
        "Vomited 1 to 2 times, able to sip water",
        "Frequent vomiting (3 to 5 times) with weakness",
        "Severe continuous vomiting (> 5 times), cannot retain fluids",
        "Feeling nauseous, but haven't vomited yet",
      ];
    }
    return [
      "Frequent vomiting (> 5 times), cannot keep fluids down",
      "Watery loose motions 3 to 4 times with weakness",
      "Mild nausea with stomach upset after food",
      "Vomited once or twice, able to drink water",
    ];
  }

  // 24. Headache
  if (/\b(headache|sar dard|sir dard|migraine)\b/i.test(q)) {
    return [
      "Sudden explosive severe headache unlike any before",
      "One-sided throbbing headache with nausea",
      "Dull band-like pressure across forehead",
      "Mild headache relieved by resting",
    ];
  }

  // 25. Anatomical Location of Pain / Symptoms (Body, Leg, Knee, Calf, Ankle, Back, Abdomen, Chest, Arm, Head)
  if (
    /\b(where.*(?:pain|hurt|dard)|location.*(?:pain|dard)|which part|kis hisse|kahan.*dard|pair me kahan|kahan dard)\b/i.test(q) ||
    (/\b(where|kahan|location)\b/i.test(q) && /\b(pain|dard|hurt|ache)\b/i.test(qu)) ||
    /\b(thigh|knee|calf|ankle|shin|foot)\b/i.test(q)
  ) {
    if (/\b(body|badan|whole body|all over|joints)\b/i.test(qu)) {
      return [
        "Severe aching all over my body & joints",
        "Pain mostly in legs, knees, and lower back",
        "Severe neck and shoulder muscle stiffness",
        "Dull continuous body ache with fatigue",
      ];
    }
    if (/\b(leg|thigh|knee|calf|ankle|shin|foot|pair|ghutna)\b/i.test(qu)) {
      return [
        "In my knee joint",
        "In my calf muscle",
        "In my thigh / upper leg",
        "In my ankle or foot",
      ];
    }
    if (/\b(back|spine|kamar|peeth|lumbar)\b/i.test(qu)) {
      return [
        "Lower back (lumbar area)",
        "Upper / mid back between shoulder blades",
        "Lower back shooting down the leg",
        "Neck / cervical spine area",
      ];
    }
    if (/\b(abdomen|stomach|belly|pet)\b/i.test(qu)) {
      return [
        "Lower right abdomen",
        "Upper central stomach (acidity/burning)",
        "Around navel / entire belly",
        "Flank / sides radiating to back",
      ];
    }
    if (/\b(arm|shoulder|elbow|wrist|hand|haath|kandha)\b/i.test(qu)) {
      return [
        "Shoulder / upper arm",
        "Elbow joint",
        "Forearm or wrist",
        "Fingers / hand",
      ];
    }
    if (/\b(head|face|sir|sar|aankh)\b/i.test(qu)) {
      return [
        "Forehead / temples (throbbing)",
        "Back of head / neck",
        "One side of head only",
        "Behind the eyes",
      ];
    }
    return [
      "Severe aching all over my body & joints",
      "Pain mostly in legs, knees, and lower back",
      "Severe neck and shoulder muscle stiffness",
      "Dull continuous body ache with fatigue",
    ];
  }

  // 26. Mobility / Ability to Walk or Stand
  if (/\b(stand|walk|get up|weight|bear weight|khade|chal pa|pair par khade|utha nahi ja raha)\b/i.test(q)) {
    return [
      "Unable to bear weight or stand on leg",
      "Can stand and walk with support",
      "Completely bedridden due to pain and weakness",
      "Can walk slowly with mild pain",
    ];
  }

  // 27. Pain severity & character
  if (/\b(pain|dard|severe|sharp|ache|burning|throbbing|intensity)\b/i.test(q)) {
    return [
      "Severe sharp unbearable pain (8-10/10)",
      "Moderate throbbing ache (5-7/10)",
      "Mild discomfort (2-4/10)",
      "Pain is radiating to other areas",
    ];
  }

  // 28. Question-intent based fallback (Yes/No screening)
  if (/\b(did you|do you|are you|have you|is there|was there|kya aap|kya)\b/i.test(q)) {
    return [
      "Yes, definitely experiencing this",
      "Mild discomfort, but manageable",
      "No, not experiencing this at all",
      "It comes and goes intermittently",
    ];
  }

  // 29. Final clinical condition-aware fallback
  if (/\b(snake|saap|saanp|bite|envenomation)\b/i.test(qu)) {
    return [
      "Rapid swelling & intense burning pain around bite",
      "Numbness, tingling, or weakness spreading in leg",
      "Difficulty breathing, dizziness, or blurred vision",
      "No severe symptoms, only local puncture pain",
    ];
  }

  if (/\b(fall|fell|falling|injury|chot|fracture|wound)\b/i.test(qu)) {
    return [
      "Severe pain and swelling in injured area",
      "Unable to bear weight or move limb",
      "Mild bruise, able to walk slowly",
      "Dizziness or nausea after injury",
    ];
  }

  if (/\b(chest|chhati|heart)\b/i.test(qu)) {
    return [
      "Heavy pressure radiating to arm or jaw",
      "Shortness of breath and sweating",
      "Sharp pain while taking deep breath",
      "Mild discomfort, comes and goes",
    ];
  }

  if (/\b(fever|bukhar|body pain|badan)\b/i.test(qu)) {
    return [
      "Started earlier today (< 24 hours)",
      "Since yesterday (1 to 2 days)",
      "For 3 to 5 days",
      "More than a week (Persistent fever)",
    ];
  }

  return [
    "Yes, experiencing this right now",
    "No, that symptom is not present",
    "Symptoms started earlier today",
    "Needs urgent doctor checkup",
  ];
}

/**
 * Ensures exactly ONE clinical question is asked per turn.
 * Strips compound trailing questions joined by "and are you", "and do you", "— and did it", etc.
 */
export function enforceSingleQuestion(questionText) {
  if (!questionText || typeof questionText !== "string") return questionText;

  const hindiMatch = questionText.match(/\((?:Hindi|Hinglish|हिन्दी):\s*['"]?([\s\S]*?)['"]?\s*\)/i);
  let englishPart = questionText.replace(/\((?:Hindi|Hinglish|हिन्दी):[\s\S]*?\)/i, "").trim();

  // Strip trailing quote/paren remnants
  englishPart = englishPart.replace(/["')\]\s]+$/, "");

  // Remove duplicate question mark artifacts like .? or ?."
  englishPart = englishPart.replace(/\.\?+/g, ".").replace(/\?+/g, "?");

  // Check if there are multiple full questions (separated by ?):
  // e.g. "I'm sorry you are in pain. Where is it hurting? And did you fall?"
  // We keep the empathy sentence + the FIRST question!
  const qMarkIndex = englishPart.indexOf("?");
  if (qMarkIndex !== -1 && qMarkIndex < englishPart.length - 1) {
    const afterQ = englishPart.slice(qMarkIndex + 1).trim();
    if (/\b(?:and|or|also|is|are|do|did|can|could|how|what|where|have|has)\b/i.test(afterQ)) {
      englishPart = englishPart.slice(0, qMarkIndex + 1);
    }
  }

  // Strip compound trailing questions joined by em-dash or comma followed by "and did it / and are you / and is there"
  // ONLY when preceded by an interrogative question!
  englishPart = englishPart
    .replace(/(?<=\b(?:where|which|when|how|is|are|do|does|did|have|has|can|could)\b[\s\S]+?)(?:[,\s]*[—–-][\s—–-]*|[,\s]+and\s+)(?:did\s+it|is\s+it|is\s+there|are\s+you|do\s+you|can\s+you|could\s+you|have\s+you|was\s+there|how\s+long)\b[\s\S]*?\??$/i, "")
    .trim();

  // Clean trailing punctuation and ensure proper single question mark closing
  englishPart = englishPart.replace(/[,;:\s—–-]+$/, "");
  if (!englishPart.endsWith("?")) {
    if (englishPart.endsWith(".")) {
      if (/\b(can|could|would|please tell|what|where|when|which|how|are|is|do|does|did|have|has)\b/i.test(englishPart)) {
        englishPart = englishPart.slice(0, -1).trim() + "?";
      } else {
        // If it's an empathy statement alone without a question, e.g. "I'm sorry you're feeling unwell."
        // We must append a supportive clinical question:
        englishPart = englishPart + " Could you tell me what symptoms are bothering you the most right now?";
      }
    } else {
      englishPart = englishPart + "?";
    }
  }

  // Format quotes cleanly with balanced double quotes
  const coreQuestion = englishPart.replace(/^Ask the IP:\s*["']?/i, "").replace(/["']?\s*$/i, "").trim();
  englishPart = `Ask the IP: "${coreQuestion}"`;

  if (hindiMatch) {
    let hinglishPart = hindiMatch[1]
      .replace(/["')\]\s]+$/, "")
      .replace(/\.\?+/g, ".")
      .trim();
    hinglishPart = hinglishPart.replace(/^['"]|['"]$/g, "").replace(/[,;:\s—–-]+$/, "").trim();
    if (!hinglishPart.endsWith("?") && !hinglishPart.endsWith("।")) {
      hinglishPart += "?";
    }
    return `${englishPart} (Hinglish: "${hinglishPart}")`;
  }

  return englishPart;
}

/**
 * Detects if the caller is confirmed to be calling on behalf of someone else (third party).
 * Default assumption: The caller is the Insured Person (IP / patient) themselves.
 */
export function isThirdPartyCaller(contextText = "") {
  return /\b(my mother|my father|my child|my baby|my son|my daughter|my wife|my husband|my brother|my sister|my friend|my colleague|a worker|someone else|patient is|mummy|papa|beta|beti|bhai|behan|patni|pati|relative|neighbour|bystander)\b/i.test(contextText);
}

/**
 * Ensures questions NEVER ask adult callers if they are conscious (since they are calling on the phone).
 * Also replaces third-person questions ("How old is the person who fell") with direct questions to the IP.
 */
export function sanitizeClinicalQuestion(questionText, allContext = "", cleanInput = "") {
  if (!questionText || typeof questionText !== "string") return questionText;

  const isThirdParty = isThirdPartyCaller(`${allContext} ${cleanInput}`);

  // If the caller is the patient themselves, forbid asking "are you conscious", "is the person conscious", etc.
  const isAskingConscious = /\b(are (?:you|they) conscious|is (?:he|she|the person|the patient) conscious|conscious and (?:responding|able to speak)|hosh me|behosh|responding normally)\b/i.test(questionText);
  const isAskingAge = !isThirdParty && /\b(?:how old|what is your age|caller'?s? age|how old is (?:the caller|the person|the patient|the one who fell))\b/i.test(questionText);

  if ((isAskingConscious && !isThirdParty) || isAskingAge) {
    // If it's a fall / bed fall
    if (/\b(fall|fell|falling|gira|giri|bed|slip|tripped)\b/i.test(`${cleanInput} ${allContext}`)) {
      return 'Ask the IP: "Did you hit your head or injure your back or limbs when you fell?" (Hinglish: "Kya girte waqt sar ya sharir ke kisi hisse me chot aayi?")';
    }
    // If it's bleeding / trauma
    if (/\b(bleed|wound|cut|chot|injury|khoon)\b/i.test(`${cleanInput} ${allContext}`)) {
      return 'Ask the IP: "Is there active continuous bleeding from the wound?" (Hinglish: "Kya chot se lagataar khoon beh raha hai?")';
    }
    // If it's chest pain / cardiac
    if (/\b(chest|chhati|heart|angina)\b/i.test(`${cleanInput} ${allContext}`)) {
      return 'Ask the IP: "Does the chest pain feel like heavy crushing pressure radiating to your arm or jaw?" (Hinglish: "Kya seene me bhaari dabav mehsoos ho raha hai jo baazu ya jabde ki taraf ja raha hai?")';
    }
    // If it's weakness / dizziness
    if (/\b(dizzy|chakkar|kamzori|faint|weakness)\b/i.test(`${cleanInput} ${allContext}`)) {
      return 'Ask the IP: "Are you feeling severe dizziness or unable to stand up right now?" (Hinglish: "Kya aapko bahut zyada chakkar ya kamzori mehsoos ho rahi hai?")';
    }
    // Default sensible question directly to the IP
    return 'Ask the IP: "Could you describe what specific symptoms or pain you are feeling right now?" (Hinglish: "Kya aap bata sakte hain ki abhi aapko kya takleef ya dard mehsoos ho raha hai?")';
  }

  // If not third-party caller, replace third-person references to caller with direct 2nd-person "you" / "your"
  if (!isThirdParty) {
    questionText = questionText
      .replace(/\bdid the (?:caller|person|patient)\b/gi, "did you")
      .replace(/\bdoes the (?:caller|person|patient)\b/gi, "do you")
      .replace(/\bis the (?:caller|person|patient)\b/gi, "are you")
      .replace(/\bhas the (?:caller|person|patient)\b/gi, "have you")
      .replace(/\bcan the (?:caller|person|patient)\b/gi, "can you")
      .replace(/\bwas the (?:caller|person|patient)\b/gi, "were you")
      .replace(/\btheir (head|body|arm|leg|chest|back|mind|vision)\b/gi, "your $1")
      .replace(/\bthe (?:caller's|person's|patient's)\b/gi, "your")
      .replace(/(["']\s*)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  }

  return questionText;
}

/**
 * Normalizes output from LLM provider into guaranteed uniform schema
 * with strict duplicate detection safeguard
 */
function normalizeDoctorOutput(raw, userInput, prevState = {}, askedQuestionsList = [], history = []) {
  const cleanInput = (userInput || "").toLowerCase();
  const prevRef = (prevState.referralDestination || "").toLowerCase();
  const historyText = history
    .map((m) => (typeof m.content === "string" ? m.content : m.text || ""))
    .join(" ")
    .toLowerCase();
  const allContext = `${cleanInput} ${prevRef} ${prevState.suspectedCondition || ""} ${prevState.symptom || ""} ${historyText}`.toLowerCase();

  const userTextHasPsych =
    /\b(suicid\w*|mar ja\w*|jaan de dunga|depress\w*|udaas\b|\brona\b|hopeless\b|anxiety\b|ghabrahat\b|mental health|akelepan\b|\bpareshan\b|\bdie\b|kill myself|crying\b|cried\b|zindagi se thak|lonely\b|niraash\b)\b/i.test(
      cleanInput
    );

  const isNacoHIV =
    /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(cleanInput) ||
    prevRef.includes("naco") ||
    prevRef.includes("1097") ||
    prevRef.includes("hiv");

  const isPsych = !isNacoHIV && Boolean(
    userTextHasPsych ||
      raw.isPsychiatric ||
      prevState.isPsychiatric ||
      /psych|tele-manas|tele manas|14416|mental health/i.test(allContext)
  );

  const isEmergency108 =
    /\b(108|ambulance|heart attack|crushing chest|cardiac arrest|unconscious|behosh|massive bleed|bleeding profusely|road accident|accident casualty|machine accident|worker trapped|trapped|factory machine|accident.*haath|crushed limb|amputation)\b/i.test(cleanInput) ||
    (raw.referralDestination === "108 Ambulance" && (raw.severity === "High" || prevState.severity === "High"));

  const directIntent = detectDirectCallerReferralIntent(cleanInput);

  const isAdviceSeeking =
    /\b(advice|doctor|consult|health advice|medical advice|phone doctor|guidance|information|kya karu|kya karein|salah|mashwara|ghar par kya karein)\b/i.test(cleanInput);

  const is104PhoneDoctor =
    /\b(104|phone consultation|phone doctor|tele consultation|tele-consultation|tele doctor|tele-doctor|call with 104|104 doctor|doctor on call|telephonic doctor|phone pe doctor|phone par doctor|call.*104)\b/i.test(cleanInput) ||
    (isAdviceSeeking && (raw.severity === "Mild" || prevState.severity === "Mild" || (!raw.severity && !prevState.severity))) ||
    (prevRef.includes("104") && !/\b(hospital|aspatal|dispensary|clinic|ambulance|108|pharmacy|chemist)\b/i.test(cleanInput));

  const isESanjeevani =
    /\b(e sanjeevani|esanjeevani|online doctor|video consultation|telemedicine)\b/i.test(cleanInput) ||
    prevRef.includes("sanjeevani");

  const isPharmacy =
    /\b(pharmacy|chemist|dawai store|medicine refill|prescribe refill|dawai leni hai|dispensary store)\b/i.test(cleanInput) ||
    prevRef.includes("pharmacy");

  const isForwardDoctor =
    /\b(forward to doctor|talk to doctor|medical officer|on-duty doctor|physician escalation)\b/i.test(cleanInput) ||
    prevRef.includes("doctor");

  const severity =
    raw.severity === "High" || raw.severity === "Moderate" || raw.severity === "Mild"
      ? raw.severity
      : (prevState.severity || (isPsych ? "High" : is104PhoneDoctor ? "Moderate" : "Moderate"));

  const severityScore = severity === "High" ? 9 : severity === "Moderate" ? 6 : 3;

  let referralDestination;
  let referralReason;

  const dispensaryStatus = getDispensaryOperatingStatus();

  if (directIntent) {
    referralDestination = directIntent.destination;
    referralReason = directIntent.reason;
  } else if (isEmergency108) {
    referralDestination = "108 Ambulance";
    referralReason = "Life-threatening acute emergency or accident casualty; dispatch 108 Ambulance immediately.";
  } else if (isPsych) {
    referralDestination = "Psychological Counselling Department";
    referralReason = "Caller exhibits emotional distress or psychological crisis; forward to Psychological Counselling / Tele-MANAS (14416).";
  } else if (isNacoHIV) {
    referralDestination = "NACO 1097 Helpline";
    referralReason = "Confidential sexual health / HIV-AIDS counseling; transfer to National AIDS Helpline (Toll-Free 1097).";
  } else if (is104PhoneDoctor) {
    referralDestination = "104 Medical Team";
    referralReason = "Caller requested tele-doctor phone consultation; transfer call queue to 104 Medical Team.";
  } else if (isESanjeevani) {
    referralDestination = "e-Sanjeevani";
    referralReason = "Advise caller to use government e-Sanjeevani online doctor tele-consultation portal.";
  } else if (isPharmacy) {
    referralDestination = "Nearest Pharmacy";
    referralReason = "Guide caller to nearest empanelled chemist or dispensary pharmacy for medicines.";
  } else if (isForwardDoctor) {
    referralDestination = "Forward to Doctor";
    referralReason = "Forward call directly to on-duty ESIC Medical Officer workstation.";
  } else if (
    raw.referralDestination &&
    [
      "108 Ambulance",
      "Psychological Counselling Department",
      "NACO 1097 Helpline",
      "104 Medical Team",
      "e-Sanjeevani",
      "Nearest Pharmacy",
      "Forward to Doctor",
      "ESIC Hospital",
      "ESIS Dispensary",
    ].includes(raw.referralDestination)
  ) {
    referralDestination = raw.referralDestination;
    referralReason = raw.referralReason;
  } else if (severity === "High") {
    referralDestination = "ESIC Hospital";
    referralReason = "Severe condition requiring specialist examination and hospital casualty/OPD care today.";
  } else if (!dispensaryStatus.isOpen) {
    const hospitalOpdStatus = getHospitalOpdOperatingStatus();
    if (!hospitalOpdStatus.isOpen) {
      referralDestination = "104 Medical Team";
      referralReason = `ESIS Dispensaries and Hospital regular OPD are currently closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    } else if (severity === "Moderate") {
      referralDestination = "ESIC Hospital";
      referralReason = `ESIS Dispensaries are closed (${dispensaryStatus.reason}). ESIC Hospital OPD is open until 4:00 PM for doctor examination today.`;
    } else {
      referralDestination = "104 Medical Team";
      referralReason = `ESIS Dispensaries are currently closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    }
  } else {
    referralDestination = "ESIS Dispensary";
    referralReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
  }

  // Ensure closed dispensary or closed hospital is never assigned when closed
  if (referralDestination === "ESIS Dispensary" && !dispensaryStatus.isOpen) {
    const hospitalOpdStatus = getHospitalOpdOperatingStatus();
    if (!hospitalOpdStatus.isOpen) {
      referralDestination = "104 Medical Team";
      referralReason = `ESIS Dispensaries and Hospital regular OPD are currently closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    } else if (severity === "Moderate") {
      referralDestination = "ESIC Hospital";
      referralReason = `ESIS Dispensaries are closed (${dispensaryStatus.reason}). Guide caller to nearest ESIC Hospital OPD today.`;
    } else {
      referralDestination = "104 Medical Team";
      referralReason = `ESIS Dispensaries are currently closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    }
  } else if (referralDestination === "ESIC Hospital" && severity !== "High") {
    const hospitalOpdStatus = getHospitalOpdOperatingStatus();
    if (!hospitalOpdStatus.isOpen) {
      // Non-emergency caller outside hospital OPD hours -> route to 104 Medical Team (doctor on call)
      referralDestination = "104 Medical Team";
      referralReason = `Hospital regular OPD is currently closed. Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    }
  }

  const userTurnsCount = history.filter((m) => m.role === "user" || m.sender === "user").length + 1;
  const isEmergency = isEmergency108 || (directIntent && directIntent.destination === "108 Ambulance");
  const isDirect = Boolean(directIntent);

  // In first two probing turns (turns 1 and 2), we do NOT show premature referral recommendation
  // unless there is an immediate 108 life emergency or direct caller request
  const isReferralReady =
    userTurnsCount >= 3 ||
    Boolean(raw.isReadyForSummary) ||
    isEmergency ||
    isDirect;

  if (!isReferralReady) {
    referralDestination = null;
    referralReason = null;
  }

  // Also clean up any placeholder referral phrases that indicate incomplete assessment
  if (referralReason && /need detailed assessment|before deciding/i.test(referralReason)) {
    if (!isReferralReady) {
      referralDestination = null;
      referralReason = null;
    }
  }

  const nlp = extractClinicalEntities(cleanInput, "probing", prevState);
  const detectedDur = nlp?.detectedDuration;

  const duration =
    detectedDur ||
    (raw.duration && raw.duration !== "Not specified" ? raw.duration : null) ||
    prevState.duration ||
    "Not specified";

  let probingQuestion = raw.probingQuestion || 'Ask the IP: "Could you please describe how you are feeling and what symptoms are troubling you most?"';

  // Safeguard: Check if LLM generated a question that was already asked or answered
  const isAskingLocation = /\b(where did|location|landmark|kis jagah|kahan hui)\b/i.test(probingQuestion);
  const answeredLocation = askedQuestionsList.some((q) => /\b(where did|location|landmark|kis jagah|kahan hui)\b/i.test(q)) ||
    /\b(road|highway|factory|floor|street|colony|area|landmark|guwahati|tinsukia|dibrugarh)\b/i.test(cleanInput);

  const isAskingCasualties = /\b(how many casualties|how many people|trapped|kitne log)\b/i.test(probingQuestion);
  const answeredCasualties = askedQuestionsList.some((q) => /\b(how many casualties|how many people|trapped|kitne log)\b/i.test(q)) ||
    /\b(worker|person|people|casualties|trapped|unconscious|single victim|1 worker|2 worker)\b/i.test(cleanInput);

  const isAskingDur = /\b(when did|how long|how many days|duration|since when|kab se|kitne din)\b/i.test(probingQuestion);
  const answeredDur = (askedQuestionsList.some((q) => /\b(when did|how long|how many days|duration|since when|kab se|kitne din)\b/i.test(q)) || Boolean(prevState.duration && prevState.duration !== "Not specified")) &&
    /\b(days|hours|weeks|months|years|din|ghante|mahine|saal|yesterday|kal se|subah se)\b/i.test(cleanInput);

  const isAskingSelfHarm = /\b(self-harm|nuksaan|harming yourself|jan dene|give up)\b/i.test(probingQuestion);
  const answeredSelfHarm = askedQuestionsList.some((q) => /\b(self-harm|nuksaan|harming yourself|jan dene|give up)\b/i.test(q)) ||
    /\b(self-harm|harming myself|not wanting to live|give up|giving up|jaan de|mar ja|suicid|nuksaan)\b/i.test(cleanInput);

  // Extract core question content excluding introductory doctor empathy phrases
  const extractCoreQuestionText = (text) =>
    (text || "")
      .toLowerCase()
      .replace(/^ask the ip:\s*["']?/i, "")
      .replace(/["']?\s*$/i, "")
      .replace(/^i (understand|hear|know|am sorry|apologize).*?[.!?]\s*/i, "")
      .replace(/^main samajh sakta.*?[.!?]\s*/i, "")
      .replace(/^kripya shant rahe.*?[.!?]\s*/i, "")
      .replace(/[^a-z0-9]/g, "");

  // Keep the AI's dynamically formulated question intact.
  // Only provide emergency fallback if the model returned empty text.
  if (!probingQuestion || probingQuestion.trim().length < 5) {
    const progressiveFallback = buildLocalDoctorConsultationFallback(cleanInput, history, prevState);
    probingQuestion = progressiveFallback.probingQuestion;
    if (progressiveFallback.suggestedAnswers?.length) {
      raw.suggestedAnswers = progressiveFallback.suggestedAnswers;
    }
  }

  if (!probingQuestion.startsWith("Ask the IP:")) {
    probingQuestion = `Ask the IP: "${probingQuestion.replace(/^["']|["']$/g, "")}"`;
  }

  // Enforce strictly ONE clinical question per turn (never combine with 'and are you', etc.)
  probingQuestion = enforceSingleQuestion(probingQuestion);
  probingQuestion = sanitizeClinicalQuestion(probingQuestion, allContext, cleanInput);
  probingQuestion = enforceSingleQuestion(probingQuestion);

  const isAskingDuration =
    /\b(when did|how long|how many days|how many months|how many years|duration|since when|kab se|kitne din|kitna samay|kitne mahine|kitne saal)\b/i.test(
      probingQuestion
    );

  let suggestedAnswers;
  const rawOptions = raw.suggestedAnswers || raw.options || raw.answers;
  const isCompoundOption = Array.isArray(rawOptions) && rawOptions.some(ans => typeof ans === "string" && (ans.length > 120 || /^[1-4]\)\s/m.test(ans)));
  const isCannedGenericAnswers = Array.isArray(rawOptions) && rawOptions.some(ans => 
    typeof ans === "string" && (
      ans.includes("experiencing this right now") ||
      ans.includes("symptom is not present") ||
      ans.includes("comes and goes intermittently") ||
      ans.includes("experiencing this symptom")
    )
  );

  if (Array.isArray(rawOptions) && rawOptions.length >= 2 && !isCompoundOption && !isCannedGenericAnswers) {
    suggestedAnswers = rawOptions
      .map((ans) => (typeof ans === "string" ? ans.trim() : String(ans)))
      .filter((ans) => ans.length > 0);

    // Validate semantic alignment between probingQuestion and suggestedAnswers
    const qLower = probingQuestion.toLowerCase();
    const joinedAnswers = suggestedAnswers.join(" ").toLowerCase();

    // Mismatch 1: Question asks for anatomical location (where/which part/thigh/knee/calf/ankle), but answers give pain severity rating (8-10, severe, moderate, mild)
    const isAskingLocation = /\b(where|location|which part|thigh|knee|calf|ankle|shin|foot|kahan|kis hisse)\b/i.test(qLower);
    const answersAreSeverity = /\b(8-10|5-7|2-4|unbearable|moderate|mild discomfort|throbbing ache)\b/i.test(joinedAnswers);
    const answersHaveLocation = /\b(knee|calf|thigh|ankle|foot|joint|muscle|back|neck|stomach|abdomen|arm|shoulder|wrist|area|spot|body|head)\b/i.test(joinedAnswers);

    // Mismatch 2: Question asks for duration/time (how long, since when, kab se, kitne din), but answers give severity or generic text
    const isAskingDuration = /\b(how long|since when|when did|how many (?:hours|days|weeks|months)|duration|kab se|kitne din|kitna samay)\b/i.test(qLower);
    const answersHaveDuration = /\b(hours|days|weeks|months|years|yesterday|today|recent|acute|chronic|sudden|persistent|ongoing)\b/i.test(joinedAnswers);

    // Mismatch 3: Question asks for age (how old, age of), but answers do not have age
    const isAskingAge = /\b(how old|age of|patient'?s? age|father'?s? age|mother'?s? age|kitni umar)\b/i.test(qLower);
    const answersHaveAge = /\b(years|elderly|adult|minor|child|umar)\b/i.test(joinedAnswers);

    // Mismatch 4: Casualties options returned when question is NOT asking about disaster/casualties
    const isAskingCasualties = /\b(how many\s+(?:people|persons?|casualties|workers?|victims?)|casualties|injured people|kitne log ghayal)\b/i.test(qLower);
    const answersHaveCasualties = /\b(casualties|person injured|trapped in vehicle|multiple people hurt)\b/i.test(joinedAnswers);

    // Mismatch 5: Question is screening/yes-no, but answers give numbers or duration
    const isYesNo = /\b(do you (?:have|feel|experience)|are you (?:having|experiencing)|is there (?:any)|did you (?:hit|fall|take))\b/i.test(qLower) && !isAskingDuration && !isAskingLocation;
    const answersHaveYesNo = /\b(yes|no|manageable|intermittently|definitely|not at all)\b/i.test(joinedAnswers);

    if (
      (isAskingLocation && answersAreSeverity && !answersHaveLocation) ||
      (isAskingDuration && !answersHaveDuration) ||
      (isAskingAge && !answersHaveAge) ||
      (!isAskingCasualties && answersHaveCasualties) ||
      (isYesNo && !answersHaveYesNo && !answersHaveDuration)
    ) {
      suggestedAnswers = generateContextualAnswers(probingQuestion, cleanInput, isPsych, allContext);
    }
  } else {
    suggestedAnswers = generateContextualAnswers(probingQuestion, cleanInput, isPsych, allContext);
  }

  const isSelfHarmTrauma =
    /\b(cut.*wrist|wrist.*cut|bleeding.*cut|cut.*hand|overdose|drank poison|poisoning|hanging|sleeping pills|nass kaat|khoon nikal)\b/i.test(allContext) ||
    (/\b(cut|bleeding|wound|khoon)\b/i.test(allContext) && /\b(sad|depress|die|suicid|jaan|mar ja|alone|unwanted)\b/i.test(allContext));

  const isDual = Boolean(raw.is_dual_protocol || raw.isDualProtocol || isSelfHarmTrauma);
  const secondaryRef = raw.call_referral_secondary || (isDual ? "Psychological Counselling Department" : null);

  let finalCondition = raw.suspectedCondition;
  if (!finalCondition || /Caller reports (?:a )?fall/i.test(finalCondition)) {
    finalCondition = "Traumatic Fall / Impact Injury Assessment";
  } else if (/Caller reports/i.test(finalCondition)) {
    if (/\b(snake|saap|saanp|bite|envenomation)\b/i.test(allContext)) {
      finalCondition = "Snake Bite (Type undetermined) / Local Tissue Reaction";
    } else if (/\b(chest pain|chhati|heart)\b/i.test(allContext)) {
      finalCondition = "Suspected Acute Coronary Syndrome";
    } else if (/\b(fever|bukhar)\b/i.test(allContext)) {
      finalCondition = "Febrile Illness / Pyrexia under Investigation";
    } else {
      const cleaned = finalCondition.replace(/^caller reports (?:an? )?/i, "").replace(/[.;].*$/, "");
      finalCondition = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } else if (isPsych) {
    finalCondition = raw.suspectedCondition || "Psychological Distress / Anxiety Crisis";
  } else if (is104PhoneDoctor) {
    finalCondition = "104 Tele-Doctor Consultation";
  } else if (!finalCondition) {
    finalCondition = "Under Clinical Assessment";
  }

  const userUtterances = [
    cleanInput,
    ...history
      .filter((m) => m.sender === "user" || m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : m.text || "")),
  ]
    .join(" ")
    .toLowerCase();

  const callerDeniesFever =
    /\b(no fever|nehi|nahi|not having fever|without fever|fever nahi|bukhar nahi|no chills|mild discomfort|just not feeling good)\b/i.test(
      userUtterances
    ) && !/\b(yes.*fever|fever.*hai|tez bukhar|severe fever)\b/i.test(userUtterances);

  const filteredRedFlags = (Array.isArray(raw.redFlagsDetected) ? raw.redFlagsDetected : []).filter(
    (f) => {
      if (!f || typeof f !== "string") return false;
      const fLower = f.toLowerCase();
      if (
        fLower.includes("fever") ||
        fLower.includes("bukhar") ||
        fLower.includes("chills") ||
        fLower.includes("pyrexia")
      ) {
        if (callerDeniesFever) return false;
        return /\b(high fever|tez bukhar|bukhar|fever|chills|shivering|rigor|10[2-5]\s*(?:°|f|deg))\b/i.test(
          userUtterances
        );
      }
      if (fLower.includes("self-harm") || fLower.includes("suicid")) {
        return /\b(wanna die|want to die|kill myself|mar jaunga|jaan de dunga|suicid)\b/i.test(
          userUtterances
        );
      }
      if (fLower.includes("chest") || fLower.includes("cardiac") || fLower.includes("coronary")) {
        return /\b(chest|chhati|heart attack|dil ka dard|left arm|pressure on chest)\b/i.test(
          userUtterances
        );
      }
      if (fLower.includes("bleed") || fLower.includes("wound") || fLower.includes("cut")) {
        return /\b(bleed|blood|khoon|deep wound|cut\s*wrist|fracture)\b/i.test(userUtterances);
      }
      return true;
    }
  );

  return {
    probingQuestion,
    suggestedAnswers,
    suspectedCondition: finalCondition,
    isPsychiatric: isPsych,
    severity,
    severityScore,
    referralDestination,
    referralReason,
    is_dual_protocol: isDual,
    call_referral_secondary: secondaryRef,
    redFlagsDetected: filteredRedFlags,
    duration,
    isReadyForSummary: Boolean(raw.isReadyForSummary || (history.length >= 6) || is104PhoneDoctor),
    clinicalSummary:
      raw.clinicalSummary ||
      `Caller presents with ${raw.suspectedCondition || "complaint"}. Evaluated Severity: ${severity}. Duration: ${duration}. Recommended Action: ${referralDestination}.`,
  };
}

/**
 * High-precision progressive local fallback engine
 * Tracks conversation history, analyzes answers, applies doctor empathy, and NEVER repeats questions!
 */
export function buildLocalDoctorConsultationFallback(userInput, history = [], prevState = {}) {
  const cleanInput = (userInput || "").toLowerCase().trim();
  const historyText = history
    .map((m) => (typeof m.content === "string" ? m.content : m.text || ""))
    .join(" ")
    .toLowerCase();
  const effectiveInput = `${cleanInput} ${prevState.suspectedCondition || ""} ${prevState.symptom || ""} ${historyText}`.toLowerCase();

  // Extract all questions already asked by the bot in this session
  const askedQuestions = history
    .filter((m) => m.sender === "bot" || m.sender === "assistant" || m.role === "assistant" || m.role === "bot")
    .map((m) => (m.text || m.content || "").toLowerCase());

  const botCount = askedQuestions.length;

  const hasAsked = (keywords) => {
    return askedQuestions.some((q) => keywords.some((kw) => q.includes(kw.toLowerCase())));
  };

  // Direct Referral Preference Check First
  const directIntent = detectDirectCallerReferralIntent(cleanInput);
  if (directIntent) {
    return {
      probingQuestion: directIntent.suggestedQuestion,
      suggestedAnswers: directIntent.suggestedAnswers,
      suspectedCondition: prevState.suspectedCondition || directIntent.suspectedConditionSuffix,
      isPsychiatric: directIntent.destination === "Psychological Counselling Department",
      severity:
        directIntent.destination === "108 Ambulance" || directIntent.destination === "ESIC Hospital"
          ? "High"
          : prevState.severity || "Moderate",
      severityScore:
        directIntent.destination === "108 Ambulance" || directIntent.destination === "ESIC Hospital"
          ? 9
          : 6,
      referralDestination: directIntent.destination,
      referralReason: directIntent.reason,
      redFlagsDetected: directIntent.destination === "108 Ambulance" ? ["Urgent ambulance transfer requested"] : [],
      duration: prevState.duration || "Reported today",
      isReadyForSummary: true,
      clinicalSummary: `Direct caller routing requested to ${directIntent.destination}.`,
    };
  }

  // 1. Combined Self-Harm / Traumatic Hemorrhage with Psychological Distress
  const isSelfHarmTrauma =
    /\b(cut.*wrist|wrist.*cut|bleeding.*cut|cut.*hand|overdose|drank poison|poisoning|hanging|sleeping pills|nass kaat|khoon nikal)\b/i.test(cleanInput) ||
    (/\b(cut|bleeding|wound|khoon)\b/i.test(cleanInput) && /\b(sad|depress|die|suicid|jaan|mar ja|alone|unwanted)\b/i.test(cleanInput));

  if (isSelfHarmTrauma) {
    const harmSteps = [
      {
        id: "harm_bleeding_pressure",
        condition: !hasAsked(["pressure", "clean cloth", "dabav", "kapda"]) && !cleanInput.includes("holding pressure"),
        question:
          'Ask the IP: "I hear you, please stay calm and stay on the line with me; help is being organized right now. Can you take a clean cloth and press it firmly on the wound without letting go?" (Hinglish: "Main aapke saath hoon, kripya shaant rahein aur phone par bane rahein. Kya aap saaf kapde se ghaav ko lagataar mazbooti se daba kar rakh pa rahe hain?")',
        options: [
          "Holding firm pressure on wound with cloth",
          "Bleeding is heavy, feeling dizzy or faint",
          "Someone is here with me helping hold pressure",
          "Need immediate 108 emergency ambulance dispatch",
        ],
      },
      {
        id: "harm_dizziness_status",
        condition: !hasAsked(["dizzy", "chakkar", "faint", "behosh"]),
        question:
          'Ask the IP: "Please keep that pressure firmly on the wound. Are you feeling dizzy, faint, or weak right now?" (Hinglish: "Kripya ghaav ko lagataar dabakar rakhein. Kya aapko abhi chakkar, behoshi ya kamzori mehsoos ho rahi hai?")',
        options: [
          "Yes, feeling very dizzy and faint",
          "A little faint, but conscious and alert",
          "No dizziness, holding pressure firmly",
          "Vision is getting blurry / feeling cold",
        ],
      },
      {
        id: "harm_companion_support",
        condition: true,
        question:
          'Ask the IP: "108 Ambulance is being alerted for immediate dispatch. Is there anyone nearby with you right now who can assist you?" (Hinglish: "108 Ambulance ko turant bheja ja raha hai. Kya aapke paas koi maujood hai jo madad kar sake?")',
        options: [
          "I am alone, please dispatch ambulance fast",
          "A family member / friend is with me now",
          "Neighbor is coming to help hold pressure",
          "Waiting by the door for the ambulance",
        ],
      },
    ];

    const currentStep = harmSteps.find((s) => s.condition) || harmSteps[harmSteps.length - 1];

    return {
      probingQuestion: enforceSingleQuestion(currentStep.question),
      suggestedAnswers: currentStep.options,
      suspectedCondition: "Acute Self-Harm / Traumatic Hemorrhage with Psychiatric Crisis",
      isPsychiatric: true,
      severity: "High",
      severityScore: 9,
      referralDestination: "108 Ambulance",
      referralReason: "Immediate traumatic hemorrhage requiring 108 Emergency Ambulance dispatch, alongside crisis mental health stabilization (Tele-MANAS 14416).",
      redFlagsDetected: ["Acute Self-Harm / Traumatic Hemorrhage", "High-Risk Psychological Crisis"],
      duration: "Reported today",
      isReadyForSummary: true,
      is_dual_protocol: true,
      call_referral_secondary: "Psychological Counselling Department",
      call_referral_secondary_reason: "Crisis emotional de-escalation & mental health counselling support (Tele-MANAS 14416).",
      clinicalSummary: "Caller presents with acute self-harm trauma with bleeding and severe psychological distress. Immediate dual protocol activated: 108 Ambulance trauma dispatch with Psychological Counselling co-referral.",
    };
  }

  // 2. Psychological Distress / Depression / Loneliness / Crisis
  const isPsych =
    /\b(suicid\w*|mar ja\w*|jaan de dunga|depress\w*|udaas\b|\brona\b|hopeless\b|anxiety\b|ghabrahat\b|mental health|akelepan\b|\bpareshan\b|\bdie\b|kill myself|crying\b|lonely\b|niraash\b|not wanting to live|self-harm)\b/i.test(
      cleanInput
    ) ||
    prevState.isPsychiatric ||
    (prevState.referralDestination || "").includes("Psychological");

  if (isPsych) {
    const psychSteps = [
      {
        id: "psych_trigger",
        condition:
          botCount === 0 &&
          !hasAsked(["kis baat se", "causing you the most", "stress recently", "troubling you"]) &&
          !/\b(work|job|boss|family|paisa|money|debt|health|bimar|loss|grief|trouble|fight|quarrel|husband|wife)\b/i.test(cleanInput),
        question:
          'Ask the IP: "I understand how heavy and lonely this feels for you right now, and you do not have to carry this alone. What has been causing you the most stress or pain recently?" (Hinglish: "Main samajh sakta hoon ki aap kitna akele aur pareshan mehsoos kar rahe hain. Kya aap bata sakte hain ki haal hi me kis baat se sabse zyada stress ya takleef ho rahi hai?")',
        options: [
          "Heavy work pressure & workplace stress",
          "Family dispute / Relationship difficulties",
          "Financial burden & debt worries",
          "Chronic illness / Physical health distress",
        ],
      },
      {
        id: "psych_duration_impact",
        condition:
          botCount <= 1 &&
          !hasAsked(["kitne samay", "carrying this sadness", "affecting your sleep", "how long"]) &&
          !/\b(week|month|year|day|ghante|saal|din|mahine|insomnia|neend|bhook)\b/i.test(cleanInput),
        question:
          'Ask the IP: "Dealing with that must be emotionally exhausting. Since how long have you been carrying this sadness or emotional distress?" (Hinglish: "Yeh mansik bojh sach me bahut thaka dene wala hota hai. Aap kitne samay se aisa mehsoos kar rahe hain?")',
        options: [
          "Past few days / Sudden overwhelming breakdown",
          "1 to 2 weeks / Continuous sadness",
          "1 to 6 months / Ongoing emotional struggle",
          "More than a year / Longstanding struggle",
        ],
      },
      {
        id: "psych_safety_check",
        condition:
          botCount <= 2 &&
          !hasAsked(["nuksaan", "self-harm", "harming yourself", "jan dene", "giving up"]) &&
          !/\b(self-harm|harming myself|not wanting to live|give up|giving up|jaan de|mar ja|suicid|nuksaan)\b/i.test(cleanInput),
        question:
          'Ask the IP: "Your life is truly precious to us. In these deep moments of darkness, have you had thoughts of harming yourself?" (Hinglish: "Aapki jaan bahut anmol hai. Kya bahut zyada nirasha me aapke mann me khud ko nuksan pahunchane ya jaan dene ka vichar aaya hai?")',
        options: [
          "Yes, having thoughts of self-harm / wanting to give up",
          "No thoughts of self-harm, just deeply sad and exhausted",
          "Feeling anxious and panic attacks, no self-harm",
          "Need to talk to a professional counsellor immediately",
        ],
      },
      {
        id: "psych_handover",
        condition: true,
        question:
          'Ask the IP: "Thank you for trusting me with that. Please know you are not alone, and help is available right now. Are you currently in a safe place right now? We are connecting you immediately to our Psychological Counselling Department and Tele-MANAS (14416) for free support." (Hinglish: "Mujhpar bharosa karne ke liye dhanyawad. Kripya jaanein ki aap akele nahi hain. Kya aap abhi kisi safe jagah par hain?")',
        options: [
          "Yes, please connect me to the counsellor right now",
          "I am at home alone, please connect urgently",
          "Family member is near me, please guide transfer",
          "Will stay on the line for counselling team",
        ],
      },
    ];

    const currentStep = psychSteps.find((s) => s.condition) || psychSteps[psychSteps.length - 1];

    return {
      probingQuestion: enforceSingleQuestion(currentStep.question),
      suggestedAnswers: currentStep.options,
      suspectedCondition: "Psychological Distress / Depression Crisis",
      isPsychiatric: true,
      severity: "High",
      severityScore: 9,
      referralDestination: "Psychological Counselling Department",
      referralReason: "Caller exhibits emotional distress / psychological crisis; priority transfer to Psychological Counselling Department (Tele-MANAS 14416).",
      redFlagsDetected: ["Emotional crisis / Psychological distress"],
      duration: prevState.duration || "Recent days",
      isReadyForSummary: history.length >= 4,
      clinicalSummary: "Caller presents with psychological distress and depression symptoms. Priority routing to Psychological Counselling Department.",
    };
  }

  // 2. Accident / Trauma Emergency
  const isAccident =
    /\b(accident|durghatna|chot|injury|cut|hit by|road accident|bike accident|car crash|fall from|machine accident|casualty|laceration|bleeding from cut)\b/i.test(
      cleanInput
    ) || (prevState.suspectedCondition || "").includes("Accident");

  if (isAccident) {
    const traumaSteps = [
      {
        id: "trauma_location_time",
        condition:
          !hasAsked(["kis jagah", "where did the accident", "exact location", "landmark"]) &&
          !/\b(road|highway|factory|floor|street|colony|area|mins ago|hours ago|just now|landmark|guwahati|tinsukia|dibrugarh)\b/i.test(cleanInput),
        question:
          'Ask the IP: "Please stay as calm as possible, help is being organized. What is the exact location, road, or factory landmark of the accident?" (Hinglish: "Kripya shaant rahein, madad bheji ja rahi hai. Durghatna kis jagah, road ya factory me hui hai?")',
        options: [
          "Road / highway accident — happened just now (<15 mins)",
          "Workplace / factory machine injury (<1 hour)",
          "Fall from height at construction site",
          "Vehicle collision on main road",
        ],
      },
      {
        id: "trauma_casualties",
        condition:
          !hasAsked(["kitne log", "how many casualties", "trapped", "behosh"]) &&
          !/\b(1 worker|2 worker|\d+ worker|\d+ people|\d+ casualties|trapped|unconscious|single person)\b/i.test(cleanInput),
        question:
          'Ask the IP: "How many people or workers are injured?" (Hinglish: "Kul kitne log ya workers ghayal hain?")',
        options: [
          "1 person injured — conscious with severe pain",
          "2 or more casualties — multiple people hurt",
          "Victim is unconscious / not responding",
          "Person trapped in vehicle / needs rescue",
        ],
      },
      {
        id: "trauma_bleeding_fracture",
        condition:
          !hasAsked(["khoon bah raha", "bleeding", "direct pressure", "fracture", "active spurting"]) &&
          !/\b(applying pressure|pressure applied|tourniquet|bandaged)\b/i.test(cleanInput),
        question:
          'Ask the IP: "Is there active spurting bleeding from the wound? If yes, apply firm direct pressure with a clean cloth immediately." (Hinglish: "Kya ghaav se tez khoon beh raha hai? Agar haan toh turant saaf kapde se daba kar rakhein.")',
        options: [
          "Heavy bleeding — applying firm pressure now",
          "Suspected fracture — unable to move limb",
          "Head injury with scalp cut / bleeding",
          "Minor bleeding, mostly bruises and shock",
        ],
      },
      {
        id: "trauma_dispatch",
        condition: true,
        question:
          'Ask the IP: "108 Emergency Ambulance is being dispatched to your location. Can the ambulance reach your location directly?" (Hinglish: "108 Ambulance ko coordinate kiya ja raha hai. Kya ambulance seedhe aapki location tak pahunch sakti hai?")',
        options: [
          "Yes, ambulance can reach directly on road",
          "Guiding ambulance from main entrance",
          "Arranging immediate local vehicle to nearest hospital",
          "Standing by with the injured person",
        ],
      },
    ];

    const currentStep = traumaSteps.find((s) => s.condition) || traumaSteps[traumaSteps.length - 1];

    return {
      probingQuestion: enforceSingleQuestion(currentStep.question),
      suggestedAnswers: currentStep.options,
      suspectedCondition: "Occupational Trauma / Acute Accident",
      isPsychiatric: false,
      severity: "High",
      severityScore: 9,
      referralDestination: "108 Ambulance",
      referralReason: "Acute accident / trauma incident requiring immediate location details and 108 emergency dispatch.",
      redFlagsDetected: ["Acute accident / trauma reported"],
      duration: "Fresh accident / trauma (<2 hours)",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: "Accident / trauma reported. Immediate location coordination and 108 Ambulance dispatch advised.",
    };
  }

  // 3. Cardiac / Chest Pain Emergency
  const isCardiac =
    /\b(chest pain|chhati me dard|seene me dard|heart attack|angina|crushing pain|baayein haath)\b/i.test(cleanInput) ||
    (prevState.suspectedCondition || "").includes("Coronary");

  if (isCardiac) {
    const cardiacSteps = [
      {
        id: "cardiac_character",
        condition: !hasAsked(["crushing", "heavy pressure", "left arm", "dabav"]),
        question:
          'Ask the IP: "Chest pain must be evaluated urgently. Does the pain feel like heavy crushing pressure?" (Hinglish: "Seene ka dard gambhir ho sakta hai. Kya seene par bhaari dabav mehsoos ho raha hai?")',
        options: [
          "Heavy crushing pressure radiating to left arm",
          "Sharp stinging chest pain when breathing in",
          "Burning sensation in chest / acidity feeling",
          "Dull heaviness with cold sweating and nausea",
        ],
      },
      {
        id: "cardiac_duration",
        condition: !hasAsked(["kitni der se", "how long has this chest", "duration"]),
        question:
          'Ask the IP: "How long has this chest tightness or pain been going on?" (Hinglish: "Yeh seene ka dard kitni der se ho raha hai?")',
        options: [
          "< 20 minutes (Sudden onset with sweating)",
          "1 to 2 hours of continuous pressure",
          "Intermittent pain since yesterday",
          "Comes and goes after eating / exertion",
        ],
      },
      {
        id: "cardiac_breathlessness",
        condition: !hasAsked(["sans lene me", "breathless", "history of heart", "sugar"]),
        question:
          'Ask the IP: "Are you struggling to breathe while sitting still?" (Hinglish: "Kya aapko baithe-baithe bhi saans lene me takleef ho rahi hai?")',
        options: [
          "Severe breathlessness — gasping for air",
          "Known high blood pressure / diabetes patient",
          "Previous heart attack / angioplasty history",
          "No past history, first time experiencing this",
        ],
      },
      {
        id: "cardiac_dispatch",
        condition: true,
        question:
          'Ask the IP: "Please sit upright, do not exert yourself, and loosen tight clothing. We are triggering 108 Emergency Ambulance to transport you to the nearest hospital casualty. Is someone with you?" (Hinglish: "Kripya aaram se baith jayein aur exertion na karein. Hum 108 Ambulance bhej rahe hain. Kya koi aapke saath hai?")',
        options: [
          "Yes, family member is with me",
          "I am alone, please send ambulance immediately",
          "Taking prescribed sorbitrate / aspirin",
          "Awaiting ambulance arrival",
        ],
      },
    ];

    const currentStep = cardiacSteps.find((s) => s.condition) || cardiacSteps[cardiacSteps.length - 1];

    return {
      probingQuestion: enforceSingleQuestion(currentStep.question),
      suggestedAnswers: currentStep.options,
      suspectedCondition: "Suspected Acute Coronary Syndrome",
      isPsychiatric: false,
      severity: "High",
      severityScore: 9,
      referralDestination: "108 Ambulance",
      referralReason: "High-risk chest pain symptoms requiring emergency cardiac evaluation and 108 Ambulance transport.",
      redFlagsDetected: ["Suspected Acute Coronary Syndrome"],
      duration: prevState.duration || "< 2 hours",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: "Patient presents with acute chest pain symptoms. Priority 108 Ambulance dispatch advised.",
    };
  }

  // 4. Truly Adaptive Clinical Synthesizer tailored to the caller's specific complaint
  const nlp = extractClinicalEntities(cleanInput, "probing", prevState);
  const domain = nlp.domain || detectClinicalDomain(cleanInput, prevState);
  let conditionLabel = nlp.conditionLabel || DOMAIN_LABELS[domain] || "Clinical Condition";

  // Build disease-adaptive probing question tailored to the exact complaint
  let currentStep;

  if (/\b(snake|bite|sting|insect|saap|kutta|dog bite|animal bite|kat liya|dank)\b/i.test(effectiveInput)) {
    conditionLabel = "Suspected Snake / Animal Bite Envenomation";
    if (!hasAsked(["kahan", "where on your body", "kis hisse", "describe the snake"])) {
      currentStep = {
        title: "Bite Location Inquiry",
        question: 'Ask the IP: "Where on your body did the snake bite occur?" (Hinglish: "Saanp ne sharir ke kis hisse par kaata hai?")',
        options: [
          "Bite is on foot / ankle",
          "Bite is on lower leg",
          "Bite is on hand / fingers",
          "Bite is on arm / wrist",
        ],
        severity: "High",
      };
    } else if (!hasAsked(["swelling", "sujan", "numbness", "sunnta"])) {
      currentStep = {
        title: "Envenomation Red Flags",
        question: 'Ask the IP: "Are you experiencing rapid swelling, numbness, or difficulty breathing around the bite?" (Hinglish: "Kya bite ke aas-paas tezi se sujan, sunnta, ya saans lene me takleef ho rahi hai?")',
        options: [
          "Rapid swelling & intense burning pain",
          "Numbness and weakness spreading in limb",
          "Difficulty breathing or blurred vision",
          "No severe swelling, only mild local pain",
        ],
        severity: "High",
      };
    } else {
      currentStep = {
        title: "Bite Appearance & Wound Check",
        question: 'Ask the IP: "Can you describe what the bite mark looks like, such as two puncture marks or redness?" (Hinglish: "Kya aap bata sakte hain ki bite ka nishan kaisa dikh raha hai?")',
        options: [
          "Two clear puncture fang marks visible",
          "Single scratch or puncture wound",
          "Redness and bruising, marks unclear",
          "No visible marks, only pain",
        ],
        severity: "High",
      };
    }
  } else if (/\b(weakness|dizzy|dizziness|faint|chakkar|kamzori|fatigue|giddiness|unsteady)\b/i.test(effectiveInput)) {
    conditionLabel = "Acute Weakness & Postural Dizziness";
    currentStep = {
      title: "Onset & Orthostatic Instability",
      question: 'Ask the IP: "Did this dizziness and weakness come on suddenly today?" (Hinglish: "Kya yeh kamzori aur chakkar aaj achanak shuru hue?")',
      options: [
        "Sudden severe onset today",
        "Gradual weakness over past 2 to 3 days",
        "Comes only when standing up from bed or chair",
        "Mild fatigue with lightheadedness",
      ],
      severity: "Moderate",
    };
  } else if (/\b(chest pain|chhati|heart|crushing|pressure in chest|left arm)\b/i.test(cleanInput)) {
    conditionLabel = "Suspected Acute Coronary Syndrome";
    currentStep = {
      title: "Cardiac Ischemia Evaluation",
      question: 'Ask the IP: "Is the chest pain feeling like heavy crushing pressure spreading to your left arm?" (Hinglish: "Kya seene me bhaari dabav mehsoos ho raha hai jo baayein haath ki taraf ja raha hai?")',
      options: [
        "Heavy crushing chest pressure radiating to left arm",
        "Sharp stinging chest pain when breathing in",
        "Burning sensation in chest / acidity feeling",
        "Dull heaviness with cold sweating and nausea",
      ],
      severity: "High",
    };
  } else if (/\b(breath|saans|wheezing|asthma|dum ghutna|shortness)\b/i.test(cleanInput)) {
    conditionLabel = "Acute Respiratory Distress / Bronchospasm";
    currentStep = {
      title: "Respiratory Distress Assessment",
      question: 'Ask the IP: "Are you having difficulty breathing while sitting still right now?" (Hinglish: "Kya aapko is samay baithe-baithe bhi saans lene me takleef ho rahi hai?")',
      options: [
        "Severe breathlessness even while resting",
        "Breathlessness only when walking or talking",
        "Wheezing sound with tight chest feeling",
        "Mild breathlessness manageable",
      ],
      severity: "High",
    };
  } else if (/\b(fever|bukhar|temperature|chills|shivering|cold|sardi)\b/i.test(cleanInput)) {
    conditionLabel = "Febrile Illness / Pyrexia under Investigation";
    currentStep = {
      title: "Febrile Pattern & Chills",
      question: 'Ask the IP: "Since how many days have you been running this fever?" (Hinglish: "Aapko yeh bukhar kitne dino se aa raha hai?")',
      options: [
        "Started today (< 24 hours)",
        "2 to 3 days (Recent)",
        "4 to 7 days (Ongoing)",
        "More than a week (Persistent)",
      ],
      severity: "Moderate",
    };
  } else if (/\b(vomit|ulti|nausea|loose motion|dast|diarrhea|food poison)\b/i.test(cleanInput)) {
    conditionLabel = "Acute Gastroenteritis / Dehydration Risk";
    currentStep = {
      title: "Gastrointestinal Fluid Loss",
      question: 'Ask the IP: "How many times have you vomited or passed loose stools today?" (Hinglish: "Aaj aapko kitni baar ulti ya dast hue hain?")',
      options: [
        "Frequent vomiting (> 5 times), cannot keep fluids down",
        "Watery loose motions 3 to 4 times with weakness",
        "Mild nausea with stomach upset after food",
        "Vomited once or twice, able to drink water",
      ],
      severity: "Moderate",
    };
  } else if (/\b(headache|sar dard|sir dard|migraine|head pain)\b/i.test(cleanInput)) {
    conditionLabel = "Acute Cephalea / Migraine under Investigation";
    currentStep = {
      title: "Headache Character & Warning Signs",
      question: 'Ask the IP: "Could you describe the type of headache pain you are feeling?" (Hinglish: "Kya aap bata sakte hain ki aapko kis tarah ka sirdard mehsoos ho raha hai?")',
      options: [
        "Sudden explosive severe headache unlike any before",
        "One-sided throbbing headache with nausea",
        "Dull band-like pressure across forehead",
        "Mild headache relieved by resting",
      ],
      severity: "Moderate",
    };
  } else if (/\b(fall|fell|falling|gira|giri|bed se|chhat se|height|tripped|slip|slipped)\b/i.test(cleanInput)) {
    conditionLabel = "Traumatic Fall / Impact Injury Assessment";
    currentStep = {
      title: "Fall Impact & Injury Screening",
      question: 'Ask the IP: "Did you hit your head or injure your back or limbs when you fell?" (Hinglish: "Kya girte waqt sar par chot lagi ya sharir ke kisi hisse me dard hai?")',
      options: [
        "Hit my head, feeling dizzy or dazed",
        "Severe pain in arm / leg / back",
        "Unable to get up from the floor",
        "Bruised and sore, but can move limbs",
      ],
      severity: "Moderate",
    };
  } else if (/\b(cut|bleeding|injury|chot|fracture|wound|trauma)\b/i.test(cleanInput)) {
    conditionLabel = "Traumatic Injury / Wound Assessment";
    currentStep = {
      title: "Trauma & Hemorrhage Check",
      question: 'Ask the IP: "Is there active continuous bleeding from the wound?" (Hinglish: "Kya chot se lagataar khoon beh raha hai?")',
      options: [
        "Heavy active bleeding requiring immediate pressure",
        "Deep cut but bleeding stopped with cloth",
        "Suspected fracture / limb deformity and swelling",
        "Minor scrape or superficial cut with mild pain",
      ],
      severity: "High",
    };
  } else {
    // Dynamic disease extractor: Never canned generic questions!
    const cleanComplaint = cleanInput.replace(/[^a-zA-Z0-9\s]/g, "").trim().slice(0, 40);
    const displayComplaint = cleanComplaint || conditionLabel || "this complaint";
    currentStep = {
      title: "Complaint Character & Functional Impact",
      question: `Ask the IP: "Could you describe how the ${displayComplaint} feels right now?" (Hinglish: "Kya aap bata sakte hain ki abhi aapko kaisa mehsoos ho raha hai?")`,
      options: [
        "Started suddenly today with significant discomfort",
        "Gradually worsening over the last 2 to 3 days",
        "Mild symptoms present for several days",
        "Severe discomfort requiring urgent doctor evaluation",
      ],
      severity: "Moderate",
    };
  }

  const isSevere =
    currentStep.severity === "High" ||
    /emergency|fracture|dvt|blood|vomit blood|unconscious|rigors|severe|chest pain|chhati|poison|snake|bite/i.test(cleanInput) ||
    prevState.severity === "High";

  const severity = isSevere ? "High" : /mild|no pain/i.test(cleanInput) ? "Mild" : "Moderate";

  let referralDestination;
  let referralReason;

  const fallbackDispensaryStatus = getDispensaryOperatingStatus();
  const isNacoHIV = /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease)\b/i.test(cleanInput);

  if (severity === "High" && /chest pain|heart|stroke|unconscious|poison|snake|bite/i.test(cleanInput)) {
    referralDestination = "108 Ambulance";
    referralReason = "Acute emergency requiring immediate ambulance dispatch.";
  } else if (isNacoHIV) {
    referralDestination = "NACO 1097 Helpline";
    referralReason = "Confidential sexual health / HIV-AIDS counseling; transfer to National AIDS Helpline (Toll-Free 1097).";
  } else if (severity === "High") {
    referralDestination = "ESIC Hospital";
    referralReason = "Severe condition requiring secondary hospital casualty or OPD evaluation today.";
  } else if (!fallbackDispensaryStatus.isOpen) {
    if (severity === "Moderate") {
      referralDestination = "ESIC Hospital";
      referralReason = `ESIS Dispensaries are currently closed (${fallbackDispensaryStatus.reason}). Guide caller to nearest ESIC Hospital casualty or urgent OPD today.`;
    } else {
      referralDestination = "104 Medical Team";
      referralReason = `ESIS Dispensaries are currently closed (${fallbackDispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    }
  } else {
    referralDestination = "ESIS Dispensary";
    referralReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
  }

  const fallbackUserTurns = history.filter((m) => m.role === "user" || m.sender === "user").length + 1;
  if (fallbackUserTurns < 3 && !isSevere) {
    referralDestination = null;
    referralReason = null;
  }

  const duration = nlp.detectedDuration || prevState.duration || "Reported today";

  let probingText = currentStep.question;
  if (!probingText.startsWith("Ask the IP:")) {
    probingText = `Ask the IP: "${probingText}"`;
  }
  probingText = enforceSingleQuestion(probingText);
  probingText = sanitizeClinicalQuestion(probingText, cleanInput, cleanInput);
  probingText = enforceSingleQuestion(probingText);

  return {
    probingQuestion: probingText,
    suggestedAnswers: currentStep.options,
    suspectedCondition: conditionLabel,
    isPsychiatric: false,
    severity,
    severityScore: severity === "High" ? 9 : severity === "Moderate" ? 6 : 3,
    referralDestination,
    referralReason,
    redFlagsDetected: isSevere ? ["Acute presentation / high severity reported"] : [],
    duration,
    isReadyForSummary: history.length >= 6 || isSevere,
    clinicalSummary: `Patient presents with ${conditionLabel}. Evaluated severity: ${severity}. Duration: ${duration}. Recommended Routing: ${referralDestination}.`,
  };
}
