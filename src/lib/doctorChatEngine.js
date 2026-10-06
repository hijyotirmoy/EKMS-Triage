// EKMS AI Call Triage & Forwarding Assistant
// Advanced Clinical Probing Engine with Doctor-like Empathy, Context Analysis & Anti-Repetition
// Detects physical and psychiatric conditions, screens for suicidal ideation/depression,
// and recommends call routing (108 Ambulance / ESIC Hospital / ESIS Dispensary / 104 Health Helpline / Counselling Department)
// Strictly NO medical prescription or doctor treatment advice.

import {
  extractClinicalEntities,
  detectClinicalDomain,
  DOMAIN_LABELS,
  getDiseaseProbingProtocol,
} from "./clinicalAdaptiveEngine.js";
import { getDispensaryOperatingStatus, getHospitalOpdOperatingStatus, sanitizeSymptomOrCondition, isLifeThreateningAmbulanceCase, stripNegatedPhrases, deduplicateRedFlags } from "./triageEngine.js";
import { groqChatCompletion } from "./groqPool.js";
import { executeCentralizedLlmProxy } from "./llmProxy.js";
import { buildLearnedPromptSnippet } from "./feedbackLearningEngine.js";

const SYSTEM_PROMPT = `You are EKMS AI, a world-class clinical triage and call-forwarding assistant for ESIC / ESIS helpline operators in Assam, India.
YOU SPEAK WITH THE COMPASSION, WARMTH, AND CLINICAL SHARPNESS OF AN EXPERIENCED DOCTOR.

CORE CLINICAL RULES:
1. FIRST UNDERSTAND THE MAIN CONDITION & COMPLAINT:
   - When a caller describes a situation, event, incident, or symptom (e.g. "I slipped from the car", "I fell down", "I have pain in my side", "My chest is feeling heavy"), your FIRST PRIORITY is to understand the EXACT MAIN CONDITION, INJURY, PAIN LOCATION, OR SYMPTOMS.
   - Clarify where they got hurt, where they feel pain, or what exact physical difficulty they are experiencing.
   - DO NOT start by asking "Since when have you had this?" or asking about duration before understanding what happened to the patient and what their main condition is!
2. NATURAL CLINICAL QUESTION FLOW:
   - Step 1: Clarify and understand Main Complaint, Specific Symptoms, Pain Location, or Injury (e.g. "Where are you feeling pain or got injured, and what symptoms do you have?").
   - Step 2: Emergency Red Flags & Associated Signs (e.g. bleeding, inability to move limbs, head strike, breathing trouble, dizziness, high fever).
   - Step 3: Functional Impact & Clinical Probing (e.g. mobility, ability to stand/walk, fluid retention, speech effort) and onset/duration if not yet clear.
   - Step 4: Final referral recommendation.
3. ONE-QUESTION-AT-A-TIME: Ask EXACTLY ONE single, clear clinical question per turn. Never combine multiple inquiries.
4. LANGUAGE PROTOCOL (ENGLISH + HINGLISH ONLY):
   - Formulate the probing question in English, followed by a concise Romanized Hinglish translation in parentheses:
     Format: Ask the IP: "<English Question>" (Hinglish: <Romanized Hinglish Question>)
   - DO NOT USE DEVANAGARI HINDI SCRIPT. Use ONLY English and Latin-script Hinglish!
5. RELEVANT SUGGESTED ANSWERS: Provide 3 to 4 realistic suggestedAnswers in English/Hinglish directly answering your exact single question.
6. IDENTITY ASSUMPTION: Assume caller is conscious and is the patient (IP) themselves unless they explicitly state calling for a family member. NEVER ask "Are you conscious?".
7. ANTI-REPETITION: Never repeat or re-ask questions that were already answered in the chat.
8. EMPATHY & EMOTIONAL REASSURANCE:
   - For distress, pain, injury, or suicidal crisis: Express immediate heartfelt sympathy and reassurance before asking your question.
9. 6-TIER LOGICAL ROUTING HIERARCHY (Between 6:00 AM and 6:00 PM):
   Tier 1. 108 Ambulance Services (HIGH SEVERITY 9 & EMERGENCY):
      - In the majority of cases where severity is 9 or 10, dispatch 108 Emergency Ambulance.
      - However, for Severity 9, if the condition is explicitly NOT too severe (patient can speak normally, manageable pain, minor superficial scratch, stable condition without airway, circulatory, or traumatic collapse), forward to others (ESIC Hospital / 104 Health Helpline).
      - Always dispatch 108 Ambulance immediately for:
        * Heavy bleeding, severe cut, work injury, and cut & bleeding (acute traumatic injuries or deep bleeding at work MUST dispatch 108 even if caller reports manageable).
        * Severe breathing difficulty / gasping for air / cyanosis.
        * Unconsciousness / collapse / unresponsive.
        * Uncontrollable heavy bleeding.
        * Major trauma / serious road crash / fall from height / factory or industrial machinery accident.
        * Prolonged seizures (>5 min) or anaphylaxis.
        * Crushing chest pain / cardiac arrest.
        * Explicit caller request for ambulance.
   Tier 2. 104 Health Helpline (Priority: Tele-Consultation, Mental Health & General Guidance): Medical advice, telephone doctor consultation, emotional support, counselling, or HIV/AIDS/STI confidential information over the phone.
   Tier 3. ESIS Dispensary (Priority: Primary / Routine Care): Basic outpatient (OPD) services within standard working hours (10:00 AM – 4:00 PM).
   Tier 4. ESIC Hospital (Priority: Secondary / Specialist Care): Advanced, specialized, high acuity fever/illness, or inpatient care within ESIC network (OPD 10 AM - 4 PM, IPD & Casualty 24x7).
   Tier 5. ESI Tie-up Hospital (Priority: Empanelled Private Care): Beneficiary needs private hospital treatment under ESI empanelment (Inpatient IPD emergency, off-hours emergency, or direct referral).
   Tier 6. Dist Hosp (Priority: Public Healthcare outside ESIC): Beneficiary needs public healthcare services outside ESIC network (non-ESIC public admissions, general public specialist care, child immunization).
10. NON-DOCTOR TRIAGE PROTOCOL (NO DISEASE DIAGNOSES, NO MEDICINES):
   - We are triage helpline call operators, NOT diagnosing doctors.
   - NEVER diagnose or hypothesize medical diseases, pathologies, or syndromes unless caller explicitly named that disease in their own words.
   - Describe condition ONLY using reported symptom areas (e.g. 'Abdominal Pain / Cramping', 'Chest Discomfort', 'High Fever', 'Throbbing Headache', 'Limb Injury').
   - NEVER suggest or name specific medicines, drugs, tablets, or injections.
11. NEVER ASK NUMERICAL SEVERITY OR SCALE QUESTIONS:
   - NEVER ask the caller or patient to rate their pain or condition on a scale of 1 to 10 (e.g. "On a scale of 1 to 10...", "1-10 ki scale par...", "rate the severity").
   - Real patients cannot rate numbers accurately.
   - Instead, ALWAYS ask clinical, functional, or descriptive probing questions (e.g. "Are you able to stand and walk on your own, or are you too weak to get out of bed?", "Are you able to keep water down or is everything coming back up?", "Is the pain manageable or so intense that you cannot rest or move?").
   - Internally deduce and calculate the severity (High / Moderate / Mild and score 1-10) based on their answers, red flags, and functional impairment.
12. PROBING FOR COMORBIDITIES & MEDICATIONS (NO DEDICATED ALLERGY QUESTIONS):
   - During the conversation without breaking the conversational flow (typically around question 6 or 7, flexible based on flow), the assistant should inquire about pre-existing COMORBIDITIES and any current MEDICATIONS:
     -> Ask naturally: "Do you have any pre-existing health conditions such as high blood pressure, diabetes/sugar, asthma, heart, or kidney disease, and are you currently taking any medicines for them?" (Hinglish: "Kya aapko pehle se diabetes, high BP, asthma ya dil ki koi bimari hai, aur kya aap koi regular dawai lete hain?")
     -> If caller mentions taking any acute medication for their current symptom (such as Paracetamol, antacid, vomiting pill like Ondansetron, or painkiller), note the medicine and whether it provided relief.
   - DO NOT ask dedicated or isolated allergy questions. Remove allergy-specific questions completely.
   - Actively detect and extract any mentioned comorbidities (Diabetes, Hypertension, Asthma, Cardiac, Kidney, Thyroid) and medications into the structured output.

13. DAYTIME HOSPITAL PROBING & BALANCED 108 REFERRALS:
   - In daytime hours (6:00 AM - 6:00 PM), hospitals and OPD facilities are open and operational.
   - DO NOT send to 108 immediately on turns 1 and 2 for general complaints (pain, vomiting, fever, limb cuts, wounds).
   - First ask probing questions to find out whether the condition is a true life-threatening emergency or manageable at a hospital.
   - If symptoms are manageable or stable, steer toward ESIC Hospital or ESIS Dispensary rather than defaulting to 108.
   - Keep responses concise, direct, and fast.

OUTPUT STRICT VALID JSON OBJECT ONLY (no markdown, no backticks):
{
  "probingQuestion": "Ask the IP: '...' (Hinglish: ...)",
  "suggestedAnswers": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "suspectedCondition": "Reported symptom area only (e.g. 'Abdominal Pain / Cramps'); NEVER diagnose a disease",
  "isPsychiatric": true | false,
  "severity": "High" | "Moderate" | "Mild",
  "referralDestination": "108 Ambulance" | "104 Health Helpline" | "ESIS Dispensary" | "ESIC Hospital" | "Nearest Tie-Up Facility" | "Govt District Hospital" | null,
  "referralReason": "Clear action for operator" | null,
  "redFlagsDetected": ["ONLY acute red flags explicitly reported by caller; NEVER include denied symptoms like 'no/nehi fever'"],
  "duration": "detected duration or accident time",
  "comorbidity": "Known chronic conditions (e.g. Diabetes, Hypertension, Asthma) or 'None reported by caller'",
  "medications": "Specific medicines taken or leave empty string '' if none / no answer",
  "isReadyForSummary": true | false,
  "clinicalSummary": "Concise symptom-based triage summary in English without diagnosing diseases"
}`;

/**
 * Strips raw clock times (e.g. 10:30 AM, 14:00) and calendar dates (e.g. 29/09/2026, 2026-09-29)
 * from input text so they are NOT mistakenly extracted as clinical duration or symptom onset.
 */
