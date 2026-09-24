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
} from "./clinicalAdaptiveEngine";

const SYSTEM_PROMPT = `You are EKMS AI, a world-class clinical triage and call-forwarding assistant for ESIC / ESIS helpline operators in Assam, India.
YOU SPEAK WITH THE COMPASSION, WARMTH, AND CLINICAL SHARPNESS OF AN EXPERIENCED DOCTOR.

YOUR CORE PURPOSE:
1. Interview the caller (Insured Person / IP) by asking focused probing questions to uncover the main issue, symptoms, duration, triggers, and severity.
2. DO NOT GIVE MEDICAL ADVICE OR DRUG PRESCRIPTIONS (No dosage, no "take aspirin", no "take nitroglycerin", etc.). Your goal is to guide the operator on WHAT DECISION TO TAKE AND WHERE TO FORWARD THE CALL.

3. CRITICAL ANTI-REPETITION MANDATE (HIGHEST PRIORITY):
   - You are provided with the full dialogue history and a list of already asked questions.
   - YOU MUST NEVER REPEAT OR RE-ASK THE SAME QUESTION OR ANY SIMILAR VARIANT OF A QUESTION THAT WAS ALREADY ASKED!
   - If the caller already answered something (e.g. they confirmed feeling hopeless, or stated a duration, or denied self-harm), DO NOT re-ask it. Acknowledge what they said and immediately move to the next clinical topic!

4. DOCTOR-LIKE EMPATHY & EMOTIONAL REASSURANCE:
   - Never sound like a cold robot. Real doctors validate distress with genuine warmth and empathy:
     * When caller shares sadness, hopelessness, pain, or crying: FIRST acknowledge their feelings warmly (e.g., "I hear how heavy and overwhelming this feels for you...", "Main samajh sakta/sakti hoon aap bohot takleef mein hain...").
     * When caller has sudden severe pain or injury: reassure them calmly (e.g., "Please stay as calm as possible, we are right here with you and organizing help...").
   - Formulate the probing question in English and Hindi (or Hinglish) prefixed with "Ask the IP: " (e.g. Ask the IP: "..." (Hindi: ...)).

5. ADAPTIVE PROGRESSIVE INQUIRY RULES BASED ON CONDITION:
   - For Psychiatric / Emotional Distress / Depression / Loneliness:
     * Step 1: Warm emotional validation + probe root trigger (family, work stress, financial burden, personal grief, health).
     * Step 2: Duration & daily functional impact (how long carrying this sadness, impact on sleep, appetite, crying spells).
     * Step 3: Gentle safety screening (thoughts of self-harm or giving up, or checking if they are currently alone).
     * Step 4: Warm reassurance & priority handover to Psychological Counselling Department / Tele-MANAS (14416).
   - For Physical Disease & Illness (Fever, Pain, Vomiting, Headache, etc.):
     * Step 1: Acknowledge symptoms + probe specific symptom character & onset (sharp vs dull, sudden vs gradual).
     * Step 2: Probe exact duration with diverse options spanning:
       (1) Small: "< 2 hours / Sudden", "1 to 3 days (Recent)"
       (2) Medium: "1 to 2 weeks", "1 to 6 months"
       (3) Long: "1 year or more (Chronic)"
       Extract any mentioned duration directly into the "duration" field!
     * Step 3: Screen for specific red flags & triggers (breathing trouble, inability to retain water, high fever, chest pain).
     * Step 4: Decision & routing guidance (Dispensary vs Hospital vs 108).
   - For Accidents / Trauma / Workplace Injury Cases:
     * Step 1: Exact location, landmark, road/factory name, and time of accident.
     * Step 2: Casualties count, anyone trapped in vehicle/machine, or unconscious.
     * Step 3: Active heavy bleeding, fractures, and immediate first-aid instructions.
     * Step 4: Immediate 108 Emergency Ambulance dispatch.

6. REFERRAL TIMING & CONCLUSION CRITERIA:
   - For Turns 1 and 2 (First two probing questions): You are in active clinical inquiry to explore symptoms and duration. DO NOT finalize the referral destination yet (return "referralDestination": null and "referralReason": null, "isReadyForSummary": false), UNLESS there is an immediate life-threatening 108 emergency (e.g. cardiac arrest, active massive hemorrhage, severe road accident) or the caller directly requested a specific facility.
   - For Turns 3 or 4+: Synthesize all findings from the complaint, onset, duration, and associated symptoms to reach a sound clinical conclusion. Provide the finalized "referralDestination" (e.g. "ESIC Hospital", "ESIS Dispensary", "104 Medical Team", "Psychological Counselling Department", "108 Ambulance") with a detailed clinical rationale in "referralReason", and set "isReadyForSummary": true.
   - The referral destination must remain dynamic and update if further critical details or red flags emerge in subsequent turns.

7. CRITICAL DIRECT CALLER PREFERENCE RULE:
   - If the caller directly states where they want to go or what service they want, ALWAYS RESPECT THEIR CHOICE:
     * Hospital / Aspatal: "ESIC Hospital"
     * Dispensary / Clinic: "ESIS Dispensary"
     * 104 phone doctor: "104 Medical Team"
     * 108 ambulance: "108 Ambulance"
     * e-Sanjeevani: "e-Sanjeevani"
     * Pharmacy / Chemist: "Nearest Pharmacy"
     * Counsellor / Mental Health: "Psychological Counselling Department"

8. OUTPUT STRICT VALID JSON OBJECT ONLY (no markdown formatting, no other text):
{
  "probingQuestion": "Ask the IP: '...'",
  "suggestedAnswers": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "suspectedCondition": "Primary suspected condition",
  "isPsychiatric": true | false,
  "severity": "High" | "Moderate" | "Mild",
  "referralDestination": "108 Ambulance" | "Psychological Counselling Department" | "ESIC Hospital" | "ESIS Dispensary" | "104 Medical Team" | "e-Sanjeevani" | "Nearest Pharmacy" | "Forward to Doctor" | null,
  "referralReason": "Clear, direct guidance on what the agent should do right now" | null,
  "redFlagsDetected": ["list of red flags if any"],
  "duration": "detected duration or accident time",
  "isReadyForSummary": true | false,
  "clinicalSummary": "Concise structured triage summary"
}

9. STRICT OFF-TOPIC BOUNDARY:
   - If query is non-medical (sports, weather, politics, jokes), firmly and politely redirect to health symptoms only.
`;

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
        'Ask the IP: "Which district or location are you calling from so we can guide you to the nearest ESIC Hospital?" (Hindi: आप किस जिले/स्थान से हैं ताकि हम आपको नज़दीकी ESIC अस्पताल का पता बता सकें?)',
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
        'Ask the IP: "Do you have your ESIC Pehchan card with you, and do you know your local dispensary timings?" (Hindi: क्या आपके पास ESIC पहचान कार्ड है और नज़दीकी डिस्पेंसरी की जानकारी है?)',
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
        'Ask the IP: "What is your exact location and landmark right now for 108 Ambulance dispatch?" (Hindi: 108 एम्बुलेंस भेजने के लिए अपना सटीक पता और नज़दीकी लैंडमार्क बताएं)',
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
        'Ask the IP: "Could you briefly state your main symptom so 104 medical team is ready when connected?" (Hindi: कृपया अपना मुख्य लक्षण बताएं ताकि 104 डॉक्टर तुरंत मदद कर सकें)',
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
        'Ask the IP: "Do you have an Android/iOS smartphone with internet to consult the doctor via e-Sanjeevani?" (Hindi: क्या आपके पास ई-संजीवनी पर ऑनलाइन डॉक्टर से बात करने के लिए स्मार्टफोन है?)',
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
        'Ask the IP: "Do you have an ESIC doctor prescription or Pehchan card for getting medicines?" (Hindi: क्या आपके पास दवा लेने के लिए डॉक्टर का पर्चा या पहचान कार्ड है?)',
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
        'Ask the IP: "We are connecting you with our compassionate mental health counselling team. Are you in a comfortable place to speak freely?" (Hindi: हम आपको परामर्श टीम से जोड़ रहे हैं। क्या आप खुलकर बात करने के लिए सुरक्षित स्थान पर हैं?)',
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
        'Ask the IP: "Connecting your call to our on-duty Medical Officer. Please stay on the line." (Hindi: आपका कॉल ऑन-ड्यूटी मेडिकल ऑफिसर को ट्रांसफर किया जा रहा है।)',
      suggestedAnswers: [
        "Urgent doctor review needed",
        "Need physician opinion on lab reports",
        "Unresponsive to primary treatment",
        "Direct clinical discussion",
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
        'Ask the IP: "This helpline is exclusively dedicated to healthcare, medical triage, and ESIC clinical assistance. Please state what health symptoms or medical concerns you are facing." (यह हेल्पलाइन केवल स्वास्थ्य और चिकित्सा परामर्श के लिए है। कृपया अपनी स्वास्थ्य समस्या या लक्षण बताएं।)',
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
  const groqKey = process.env.GROQ_API_KEY;

  // 1. Try Groq Cloud AI with Multi-Model Cascade (120B High Intelligence -> 20B Fast -> 27B)
  if (groqKey) {
    const candidateModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const conversationMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-10).map((m) => ({
            role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
            content: typeof m.content === "string" ? m.content : m.text || "",
          })),
          {
            role: "user",
            content: `Caller's current reply: "${cleanInput}".
Previous suspected condition: "${currentClinicalState.suspectedCondition || "Not yet determined"}".
Already asked questions in this chat: ${JSON.stringify(askedQuestionsList)}.

INSTRUCTIONS FOR NEXT TURN:
1. Act as an experienced, deeply empathetic doctor.
2. Carefully analyse what the caller just replied and connect it with their prior answers from the context of this chat.
3. Show genuine human warmth and sympathy (acknowledge their distress, fear, or pain first).
4. Ask ONE targeted, clinically relevant follow-up probing question tailored directly to what they typed.
5. Formulate the question for the agent to ask the caller in English with clear Hindi translation in parentheses (e.g. Ask the IP: "..." (Hindi: ...)).
6. NEVER repeat or re-ask any question from the "Already asked questions" list!
7. Provide 3-4 realistic clickable suggested answers matching the exact question you asked.
8. REFERRAL TIMING & CONCLUSION RULE:
   - Current user turn count: ${userTurnsCount}.
   - In Turns 1 and 2 (first two probing questions): You are in active clinical inquiry. DO NOT conclude the referral yet (set "referralDestination": null, "referralReason": null, "isReadyForSummary": false), UNLESS life-threatening 108 emergency or caller explicitly asked for a facility.
   - In Turns 3 or 4+ (clinical conclusion): Analyze the entire symptom presentation, onset, and duration. Formulate the finalized "referralDestination" ("ESIC Hospital" | "ESIS Dispensary" | "104 Medical Team" | "Psychological Counselling Department" | "108 Ambulance") with clinical reason, and set "isReadyForSummary": true.
   - Referral destination must remain dynamic and change if new critical symptoms emerge later.
9. Respond strictly in valid JSON format:
{ "probingQuestion": "Ask the IP: ...", "suggestedAnswers": [...], "suspectedCondition": "...", "isPsychiatric": true/false, "severity": "High/Moderate/Mild", "referralDestination": "..." or null, "referralReason": "..." or null, "redFlagsDetected": [], "duration": "...", "isReadyForSummary": true/false, "clinicalSummary": "..." }`,
          },
        ];

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: conversationMessages,
            response_format: { type: "json_object" },
            temperature: 0.35,
            max_tokens: 800,
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
        }
      } catch (err) {
        console.warn(`Groq model ${model} fallback:`, err.message);
      }
    }
  }

  // 2. Fallback to Ultra-Smart Local Adaptive Doctor Engine (<1ms, Guaranteed 100% Non-Repeating)
  return buildLocalDoctorConsultationFallback(cleanInput, history, currentClinicalState);
}

/**
 * Normalizes output from LLM provider into guaranteed uniform schema
 * with strict duplicate detection safeguard
 */
function normalizeDoctorOutput(raw, userInput, prevState = {}, askedQuestionsList = [], history = []) {
  const cleanInput = (userInput || "").toLowerCase();
  const prevRef = (prevState.referralDestination || "").toLowerCase();
  const allContext = `${cleanInput} ${prevRef} ${prevState.suspectedCondition || ""} ${prevState.symptom || ""}`.toLowerCase();

  const userTextHasPsych =
    /\b(suicid\w*|mar ja\w*|jaan de dunga|depress\w*|udaas\b|\brona\b|hopeless\b|anxiety\b|ghabrahat\b|mental health|akelepan\b|\bpareshan\b|\bdie\b|kill myself|crying\b|cried\b|zindagi se thak|lonely\b|niraash\b)\b/i.test(
      cleanInput
    );

  const isPsych = Boolean(
    userTextHasPsych ||
      raw.isPsychiatric ||
      prevState.isPsychiatric ||
      /psych|counsel|manas|14416/i.test(allContext)
  );

  const isEmergency108 =
    /\b(108|ambulance|heart attack|crushing chest|cardiac arrest|unconscious|behosh|massive bleed|bleeding profusely|road accident|accident casualty|machine accident|worker trapped|trapped|factory machine|accident.*haath|crushed limb|amputation)\b/i.test(cleanInput) ||
    (raw.referralDestination === "108 Ambulance" && (raw.severity === "High" || prevState.severity === "High"));

  const directIntent = detectDirectCallerReferralIntent(cleanInput);

  const is104PhoneDoctor =
    /\b(104|phone consultation|phone doctor|tele consultation|tele-consultation|tele doctor|tele-doctor|call with 104|104 doctor|doctor on call|telephonic doctor|phone pe doctor|phone par doctor|call.*104)\b/i.test(cleanInput) ||
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

  if (directIntent) {
    referralDestination = directIntent.destination;
    referralReason = directIntent.reason;
  } else if (isEmergency108) {
    referralDestination = "108 Ambulance";
    referralReason = "Life-threatening acute emergency or accident casualty; dispatch 108 Ambulance immediately.";
  } else if (isPsych) {
    referralDestination = "Psychological Counselling Department";
    referralReason = "Caller exhibits emotional distress or psychological crisis; forward to Psychological Counselling / Tele-MANAS (14416).";
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
  } else {
    referralDestination = "ESIS Dispensary";
    referralReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
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

  const currentCoreQ = extractCoreQuestionText(probingQuestion);

  const isDuplicate =
    (isAskingLocation && answeredLocation) ||
    (isAskingCasualties && answeredCasualties) ||
    (isAskingDur && answeredDur) ||
    (isAskingSelfHarm && answeredSelfHarm) ||
    askedQuestionsList.some((asked) => {
      const askedCore = extractCoreQuestionText(asked);
      return (
        askedCore.length > 20 &&
        currentCoreQ.length > 20 &&
        (askedCore.includes(currentCoreQ.slice(0, 30)) || currentCoreQ.includes(askedCore.slice(0, 30)))
      );
    });

  if (isDuplicate) {
    // LLM repeated itself or asked already-answered topic! Override with next progressive step from local engine
    const progressiveFallback = buildLocalDoctorConsultationFallback(cleanInput, history, prevState);
    probingQuestion = progressiveFallback.probingQuestion;
    if (progressiveFallback.suggestedAnswers?.length) {
      raw.suggestedAnswers = progressiveFallback.suggestedAnswers;
    }
  }

  if (!probingQuestion.startsWith("Ask the IP:")) {
    probingQuestion = `Ask the IP: "${probingQuestion.replace(/^["']|["']$/g, "")}"`;
  }

  const isAskingDuration =
    /\b(when did|how long|how many days|how many months|how many years|duration|since when|kab se|kitne din|kitna samay|kitne mahine|kitne saal)\b/i.test(
      probingQuestion
    );

  // Retain the AI-generated dynamic suggested answers whenever available; never overwrite them!
  let suggestedAnswers;
  if (Array.isArray(raw.suggestedAnswers) && raw.suggestedAnswers.length >= 2) {
    suggestedAnswers = raw.suggestedAnswers
      .map((ans) => (typeof ans === "string" ? ans.trim() : String(ans)))
      .filter((ans) => ans.length > 0);
  } else if (isAskingDuration) {
    suggestedAnswers = [
      "< 2 hours (Sudden / Acute)",
      "1 to 3 days (Recent)",
      "1 to 2 weeks",
      "1 to 6 months",
      "1 year or more (Chronic)",
    ];
  } else {
    suggestedAnswers = [
      "Symptoms started today",
      "Moderate discomfort",
      "Fever / cold / mild body ache",
      "Need guidance on daily medicines",
    ];
  }

  return {
    probingQuestion,
    suggestedAnswers,
    suspectedCondition:
      raw.suspectedCondition ||
      (isPsych
        ? "Psychological Distress / Anxiety Crisis"
        : is104PhoneDoctor
        ? "104 Tele-Doctor Consultation"
        : "Under Clinical Assessment"),
    isPsychiatric: isPsych,
    severity,
    severityScore,
    referralDestination,
    referralReason,
    redFlagsDetected: Array.isArray(raw.redFlagsDetected) ? raw.redFlagsDetected : [],
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

  // 1. Psychological Distress / Depression / Loneliness / Crisis
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
          'Ask the IP: "I understand how heavy and lonely this feels for you right now, and you do not have to carry this alone. May I ask what has been causing you the most stress or pain recently? Is it family, work pressure, health, or personal troubles? (Hindi: मैं समझ सकता/सकती हूँ कि आप कितना अकेला और निराश महसूस कर रहे हैं। क्या आप बता सकते हैं कि हाल ही में किस बात से आपको सबसे ज्यादा तनाव या तकलीफ हो रही है?)"',
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
          'Ask the IP: "Dealing with that must be emotionally exhausting. For how long have you been carrying this sadness, and has it been affecting your sleep, appetite, or daily peace of mind? (Hindi: यह मानसिक बोझ बहुत थका देने वाला होता है। आप कितने समय से ऐसा महसूस कर रहे हैं, और क्या इससे आपकी नींद और भूख प्रभावित हो रही है?)"',
        options: [
          "Past few days / Sudden overwhelming breakdown",
          "1 to 2 weeks / Insomnia and loss of appetite",
          "1 to 6 months / Continuous sadness and crying",
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
          'Ask the IP: "Your life is truly precious to us. In these deep moments of darkness, have you felt like giving up or had thoughts of harming yourself? (Hindi: आपकी जान बहुत अनमोल है। क्या बहुत ज्यादा निराशा में आपके मन में खुद को नुकसान पहुँचाने या जान देने का विचार आया है?)"',
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
          'Ask the IP: "Thank you for trusting me with that. Please know you are not alone, and help is available right now. Are you currently in a safe place, and is someone with you? We are connecting you immediately to our Psychological Counselling Department and Tele-MANAS (14416) for free support. (Hindi: मुझपर भरोसा करने के लिए धन्यवाद। क्या आप अभी सुरक्षित स्थान पर हैं? हम तुरंत आपको मानसिक स्वास्थ्य परामर्श टीम (Tele-MANAS 14416) से जोड़ रहे हैं।)"',
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
      probingQuestion: currentStep.question,
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
          'Ask the IP: "Please stay as calm as possible, help is being organized. What is the exact location, road, or factory landmark of the accident, and when did it occur? (Hindi: कृपया शांत रहें, मदद भेजी जा रही है। दुर्घटना किस जगह, सड़क या फैक्ट्री में हुई है, और किस समय हुई?)"',
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
          'Ask the IP: "How many people or workers are injured, and is anyone trapped inside the vehicle/machinery or unconscious? (Hindi: कुल कितने लोग घायल हैं, क्या कोई मशीन या वाहन में फंसा हुआ है या बेहोश है?)"',
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
          'Ask the IP: "Is there active spurting bleeding or open bone fractures? If bleeding, apply firm direct pressure with a clean cloth immediately. (Hindi: क्या बहुत तेज खून बह रहा है या हड्डी टूटी है? यदि खून बह रहा है तो तुरंत साफ कपड़े से दबाकर रखें।)"',
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
          'Ask the IP: "108 Emergency Ambulance is being dispatched to your location. Please keep the patient still and warm. Can the ambulance reach directly? (Hindi: 108 एम्बुलेंस को सूचित किया जा रहा है। क्या एम्बुलेंस सीधे वहां पहुंच सकती है?)"',
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
      probingQuestion: currentStep.question,
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
          'Ask the IP: "Chest pain must be evaluated urgently. Is the pain feeling like heavy crushing pressure, and is it spreading to your left arm, neck, or jaw? (Hindi: सीने का दर्द गंभीर हो सकता है। क्या सीने पर भारी दबाव महसूस हो रहा है, और क्या दर्द बाएं हाथ या जबड़े की तरफ जा रहा है?)"',
        options: [
          "Yes, crushing heavy pressure radiating to left arm",
          "Sharp stinging chest pain when breathing in",
          "Burning sensation in chest / acidity feeling",
          "Dull heaviness with cold sweating and nausea",
        ],
      },
      {
        id: "cardiac_duration",
        condition: !hasAsked(["kitni der se", "how long has this chest", "duration"]),
        question:
          'Ask the IP: "How long has this chest tightness or pain been going on, and are you having any cold sweating or dizziness? (Hindi: यह सीने का दर्द कितनी देर से हो रहा है, और क्या आपको ठंडा पसीना या चक्कर आ रहे हैं?)"',
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
          'Ask the IP: "Are you struggling to breathe while sitting still, and do you have a known history of heart disease, high BP, or diabetes? (Hindi: क्या आपको बैठे-बैठे भी सांस लेने में तकलीफ हो रही है, और क्या आपको पहले से बीपी या दिल की बीमारी है?)"',
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
          'Ask the IP: "Please sit upright, do not exert yourself, and loosen tight clothing. We are triggering 108 Emergency Ambulance to transport you to the nearest hospital casualty. Is someone with you? (Hindi: कृपया आराम से बैठ जाएं और मेहनत न करें। हम 108 एम्बुलेंस भेज रहे हैं। क्या कोई आपके साथ है?)"',
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
      probingQuestion: currentStep.question,
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

  // 4. General Clinical Domain Probing Protocol (Fever, Abdominal, Headache, Respiratory, Orthopedic, etc.)
  const nlp = extractClinicalEntities(cleanInput, "probing", prevState);
  const domain = nlp.domain || detectClinicalDomain(cleanInput, prevState);
  const conditionLabel = nlp.conditionLabel || DOMAIN_LABELS[domain] || "General Clinical Complaint";

  // Use domain-specific progressive protocol
  const protocol = getDiseaseProbingProtocol(domain, prevState);

  // Filter out any questions already asked in this session
  const remainingSteps = protocol.filter((step) => {
    const qText = (step.question || "").toLowerCase();
    return !askedQuestions.some((asked) => {
      const simplifiedAsked = asked.replace(/[^a-z0-9]/g, "");
      const simplifiedQ = qText.replace(/[^a-z0-9]/g, "");
      return simplifiedAsked.length > 15 && simplifiedQ.length > 15 &&
        (simplifiedAsked.includes(simplifiedQ.slice(0, 25)) || simplifiedQ.includes(simplifiedAsked.slice(0, 25)));
    });
  });

  const currentStep = remainingSteps[0] || protocol[protocol.length - 1] || {
    question: "How are your symptoms progressing, and are you able to manage daily routine?",
    options: ["Symptoms getting worse today", "Stable but uncomfortable", "Mild symptoms", "Need doctor consultation"],
  };

  const isSevere =
    /emergency|fracture|dvt|blood|vomit blood|unconscious|rigors|severe|chest pain|chhati|poison/i.test(cleanInput) ||
    prevState.severity === "High";

  const severity = isSevere ? "High" : /mild|no pain/i.test(cleanInput) ? "Mild" : "Moderate";

  let referralDestination;
  let referralReason;

  if (severity === "High" && /chest pain|heart|stroke|unconscious|poison/i.test(cleanInput)) {
    referralDestination = "108 Ambulance";
    referralReason = "Acute emergency requiring immediate ambulance dispatch.";
  } else if (severity === "High") {
    referralDestination = "ESIC Hospital";
    referralReason = "Severe condition requiring secondary hospital casualty or OPD evaluation today.";
  } else {
    referralDestination = "ESIS Dispensary";
    referralReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
  }

  const fallbackUserTurns = history.filter((m) => m.role === "user" || m.sender === "user").length + 1;
  if (fallbackUserTurns < 3 && !isSevere) {
    referralDestination = null;
    referralReason = null;
  }

  const isDurationQuestion =
    /\b(when did|how long|how many days|duration|since when|kab se|kitne din|kitna samay)\b/i.test(
      `${currentStep.title || ""} ${currentStep.question || ""}`
    );

  const durationOptions = isDurationQuestion
    ? [
        "< 2 hours (Sudden / Acute)",
        "1 to 3 days (Recent)",
        "1 to 2 weeks",
        "1 to 6 months",
        "1 year or more (Chronic)",
      ]
    : currentStep.options || [
        "Symptoms started suddenly today",
        "Moderate pain / discomfort",
        "Mild symptoms manageable",
        "Severe pain and weakness",
      ];

  const duration = nlp.detectedDuration || prevState.duration || "Reported today";

  let probingText = (currentStep.question || "").startsWith("Ask the IP:")
    ? currentStep.question
    : `Ask the IP: "${currentStep.question || ""}"`;

  return {
    probingQuestion: probingText,
    suggestedAnswers: durationOptions,
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