export function stripClockAndCalendarTimestamps(text) {
  if (!text || typeof text !== "string") return "";
  return text
    // Strip ISO dates: 2026-09-29, 2026/09/29
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ")
    // Strip DD/MM/YYYY or MM/DD/YYYY: 29/09/2026, 29-09-2026, 29.09.2026
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ")
    // Strip 12h/24h timestamps: 10:30 AM, 14:25, 09:15:30 pm
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
    // Strip standalone am/pm times: at 10 am, 4 pm
    .replace(/\b(?:at\s+)?\d{1,2}\s*(?:am|pm)\b/gi, " ")
    // Strip explicit labels: "time: 10:30", "date: 29-09-2026", "timestamp: ..."
    .replace(/\b(?:date|time|timestamp)[:\s]+\S+/gi, " ")
    // Strip month names with day and year: 29th September 2026, Sep 29 2026
    .replace(/\b(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s*\d{2,4})?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
      destination: "104 Health Helpline",
      reason:
        "Caller requested tele-doctor phone consultation; transfer call queue to 104 Health Helpline.",
      suspectedConditionSuffix: "104 Tele-Doctor Consultation",
      suggestedQuestion:
        'Ask the IP: "Could you briefly state your main symptom so 104 Health Helpline doctor is ready when connected?" (Hinglish: "Kripya apna main symptom batayein taaki 104 helpline doctor connect hote hi madad kar sake?")',
      suggestedAnswers: [
        "Fever / cold / mild body ache",
        "Stomach upset / nausea / weakness",
        "Need advice on existing BP / Sugar medicine",
        "General health consultation",
      ],
    };
  }

  // 5. Direct Tie-Up Hospital Intent
  if (
    /\b(tie up|tie-up|empanelled hospital|empanelled facility|private hospital under esic|cashless tie up|tie up hospital)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "Nearest Tie-Up Facility",
      reason:
        "Caller requested empanelled tie-up facility; guide caller to nearest Empanelled Tie-Up Hospital under ESI guidelines.",
      suspectedConditionSuffix: "Empanelled Tie-Up Care",
      suggestedQuestion:
        'Ask the IP: "Do you have an ESIC Hospital referral or need cashless emergency admission at an empanelled hospital?" (Hinglish: "Kya aapke paas ESIC Hospital ka referral letter hai ya empanelled hospital me emergency admission chahte hain?")',
      suggestedAnswers: [
        "Have ESIC Hospital referral letter",
        "Need emergency inpatient (IPD) admission",
        "Seeking nearest empanelled hospital address",
        "Pehchan card holder seeking tie-up care",
      ],
    };
  }

  // 6. Direct District Hospital / Public Healthcare Intent
  if (
    /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|child immunization|vaccination|tika karan)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "Govt District Hospital",
      reason:
        "Caller requested public healthcare outside ESIC network (public hospital, civil hospital, or child immunization); guide to nearest Govt District Hospital.",
      suspectedConditionSuffix: "Public Healthcare / District Hospital",
      suggestedQuestion:
        'Ask the IP: "Which district or town are you located in so we can provide directions to the nearest Govt District Hospital?" (Hinglish: "Aap kis district ya location me hain taaki hum nearest Govt District Hospital ka pata de sakein?")',
      suggestedAnswers: [
        "Need directions to Govt District Hospital",
        "Seeking child immunization / vaccination",
        "Need public hospital admission assistance",
        "Non-ESIC public healthcare inquiry",
      ],
    };
  }

  // 7. Direct Mental Health / Counselling Intent
  if (
    /\b(counsellor|psychiatrist|counseling|counselling|dimag ke doctor|mental doctor|depression doctor|manorog|tele manas|tele-manas|14416)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "104 Health Helpline",
      reason:
        "Caller requested psychological counselling / emotional support; forward to 104 Health Helpline for 24x7 doctor and counseling on phone.",
      suspectedConditionSuffix: "Psychological Counselling Support",
      suggestedQuestion:
        'Ask the IP: "We are connecting you with our compassionate health and counselling helpline. Are you in a comfortable place to speak freely?" (Hinglish: "Hum aapko 104 helpline se connect kar rahe hain. Kya aap bina kisi jhijhak ke akele me baat karne ke liye safe jagah par hain?")',
      suggestedAnswers: [
        "Yes, please connect to 104 counsellor now",
        "Experiencing extreme stress and anxiety",
        "Feeling deeply depressed and hopeless",
        "Need confidential counselling",
      ],
    };
  }

  // 9. Direct HIV / AIDS / Sexual Disease Intent
  if (
    /\b(naco|1097|hiv|aids|gupt rog|sexual health|sexually transmitted|std\b|sti\b|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(
      clean
    )
  ) {
    return {
      destination: "104 Health Helpline",
      reason:
        "Caller inquiring about HIV/AIDS, STI, or sexual health; transfer call to 104 Health Helpline for 24x7 confidential doctor guidance and counseling.",
      suspectedConditionSuffix: "HIV / AIDS & Sexual Health Guidance",
      suggestedQuestion:
        'Ask the IP: "Your consultation is completely confidential. Are you seeking free testing information, counseling, or emergency guidance?" (Hinglish: "Aapki baatcheet bilkul confidential hai. Kya aap free test, counselling ya emergency guidance chahte hain?")',
      suggestedAnswers: [
        "Need confidential counseling & testing center info",
        "Recent possible exposure — need emergency PEP guidance (< 72 hrs)",
        "Experiencing symptoms of sexually transmitted infection",
        "Need doctor consultation on 104 helpline",
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

  // Retrieve any learned feedback rules from human agents relevant to current caller presentation
  const learnedSnippet = await buildLearnedPromptSnippet(
    `${cleanInput} ${currentClinicalState.suspectedCondition || ""}`,
    "probing"
  );

  // =========================================================================
  // ULTRA-FAST AI ENGINE CASCADE:
  // Priority 1: Groq Multi-Key Pool (llama-3.1-8b-instant / llama-3.3-70b-versatile, ~150-350ms)
  // Priority 2: Google Gemini 2.0 Flash (Direct, ~400-600ms)
  // Priority 3: Progressive Deterministic Clinical Engine (< 5ms)
  // =========================================================================

  const conversationMessages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}

CRITICAL ANTI-REPETITION & PROGRESSION DIRECTIVES:
1. REVIEW HISTORY: Never re-ask or rephrase questions already answered in previous turns.
2. FIRST UNDERSTAND MAIN COMPLAINT & SYMPTOMS: On initial turns or when a caller describes a situation/incident/pain, focus on clarifying the injury, pain location, or specific symptoms. DO NOT blindly ask duration/time first.
3. CONVERSATION ADVANCEMENT:
   - Turn 1: Main complaint, symptoms, pain location, or injury details.
   - Turn 2: Key Associated Symptoms & Emergency Red Flags (e.g. bleeding, inability to move, breathing trouble, dizziness, head strike, fever).
   - Turn 3: Functional impact & clinical probing (e.g. mobility, ability to keep fluids/food, speech effort, breathing distress) and onset/duration if still needed. NEVER ask the caller to rate on a 1-10 scale; deduce severity internally.
   - Turn 4+: Set "isReadyForSummary": true and provide clear final referral.
4. NEVER ASK NUMERICAL SEVERITY (1-10 SCALE): Ask functional/descriptive clinical questions only.
5. ADAPT TO SYMPTOM CLARIFICATION: If the caller updates, clarifies, or changes their symptom (e.g. from general stomach pain to 'periods cramps' or vice-versa), immediately adapt the suspected condition to the clarified symptom (e.g. 'Dysmenorrhea / Menstrual Cramps') and ask probing questions specifically tailored to that complaint. NEVER assume chest pain or unrelated conditions unless explicitly stated by the caller.
6. NEVER HALLUCINATE CHEST PAIN: Only assess cardiac conditions if the caller affirmatively reported chest pain or heart symptoms.
7. Keep questions concise and empathetic in format: Ask the IP: "..." (Hinglish: "...")`,
    },
    ...history.slice(-8).map((m) => ({
      role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
      content: typeof m.content === "string" ? m.content : m.text || "",
    })),
    {
      role: "user",
      content: `Caller: "${cleanInput}".
Clinical Context: Current Condition: "${currentClinicalState.suspectedCondition || "Under Assessment"}", Known Duration: "${currentClinicalState.duration || "Not specified"}", RedFlags: ${JSON.stringify(currentClinicalState.redFlagsDetected || [])}, Turn: ${userTurnsCount}.
Already Asked Questions: ${JSON.stringify(askedQuestionsList)}.${learnedSnippet ? `\n\n${learnedSnippet}` : ""}

Respond strictly in valid JSON format:
{ "probingQuestion": "Ask the IP: ... (Hinglish: ...)", "suggestedAnswers": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "suspectedCondition": "...", "isPsychiatric": false, "severity": "High/Moderate/Mild", "referralDestination": "..." or null, "referralReason": "..." or null, "redFlagsDetected": [], "duration": "...", "comorbidity": "Known chronic conditions (Diabetes, Hypertension, Asthma) or None reported by caller", "medications": "Medicines taken or empty string '' if none / no answer", "isReadyForSummary": false, "clinicalSummary": "..." }`,
    },
  ];

  // 1. Direct Groq Fast Multi-Key Pool (Rotates across all keys on 429/failures)
  try {
    const groqResult = await groqChatCompletion({
      messages: conversationMessages,
      model: "qwen/qwen3.8-27b",
      candidateModels: ["qwen/qwen3.8-27b"],
      temperature: 0.2,
      max_tokens: 450,
      timeoutMs: 2500,
      maxAttempts: 3,
    });

    if (groqResult?.content) {
      const parsed = JSON.parse(groqResult.content);
      if (parsed && (parsed.probingQuestion || parsed.clinicalSummary)) {
        return normalizeDoctorOutput(parsed, cleanInput, currentClinicalState, askedQuestionsList, history);
      }
    }
  } catch (groqErr) {
    console.warn("[DoctorChat] Groq pool notice:", groqErr.message);
  }

  // 2. Direct Gemini Flash (Fallback if all Groq keys are exhausted)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const promptText = `${SYSTEM_PROMPT}\n\nCaller: "${cleanInput}"\nContext: Condition: "${currentClinicalState.suspectedCondition || "Not yet determined"}", Turn: ${userTurnsCount}\nAlready asked: ${JSON.stringify(askedQuestionsList)}\n${learnedSnippet ? `\n${learnedSnippet}` : ""}\nStrictly return JSON object with anti-repetition.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 600 },
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
      }
    } catch (geminiErr) {
      console.warn("[DoctorChat] Gemini fallback notice:", geminiErr.message);
    }
  }

  // 3. Local Progressive Clinical Engine (<5ms, 100% accurate, zero network delay)
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

  // 27. Pain severity & character (Descriptive & functional, no numerical ratings)
  if (/\b(pain|dard|severe|sharp|ache|burning|throbbing|intensity)\b/i.test(q)) {
    return [
      "Severe unbearable pain — cannot move or rest",
      "Continuous sharp pain, worsens on movement",
      "Moderate throbbing ache, manageable with rest",
      "Mild discomfort / manageable dull ache",
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

  // Intercept and rewrite any numerical severity / scale of 1 to 10 questions into functional clinical probing
  const isScaleOf10Question = /\b(scale of 1 (?:to|-) ?10|1 to 10 scale|1 se 10|1-10 ki scale|rate your (?:pain|severity|weakness|condition|fever|symptom) on a scale|scale of 1-10|rate (?:it|this|the pain|the severity) on a scale|scale of 1 to 5|1 to 5 scale|scale par|on a scale of|rate the severity|rate your pain)\b/i.test(questionText);

  if (isScaleOf10Question) {
    const contextCombined = `${cleanInput} ${allContext}`.toLowerCase();
    if (/\b(dizzy|chakkar|weakness|kamzori|faint|vomit|ulti|fluid|dehydrat|nausea)\b/i.test(contextCombined)) {
      return 'Ask the IP: "Are you able to stand and walk safely on your own, or are you feeling too weak to get out of bed?" (Hinglish: "Kya aap bina sahare khade ho kar chal pa rahe hain ya itni kamzori hai ki utha nahi ja raha?")';
    } else if (/\b(chest|chhati|heart|breath|saans|asthma)\b/i.test(contextCombined)) {
      return 'Ask the IP: "Are you able to speak full sentences comfortably, or is the breathing difficulty and chest discomfort making it hard to talk?" (Hinglish: "Kya aap aasaani se bol pa rahe hain ya saans phoolne aur seene me dabav ki wajah se bolna mushkil ho raha hai?")';
    } else if (/\b(pain|dard|headache|sar dard|stomach|pet dard|wound|chot|injury|fracture|burn)\b/i.test(contextCombined)) {
      return 'Ask the IP: "Is the pain preventing you from moving or resting comfortably, or is it manageable with rest?" (Hinglish: "Kya dard ki wajah se hilna-dulna ya aaram karna mushkil ho raha hai ya aaram karne se sehan ho raha hai?")';
    } else if (/\b(fever|bukhar|shivering|thand|chills)\b/i.test(contextCombined)) {
      return 'Ask the IP: "Do you have severe shivering and chills, or are you able to eat and drink fluids normally?" (Hinglish: "Kya bukhar ke saath tez kapkapi hai ya aap theek se kha-pee pa rahe hain?")';
    } else {
      return 'Ask the IP: "How is this condition affecting your daily activities or ability to move around?" (Hinglish: "Is takleef ki wajah se aapke rozmara ke kaam ya chalne-firne me kitni dikkat ho rahi hai?")';
    }
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
 * Extracts clean, professional comorbidity findings from text
 */
export function extractComorbiditiesFromText(text = "", existingComorbidity = null) {
  if (!text) {
    return existingComorbidity && !/^(none|nil|no pre|none reported)/i.test(existingComorbidity)
      ? existingComorbidity
      : "";
  }
  const lower = text.toLowerCase();

  if (
    /\b(no\s+(?:known\s+)?comorbidit(?:y|ies)|no\s+(?:pre-existing|chronic|prior)\s+(?:condition|illness|disease|history)|koi\s+purani\s+bimari\s+nahi|koi\s+bimari\s+nahi|no\s+bp\s+sugar|na\s+sugar\s+na\s+bp|none|nil|negative)\b/i.test(
      lower
    )
  ) {
    return "";
  }

  const conditions = [];

  if (/\b(diabet(?:es|ic)|sugar|madhumeh|high blood sugar|type\s*2\s*diabetes|type\s*1\s*diabetes)\b/i.test(lower)) {
    conditions.push("Diabetes / High Blood Sugar");
  }
  if (/\b(hypertension|high\s*bp|blood\s*pressure|high\s*pressure|uchh\s*raktchap)\b/i.test(lower)) {
    conditions.push("Hypertension / High BP");
  }
  if (/\b(asthma|damah|dama\b|wheezing|copd|respiratory\s*disease)\b/i.test(lower)) {
    conditions.push("Bronchial Asthma / Respiratory condition");
  }
  if (/\b(heart\s*disease|cardiac|cad\b|heart\s*attack|dil\s*ki\s*bimari|angina|stent|bypass)\b/i.test(lower)) {
    conditions.push("Cardiovascular / Heart Disease");
  }
  if (/\b(kidney\s*disease|renal|ckd\b|dialysis|kidney\s*problem|gurde)\b/i.test(lower)) {
    conditions.push("Chronic Kidney Disease / Renal illness");
  }
  if (/\b(thyroid|hypothyroid|hyperthyroid)\b/i.test(lower)) {
    conditions.push("Thyroid disorder");
  }
  if (/\b(liver\s*disease|cirrhosis|jaundice|hepatitis|liver\s*problem)\b/i.test(lower)) {
    conditions.push("Liver disease / condition");
  }

  if (conditions.length > 0) {
    return conditions.join("; ");
  }

  const directMatch = lower.match(/\b(?:history of|suffering from|patient has|bimari hai)\s+([a-zA-Z\s]{2,30})/i);
  if (directMatch && directMatch[1]) {
    const rawCond = directMatch[1].trim().replace(/\b(hai|tha|se|ki)\b/gi, "").trim();
    if (rawCond.length > 2 && !/^(no|none|nahi|nil)/i.test(rawCond)) {
      return `Reported: ${rawCond.charAt(0).toUpperCase() + rawCond.slice(1)}`;
    }
  }

  return existingComorbidity && !/^(none|nil|no pre|none reported)/i.test(existingComorbidity)
    ? existingComorbidity
    : "";
}

/**
 * Extracts clean, professional allergy findings from text
 */
export function extractAllergiesFromText(text = "", existingAllergy = null) {
  if (!text) return existingAllergy || "None reported by caller";
  const lower = text.toLowerCase();
  
  if (/\b(no\s+(?:known\s+)?allerg(?:y|ies)|not\s+allergic|no\s+reaction|koi\s+allergy\s+nahi|allergy\s+nahi|none|nil|negative)\b/i.test(lower)) {
    return "No known drug or food allergies reported";
  }

  if (/\b(penicillin|sulfa|aspirin|ibuprofen|paracetamol|nsaid|amoxicillin|cipro)\b/i.test(lower) && /\ballerg\w*\b/i.test(lower)) {
    const drugMatch = lower.match(/\b(penicillin|sulfa|aspirin|ibuprofen|paracetamol|nsaid|amoxicillin|cipro)\b/i);
    return `Known drug allergy to ${drugMatch ? drugMatch[0].toUpperCase() : "medication"}`;
  }
  if (/\b(peanuts?|eggs?|seafood|fish|prawns?|milk|wheat|soy|food)\b/i.test(lower) && /\ballerg\w*\b/i.test(lower)) {
    const foodMatch = lower.match(/\b(peanuts?|eggs?|seafood|fish|prawns?|milk|wheat|soy|food)\b/i);
    return `Known food allergy (${foodMatch ? foodMatch[0] : "food item"})`;
  }
  if (/\b(dust|pollen|insect\s*(?:bite|sting)?|bee\s*sting|cold|weather)\b/i.test(lower) && /\ballerg\w*\b/i.test(lower)) {
    return "Environmental / insect sting allergy";
  }
  
  const generalMatch = lower.match(/\ballergic\s+to\s+([a-zA-Z\s]{2,30})/i) || lower.match(/\ballergy\s+(?:from|due to|to)\s+([a-zA-Z\s]{2,30})/i);
  if (generalMatch && generalMatch[1]) {
    const allergen = generalMatch[1].trim().replace(/\b(hai|tha|hoti hai)\b/gi, "").trim();
    if (allergen.length > 2) {
      return `Allergic to ${allergen.charAt(0).toUpperCase() + allergen.slice(1)}`;
    }
  }

  if (/\b(rash|urticaria|hives|khujli|itching|daane)\b/i.test(lower)) {
    return "Allergic skin manifestation (rash / itching reported)";
  }

  return existingAllergy && existingAllergy !== "None reported" && existingAllergy !== ""
    ? existingAllergy
    : "None reported by caller";
}

/**
 * Extracts clean, professional medication history from text
 */
export function extractMedicationsFromText(text = "", existingMed = null) {
  if (existingMed && /^(none|nil|no prior|none reported|medication taken:\s*none)/i.test(String(existingMed).trim())) {
    existingMed = "";
  }
  if (!text) {
    return existingMed ? String(existingMed).replace(/^medications?\s*(?:taken)?[:\s]*/i, "") : "";
  }
  const lower = text.toLowerCase();

  // If caller reported no medication or none taken, strictly leave blank per user mandate
  if (/\b(no\s+medicin(?:e|es)|no\s+medication|haven'?t\s+taken|not\s+taken|kuch\s+nahi\s+liya|koi\s+dawa\s+nahi|dawai\s+nahi|dawa\s+nahi|none|nil|na\s+dawa)\b/i.test(lower)) {
    return "";
  }

  const medsFound = [];
  if (/\b(ondansetron|vomikind|domperidone|emset)\b/i.test(lower)) {
    medsFound.push("Tab. Ondansetron");
  }
  if (/\b(ors|electral|electrolyte)\b/i.test(lower)) {
    medsFound.push("ORS");
  }
  if (/\b(paracetamol|dolo|crocin|calpol|pcm)\b/i.test(lower)) {
    medsFound.push("Tab. Paracetamol");
  }
  if (/\b(combiflam|ibuprofen|diclofenac|aceclofenac|painkiller)\b/i.test(lower)) {
    medsFound.push("Combiflam / Diclofenac (Painkiller)");
  }
  if (/\b(cetirizine|avil|allegra|levocet|montair)\b/i.test(lower)) {
    medsFound.push("Cetirizine / Avil");
  }
  if (/\b(pantoprazole|pantocid|pan\s*40|omeprazole|omez|antacid|gelusil|digene)\b/i.test(lower)) {
    medsFound.push("Pantoprazole / Antacid");
  }
  if (/\b(inhaler|puff|asthalin|budecort|foracort)\b/i.test(lower)) {
    medsFound.push("Inhaler (Asthalin)");
  }
  if (/\b(sorbitrate|aspirin|ecospirin)\b/i.test(lower)) {
    medsFound.push("Aspirin / Sorbitrate");
  }
  if (/\b(insulin|metformin|glycomet)\b/i.test(lower)) {
    medsFound.push("Insulin / Metformin");
  }
  if (/\b(telmisartan|amlodipine|atenolol|bp\s+medicine|bp\s+dawai)\b/i.test(lower)) {
    medsFound.push("BP medicine (Telmisartan / Amlodipine)");
  }

  if (medsFound.length > 0) {
    return medsFound.join("; ");
  }

  const genericMedMatch = lower.match(/\b(?:taking|take|taken|dawai\s+li|medicine\s+li)\s+([a-zA-Z0-9\s]{2,30})/i);
  if (genericMedMatch && genericMedMatch[1]) {
    const rawMed = genericMedMatch[1].trim();
    if (rawMed.length > 2 && !/^(no|none|nahi|nil)/i.test(rawMed)) {
      return rawMed.charAt(0).toUpperCase() + rawMed.slice(1);
    }
  }

  return existingMed && existingMed !== "None reported" && existingMed !== "None reported by caller" && existingMed !== "No prior medication taken for current episode" && existingMed !== ""
    ? String(existingMed).replace(/^medications?\s*(?:taken)?[:\s]*/i, "")
    : "";
}

/**
 * Normalizes output from LLM provider into guaranteed uniform schema
 * with strict duplicate detection safeguard
 */
function normalizeDoctorOutput(raw, userInput, prevState = {}, askedQuestionsList = [], history = []) {
  const cleanInput = (userInput || "").toLowerCase();
  const prevRef = (prevState.referralDestination || "").toLowerCase();
  const userMessages = history.filter(
    (m) => m.sender === "user" || m.role === "user"
  );
  const userUtterances = userMessages
    .map((m) => (typeof m.content === "string" ? m.content : m.text || ""))
    .join(" ")
    .toLowerCase();
  const allCallerText = `${cleanInput} ${userUtterances}`.trim().toLowerCase();
  const affirmativeCallerText = stripNegatedPhrases(allCallerText);

  // Dynamic correction check: Did caller explicitly negate an accident, injury, or chest pain?
  const isAccidentDenied = /\b(no\s+accident|not\s+an\s+accident|no\s+injury|not\s+injured|without\s+injury|no\s+cut|no\s+wound|chot\s+nahi|accident\s+nahi|durghatna\s+nahi|injury\s+nahi)\b/i.test(cleanInput);
  const hasChestPainDenial = /\b(no\s+chest\s+pain|seene\s*me\s*dard\s*nahi|chhati\s*dard\s*nahi|not\s+chest\s+pain)\b/i.test(cleanInput);

  if (isAccidentDenied && (prevState.suspectedCondition || "").includes("Accident")) {
    prevState.suspectedCondition = "";
    if (prevState.referralDestination === "108 Ambulance") {
      prevState.referralDestination = null;
    }
  }
  if (hasChestPainDenial && (prevState.suspectedCondition || "").includes("Coronary")) {
    prevState.suspectedCondition = "";
    if (prevState.referralDestination === "108 Ambulance") {
      prevState.referralDestination = null;
    }
  }

  // Pure caller context — NEVER mix assistant bot questions into caller symptom evaluation!
  const allContext = `${cleanInput} ${prevRef} ${affirmativeCallerText}`.toLowerCase();

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

  const ambulanceCheck = isLifeThreateningAmbulanceCase(
    allContext,
    raw.severityScore || (raw.severity === "High" ? 9 : 5),
    { symptom_notes: cleanInput },
    prevState
  );
  const isEmergency108 = ambulanceCheck.is108;

  const directIntent = detectDirectCallerReferralIntent(cleanInput);

  const isAdviceSeeking =
    /\b(advice|doctor|consult|health advice|medical advice|phone doctor|guidance|information|kya karu|kya karein|salah|mashwara|ghar par kya karein)\b/i.test(cleanInput);

  const is104PhoneDoctor =
    /\b(104|phone consultation|phone doctor|tele consultation|tele-consultation|tele doctor|tele-doctor|call with 104|104 doctor|doctor on call|telephonic doctor|phone pe doctor|phone par doctor|call.*104)\b/i.test(cleanInput) ||
    (isAdviceSeeking && (raw.severity === "Mild" || prevState.severity === "Mild" || (!raw.severity && !prevState.severity))) ||
    (prevRef.includes("104") && !/\b(hospital|aspatal|dispensary|clinic|ambulance|108|pharmacy|chemist)\b/i.test(cleanInput));

  const isDispensaryMedicine =
    /\b(pharmacy|chemist|dawai store|medicine refill|prescribe refill|dawai leni hai|dispensary store)\b/i.test(cleanInput) ||
    prevRef.includes("pharmacy") ||
    prevRef.includes("dispensary");

  let severity =
    raw.severity === "High" || raw.severity === "Moderate" || raw.severity === "Mild"
      ? raw.severity
      : (prevState.severity || (isPsych ? "High" : is104PhoneDoctor ? "Moderate" : "Moderate"));

  let severityScore = Number(raw.severityScore) || (severity === "High" ? 9 : severity === "Moderate" ? 6 : 3);

  // STRICT RULE: If the case is NOT a genuine life-and-death emergency, DO NOT score it 9!
  if (!isEmergency108 && (severity === "High" || severityScore >= 9)) {
    severity = "Moderate";
    severityScore = 6;
  }

  let referralDestination;
  let referralReason;
  let secondaryReferral = null;
  let isDualProtocol = false;

  const dispensaryStatus = getDispensaryOperatingStatus();

  // Check IST time:
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const hour = istDate.getHours();
  const currentMinutes = hour * 60 + istDate.getMinutes();
  const isNightAfter10PM = hour >= 22 || hour < 6; // 10:00 PM to 6:00 AM IST
  const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM (960) to 10:00 AM (600)

  // Conditions for Category 7: ESI Tie-Up Hospital
  const isIpdEmergency = /\b(ipd|inpatient|admit|admission|admitted|icu|intensive care|emergency admit)\b/i.test(allContext);
  const hasEsicReferral = /\b(esic referral|referred by esic|referral letter|doctor referral|referred to tie.?up)\b/i.test(allContext);
  const isTieUpEligible = isIpdEmergency || hasEsicReferral || /\b(tie.?up|empanelled)\b/i.test(allContext);

  // Conditions for Category 8: District Hospital (Public Healthcare outside ESIC)
  const isDistHospRequest = /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|immunization|vaccination|tika|tika karan|child vaccine)\b/i.test(allContext);

  // Check if beneficiary has physical health / medical symptoms alongside any psychiatric complaints
  const hasPhysicalHealthSymptoms =
    severity === "High" ||
    /\b(fever|bukhar|chest|chhati|heart|pain|dard|bleed|wound|cut|accident|injury|chot|vomit|ulti|loose motion|dast|fracture|burn|poison|snake|bite|breath|saans|cough|dizzy|chakkar|kamzori|stone|bp|headache|rash|infection)\b/i.test(allContext);

  if (directIntent) {
    referralDestination = directIntent.destination;
    referralReason = directIntent.reason;
    secondaryReferral = "ESIC Hospital";
  }
  // Tier 1: 108 Ambulance Services (Strict Life-Threatening Crisis ONLY)
  else if (isEmergency108) {
    referralDestination = "108 Ambulance";
    referralReason = ambulanceCheck.reason || "Life-threatening acute emergency or trauma injury; dispatch 108 Ambulance immediately.";
    secondaryReferral = "ESIC Hospital";
  }
  // Tier 2: Mental Health / Emotional Distress / Suicide Crisis -> 104 Health Helpline
  else if (isPsych) {
    referralDestination = "104 Health Helpline";
    referralReason = "Beneficiary requires psychological counseling, doctor support or emotional guidance; connect with 104 Health Helpline for 24x7 doctor & counselling assistance.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  }
  // Tier 3: HIV/AIDS / STI -> 104 Health Helpline
  else if (isNacoHIV) {
    referralDestination = "104 Health Helpline";
    referralReason = "Confidential sexual health / HIV-AIDS medical guidance; connect with 104 Health Helpline for tele-doctor consultation.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  }
  // Tier 6: Dist Hosp (Priority: Public Healthcare outside ESIC)
  else if (isDistHospRequest) {
    referralDestination = "Govt District Hospital";
    referralReason = "Beneficiary needs public healthcare services outside the ESIC network (public admissions, specialist care, or child immunization); guide to nearest Govt District Hospital.";
    secondaryReferral = "104 Health Helpline";
    isDualProtocol = false;
  }
  // Tier 5: ESI Tie-up Hospital (Explicit IPD admission or ESIC referral)
  else if (isTieUpEligible) {
    referralDestination = "Nearest Tie-Up Facility";
    referralReason = isIpdEmergency
      ? "Inpatient (IPD) emergency; refer to nearest Empanelled Tie-Up Facility for cashless emergency admission under ESI guidelines."
      : hasEsicReferral
      ? "Patient possesses direct referral from ESIC Hospital; refer to nearest Empanelled Tie-Up Facility for specialist treatment."
      : "Refer to nearest Empanelled Tie-Up Facility for cashless treatment under ESI empanelment guidelines.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  }
  // After 10:00 PM: If manageable and not life-and-death -> 104 Health Helpline
  else if (isNightAfter10PM) {
    referralDestination = "104 Health Helpline";
    referralReason = "Night hours (after 10:00 PM): Condition is manageable. Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  }
  // If off-hours (after 4 PM to 10 AM) and NO emergency:
  else if (isOffHours || !dispensaryStatus.isOpen) {
    referralDestination = "104 Health Helpline";
    referralReason = "Dispensary and hospital OPD hours are closed (10:00 AM – 4:00 PM). Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  }
  // Tier 2: 104 Health Helpline (Priority: Tele-Consultation / General Info during daytime)
  else if (
    is104PhoneDoctor ||
    (isAdviceSeeking && severity !== "High")
  ) {
    referralDestination = "104 Health Helpline";
    referralReason = "Beneficiary needs health guidance without visiting a physical facility; transfer call to 104 Health Helpline for 24x7 doctor consultation over the phone.";
    secondaryReferral = "ESIS Dispensary";
    isDualProtocol = false;
  }
  // Tier 3: ESIS Dispensary (Priority: Primary / Routine Care during 10 AM - 4 PM)
  else if (dispensaryStatus.isOpen && severity !== "High") {
    referralDestination = "ESIS Dispensary";
    referralReason = "Daytime (10:00 AM – 4:00 PM): Routine primary care; visit nearest ESIS Dispensary for doctor consultation and medicines.";
    secondaryReferral = "104 Health Helpline";
    isDualProtocol = false;
  }
  // Tier 4: ESIC Hospital (Priority: Secondary / Specialist Care)
  else {
    referralDestination = "ESIC Hospital";
    referralReason = "Beneficiary needs advanced specialized care or secondary evaluation within ESIC network (OPD 10:00 AM – 4:00 PM, IPD & Emergency 24x7).";
    secondaryReferral = "ESIS Dispensary";
    isDualProtocol = false;
  }

  if (secondaryReferral === referralDestination) {
    secondaryReferral = referralDestination === "ESIC Hospital" ? "104 Health Helpline" : "ESIC Hospital";
  }

  const userTurnsCount = history.filter((m) => m.role === "user" || m.sender === "user").length + 1;
  const isDirect = Boolean(directIntent);

  // In first two probing turns (turns 1 and 2), we do NOT show premature referral recommendation
  // or jump to 108 unless there is an unequivocal critical life-or-death crisis
  // (e.g. cardiac arrest, unresponsive/unconscious, drowning, massive arterial hemorrhage, or direct caller ambulance request).
  // First ask probing questions to find out whether condition is emergency or manageable at hospital, especially in daytime.
  const isLifeThreateningCrisis =
    (directIntent && directIntent.destination === "108 Ambulance") ||
    /\b(cardiac arrest|heart attack|unconscious|behosh|not breathing|choking|drank poison|poisoning|drowning)\b/i.test(allContext);

  const isReferralReady =
    userTurnsCount >= 3 ||
    Boolean(raw.isReadyForSummary) ||
    isLifeThreateningCrisis ||
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

  const cleanInputWithoutTimestamps = stripClockAndCalendarTimestamps(cleanInput);
  const nlp = extractClinicalEntities(cleanInputWithoutTimestamps || cleanInput, "probing", prevState);
  const detectedDur = nlp?.detectedDuration;

  // Discard raw duration if it's merely a calendar date, clock timestamp, or injury mechanism (e.g. "Recent fall")
  const isInvalidDuration = raw.duration && (
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(raw.duration) ||
    /\b\d{1,2}:\d{2}/.test(raw.duration) ||
    /\b(am|pm|today's date|current time)\b/i.test(raw.duration) ||
    /\b(fall|fell|falling|accident|injury|trauma|pain|chot|gir gaya|impact|fracture|wound)\b/i.test(raw.duration)
  );

  // If a fall was reported in duration or text, ensure it is preserved as a clinical Red Flag / mechanism
  if (raw.duration && /\b(fall|fell|falling|gir gaya|accident|injury)\b/i.test(raw.duration)) {
    if (!Array.isArray(raw.redFlags)) raw.redFlags = [];
    raw.redFlags.push("Recent fall / physical impact trauma");
  }

  const duration =
    detectedDur ||
    (!isInvalidDuration && raw.duration && raw.duration !== "Not specified" ? raw.duration : null) ||
    prevState.duration ||
    "Reported today";

  let probingQuestion = raw.probingQuestion || 'Ask the IP: "Could you please describe how you are feeling and what symptoms are troubling you most?"';

  // Helper to extract core alphanumeric question content for deduplication
  const getCoreQuestionText = (text) =>
    (text || "")
      .toLowerCase()
      .replace(/^ask the ip:\s*["']?/i, "")
      .replace(/\(hinglish:.*?\)/gi, "")
      .replace(/["']?\s*$/i, "")
      .replace(/^i (understand|hear|know|am sorry|apologize|see).*?[.!?]\s*/i, "")
      .replace(/^main samajh sakta.*?[.!?]\s*/i, "")
      .replace(/^kripya shant rahe.*?[.!?]\s*/i, "")
      .replace(/[^a-z0-9]/g, "");

  // 1. Check if duration / time / date is already known from state, text, or previous turns
  const isDurationAlreadyKnown = Boolean(
    detectedDur ||
    /\b(\d+\s*(?:days?|hours?|weeks?|months?|years?|din|ghante|mahine|saal)|yesterday|today|kal se|subah se|aaj se|since\s+\w+)\b/i.test(allContext) ||
    askedQuestionsList.some((q) => /\b(when did|how long|how many days|duration|since when|kab se|kitne din)\b/i.test(q)) ||
    (duration && !/^(not|unknown|pending|unspecified)/i.test(duration.trim()) && duration !== "Reported today") ||
    (prevState.duration && !/^(not|unknown|pending|unspecified)/i.test(String(prevState.duration).trim()) && prevState.duration !== "Reported today")
  );

  // If raw probing question is empty, ask caller to describe where they feel pain/discomfort and their symptoms
  if (!probingQuestion || probingQuestion.trim().length < 5) {
    const rawCond = raw.suspectedCondition || prevState.suspectedCondition || prevState.symptom || "your symptoms";
    const displayComplaint = sanitizeSymptomOrCondition(rawCond, cleanInput) || "your symptoms";
    probingQuestion = `Ask the IP: "Could you please describe where you are feeling pain or discomfort with ${displayComplaint} and what exact symptoms you are experiencing?" (Hinglish: "Kripya batayein aapko kahan dard ya takleef mehsoos ho rahi hai aur kya mukhya lakshan hain?")`;
    raw.suggestedAnswers = [
      "Severe pain in body / limbs",
      "Chest discomfort or breathing difficulty",
      "Stomach pain / nausea / digestive distress",
      "Headache, dizziness, or fever",
    ];
  }

  // 2. Check if the newly proposed question asks for duration, date, or time
  const isCandidateAskingDuration = /\b(when did|how long|how many days|how many weeks|how many months|duration|since when|what time|what date|start date|on which day|kab se|kitne din|kitna samay|kis din|kis waqt|kitne ghante)\b/i.test(
    probingQuestion
  );

  // 3. Strict duplicate detection against any previously asked questions in this session
  const candidateCore = getCoreQuestionText(probingQuestion);
  const isDuplicateQuestion = askedQuestionsList.some((prevQ) => {
    const prevCore = getCoreQuestionText(prevQ);
    if (!prevCore || !candidateCore) return false;
    if (prevCore === candidateCore) return true;
    if (prevCore.length > 15 && candidateCore.length > 15) {
      if (prevCore.includes(candidateCore) || candidateCore.includes(prevCore)) return true;
    }
    // Semantic clinical topic duplication checks
    const isBothAssociated = /\b(associated|companion|nausea.*dizzy|ulti.*chakkar)\b/i.test(prevQ) && /\b(associated|companion|nausea.*dizzy|ulti.*chakkar)\b/i.test(probingQuestion);
    const isBothDuration = /\b(when did|how long|how many days|kab se|kitne din)\b/i.test(prevQ) && /\b(when did|how long|how many days|kab se|kitne din)\b/i.test(probingQuestion);
    const isBothMedication = /\b(medicines?|dawai|painkillers?|paracetamol)\b/i.test(prevQ) && /\b(medicines?|dawai|painkillers?|paracetamol)\b/i.test(probingQuestion);
    const isBothComorbidity = /\b(comorbidit|pre-existing|diabetes|bp|asthma|pehle se)\b/i.test(prevQ) && /\b(comorbidit|pre-existing|diabetes|bp|asthma|pehle se)\b/i.test(probingQuestion);
    const isBothRadiation = /\b(radiat|spread|phail)\b/i.test(prevQ) && /\b(radiat|spread|phail)\b/i.test(probingQuestion);
    const isBothDailyImpact = /\b(affect.*eat|khana.*peena|daily activities|chalne.*firne)\b/i.test(prevQ) && /\b(affect.*eat|khana.*peena|daily activities|chalne.*firne)\b/i.test(probingQuestion);
    if (isBothAssociated || isBothDuration || isBothMedication || isBothComorbidity || isBothRadiation || isBothDailyImpact) {
      return true;
    }
    return false;
  });

  // If candidate question is duplicate OR repeats asking for time/date when duration is already known:
  if ((isCandidateAskingDuration && isDurationAlreadyKnown) || isDuplicateQuestion) {
    const alternativeQuestions = [
      {
        id: "associated_symptoms",
        match: () => !askedQuestionsList.some((q) => /\b(associated|companion|nausea.*dizzy|ulti.*chakkar)\b/i.test(q)),
        question:
          'Ask the IP: "Are you experiencing any other associated symptoms such as nausea, dizziness, sweating, or weakness?" (Hinglish: "Kya aapko ulti, chakkar, pasina, ya kamzori jaisi koi aur takleef bhi mehsoos ho rahi hai?")',
        options: [
          "Nausea and feeling like vomiting",
          "Dizziness and physical weakness",
          "Cold sweating and shivering",
          "No other associated symptoms",
        ],
      },
      {
        id: "pain_character_radiation",
        match: () => /\b(pain|dard|ache|cramp|pressure)\b/i.test(allContext) && !askedQuestionsList.some((q) => /\b(radiat|spread|phail)\b/i.test(q)),
        question:
          'Ask the IP: "Does this pain spread or radiate to any other part of your body, such as your back, arm, or jaw?" (Hinglish: "Kya yeh dard sharir ke kisi aur hisse jaise peeth, baazu ya jabde ki taraf phail raha hai?")',
        options: [
          "No, does not radiate / stays in one spot",
          "No, not spreading to any other part",
          "Radiating towards the left arm / jaw",
          "Spreading across the back / shoulders",
        ],
      },
      {
        id: "functional_daily_impact",
        match: () => !askedQuestionsList.some((q) => /\b(affect.*eat|khana.*peena|daily activities|chalne.*firne)\b/i.test(q)),
        question:
          'Ask the IP: "Has this condition affected your ability to eat, drink fluids, or sleep comfortably?" (Hinglish: "Kya is takleef ki wajah se khana peena ya sona mushkil ho raha hai?")',
        options: [
          "Unable to keep food or fluids down",
          "Disturbed sleep due to persistent pain",
          "Eating and drinking normally",
          "Severe weakness preventing daily activities",
        ],
      },
      {
        id: "symptom_progression",
        match: () => !askedQuestionsList.some((q) => /\b(waves|cramps|continuously|lagataar|beech-beech)\b/i.test(q)),
        question:
          'Ask the IP: "Does this discomfort stay continuously at the same level, or does it come and go in waves?" (Hinglish: "Kya yeh takleef lagataar bani rehti hai, ya beech-beech me kam-zyada hoti hai?")',
        options: [
          "Constant steady discomfort without relief",
          "Comes and goes in waves / cramps",
          "Worsens significantly after moving or walking",
          "Mostly manageable with periods of relief",
        ],
      },
      {
        id: "medication_history",
        match: () => !askedQuestionsList.some((q) => /\b(medicines?|dawai|painkillers?|paracetamol)\b/i.test(q)),
        question:
          'Ask the IP: "Have you taken any medicines, painkillers, or home remedies for this, and did they provide relief?" (Hinglish: "Kya aapne iske liye koi dawai ya gharelu upchaar liya hai, aur kya usse aaram mila?")',
        options: [
          "Took over-the-counter medicine with no relief",
          "Partial temporary relief from medicine",
          "Have not taken any medication yet",
          "Prescribed regular medications for chronic illness",
        ],
      },
      {
        id: "pre_existing_conditions",
        match: () => !askedQuestionsList.some((q) => /\b(pre-existing|diabetes|bp|asthma|pehle se|comorbidit)\b/i.test(q)),
        question:
          'Ask the IP: "Do you have any pre-existing health conditions such as high blood pressure, diabetes, or asthma, and are you taking any regular medications for them?" (Hinglish: "Kya aapko pehle se diabetes, high BP, ya asthma jaisi koi bimari hai, aur kya aap koi regular dawai lete hain?")',
        options: [
          "History of high blood pressure (BP)",
          "History of diabetes / sugar",
          "Asthma or respiratory condition",
          "No pre-existing health conditions",
        ],
      },
    ];

    const pick = alternativeQuestions.find((item) => {
      if (!item.match()) return false;
      const core = getCoreQuestionText(item.question);
      return !askedQuestionsList.some((prevQ) => {
        const prevC = getCoreQuestionText(prevQ);
        return prevC === core || (prevC.length > 15 && (prevC.includes(core) || core.includes(prevC)));
      });
    });

    if (pick) {
      probingQuestion = pick.question;
      raw.suggestedAnswers = pick.options;
    } else {
      // All topics already thoroughly asked: conclude questioning gracefully without repetition
      raw.isReadyForSummary = true;
      probingQuestion = 'Ask the IP: "We have carefully noted all your symptoms and medical details. Please confirm your exact location so I can direct you to the nearest facility or dispatch assistance." (Hinglish: "Humne aapki saari takleef aur lakshan note kar liye hain. Kripya apna sahi pata ya landmark batayein taaki sahi suvidha tak margdarshan kiya ja sake.")';
      raw.suggestedAnswers = [
        "Please guide me to the nearest healthcare facility",
        "Need immediate emergency assistance",
        "Connect me with the 104 tele-doctor",
        "Will visit ESIC Hospital / Dispensary",
      ];
    }
  }

  // Provide progressive fallback if probing question is still empty
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

    // Mismatch 6: Answers contain numerical scale rating (1-3, 4-6, 7-8, 9-10, 1-10, /10)
    const answersAreScaleRating = /\b(1-3|4-6|7-8|9-10|1-10|scale of 1|scale of 10|\/10)\b/i.test(joinedAnswers);

    if (
      answersAreScaleRating ||
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

  const isDual = Boolean(isDualProtocol || raw.is_dual_protocol || raw.isDualProtocol || isSelfHarmTrauma);
  const secondaryRef = secondaryReferral || raw.call_referral_secondary || (isDual ? "Psychological Counselling Department" : null);

  const callerDeniesFever =
    /\b(no\s+fever|not\s+have\s+fever|don'?t\s+have\s+fever|do\s+not\s+have\s+fever|without\s+fever|fever\s+nahi|bukhar\s+nahi|no\s+chills|no\s+body\s*aches?|without\s+chills|nehi|nahi|not\s+having\s+fever)\b/i.test(
      userUtterances
    ) && !/\b(yes.*fever|fever.*hai|tez bukhar|severe fever|high grade fever)\b/i.test(userUtterances);

  let finalCondition = raw.suspectedCondition;
  if (!finalCondition || /Caller reports (?:a )?fall/i.test(finalCondition)) {
    finalCondition = "Traumatic Fall / Impact Injury Assessment";
  } else if (/Caller reports/i.test(finalCondition)) {
    if (/\b(snake|saap|saanp|bite|envenomation)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Snake Bite / Envenomation Assessment";
    } else if (/\b(chest pain|chhati|heart)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Acute Chest Pain / Discomfort";
    } else if (!callerDeniesFever && /\b(fever|bukhar)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Febrile Symptoms / Fever";
    } else {
      const cleaned = finalCondition.replace(/^caller reports (?:an? )?/i, "").replace(/[.;].*$/, "");
      finalCondition = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } else if (isPsych) {
    finalCondition = raw.suspectedCondition || "Psychological Distress / Anxiety Crisis";
  } else if (is104PhoneDoctor) {
    finalCondition = "104 Tele-Doctor Consultation";
  } else if (!finalCondition) {
    finalCondition = "Clinical Assessment";
  }

  // If fever is denied but condition contains fever/febrile, fix condition using actual affirmative symptoms
  if (callerDeniesFever && /\b(fever|febrile|bukhar|chills)\b/i.test(finalCondition)) {
    if (/\b(vomit\w*|ulti\w*)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Persistent Vomiting / Nausea";
    } else if (/\b(dizzy|chakkar|weakness|kamzori|faint)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Weakness & Dizziness Assessment";
    } else if (/\b(chest|chhati|heart)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Chest Discomfort Assessment";
    } else if (/\b(stomach|abdom|pet)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Abdominal Discomfort Assessment";
    } else {
      finalCondition = prevState.suspectedCondition && !/\b(fever|febrile)\b/i.test(prevState.suspectedCondition)
        ? prevState.suspectedCondition
        : "Clinical Assessment";
    }
  }

  // If caller mentioned period / menstrual cramps, ensure condition is Dysmenorrhea / Menstrual Cramps
  const isPeriodCramps = /\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari|period cramps|periods cramps|periods ka dard|mahavari dard)\b/i.test(affirmativeCallerText);
  if (isPeriodCramps) {
    finalCondition = "Dysmenorrhea / Menstrual Cramps";
  }

  // Prevent false cardiac assignment: if caller NEVER spoke about chest/heart, strip any cardiac condition
  const callerSpokeChest = /\b(chest|chhati|heart|angina|crushing|dil ka dard|left arm)\b/i.test(affirmativeCallerText);
  if (!callerSpokeChest && (finalCondition.includes("Coronary") || finalCondition.includes("Chest Discomfort"))) {
    if (isPeriodCramps) {
      finalCondition = "Dysmenorrhea / Menstrual Cramps";
    } else if (/\b(stomach|abdom|pet|gastric|cramp|colic)\b/i.test(affirmativeCallerText)) {
      finalCondition = "Abdominal / Gastric Pain";
    } else {
      finalCondition = prevState.suspectedCondition && !prevState.suspectedCondition.includes("Coronary")
        ? prevState.suspectedCondition
        : "Clinical Assessment";
    }
  }

  // Strictly enforce non-doctor guideline: strip fabricated diseases unless spoken by caller
  finalCondition = sanitizeSymptomOrCondition(finalCondition, userUtterances);

  const filteredRedFlags = (Array.isArray(raw.redFlagsDetected) ? raw.redFlagsDetected : []).filter(
    (f) => {
      if (!f || typeof f !== "string") return false;
      const fLower = f.toLowerCase();
      // Never allow duration in red flags!
      if (
        /\b(duration|since|days?|hours?|weeks?|months?|dino?|ghante?|yesterday|today|4-7 days|2-3 days|less than 2 hours)\b/i.test(fLower) ||
        /^\d+\s*-\s*\d+\s*(?:days?|hours?|weeks?|months?)$/i.test(f.trim()) ||
        /^duration:?\s*/i.test(f.trim())
      ) {
        return false;
      }
      // Never allow generic filler in red flags!
      if (
        fLower.includes("acute presentation") ||
        fLower.includes("high severity reported") ||
        fLower.includes("urgent ambulance transfer")
      ) {
        return false;
      }
      if (
        fLower.includes("fever") ||
        fLower.includes("bukhar") ||
        fLower.includes("chills") ||
        fLower.includes("pyrexia")
      ) {
        if (callerDeniesFever) return false;
        return /\b(high fever|tez bukhar|bukhar|fever|chills|shivering|rigor|10[2-5]\s*(?:°|f|deg))\b/i.test(
          affirmativeCallerText
        );
      }
      if (fLower.includes("self-harm") || fLower.includes("suicid")) {
        return /\b(wanna die|want to die|kill myself|mar jaunga|jaan de dunga|suicid)\b/i.test(
          userUtterances
        );
      }
      if (fLower.includes("chest") || fLower.includes("cardiac") || fLower.includes("coronary")) {
        return /\b(chest|chhati|heart attack|dil ka dard|left arm|pressure on chest)\b/i.test(
          affirmativeCallerText
        );
      }
      if (fLower.includes("bleed") || fLower.includes("wound") || fLower.includes("cut")) {
        return /\b(bleed|blood|khoon|deep wound|cut\s*wrist|fracture)\b/i.test(affirmativeCallerText);
      }
      return true;
    }
  );

  // Augment with caller-reported clinical situations
  const addDetectedFlag = (flag) => {
    if (!filteredRedFlags.some((f) => f.toLowerCase() === flag.toLowerCase())) {
      filteredRedFlags.push(flag);
    }
  };

  if (/\b(hematemesis|blood in vomit|vomit.*blood|blood.*stool|melena|khoon.*ulti|ulti.*khoon|gastrointestinal bleeding|gi bleed)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Gastrointestinal bleeding / hematemesis (blood in vomit)");
  }
  if (/\b(cannot keep.*fluid|inability to retain fluid|unable to retain fluid|can'?t retain fluid|can'?t drink|paani.*ruk nahi|paani.*nahi pi|persistent vomit|continuous vomit)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Inability to retain oral fluids");
  }
  if (!callerDeniesFever && /\b(high fever|tez bukhar|chills|shivering|rigor|kapkapi)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("High fever with chills and shivering");
  }
  if (/\b(severe breathlessness|saans.*takleef|gasping|gasping for air|shortness of breath)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Severe shortness of breath");
  }
  if (/\b(unconscious|behosh|fainted|blackout|syncope|unresponsive)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Loss of consciousness / fainting episode");
  }
  if (/\b(seizure|convulsions?|fits?|mirgi)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Seizure / convulsions");
  }
  if (/\b(heavy bleed|profuse bleed|khoon beh raha)\b/i.test(affirmativeCallerText)) {
    addDetectedFlag("Heavy uncontrolled bleeding");
  }

  const detectedComorbidity = raw.comorbidity || raw.comorbidities || extractComorbiditiesFromText(allContext, prevState.comorbidity || prevState.comorbidities);
  const detectedAllergies = raw.allergies || raw.allergy || extractAllergiesFromText(allContext, prevState.allergies);
  const detectedMedications = raw.medications || raw.medication || extractMedicationsFromText(allContext, prevState.medications || prevState.medication);

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
    redFlagsDetected: deduplicateRedFlags(filteredRedFlags),
    duration,
    comorbidity: detectedComorbidity,
    comorbidities: detectedComorbidity,
    allergies: detectedAllergies,
    medication: detectedMedications,
    medications: detectedMedications,
    isReadyForSummary: Boolean(raw.isReadyForSummary || (history.length >= 6) || is104PhoneDoctor),
    clinicalSummary: sanitizeSymptomOrCondition(
      raw.clinicalSummary ||
        `Caller presents with ${finalCondition || "symptoms"}. Evaluated Severity: ${severity}. Duration: ${duration}. Recommended Action: ${referralDestination || "Medical Evaluation"}.`,
      userUtterances
    ),
  };
}

/**
 * High-precision progressive local fallback engine
 * Tracks conversation history, analyzes answers, applies doctor empathy, and NEVER repeats questions!
 */
export function buildLocalDoctorConsultationFallback(userInput, history = [], prevState = {}) {
  const cleanInput = (userInput || "").toLowerCase().trim();
  const userMessages = history.filter(
    (m) => m.sender === "user" || m.role === "user"
  );
  const userUtterances = userMessages
    .map((m) => (typeof m.content === "string" ? m.content : m.text || ""))
    .join(" ")
    .toLowerCase();
  const allCallerText = `${cleanInput} ${userUtterances}`.trim().toLowerCase();
  const affirmativeCallerText = stripNegatedPhrases(allCallerText);
  const allContext = `${cleanInput} ${allCallerText} ${prevState.referralDestination || ""}`.toLowerCase();

  // CRITICAL: effectiveInput must ONLY contain what the CALLER actually reported!
  // Assistant bot questions must NEVER be included here, otherwise asking "do you have heart disease?"
  // will falsely diagnose the caller with heart disease!
  const effectiveInput = affirmativeCallerText;

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
    /\b(cut.*wrist|wrist.*cut|overdose|drank poison|poisoning|hanging|sleeping pills|nass kaat|haath ki nas)\b/i.test(cleanInput) ||
    (/\b(cut|bleeding|wound|khoon)\b/i.test(cleanInput) && /\b(sad|depress|die|suicid|jaan\s*(?:dene|dena)|mar ja|alone|unwanted|self[- ]?harm)\b/i.test(cleanInput));

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
      call_referral_secondary: "104 Health Helpline",
      call_referral_secondary_reason: "Crisis emotional de-escalation & mental health counselling support via 104 Health Helpline.",
      clinicalSummary: "Caller presents with acute self-harm trauma with bleeding and severe psychological distress. Immediate dual protocol activated: 108 Ambulance trauma dispatch with 104 Health Helpline co-referral.",
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
          'Ask the IP: "Thank you for trusting me with that. Please know you are not alone, and help is available right now. Are you currently in a safe place right now? We are connecting you immediately to 104 Health Helpline for free doctor and counseling support." (Hinglish: "Mujhpar bharosa karne ke liye dhanyawad. Kripya jaanein ki aap akele nahi hain. Kya aap abhi kisi safe jagah par hain? Hum aapko 104 helpline se connect kar rahe hain.")',
        options: [
          "Yes, please connect me to 104 counsellor right now",
          "I am at home alone, please connect urgently",
          "Family member is near me, please guide transfer",
          "Will stay on the line for 104 helpline team",
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
      referralDestination: "104 Health Helpline",
      referralReason: "Caller exhibits emotional distress / psychological crisis; priority transfer to 104 Health Helpline for 24x7 doctor & counseling support.",
      redFlagsDetected: ["Emotional crisis / Psychological distress"],
      duration: prevState.duration || "Recent days",
      isReadyForSummary: history.length >= 4,
      clinicalSummary: "Caller presents with psychological distress and depression symptoms. Priority routing to 104 Health Helpline.",
    };
  }

  // 2. High-Risk Obstetric / Pregnancy Crisis Emergency
  const isPregnancyEmergency = /\b(pregnant|pregnancy|garbhwati|hamla|pragnen\w*|expecting|trimester|foetus|fetus|water\s*broke|labor\s*pain|labour\s*pain)\b/i.test(effectiveInput);
  if (isPregnancyEmergency) {
    const isSeverePregnancy =
      /\b(heavy\s*(?:vaginal\s*)?bleed\w*|sudden\s*bleed\w*|vaginal\s*bleed\w*|bleed\w*.*(?:severe|intense)\s*pain|water\s*broke|amniotic|active\s*labor|eclampsia|seizure|convulsion|severe\s*continuous\s*(?:abdominal|pelvic)\s*pain|unbearable\s*pain)\b/i.test(allContext) ||
      /\b(pregnant with heavy|water broke|high blood pressure with severe)\b/i.test(cleanInput);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    const pregSeverity = isSeverePregnancy ? "High" : "Moderate";
    const pregSeverityScore = isSeverePregnancy ? 10 : 6;
    const pregReferral = isSeverePregnancy ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIC Hospital");

    return {
      probingQuestion: enforceSingleQuestion(
        'Ask the IP: "Are you pregnant and experiencing heavy vaginal bleeding, severe continuous abdominal/back pain, water breaking, or seizures / severe headache with high BP?" (Hinglish: "Kya pregnancy me tez khoon behna, pet me lagataar asahniya dard, paani ki thaili phatna, ya high BP ke saath daura/sir dard ho raha hai?")'
      ),
      suggestedAnswers: [
        "Pregnant with heavy vaginal bleeding or severe continuous pain (Emergency)",
        "Amniotic sac ruptured (water broke) / intense labor pains close together (Emergency)",
        "High blood pressure with severe headache, vision changes, or seizures (Emergency)",
        "Mild pregnancy cramps / nausea without bleeding, routine inquiry",
      ],
      suspectedCondition: "High-Risk Pregnancy / Obstetric Emergency",
      isPsychiatric: false,
      severity: pregSeverity,
      severityScore: pregSeverityScore,
      referralDestination: pregReferral,
      referralReason: isSeverePregnancy
        ? "High-risk obstetric emergency (heavy bleeding, active labor/water broke, or eclampsia) requiring immediate 108 Emergency Ambulance dispatch."
        : "Pregnancy discomfort requires medical evaluation by an obstetrician.",
      redFlagsDetected: isSeverePregnancy ? ["High-risk pregnancy complication / acute labor"] : ["Pregnancy symptom under evaluation"],
      duration: prevState.duration || "Reported today",
      isReadyForSummary: isSeverePregnancy ? true : history.length >= 2,
      clinicalSummary: `Obstetric evaluation in progress. Severity: ${pregSeverity}. Referral: ${pregReferral}.`,
    };
  }

  // 3. Senselessness / Unconsciousness / Fainting Emergency
  const isSenselessOrUnconscious =
    /\b(senseless\w*|unconscious\w*|behosh\w*|behoshi|faint\w*|blackout\w*|loss\s*of\s*consciousness|unresponsive|not\s*waking\s*up|collapsed\b)/i.test(effectiveInput) &&
    !/\b(conscious|alert|hosh\s*me|awake)\b/i.test(cleanInput);
  if (isSenselessOrUnconscious) {
    const isSevereUnconscious =
      /\b(unresponsive|will not wake up|won'?t wake up|unconscious|behosh|behoshi|senseless|senselessness|not waking up|coma|head injury|seizure|convulsion)\b/i.test(allContext) &&
      !/\b(fainted briefly|now awake|talking normally|dizzy only|conscious)\b/i.test(cleanInput);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    const uncSeverity = isSevereUnconscious ? "High" : "Moderate";
    const uncSeverityScore = isSevereUnconscious ? 10 : 6;
    const uncReferral = isSevereUnconscious ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIC Hospital");

    return {
      probingQuestion: enforceSingleQuestion(
        'Ask the IP: "Is the person currently senseless, completely unresponsive and not waking up, or have they had a seizure/fit?" (Hinglish: "Kya marij abhi poori tarah behosh/senseless hai aur aawaz dene par bhi hosh me nahi aa raha, ya daura pada hai?")'
      ),
      suggestedAnswers: [
        "Completely senseless / unresponsive and will not wake up (Emergency)",
        "Unconscious after head injury or seizure / convulsion (Emergency)",
        "Fainted briefly for a few seconds, but now awake and alert",
        "Feeling dizzy or lightheaded, but fully conscious and talking",
      ],
      suspectedCondition: "Loss of Consciousness / Unresponsiveness",
      isPsychiatric: false,
      severity: uncSeverity,
      severityScore: uncSeverityScore,
      referralDestination: uncReferral,
      referralReason: isSevereUnconscious
        ? "Senselessness / unresponsive patient requires immediate 108 Emergency Ambulance dispatch."
        : "Episode of fainting/dizziness requires casualty medical evaluation.",
      redFlagsDetected: isSevereUnconscious ? ["Unresponsiveness / Complete loss of consciousness"] : ["Syncope episode reported"],
      duration: prevState.duration || "< 1 hour",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: `Unconsciousness evaluation in progress. Severity: ${uncSeverity}. Referral: ${uncReferral}.`,
    };
  }

  // 4. Deep Cuts & Heavy Bleeding Emergency
  const inputAffirmative = stripNegatedPhrases(cleanInput);
  const isBleedOrCutDenied = /\b(no\s+cut|no\s+wound|no\s+bleed|bleeding\s*stopped|khoon\s*ruk\s*gaya|chot\s*nahi)\b/i.test(cleanInput);
  const hasDeepCutOrBleed =
    !isBleedOrCutDenied &&
    (/\b(deep\s*cut|gaping\s*cut|deep\s*wound|deep\s*laceration|gehra\s*ghao|gehra\s*cut|severe\s*cut|heavy\s*bleed\w*|profuse\s*bleed\w*|uncontrolled\s*bleed\w*|continuous\s*bleed\w*|spurting|tez\s*khoon|bohot\s*khoon|khoon\s*nahi\s*ruk\s*raha)\b/i.test(effectiveInput) ||
     (/\b(cut|laceration|wound|ghao)\b/i.test(effectiveInput) && /\b(bleed|blood|khoon)\b/i.test(effectiveInput)));

  if (hasDeepCutOrBleed) {
    const isLifeThreateningBleed =
      /\b(heavy\s*active\s*spurting|deep\s*gaping|spurting|arterial|uncontrolled|cannot\s*stop|not\s*stopping|soaking|profuse|massive)\b/i.test(allContext) &&
      !/\b(bleeding stopped|khoon ruk gaya|not heavy bleeding|bleeding controlled|minor cut|small cut|stopped with firm pressure)\b/i.test(cleanInput);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    const cutSeverity = isLifeThreateningBleed ? "High" : "Moderate";
    const cutSeverityScore = isLifeThreateningBleed ? 10 : 6;
    let cutReferral = isLifeThreateningBleed ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIS Dispensary");

    return {
      probingQuestion: enforceSingleQuestion(
        'Ask the IP: "How deep is the cut, and is blood spurting or soaking through cloths continuously despite firm direct pressure?" (Hinglish: "Ghaav kitna gehra hai, aur kya saaf kapde se dabane ke bawajood lagatar tez khoon beh raha hai?")'
      ),
      suggestedAnswers: [
        "Heavy active spurting bleeding — cannot stop with cloth (Emergency)",
        "Deep gaping cut exposing fat or muscle, continuous bleeding (Severe)",
        "Deep cut, but bleeding has slowed / stopped with firm pressure",
        "Superficial cut / minor scrape with mild bleeding",
      ],
      suspectedCondition: "Deep Cut / Active Bleeding",
      isPsychiatric: false,
      severity: cutSeverity,
      severityScore: cutSeverityScore,
      referralDestination: cutReferral,
      referralReason: isLifeThreateningBleed
        ? "Deep cut with uncontrolled hemorrhage / spurting bleeding requires immediate 108 Emergency Ambulance dispatch."
        : "Wound requires medical evaluation, dressing, and tetanus prophylaxis at nearest dispensary.",
      redFlagsDetected: isLifeThreateningBleed ? ["Uncontrolled spurting hemorrhage / Deep gaping wound"] : ["Laceration injury reported"],
      duration: prevState.duration || "Fresh injury (< 2 hours)",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: `Wound assessment in progress. Clinical severity: ${cutSeverity}. Referral: ${cutReferral}.`,
    };
  }

  // 5. Accident / High-Impact Trauma Casualty Emergency
  const isAccidentDenied = /\b(no\s+accident|not\s+an\s+accident|no\s+injury|not\s+injured|without\s+injury|accident\s+nahi|durghatna\s+nahi)\b/i.test(cleanInput);
  if (isAccidentDenied && (prevState.suspectedCondition || "").includes("Accident")) {
    prevState.suspectedCondition = "";
  }

  const isAccident =
    !isAccidentDenied &&
    (/\b(accident|durghatna|car\s*crash|bike\s*accident|road\s*accident|hit\s*by|fall\s*from\s*(?:height|roof|building|tree|stairs)|machine\s*accident|machinery\s*accident|industrial\s*injury)\b/i.test(
      inputAffirmative
    ) || ((prevState.suspectedCondition || "").includes("Accident") && !isAccidentDenied));

  if (isAccident) {
    const isLifeThreateningTrauma =
      /\b(severe crash|severe vehicular|trapped in vehicle|fall from (?:roof|building|height)|head injury.*unconscious|bone deformity|visible bone|open fracture|unable to move|amputation|crushed\s*limb|third degree burn|head trauma|fracture|broken bone|bleeding heavily|deep cut)\b/i.test(allContext) ||
      /\b(severe vehicular crash|trapped in vehicle|emergency\)|head injury|bone deformity)\b/i.test(cleanInput);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    const traumaSeverity = isLifeThreateningTrauma ? "High" : "Moderate";
    const traumaSeverityScore = isLifeThreateningTrauma ? 10 : 6;
    let traumaReferral = isLifeThreateningTrauma ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIS Dispensary");
    let traumaReason = isLifeThreateningTrauma
      ? "Acute severe catastrophic trauma casualty requiring immediate 108 Emergency Ambulance dispatch."
      : "Manageable minor accident trauma; visit nearest ESIS Dispensary for doctor evaluation.";

    return {
      probingQuestion: enforceSingleQuestion(
        'Ask the IP: "Was it a high-speed vehicle crash or fall from height with severe head trauma, bone deformity/fracture, heavy bleeding, or trapped victim?" (Hinglish: "Kya yeh tez takkar ya unchai se girne ka gambhir haadsa hai jisme sar par chot, haddi tutna/tedhi hona, tez khoon ya behoshi hui hai?")'
      ),
      suggestedAnswers: [
        "Severe vehicular crash / fall from height with head injury or bone deformity (Emergency)",
        "Trapped in vehicle or unable to move due to unbearable trauma (Emergency)",
        "Minor collision or slip, fully alert with local bruising and swelling",
        "Minor scrape from low-speed slip, stable and walking normally",
      ],
      suspectedCondition: "Occupational Trauma / Acute Accident",
      isPsychiatric: false,
      severity: traumaSeverity,
      severityScore: traumaSeverityScore,
      referralDestination: traumaReferral,
      referralReason: traumaReason,
      redFlagsDetected: isLifeThreateningTrauma ? ["Major catastrophic trauma casualty / Fracture deformity"] : ["Minor injury reported"],
      duration: "Fresh accident / trauma (<2 hours)",
      isReadyForSummary: isLifeThreateningTrauma ? true : history.length >= 2,
      clinicalSummary: `Trauma assessment in progress. Clinical severity: ${traumaSeverity}. Referral: ${traumaReferral}.`,
    };
  }

  // 3. Cardiac / Chest Pain Emergency
  const hasChestPainDenial = /\b(no\s+chest\s+pain|seene\s*me\s*dard\s*nahi|chhati\s*dard\s*nahi|not\s+chest\s+pain)\b/i.test(cleanInput);
  if (hasChestPainDenial && (prevState.suspectedCondition || "").includes("Coronary")) {
    prevState.suspectedCondition = "";
  }

  const callerSpokeCardiac = /\b(chest pain|chhati me dard|seene me dard|heart attack|angina|crushing chest|crushing pain in chest|baayein haath me dard)\b/i.test(affirmativeCallerText);
  const isCardiac = !hasChestPainDenial && callerSpokeCardiac;

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

    const isLifeThreateningCardiac =
      /\b(crushing|radiating|left arm|baayein haath|sweat|pasina|gasping|unconscious)\b/i.test(allContext) &&
      !/\b(burning|acidity|gas|sharp|stinging|mild|tolerable)\b/i.test(cleanInput);

    const cardiacSeverity = isLifeThreateningCardiac ? "High" : "Moderate";
    const cardiacSeverityScore = isLifeThreateningCardiac ? 9 : 6;
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    let cardiacReferral = isLifeThreateningCardiac ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIC Hospital");

    return {
      probingQuestion: enforceSingleQuestion(currentStep.question),
      suggestedAnswers: currentStep.options,
      suspectedCondition: "Suspected Acute Coronary Syndrome",
      isPsychiatric: false,
      severity: cardiacSeverity,
      severityScore: cardiacSeverityScore,
      referralDestination: cardiacReferral,
      referralReason: isLifeThreateningCardiac
        ? "High-risk crushing chest pain symptoms requiring emergency cardiac evaluation and 108 Ambulance transport."
        : "Chest pain requires medical review at hospital casualty.",
      redFlagsDetected: isLifeThreateningCardiac ? ["Suspected Acute Coronary Syndrome"] : ["Chest discomfort reported"],
      duration: prevState.duration || "< 2 hours",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: `Cardiac evaluation in progress. Severity: ${cardiacSeverity}. Referral: ${cardiacReferral}.`,
    };
  }

  // 6. Severe Breathlessness / Respiratory Distress Emergency
  const isBreathingDenied = /\b(no\s+(?:breathing|breathless|shortness of breath|dyspnea)|saans\s*me\s*takleef\s*nahi|saans\s*nahi\s*phool\s*rahi)\b/i.test(cleanInput);
  if (isBreathingDenied && (prevState.suspectedCondition || "").includes("Respiratory")) {
    prevState.suspectedCondition = "";
  }
  const hasBreathlessness =
    !isBreathingDenied &&
    /\b(breathless\w*|difficulty\s*breath\w*|trouble\s*breath\w*|shortness\s*of\s*breath|saans\s*lene\s*me|saans\s*phool|gasp\w*|wheez\w*|stridor|asthma\s*attack|choking)\b/i.test(effectiveInput);

  if (hasBreathlessness) {
    const isSevereBreathing =
      /\b(gasping\s*for\s*air|unable\s*to\s*speak\s*in\s*full\s*sentences|cannot\s*speak|cannot\s*talk|blue\s*lips|cyanosis|struggling\s*for\s*breath|suffocating|choking)\b/i.test(allContext) ||
      /\b(yes,\s*gasping|gasping|emergency\)|unable to speak|blue lips)\b/i.test(cleanInput);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
    const hour = istDate.getHours();
    const isNightAfter10PM = hour >= 22 || hour < 6;

    const breathSeverity = isSevereBreathing ? "High" : "Moderate";
    const breathSeverityScore = isSevereBreathing ? 10 : 6;
    let breathReferral = isSevereBreathing ? "108 Ambulance" : (isNightAfter10PM ? "104 Health Helpline" : "ESIS Dispensary");
    let breathReason = isSevereBreathing
      ? "Severe respiratory distress with gasping or inability to speak in full sentences requires immediate 108 Emergency Ambulance dispatch."
      : "Respiratory difficulty requires clinical evaluation and nebulization/medication at dispensary.";

    return {
      probingQuestion: enforceSingleQuestion(
        'Ask the IP: "Are you struggling to breathe, gasping for air, unable to speak in full sentences, or have bluish lips/fingertips?" (Hinglish: "Kya aapko saans lene mein bahut takleef ho rahi hai, saans phool rahi hai jisse bolna mushkil hai, ya hoth neele pad rahe hain?")'
      ),
      suggestedAnswers: [
        "Yes, gasping for air and cannot speak in full sentences (Emergency)",
        "Severe asthma attack / acute wheezing struggle (Emergency)",
        "Moderate breathing discomfort, but able to speak sentences",
        "Mild breathlessness with coughing, stable while resting",
      ],
      suspectedCondition: "Acute Respiratory Distress / Dyspnea",
      isPsychiatric: false,
      severity: breathSeverity,
      severityScore: breathSeverityScore,
      referralDestination: breathReferral,
      referralReason: breathReason,
      redFlagsDetected: isSevereBreathing ? ["Severe Respiratory Distress / Gasping for air"] : ["Dyspnea / Breathlessness reported"],
      duration: prevState.duration || "< 2 hours",
      isReadyForSummary: history.length >= 2,
      clinicalSummary: `Respiratory evaluation in progress. Clinical severity: ${breathSeverity}. Referral: ${breathReferral}.`,
    };
  }

  // 7. Snake Bite Envenomation Emergency (Critical life-threatening emergency requiring Anti-Snake Venom (ASV))
  const isSnakeBiteEmergency = /\b(snake\s*bite|saap\s*(?:ne\s*)?kaat|saanp\s*(?:ne\s*)?kaat|envenomation|snakebite)\b/i.test(effectiveInput);
  if (isSnakeBiteEmergency) {
    const hasReportedLocationOrSwelling = /\b(leg|foot|hand|arm|finger|ankle|pair|haath|swelling|sujan|pain|dard)\b/i.test(effectiveInput);

    const snakeSeverity = "High";
    const snakeSeverityScore = 10;
    const snakeReferral = "108 Ambulance";
    const snakeReason = "Snake bite is a critical life-threatening emergency requiring immediate 108 Emergency Ambulance dispatch for anti-snake venom (ASV) and casualty resuscitation.";

    const probingQ = hasReportedLocationOrSwelling
      ? 'Ask the IP: "Keep the bitten limb completely still below heart level and do not tie a tight tourniquet. Are you experiencing rapid swelling, numbness, or breathing difficulty while the 108 Ambulance is being alerted?" (Hinglish: "Kaate huye hisse ko hilayein nahi aur dil ke level se neeche rakhein, koi kassi patti na baandhein. 108 Ambulance bulayi ja rahi hai. Kya tezi se sujan, sunnta ya saans lene me takleef ho rahi hai?")'
      : 'Ask the IP: "Snake bite is a life-threatening medical emergency. Which part of your body was bitten, and is there swelling or fang marks? 108 Ambulance is being alerted immediately." (Hinglish: "Saanp ka kaatna gambhir emergency hai. Sharir ke kis hisse par kaata hai aur kya sujan ya daant ke nishan hain? 108 Ambulance turant bheji ja rahi hai.")';

    const snakeOptions = [
      "Bite on leg / foot with swelling and pain (Ambulance dispatched)",
      "Bite on hand / arm with spreading numbness (Ambulance dispatched)",
      "Difficulty breathing / dizziness after bite (Emergency)",
      "Bite marks visible, keeping limb still and calm",
    ];

    return {
      probingQuestion: enforceSingleQuestion(probingQ),
      suggestedAnswers: snakeOptions,
      suspectedCondition: "Snake Bite",
      isPsychiatric: false,
      severity: snakeSeverity,
      severityScore: snakeSeverityScore,
      referralDestination: snakeReferral,
      referralReason: snakeReason,
      redFlagsDetected: ["Snake bite envenomation / Neurotoxic-hemotoxic risk"],
      duration: prevState.duration || "Reported today (< 2 hours)",
      isReadyForSummary: true, // Emergency: immediately ready, do not delay ambulance dispatch!
      clinicalSummary: "Snake bite reported. Immediate 108 Emergency Ambulance dispatch required for Anti-Snake Venom (ASV) and casualty stabilization.",
    };
  }

  // 4. Truly Adaptive Clinical Synthesizer tailored to the caller's specific complaint
  const cleanInputWithoutTimestamps = stripClockAndCalendarTimestamps(cleanInput);
  const nlp = extractClinicalEntities(cleanInputWithoutTimestamps || cleanInput, "probing", prevState);
  const domain = nlp.domain || detectClinicalDomain(cleanInputWithoutTimestamps || cleanInput, prevState);
  let conditionLabel = nlp.conditionLabel || DOMAIN_LABELS[domain] || "Clinical Condition";

  const hasKnownDuration = Boolean(
    (prevState.duration && prevState.duration !== "Not specified" && prevState.duration !== "Not yet assessed") ||
    nlp.detectedDuration ||
    /\b(\d+\s*(?:days?|hours?|weeks?|months?|years?|din|ghante|mahine|saal)|yesterday|today|kal se|subah se|aaj se|since\s+\w+)\b/i.test(effectiveInput) ||
    hasAsked(["kitne din", "how many days", "duration", "since when", "kab se", "suddenly today", "what time", "what date", "start date"])
  );

  // Build progressive disease-adaptive probing question tailored to the exact complaint
  let currentStep;

  // Dedicated Dysmenorrhea / Period Cramps & Pelvic Pain Branch
  if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari|periods cramps|period cramps|periods ka dard|mahavari dard)\b/i.test(effectiveInput)) {
    conditionLabel = "Dysmenorrhea / Menstrual Cramps";

    const isPainManageable = /\b(manageable|can move|can walk|moving around|theek hai|chal pa|bearable|tolerable|not severe|ghoom sakti)\b/i.test(cleanInput) ||
      /\b(manageable|can move|can walk|moving around|bearable|tolerable)\b/i.test(affirmativeCallerText);

    const hasAskedMobilityOrBleeding = hasAsked(["stand", "walk", "intense", "chalne", "khade", "bleeding", "heavy flow", "clot", "thakke", "manageable"]);
    const hasAskedMedicationOrRemedy = hasAsked(["meftal", "paracetamol", "dawai", "hot water", "sikai", "thaili", "remedy", "tablet", "medicine"]);
    const hasAskedAssociatedOrRedFlags = hasAsked(["fever", "bukhar", "vomit", "ulti", "faint", "behosh", "pre-existing", "bp", "sugar"]);

    if (!hasAskedMobilityOrBleeding && !isPainManageable) {
      currentStep = {
        title: "Cramp Severity & Bleeding Assessment",
        question: 'Ask the IP: "Is the menstrual cramp pain manageable allowing you to move around, or is it so severe that you cannot stand or walk? Also, are you experiencing unusually heavy bleeding or large blood clots?" (Hinglish: "Kya periods ka dard control mein hai jisse aap chal-phir pa rahi hain, ya dard bahut zyada hai? Aur kya bleeding normal se zyada ya bade thakke aa rahe hain?")',
        options: [
          "Pain is manageable, able to walk and move around",
          "Severe cramp pain, unable to stand or perform routine work",
          "Very heavy bleeding with large clots and weakness",
          "Moderate lower belly cramps and lower back ache",
        ],
        severity: "Moderate",
      };
    } else if (!hasAskedMedicationOrRemedy) {
      currentStep = {
        title: "Medication & Home Comfort Measures",
        question: 'Ask the IP: "Have you taken any pain reliever (such as Meftal-Spas or Paracetamol) or applied a warm water heating bag on your lower abdomen?" (Hinglish: "Kya aapne dard ke liye koi dawai jaise Meftal-Spas ya Paracetamol li hai, ya garam paani ki thaili se sikai ki hai?")',
        options: [
          "Used warm water heating bag with partial comfort",
          "Taken antispasmodic / pain relief tablet (Meftal-Spas)",
          "Have not taken any medication or pain reliever yet",
          "Took medicine but cramps are still persisting",
        ],
        severity: "Moderate",
      };
    } else if (!hasAskedAssociatedOrRedFlags) {
      currentStep = {
        title: "Associated Gynecological & Systemic Symptoms",
        question: 'Ask the IP: "Do you have any severe vomiting, high fever, dizziness, or any pre-existing health conditions?" (Hinglish: "Kya saath mein ulti, tez bukhar ya behoshi jaisa lag raha hai, aur kya pehle se koi bimari hai?")',
        options: [
          "No vomiting or fever, only menstrual cramps",
          "Mild nausea and weakness, but no fever",
          "High fever with severe pelvic pain",
          "Feeling dizzy and faint when standing up",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Clinical Referral & Home Guidance",
        question: 'Ask the IP: "Please rest in a comfortable position and stay well hydrated with warm fluids. Would you like a tele-consultation with a doctor on 104, or guidance to the nearest ESIS Dispensary during OPD hours?" (Hinglish: "Aaram karein aur gunguna paani ya soup piyein. Kya aap 104 helpline par doctor se phone par baat karna chahti hain ya nazdeeki ESIS dispensary jana chahti hain?")',
        options: [
          "Connect with 104 Health Helpline for tele-doctor advice",
          "Will visit ESIS Dispensary during regular OPD hours",
          "Symptoms are under control with rest and fluids",
          "Require doctor tele-consultation on phone",
        ],
        severity: "Moderate",
      };
    }
  }

  // Dedicated Ophthalmic / Eye Complaint Evaluation Branch
  else if (/\b(eye|eyes|aankh|aankhein|vision|swollen eye|red eye|eye pain|conjunctivitis|cornea|watering eye|photophobia|light hurts|blurr\w* vision)\b/i.test(effectiveInput)) {
    conditionLabel = "Ophthalmic Distress / Red Eye Evaluation";
    if (!hasAsked(["vision", "dikhai", "clear", "blur", "roshni"]) && !/\b(vision.*(?:clear|normal)|dikhai.*theek)\b/i.test(cleanInput)) {
      currentStep = {
        title: "Visual Acuity & Vision Check",
        question: 'Ask the IP: "Is the vision clear in that eye, or are you having any blurriness, sudden loss of vision, or halos around lights?" (Hinglish: "Kya aankh se saaf dikh raha hai ya dhundhlapan, kam dikhna ya roshni ke aas-paas ghera dikh raha hai?")',
        options: [
          "Vision is completely clear, only redness and irritation",
          "Mild blurriness with tearing and light sensitivity",
          "Sudden significant drop or loss of vision (Urgent)",
          "Seeing rainbow halos or dark spots",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["chot", "injury", "dust", "chemical", "foreign body", "dhool", "kuch gira"])) {
      currentStep = {
        title: "Eye Trauma & Foreign Object Assessment",
        question: 'Ask the IP: "Did any dust, insect, chemical splash, or physical injury hit the eye?" (Hinglish: "Kya aankh me koi dhool, keeda, chemical ya koi chot lagi hai?")',
        options: [
          "No injury or foreign object, just redness and pain",
          "Dust or tiny particle fell into the eye",
          "Chemical splash / soap / sanitizer went into eye",
          "Minor scratch or eye rubbing strain",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["discharge", "keechad", "paani", "sticky", "tearing"])) {
      currentStep = {
        title: "Eye Discharge & Secretion Check",
        question: 'Ask the IP: "Is there yellow/green sticky discharge or crusting on the eyelashes, or continuous watery tearing?" (Hinglish: "Kya aankh se peela/chchipchipa keechad nikal raha hai ya lagatar paani beh raha hai?")',
        options: [
          "Watery tearing and sensitivity to light",
          "Yellowish sticky discharge sticking eyelids together",
          "Mild grittiness, feeling like sand in the eye",
          "No discharge, only red and swollen eyelid",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Ophthalmic Care & Drop Assessment",
        question: 'Ask the IP: "Have you washed the eye with clean cool water or put any eye drops, and does bright light hurt?" (Hinglish: "Kya aapne aankh ko saaf thande paani se dhoya hai ya koi drop daali hai, aur kya tez roshni se dard hota hai?")',
        options: [
          "Washed with cool water; light is hurting (photophobia)",
          "Put lubricant / cooling eye drops with slight relief",
          "Have not put any drops or medication yet",
          "Pain is tolerable, eyelid is swollen",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(snake|bite|sting|insect|saap|kutta|dog bite|animal bite|kat liya|dank)\b/i.test(effectiveInput)) {
    conditionLabel = "Suspected Snake / Animal Bite Envenomation";
    if (!hasAsked(["kahan", "where on your body", "kis hisse"])) {
      currentStep = {
        title: "Bite Location Inquiry",
        question: 'Ask the IP: "Where on your body did the bite occur?" (Hinglish: "Sharir ke kis hisse par kaata hai?")',
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
        question: 'Ask the IP: "Can you describe what the bite mark looks like, such as two puncture marks or redness?" (Hinglish: "Kya bite ka nishan do daant ke nishan ya laal dhabbe jaisa dikh raha hai?")',
        options: [
          "Two clear puncture fang marks visible",
          "Single scratch or puncture wound",
          "Redness and bruising, marks unclear",
          "No visible marks, only pain",
        ],
        severity: "High",
      };
    }
  } else if (!hasChestPainDenial && /\b(chest pain|chhati me dard|seene me dard|heart attack|angina|crushing chest|crushing pain in chest|pressure in chest|baayein haath me dard)\b/i.test(effectiveInput)) {
    conditionLabel = "Suspected Acute Coronary Syndrome";
    if (!hasAsked(["radiating", "left arm", "jaw", "baayein haath"])) {
      currentStep = {
        title: "Cardiac Ischemia Evaluation",
        question: 'Ask the IP: "Is the chest pain feeling like heavy crushing pressure radiating to your left arm or jaw?" (Hinglish: "Kya seene me bhaari dabav mehsoos ho raha hai jo baayein haath ya jabde ki taraf ja raha hai?")',
        options: [
          "Heavy crushing chest pressure radiating to left arm",
          "Sharp stinging chest pain when breathing in",
          "Burning sensation in chest / acidity feeling",
          "Dull heaviness with cold sweating and nausea",
        ],
        severity: "High",
      };
    } else if (!hasAsked(["breath", "saans", "sweating", "pasina"])) {
      currentStep = {
        title: "Cardiac Associated Symptoms",
        question: 'Ask the IP: "Are you having shortness of breath, cold sweating, or dizziness along with the chest pain?" (Hinglish: "Kya seene ke dard ke saath saans phoolna, thanda pasina ya chakkar aa rahe hain?")',
        options: [
          "Severe shortness of breath with sweating",
          "Cold sweating and extreme weakness",
          "Dizziness when standing up",
          "No breathlessness, only localized pain",
        ],
        severity: "High",
      };
    } else {
      currentStep = {
        title: "Cardiac Medical History",
        question: 'Ask the IP: "Do you have a known history of high blood pressure, diabetes, or heart conditions?" (Hinglish: "Kya aapko pehle se high BP, diabetes ya dil ki bimari ki takleef hai?")',
        options: [
          "Yes, known high BP and heart medication",
          "Yes, diabetic for several years",
          "No prior medical history known",
          "Taking daily BP medications",
        ],
        severity: "High",
      };
    }
  } else if (/\b(breath|saans|wheezing|asthma|dum ghutna|shortness)\b/i.test(effectiveInput)) {
    conditionLabel = "Acute Respiratory Distress / Bronchospasm";
    if (!hasAsked(["gasping", "full sentences", "blue", "haanf", "poori baat", "speak normally"])) {
      currentStep = {
        title: "Severe Breathing Emergency Evaluation",
        question: 'Ask the IP: "Is the difficulty in breathing so severe that you are gasping for air, skin or lips turning blue, or unable to speak in full sentences?" (Hinglish: "Kya saans lene me itni zyada takleef hai ki aap haanf rahe hain, honth/tvacha neeli pad rahi hai, ya poori baat ek baar me nahi bol pa rahe?")',
        options: [
          "Yes, gasping for air and cannot speak in full sentences (Emergency)",
          "Lips or skin look bluish / struggling for every breath (Emergency)",
          "No, I can speak normally but feel breathless",
          "Manageable breathlessness with cough and congestion",
        ],
        severity: "High",
      };
    } else if (!hasAsked(["cough", "khansi", "fever", "bukhar", "phlegm"])) {
      currentStep = {
        title: "Respiratory Associated Signs",
        question: 'Ask the IP: "Are you also having a high fever, chills, or chest congestion?" (Hinglish: "Kya saath me tez bukhar, thand ya seene me jakdan bhi hai?")',
        options: [
          "High fever with chills and shivering",
          "Continuous dry cough with throat pain",
          "Productive cough with yellow/green phlegm",
          "No fever, only chest tightness and wheezing",
        ],
        severity: "High",
      };
    } else {
      currentStep = {
        title: "Inhaler & Asthma History",
        question: 'Ask the IP: "Do you use an asthma inhaler or have a history of lung conditions?" (Hinglish: "Kya aap ghar par asthma ka inhaler lete hain ya pehle se koi takleef hai?")',
        options: [
          "Using inhaler, but getting limited relief",
          "Took inhaler and feeling slightly better",
          "Do not have asthma or inhaler",
          "First time having this severe breathlessness",
        ],
        severity: "High",
      };
    }
  } else if (/\b(fever|bukhar|temperature|chills|shivering|cold|sardi)\b/i.test(effectiveInput)) {
    conditionLabel = "Febrile Symptoms with Chills";
    if (!hasKnownDuration && !hasAsked(["kitne din", "how many days", "duration", "since when", "kab se"])) {
      currentStep = {
        title: "Febrile Pattern & Onset",
        question: 'Ask the IP: "Since how many days have you been running this fever?" (Hinglish: "Aapko yeh bukhar kitne dino se aa raha hai?")',
        options: [
          "Started today (< 24 hours)",
          "For the past 1 to 2 days",
          "4 to 7 days (Ongoing)",
          "More than a week (Persistent)",
        ],
        severity: "High",
      };
    } else if (!hasAsked(["gasping", "breath", "saans", "haanf", "full sentences", "chills"])) {
      currentStep = {
        title: "Febrile Associated Symptoms & Airway Warning Signs",
        question: 'Ask the IP: "Are you having chills with shivering, or any breathing difficulty like gasping for air or inability to speak in full sentences?" (Hinglish: "Kya bukhar ke saath thand/kampkampi hai, ya saans lene me takleef jaise haanfna ya poori baat na bol pana?")',
        options: [
          "High fever with chills and shivering, breathing is manageable",
          "No, I can speak normally but feel breathless",
          "Severe breathing difficulty, gasping for air (Emergency)",
          "High fever with severe body ache and headache",
        ],
        severity: "High",
      };
    } else {
      currentStep = {
        title: "Fluid Intake & Hydration",
        question: 'Ask the IP: "Are you able to drink plenty of fluids and pass urine normally today?" (Hinglish: "Kya aap paani/taral padarth theek se pee pa rahe hain aur peshab theek ho raha hai?")',
        options: [
          "Drinking fluids well and passing normal urine",
          "Feeling nauseated, struggling to drink water",
          "Dark urine and feeling very weak",
          "Taking paracetamol with mild relief",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(allerg(?:y|ic|ies)|allergic to|allergy hai|rash|khujli|itching|daane|hives|urticaria|reaction|soojan|swelling of (?:lips|face|eyes|throat)|anaphylaxis)\b/i.test(effectiveInput)) {
    conditionLabel = "Allergic Reaction / Dermatological Distress";
    if (!hasAsked(["triggered", "wajah", "reaction", "chehre", "lips", "swelling", "bcz of what", "cause", "kis wajah"])) {
      currentStep = {
        title: "Allergy Trigger & Reaction Check",
        question: 'Ask the IP: "What triggered this allergy (such as a specific medicine, food item, insect sting, or dust), and are you having any swelling of the lips, face, or difficulty breathing?" (Hinglish: "Yeh allergy kis wajah se hui — kisi dawai, khane ki cheez, keede ke kaatne ya dhool se, aur kya honth ya chehre par sujan ya saans lene me takleef hai?")',
        options: [
          "Reaction to a specific medication / painkiller",
          "Food allergy reaction (peanuts / seafood / milk / spices)",
          "Insect sting / bite or environmental dust exposure",
          "Swelling of lips, tongue, or difficulty breathing (Urgent)",
          "Mild itchy skin rash without swelling",
        ],
        severity: /\b(lips|tongue|throat|breath|anaphylaxis|soojan|swelling)\b/i.test(effectiveInput) ? "High" : "Moderate",
      };
    } else if (!hasAsked(["dawai", "cetirizine", "avil", "medicine", "antihistamine"])) {
      currentStep = {
        title: "Allergy Medication Check",
        question: 'Ask the IP: "Have you taken any antiallergic medicine (like Cetirizine, Levocet, or Avil) or applied any lotion for this reaction?" (Hinglish: "Kya aapne is allergy ke liye koi dawai jaise Cetirizine ya Avil li hai, ya koi malham lagaya hai?")',
        options: [
          "Took Cetirizine / Avil, waiting for relief",
          "Have not taken any antiallergic medication yet",
          "Applied soothing lotion / calamine",
          "Took medicine earlier, but itching and rash spreading",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Onset & Spread",
        question: 'Ask the IP: "When did this reaction start, and is it rapidly spreading across your body?" (Hinglish: "Yeh reaction kab shuru hua aur kya yeh pooray sharir par tezi se phail raha hai?")',
        options: [
          "Started within the last 1-2 hours and spreading fast",
          "Started earlier today, localized to one area",
          "Persisting for 2 to 3 days with intense itching",
          "Mild reaction, stable and not spreading",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(vomit|ulti|nausea|loose motion|dast|diarrhea|food poison|pet kharab)\b/i.test(effectiveInput)) {
    conditionLabel = "Acute Gastroenteritis / Dehydration Risk";
    if (!hasAsked(["kitni baar", "how many times", "frequency", "episodes"])) {
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
    } else if (!hasAsked(["dawai", "medicine", "ondansetron", "domperidone", "antacid"])) {
      currentStep = {
        title: "Medication & Hydration Intake Check",
        question: 'Ask the IP: "Have you taken any medication for vomiting (like Ondansetron/Domperidone) or antacid, and are you able to sip ORS?" (Hinglish: "Kya aapne ulti ke liye koi dawai jaise Ondansetron ya antacid li hai, aur kya ORS ya paani pee pa rahe hain?")',
        options: [
          "Taking ORS; have not taken anti-emetic pill",
          "Took vomiting medicine (Ondansetron / antacid)",
          "Cannot retain any medicine or liquids (vomiting out)",
          "Have not taken any medication yet",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["pet dard", "abdominal pain", "cramps", "blood"])) {
      currentStep = {
        title: "Abdominal Pain & Dehydration",
        question: 'Ask the IP: "Are you having severe stomach cramps or feeling extreme thirst and dry mouth?" (Hinglish: "Kya pet me tez marod/dard ya bahut zyada pyaas aur gala sookh raha hai?")',
        options: [
          "Severe cramping abdominal pain",
          "Extreme thirst, dry mouth and weakness",
          "Mild stomach discomfort",
          "No pain, only frequent loose stools",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "ORS & Hydration Status",
        question: 'Ask the IP: "Have you started taking ORS (electrolytes) or boiled water with salt-sugar?" (Hinglish: "Kya aapne ORS ghol ya namak-cheeni ka paani peena shuru kiya hai?")',
        options: [
          "Yes, drinking ORS solution regularly",
          "Vomiting everything including ORS",
          "Have not started ORS yet",
          "Drinking plain water in small sips",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(weakness|dizzy|dizziness|faint|chakkar|kamzori|fatigue|giddiness|unsteady)\b/i.test(effectiveInput)) {
    conditionLabel = "Acute Weakness & Postural Dizziness";
    if (!hasKnownDuration && !hasAsked(["kitne din", "how many days", "duration", "since when", "kab se", "suddenly today"])) {
      currentStep = {
        title: "Onset & Orthostatic Instability",
        question: 'Ask the IP: "Did this dizziness and weakness come on suddenly today or has it been gradual?" (Hinglish: "Kya yeh kamzori aur chakkar aaj achanak shuru hue ya dheere-dheere badh rahe hain?")',
        options: [
          "Sudden severe onset today",
          "Gradual weakness over past 2 to 3 days",
          "Comes only when standing up from bed or chair",
          "Mild fatigue with lightheadedness",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["stand", "walk", "chal", "khade", "unsteady", "support"])) {
      currentStep = {
        title: "Postural Stability & Safety",
        question: 'Ask the IP: "Are you able to stand and walk safely without losing balance?" (Hinglish: "Kya aap bina ladkhadaye khade ho kar chal pa rahe hain?")',
        options: [
          "Very unsteady, cannot stand without support",
          "Dizzy only when changing positions",
          "Mild weakness, can walk slowly",
          "Feeling faint with cold sweating",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Associated Weakness Screening",
        question: 'Ask the IP: "Are you having any blurred vision, slurred speech, or numbness in your arms or legs?" (Hinglish: "Kya aankhon ke aage andhera, bolne me ladkhadahat ya haath-pair me sunnta mehsoos ho rahi hai?")',
        options: [
          "Vision getting blurry and lightheaded",
          "Numbness or tingling in arms/legs",
          "Speech is clear, just generalized fatigue",
          "Feeling hungry and low on energy",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(headache|sar dard|sir dard|migraine|head pain)\b/i.test(effectiveInput)) {
    conditionLabel = "Acute Cephalea / Migraine under Investigation";
    if (!hasAsked(["kis tarah", "type of headache", "character", "throbbing"])) {
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
    } else if (!hasAsked(["vomiting", "ulti", "light", "roshni", "neck", "gardan"])) {
      currentStep = {
        title: "Neurological Headache Screening",
        question: 'Ask the IP: "Are you experiencing vomiting, sensitivity to bright light, or neck stiffness?" (Hinglish: "Kya sirdard ke saath ulti, tez roshni se pareshani ya gardan me akad mehsoos ho rahi hai?")',
        options: [
          "Severe sensitivity to light and sound",
          "Nausea and feeling like vomiting",
          "Stiff neck with fever",
          "No light sensitivity, only head heaviness",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Headache Triggers & Sleep",
        question: 'Ask the IP: "Have you been under heavy stress, lack of sleep, or screen strain recently?" (Hinglish: "Kya neend ki kami, screen time ya zyada tanav ki wajah se yeh dard badha hai?")',
        options: [
          "Due to severe lack of sleep and stress",
          "Started after long screen exposure",
          "Comes regularly every few weeks",
          "Sudden onset without clear trigger",
        ],
        severity: "Moderate",
      };
    }
  } else if (!isAccidentDenied && /\b(fall|fell|falling|gira|giri|bed se|chhat se|height|tripped|slip|slipped|sleeped|slept from|car|bike|vehicle|auto|bus|accident|scooty|injury|chot|hit)\b/i.test(effectiveInput)) {
    conditionLabel = "Traumatic Fall / Accident Injury Assessment";
    if (!hasAsked(["hit your head", "sar par chot", "limbs", "hisse me dard", "where are you hurt", "kahan chot", "where on your body"])) {
      currentStep = {
        title: "Incident & Injury Location Screening",
        question: 'Ask the IP: "Where on your body did you get hurt or feel pain when you slipped / fell from the vehicle?" (Hinglish: "Girte ya chot lagte waqt aapko sharir ke kis hisse me chot ya dard mehsoos ho raha hai?")',
        options: [
          "Severe pain in arm / leg / back / ribs",
          "Hit my head, feeling dizzy or dazed",
          "Bleeding / cut wound needing dressing",
          "Bruised and sore, but can move limbs",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["swelling", "sujan", "move", "weight", "khade"])) {
      currentStep = {
        title: "Fracture & Mobility Evaluation",
        question: 'Ask the IP: "Is there visible swelling or inability to move the injured limb?" (Hinglish: "Kya chot lagi jagah par sujan hai ya haath-pair hilane me asahniya dard ho raha hai?")',
        options: [
          "Severe swelling and cannot bear weight",
          "Can move fingers/toes with mild pain",
          "Deformity or bone bend suspected",
          "Minor bruise with mild tenderness",
        ],
        severity: "High",
      };
    } else {
      currentStep = {
        title: "Post-Fall Vitality Check",
        question: 'Ask the IP: "Are you having any nausea, vomiting, or memory confusion after the fall?" (Hinglish: "Kya girne ke baad ulti jaisa lagna ya chakkar aane ki takleef hai?")',
        options: [
          "Feeling nauseated and slight confusion",
          "Alert and oriented, only localized body pain",
          "Mild headache from the fall impact",
          "No dizziness or nausea",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(cut|bleeding|injury|chot|fracture|wound|trauma)\b/i.test(effectiveInput)) {
    conditionLabel = "Traumatic Injury / Wound Assessment";
    if (!hasAsked(["active continuous bleeding", "lagataar khoon", "bleeding from the wound"])) {
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
    } else if (!hasAsked(["cloth", "pressure", "dabav", "tetanus", "tika"])) {
      currentStep = {
        title: "Wound Management & Cleanliness",
        question: 'Ask the IP: "Have you washed the wound with clean water and covered it with a clean bandage or cloth?" (Hinglish: "Kya aapne ghaav ko saaf paani se dho kar saaf kapde ya patti se dhaka hai?")',
        options: [
          "Covered with clean cloth and holding pressure",
          "Washed with water, cut is open",
          "Need tetanus injection and dressing",
          "Minor scrape requiring antiseptic",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Injury Functional Impact & Mobility",
        question: 'Ask the IP: "Is the pain from the injury preventing you from moving the area or resting comfortably?" (Hinglish: "Kya chot ke dard ki wajah se hilna-dulna ya aaram karna mushkil ho raha hai?")',
        options: [
          "Severe unbearable pain — cannot move the injured area",
          "Continuous sharp pain, worsens on movement",
          "Moderate stinging pain, manageable with rest",
          "Mild localized discomfort",
        ],
        severity: "Moderate",
      };
    }
  } else if (/\b(hand|hands|wrist|wrists|finger|fingers|palm|thumb|haath\b|hath\b|kalai\b|leg|legs|knee|knees|ankle|ankles|foot|feet|pair\b|taang\b|thigh|calf|calves|arm|arms|elbow|shoulder|bone|joint|joints|jod\b|back pain|kamar)\b/i.test(effectiveInput)) {
    const isUpperLimb = /\b(hand|wrist|finger|palm|thumb|haath|kalai|arm|elbow|shoulder)\b/i.test(effectiveInput);
    if (/\b(wrist|kalai)\b/i.test(effectiveInput) && /\b(hand|haath)\b/i.test(effectiveInput)) {
      conditionLabel = "Hand & Wrist Pain";
    } else if (/\b(wrist|kalai)\b/i.test(effectiveInput)) {
      conditionLabel = "Pain in Wrist Area";
    } else if (/\b(hand|haath|finger)\b/i.test(effectiveInput)) {
      conditionLabel = "Pain in Hand";
    } else if (/\b(arm|shoulder|elbow)\b/i.test(effectiveInput)) {
      conditionLabel = "Arm & Shoulder Pain";
    } else if (/\b(knee|ghutna)\b/i.test(effectiveInput)) {
      conditionLabel = "Knee Pain";
    } else {
      conditionLabel = "Limb & Musculoskeletal Pain";
    }

    if (!hasAsked(["walk", "bear weight", "vajan", "chalne", "chal", "hilane", "move", "weight", "grip", "fingers"])) {
      currentStep = isUpperLimb
        ? {
            title: "Limb Movement & Severity Assessment",
            question: 'Ask the IP: "Could you please tell me if you are able to move your wrist and fingers, or is there swelling, deformity, or severe pain on movement?" (Hinglish: "Kya aap apni kalai aur ungliyan hila pa rahe hain, ya sujan aur hilane me tez dard hai?")',
            options: [
              "Cannot move wrist or fingers due to severe pain",
              "Severe swelling and sharp pain when moving",
              "Moderate pain, can move fingers slightly",
              "Mild discomfort, movement is manageable",
            ],
            severity: /cannot move|sharp pain|severe swelling/i.test(cleanInput) ? "High" : "Moderate",
          }
        : {
            title: "Mobility & Weight Bearing Assessment",
            question: 'Ask the IP: "Are you able to walk and bear weight on your leg, or is there swelling, bruising, or severe pain on movement?" (Hinglish: "Kya aap pair par vajan daal kar chal pa rahe hain, ya sujan aur hilane me tez dard hai?")',
            options: [
              "Cannot bear weight or walk at all",
              "Severe swelling and sharp pain on movement",
              "Can walk with a limp / mild support",
              "Mild soreness, able to walk slowly",
            ],
            severity: /cannot bear weight|sharp pain|severe swelling/i.test(cleanInput) ? "High" : "Moderate",
          };
    } else if (!hasAsked(["injury", "twist", "chot", "moch", "accident", "fall"])) {
      currentStep = {
        title: "Mechanism of Pain & Injury Screening",
        question: 'Ask the IP: "Did this pain start after a sudden twist, heavy work, lifting, or a fall/injury?" (Hinglish: "Kya yeh dard kisi moch, girne, bhari vajan uthane ya chot lagne ke baad shuru hua?")',
        options: [
          "Sudden twist or sprain while working/walking",
          "Recent fall or blunt impact",
          "Gradual aching pain without any injury",
          "Muscle cramp after prolonged standing/physical work",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["numbness", "tingling", "sunn", "jhanjhanahat", "weakness"])) {
      currentStep = {
        title: "Neurological & Circulation Assessment",
        question: 'Ask the IP: "Is there any numbness, tingling sensation, coldness, or radiating pain down the leg or foot?" (Hinglish: "Kya pair me sunn-pan, jhanjhanahat ya thanda padne jaisa lag raha hai?")',
        options: [
          "Numbness and tingling reaching the toes/foot",
          "Radiating sharp pain from hip down to leg",
          "Swelling and local tenderness only",
          "No numbness, only muscle soreness",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Musculoskeletal Pain Impact & Medication",
        question: 'Ask the IP: "Have you taken any pain reliever, or applied ice/warm fomentation, and did it provide relief?" (Hinglish: "Kya aapne dard ke liye koi davai li ya sikai ki hai, aur kya usse aaram mila?")',
        options: [
          "Took painkiller, but pain is still severe",
          "Applied balm/fomentation with mild relief",
          "Have not taken any medicines yet",
          "Need doctor examination and prescription",
        ],
        severity: "Moderate",
      };
    }
  } else {
    // General Medical Complaint - Progressive 3-stage clinical inquiry
    conditionLabel = prevState.suspectedCondition || "General Medical Evaluation";
    const alreadyDescribedSymptom = /\b(pain|dard|fever|bukhar|cough|khasi|headache|sirdard|cut|bleed|vomit|leg|chest|stomach|chot|swelling)\b/i.test(cleanInput);
    if (!hasAsked(["where you are feeling", "what exact symptoms", "kahan dard", "kya mukhya lakshan", "describe where"]) && !alreadyDescribedSymptom) {
      currentStep = {
        title: "Main Complaint & Specific Symptoms",
        question: 'Ask the IP: "Could you please describe where you are feeling pain or discomfort and what exact symptoms you are experiencing?" (Hinglish: "Kripya batayein aapko kahan dard ya takleef mehsoos ho rahi hai aur kya mukhya lakshan hain?")',
        options: [
          "Pain or injury in limbs / body",
          "Chest discomfort or breathing difficulty",
          "Stomach pain / gastric issue / nausea",
          "Headache, dizziness, or fever",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["other symptoms", "fever, pain", "associated", "bukhar, dard", "chakkar"])) {
      currentStep = {
        title: "Associated Red Flags & Secondary Symptoms",
        question: 'Ask the IP: "Are you experiencing any other symptoms such as severe pain, breathing difficulty, bleeding, or dizziness?" (Hinglish: "Kya aapko tez dard, saans lene me dikkat, khoon behna ya chakkar jaisi koi aur pareshani bhi hai?")',
        options: [
          "Severe pain and physical weakness",
          "Shortness of breath / dizziness",
          "Mild fever or stomach upset",
          "No other emergency symptoms",
        ],
        severity: "Moderate",
      };
    } else if (!hasKnownDuration && !hasAsked(["since when", "how many days", "duration", "kab se"])) {
      currentStep = {
        title: "Complaint Duration & Onset",
        question: 'Ask the IP: "Since when have you had this condition, and did it start suddenly today or a few days ago?" (Hinglish: "Yeh takleef kab se shuru hui hai aur kitne dino se ho rahi hai?")',
        options: [
          "Started suddenly today (< 24 hours)",
          "For the past 1 to 2 days",
          "For 3 to 7 days (Ongoing)",
          "More than a week / persistent",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["daily routine", "eat, drink", "khane-peene", "aaram", "affecting"])) {
      currentStep = {
        title: "Functional Impact & Daily Activity",
        question: 'Ask the IP: "Is this discomfort preventing you from eating, sleeping, or carrying out your daily work?" (Hinglish: "Kya is takleef ki wajah se khane-peene, sone ya kaam karne me dikkat aa rahi hai?")',
        options: [
          "Unable to work or rest comfortably",
          "Moderate discomfort, able to do light tasks",
          "Mild discomfort, managing daily routine",
          "Need doctor examination and medicines today",
        ],
        severity: "Moderate",
      };
    } else if (!hasAsked(["pre-existing", "diabetes", "high bp", "asthma", "purani bimari", "comorbidit", "blood pressure"])) {
      currentStep = {
        title: "Comorbidity & Ongoing Medication Check",
        question:
          'Ask the IP: "Do you have any pre-existing health conditions such as high blood pressure, diabetes, asthma, or heart disease, and are you taking any regular medications for them?" (Hinglish: "Kya aapko pehle se high BP, diabetes/sugar, asthma ya dil ki koi bimari hai, aur kya aap koi regular dawai lete hain?")',
        options: [
          "History of High BP / taking BP medicine",
          "History of Diabetes / on sugar medication",
          "History of Asthma / using inhaler",
          "No pre-existing health conditions or regular medicines",
        ],
        severity: "Moderate",
      };
    } else {
      currentStep = {
        title: "Medical History & Pehchan Card",
        question: 'Ask the IP: "Do you have your ESIC Pehchan card with you for visiting the doctor?" (Hinglish: "Kya doctor ko dikhane ke liye aapke paas ESIC Pehchan card upalabdha hai?")',
        options: [
          "Yes, I have my ESIC Pehchan card ready",
          "Need guidance on finding the nearest facility",
          "Would like tele-doctor guidance on 104",
          "Carrying previous prescriptions",
        ],
        severity: "Moderate",
      };
    }
  }

  const isPsychFallback = Boolean(
    prevState.isPsychiatric ||
    /\b(suicid\w*|mar ja\w*|depress\w*|anxiety\b|ghabrahat\b|mental health|tele-manas|14416|udaas\b|hopeless)\b/i.test(effectiveInput)
  );

  const isSevere =
    currentStep.severity === "High" ||
    /emergency|fracture|dvt|blood|vomit blood|unconscious|rigors|severe|chest pain|chhati|poison|snake|bite/i.test(cleanInput) ||
    prevState.severity === "High";

  // If conversation has reached turn 5-7 without breaking flow and comorbidity hasn't been asked yet
  const hasAskedComorbidityAlready = hasAsked(["pre-existing", "diabetes", "high bp", "asthma", "purani bimari", "comorbidit", "blood pressure"]);
  const userTurnsCountFallback = history.filter((m) => m.role === "user" || m.sender === "user").length;
  if (!isSevere && (userTurnsCountFallback >= 5 || botCount >= 5) && !hasAskedComorbidityAlready && !isPsychFallback && !isAccident) {
    currentStep = {
      title: "Comorbidity & Ongoing Medication Check",
      question:
        'Ask the IP: "Do you have any pre-existing health conditions such as high blood pressure, diabetes, asthma, or heart disease, and are you taking any regular medications for them?" (Hinglish: "Kya aapko pehle se high BP, diabetes/sugar, asthma ya dil ki koi bimari hai, aur kya aap koi regular dawai lete hain?")',
      options: [
        "History of High BP / taking BP medicine",
        "History of Diabetes / on sugar medication",
        "History of Asthma / using inhaler",
        "No pre-existing health conditions or regular medicines",
      ],
      severity: "Moderate",
    };
  }

  const ambulanceFallbackCheck = isLifeThreateningAmbulanceCase(effectiveInput, isSevere ? 9 : 5, { symptom_notes: cleanInput }, prevState);
  const isLifeThreateningCrisis = ambulanceFallbackCheck.is108;

  // STRICT RULE: If the case is NOT a genuine life-and-death emergency, DO NOT score it 9!
  const severity = isLifeThreateningCrisis ? "High" : (isSevere && !isLifeThreateningCrisis ? "Moderate" : /mild|no pain/i.test(cleanInput) ? "Mild" : "Moderate");
  const severityScore = isLifeThreateningCrisis ? 9 : (severity === "High" ? 7 : severity === "Moderate" ? 6 : 3);

  let referralDestination;
  let referralReason;
  let secondaryReferral = null;
  let isDualProtocol = false;

  const fallbackDispensaryStatus = getDispensaryOperatingStatus();
  const isNacoHIV = /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease)\b/i.test(effectiveInput);

  // Check IST time:
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const hour = istDate.getHours();
  const currentMinutes = hour * 60 + istDate.getMinutes();
  const isNightAfter10PM = hour >= 22 || hour < 6; // 10:00 PM to 6:00 AM IST
  const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM to 10:00 AM IST

  const isIpdEmergency = /\b(ipd|inpatient|admit|admission|admitted|icu|intensive care|emergency admit)\b/i.test(effectiveInput);
  const hasEsicReferral = /\b(esic referral|referred by esic|referral letter|doctor referral|referred to tie.?up)\b/i.test(effectiveInput);
  const isTieUpEligible = isIpdEmergency || hasEsicReferral || /\b(tie.?up|empanelled)\b/i.test(effectiveInput);
  const isDistHospRequest = /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|immunization|vaccination|tika|tika karan|child vaccine)\b/i.test(effectiveInput);
  const hasPhysicalHealth =
    isSevere ||
    /\b(fever|bukhar|chest|chhati|heart|pain|dard|bleed|wound|cut|accident|injury|chot|vomit|ulti|loose motion|dast|fracture|burn|poison|snake|bite|breath|saans|cough|dizzy|chakkar|kamzori|stone|bp|headache|rash|infection)\b/i.test(effectiveInput);

  if (isLifeThreateningCrisis) {
    referralDestination = "108 Ambulance";
    referralReason = ambulanceFallbackCheck.reason || "Acute life-and-death emergency requiring immediate 108 Ambulance dispatch.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (isPsychFallback) {
    referralDestination = "104 Health Helpline";
    referralReason = "Beneficiary requires psychological counseling or emotional support; transfer to 104 Health Helpline for 24x7 doctor & counselling support.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (isNacoHIV) {
    referralDestination = "104 Health Helpline";
    referralReason = "Confidential sexual health / HIV-AIDS counseling; transfer to 104 Health Helpline.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (isDistHospRequest) {
    referralDestination = "Govt District Hospital";
    referralReason = "Public healthcare outside ESIC network; guide to nearest Govt District Hospital.";
    secondaryReferral = "104 Health Helpline";
    isDualProtocol = false;
  } else if (isTieUpEligible) {
    referralDestination = "Nearest Tie-Up Facility";
    referralReason = "Refer to nearest Empanelled Tie-Up Facility for cashless treatment under ESI guidelines.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (conditionLabel === "Dysmenorrhea / Menstrual Cramps") {
    if (isNightAfter10PM || isOffHours || !fallbackDispensaryStatus.isOpen) {
      referralDestination = "104 Health Helpline";
      referralReason = "Night hours (after 10:00 PM): Manageable menstrual cramps (dysmenorrhea). Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
      secondaryReferral = "ESIC Hospital";
    } else {
      referralDestination = "ESIS Dispensary";
      referralReason = "Daytime (10:00 AM – 4:00 PM): Routine primary care; visit nearest ESIS dispensary during regular OPD hours for doctor evaluation and antispasmodic medicines.";
      secondaryReferral = "104 Health Helpline";
    }
    isDualProtocol = false;
  } else if (isNightAfter10PM) {
    // Night hours (after 10:00 PM) manageable case -> 104 Health Helpline
    referralDestination = "104 Health Helpline";
    referralReason = "Night hours (after 10:00 PM): Condition is manageable. Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (isOffHours || !fallbackDispensaryStatus.isOpen) {
    referralDestination = "104 Health Helpline";
    referralReason = "Dispensary and hospital OPD hours are closed (10:00 AM – 4:00 PM). Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
    secondaryReferral = "ESIC Hospital";
    isDualProtocol = false;
  } else if (severity === "Mild" || /advice|phone doctor|guidance|information/i.test(effectiveInput)) {
    referralDestination = "104 Health Helpline";
    referralReason = `Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
    secondaryReferral = "ESIS Dispensary";
    isDualProtocol = false;
  } else if (fallbackDispensaryStatus.isOpen && severity !== "High") {
    referralDestination = "ESIS Dispensary";
    referralReason = "Daytime (10:00 AM – 4:00 PM): Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
    secondaryReferral = "104 Health Helpline";
    isDualProtocol = false;
  } else {
    referralDestination = "ESIC Hospital";
    referralReason = "Advanced specialized or secondary hospital care within ESIC network.";
    secondaryReferral = "ESIS Dispensary";
    isDualProtocol = false;
  }

  if (secondaryReferral === referralDestination) {
    secondaryReferral = referralDestination === "ESIC Hospital" ? "104 Health Helpline" : "ESIC Hospital";
  }

  const fallbackUserTurns = history.filter((m) => m.role === "user" || m.sender === "user").length + 1;
  if (fallbackUserTurns < 3 && !isLifeThreateningCrisis) {
    referralDestination = null;
    referralReason = null;
  }

  const duration = nlp.detectedDuration || prevState.duration || "Reported today";
  const fallbackComorbidity = extractComorbiditiesFromText(effectiveInput, prevState.comorbidity || prevState.comorbidities);
  const fallbackAllergies = extractAllergiesFromText(effectiveInput, prevState.allergies);
  const fallbackMedications = extractMedicationsFromText(effectiveInput, prevState.medications || prevState.medication);

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
    isPsychiatric: isPsychFallback,
    severity,
    severityScore,
    referralDestination,
    referralReason,
    is_dual_protocol: isDualProtocol,
    call_referral_secondary: secondaryReferral,
    redFlagsDetected: isSevere ? ["Acute presentation / high severity reported"] : [],
    duration,
    comorbidity: fallbackComorbidity,
    comorbidities: fallbackComorbidity,
    allergies: fallbackAllergies,
    medication: fallbackMedications,
    medications: fallbackMedications,
    isReadyForSummary: history.length >= 6 || isSevere,
    clinicalSummary: `Patient presents with ${conditionLabel}. Evaluated severity: ${severity}. Duration: ${duration}. Recommended Routing: ${referralDestination}.`,
  };
}
