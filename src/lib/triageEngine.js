// Clinical Triage Evaluation Engine
import { groqChatCompletion } from "./groqPool.js";
import { executeCentralizedLlmProxy } from "./llmProxy.js";
import {
  buildLearnedPromptSnippet,
  applyAlgorithmicFeedbackOverrides,
} from "./feedbackLearningEngine.js";
import {
  calculateClinicalSeverityScore,
  mapScoreToUrgency,
  mapUrgencyToBaselineScore,
  validateCallerMentionedDuration,
} from "./clinicalScoring.js";

/**
 * Evaluates whether ESIS Dispensaries are currently open in Assam (IST UTC+5:30).
 * Operating hours:
 * - Monday to Friday: 10:00 AM to 4:00 PM.
 * - 1st, 3rd & 5th Saturday: 10:00 AM to 12:00 PM.
 * - Closed: Sunday, 2nd & 4th Saturday.
 */
export function getDispensaryOperatingStatus(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  const dateOfMonth = istDate.getDate();
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  // 1st Saturday is date 1-7, 3rd Saturday is date 15-21, 5th Saturday is date 29-31
  const is1st3rdOr5thSaturday =
    day === 6 &&
    ((dateOfMonth >= 1 && dateOfMonth <= 7) ||
      (dateOfMonth >= 15 && dateOfMonth <= 21) ||
      (dateOfMonth >= 29 && dateOfMonth <= 31));
  const is2ndOr4thSaturday = day === 6 && !is1st3rdOr5thSaturday;
  const isSunday = day === 0;

  let isOpen = false;
  let reason = "";

  if (isSunday) {
    isOpen = false;
    reason = "ESIS Dispensaries are closed on Sunday.";
  } else if (is2ndOr4thSaturday) {
    isOpen = false;
    reason = "ESIS Dispensaries are closed on 2nd & 4th Saturdays.";
  } else if (is1st3rdOr5thSaturday) {
    // 1st, 3rd & 5th Saturday: Open 10:00 AM (600) to 12:00 PM (720)
    isOpen = currentMinutes >= 600 && currentMinutes < 720;
    if (currentMinutes < 600) {
      reason = "ESIS Dispensaries open at 10:00 AM today (1st, 3rd & 5th Saturday hours: 10:00 AM – 12:00 PM).";
    } else if (currentMinutes >= 720) {
      reason = "ESIS Dispensaries closed for the day at 12:00 PM (1st, 3rd & 5th Saturday hours: 10:00 AM – 12:00 PM).";
    }
  } else {
    // Monday to Friday: Open 10:00 AM (600) to 4:00 PM (960)
    isOpen = currentMinutes >= 600 && currentMinutes < 960;
    if (currentMinutes < 600) {
      reason = "ESIS Dispensaries open at 10:00 AM (Mon–Fri: 10:00 AM – 4:00 PM).";
    } else if (currentMinutes >= 960) {
      reason = "ESIS Dispensaries closed for the day at 4:00 PM (Mon–Fri: 10:00 AM – 4:00 PM).";
    }
  }

  const isNight = hour >= 20 || hour < 6;

  return {
    isOpen,
    isWeekend: isSunday || is2ndOr4thSaturday,
    isSaturday: day === 6,
    is1st3rdOr5thSaturday,
    isNight,
    reason,
    operatingHoursText: "Mon–Fri: 10:00 AM – 4:00 PM · 1st, 3rd & 5th Sat: 10:00 AM – 12:00 PM",
  };
}

export function getHospitalOpdOperatingStatus(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  // Hospital OPD: 10:00 AM (600 min) to 4:00 PM (960 min). IPD and Emergency are open 24x7.
  const isOpdOpen = currentMinutes >= 600 && currentMinutes < 960;

  let reason = "";
  if (currentMinutes < 600) {
    reason = "Hospital OPD opens at 10:00 AM (OPD: 10:00 AM – 4:00 PM · IPD & Emergency: 24x7)";
  } else if (currentMinutes >= 960) {
    reason = "Hospital OPD closed at 4:00 PM (OPD: 10:00 AM – 4:00 PM · IPD & Emergency: 24x7)";
  }

  return {
    isOpen: isOpdOpen,
    isOpdOpen,
    isIpdAndEmergencyOpen: true,
    hour,
    reason,
    operatingHoursText: "OPD: 10:00 AM – 4:00 PM · IPD & Emergency: 24x7",
  };
}

/**
 * Evaluates whether a case meets the strict clinical criteria for 108 Emergency Ambulance dispatch.
 * 
 * Rules based on official clinical triage protocol:
 * Between 6:00 AM and 6:00 PM (IST):
 * ONLY refer to 108 Ambulance in case of Severity 9/10 IF the patient has genuine life-threatening emergencies:
 * 1. Severe Breathing Issues: Gasping for air, skin/lips turning blue (cyanosis), or inability to speak in full sentences.
 *    (If caller states they can speak normally or denies severe gasping, DO NOT call ambulance!).
 * 2. Unconsciousness: Person is unresponsive and will not wake up, sudden collapse, or coma.
 * 3. Uncontrollable Bleeding: Heavy bleeding that does not stop after 10 minutes of firm, direct pressure.
 * 4. Major Trauma: Serious car accidents, head/spinal injuries, falls from a significant height, or severe burns covering a large area of the body.
 * 5. Prolonged Seizures: Seizure lasting > 5 minutes, or a person having their first-ever seizure (status epilepticus).
 * 6. Anaphylaxis: Severe allergic reaction causing throat, lips, or tongue to swell, restricting airways.
 * 7. Acute Cardiac Arrest / Crushing Chest Pain radiating to arm/jaw with cold diaphoresis.
 * 8. Explicit caller request for 108 Ambulance dispatch.
 * 
 * If between 6:00 AM and 6:00 PM there are NO such life-threatening emergency signs:
 * Even with high severity (9 or 10) like high fever with chills, severe pain, or breathlessness where the caller CAN speak normally:
 * -> DO NOT call 108 Ambulance!
 * -> Refer to Hospital (ESIC Hospital / nearest Govt District Hospital).
 */
export function isLifeThreateningAmbulanceCase(textContext = "", severity = 5, intake = {}, tState = {}) {
  const rawText = `${textContext || ""} ${intake?.symptom_notes || ""} ${intake?.complaint || ""} ${tState?.symptom || ""} ${tState?.condition || ""} ${tState?.suspectedCondition || ""}`.toLowerCase();

  // Explicit caller intent for 108 Ambulance
  if (/\b(call 108|dispatch ambulance|send ambulance|108 ambulance|ambulance chahiye|ambulance bulao|need ambulance|108 call)\b/i.test(rawText)) {
    return { is108: true, reason: "Caller explicitly requested 108 Emergency Ambulance dispatch." };
  }

  // Explicit caller negations & symptom denials: e.g. "no accident", "no injury", "bleeding stopped", "vision is clear"
  const isAccidentDenied = /\b(no\s+accident|not\s+an\s+accident|no\s+injury|not\s+injured|without\s+injury|accident\s+nahi|durghatna\s+nahi)\b/i.test(rawText);
  const isSuperficialOrMinorCut = /\b(superficial|superficial cut|minor cut|small cut|paper cut|shallow cut|antiseptic cream|applied.*cream|cream.*applied|applied.*ointment|bandaid|bandage|scrape|scratch|scratched|chhoti chot|halki chot|minor injury|small scratch)\b/i.test(rawText);
  const bleedingControlled = isSuperficialOrMinorCut || /\b(bleeding stopped|khoon ruk gaya|not heavy bleeding|bleeding controlled|minor cut|small cut|no bleeding|bleeding nahi|no active bleeding|stopped bleeding)\b/i.test(rawText);
  const canSpeakNormally = (
    /\b(can\s+speak\s+normally|able\s+to\s+speak\s+normally|speaking\s+normally|no\s+gasping|not\s+gasping|not\s+turning\s+blue)\b/i.test(rawText) ||
    (/\b(can\s+speak|able\s+to\s+speak)\b/i.test(rawText) && !/\b(unable|cannot|can'?t|not\s+able|difficulty)\b/i.test(rawText))
  ) && !/\b(unable\s+to\s+speak|cannot\s+speak|can'?t\s+speak|struggling\s+to\s+speak|gasping)\b/i.test(rawText);
  const isConsciousAlert = /\b(conscious|hosh me|awake|alert|responding normally|talking)\b/i.test(rawText);
  const hasChestPainDenial = /\b(no\s+chest\s+pain|seene\s*me\s*dard\s*nahi|chhati\s*dard\s*nahi|not\s+chest\s+pain)\b/i.test(rawText);

  // Strip negated phrases to obtain purely affirmative clinical context
  const affirmativeText = stripNegatedPhrases(rawText);

  // Time calculations (IST):
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const currentHour = istDate.getHours();
  const currentMinutes = currentHour * 60 + istDate.getMinutes();
  const isNightAfter10PM = currentHour >= 22 || currentHour < 6; // 10:00 PM to 6:00 AM IST
  const isDaytimeOPD = currentMinutes >= 600 && currentMinutes < 960; // 10:00 AM to 4:00 PM IST

  // ONLY dispatch 108 for STRICT LIFE-AND-DEATH CRISES:

  // 1. Uncontrollable spurting / arterial bleeding, heavy bleeding, deep cuts (hand, finger, limb)
  const hasUncontrollableBleeding = !bleedingControlled && !isSuperficialOrMinorCut && !isAccidentDenied && (
    /\b(spurting\s*bleed\w*|arterial\s*bleed\w*|heavy\s*bleed\w*|massive\s*bleed\w*|amputation|crushed\s*limb|profuse\s*bleed\w*)\b/i.test(affirmativeText) ||
    (/\b(deep\s*(?:gaping\s*)?cut|deep\s*laceration|heavy\s*cut|gehra\s*ghao|deep\s*wound)\b/i.test(affirmativeText) && /\b(bleed\w*|khoon|heavy|deep|gehra|cut|wound)\b/i.test(affirmativeText) && /\b(spurting|uncontrolled|heavy|continuous|bhaari|ruk nahi)\b/i.test(affirmativeText)) ||
    /\b(heavy active bleeding|cannot stop bleeding|bleeding continuously|tez khoon|bahut khoon|bhaari khoon)\b/i.test(affirmativeText)
  );

  // 1b. Workplace Injury / Industrial / Machine / Hand & Finger Heavy Cut
  const hasWorkplaceInjury = !isAccidentDenied && !isSuperficialOrMinorCut && !bleedingControlled && (
    /\b(industrial accident|machine amputation|heavy machine crush|amputation|crushed finger|crushed hand|severed limb|severed finger|industrial heavy trauma)\b/i.test(affirmativeText) ||
    (/\b(workplace injury|factory injury)\b/i.test(affirmativeText) && /\b(crushed|amputation|heavy bleeding|unconscious|deep laceration)\b/i.test(affirmativeText))
  );

  // 1c. Head Injury / Concussion / Trauma to Head
  const hasHeadInjury = !isAccidentDenied && !isSuperficialOrMinorCut && (
    /\b(head trauma|hit (?:my|the|his|her)?\s*head.*(?:unconscious|vomit|dizzy|concussion)|sar me chot.*(?:behosh|ulti|chakkar)|skull injury|skull fracture|concussion|heavy head bleeding)\b/i.test(affirmativeText)
  );

  // 1d. Any Road / Vehicular / Fall Accident
  const hasAccident = !isAccidentDenied && !isSuperficialOrMinorCut && (
    /\b(serious road accident|severe car accident|bike collision|vehicle collision|hit by car|durghatna.*(?:behosh|fracture|bleed)|fall from height|fall from roof)\b/i.test(affirmativeText)
  );

  // 1e. Elderly comorbidities (managed at Hospital Casualty / OPD, NOT 108 Ambulance unless acute life threat)
  const callerAge = parseInt(intake?.age || tState?.age || "0", 10) || 0;

  // 2. Severe Respiratory Failure / Breathlessness: Active gasping for air, cyanosis, unable to speak full sentences
  const hasSevereBreathing = !canSpeakNormally && (
    /\b(gasping for air|gasping|skin turning blue|lips turning blue|turning blue|blue skin|cyanosis|unable to speak in full sentences|cannot speak in full sentences|struggling for every breath|severe breathlessness|saans lene me haanf|choking|stridor)\b/i.test(affirmativeText)
  );

  // 3. Unconsciousness / Senselessness / Coma / Sudden Collapse: Individual is unresponsive and will not wake up
  const hasUnconsciousness = !isConsciousAlert && (
    /\b(unresponsive|will not wake up|won'?t wake up|unconscious|behosh|behoshi|senseless|senselessness|not waking up|coma|collapsed and not responding|loss of consciousness)\b/i.test(affirmativeText)
  );

  // 4. Acute Myocardial Infarction / Cardiac Arrest / Critical Life-Threatening Cardiac Crisis:
  // ONLY real life-threatening presentations: Crushing retrosternal pressure radiating to left arm/jaw WITH cold diaphoresis (sweating), collapse, gasping, or cardiac arrest.
  // Note: Not all chest pain is an emergency! Isolated, muscular, burning/gas, or stable non-crushing chest pain is hospital or dispensary manageable.
  const isNonCardiacOrMildChest = /\b(gas|acidity|acid reflux|gerd|muscle|pressing|sharp|stinging|stitching|prick|coughing|halka dard|mild|tolerable)\b/i.test(rawText);
  const hasCardiacArrest = !hasChestPainDenial && !isNonCardiacOrMildChest && (
    /\b(cardiac arrest|heart attack.*unconscious|heart attack.*collapse|crushing chest.*(?:left arm|sweat|pasina|collapse|gasping)|chest pain.*(?:sweating|pasina).*(?:radiat|left arm|baayein haath|behosh|collapse))\b/i.test(affirmativeText)
  );

  // 5. Catastrophic Major Trauma & Severe Accidents: Serious vehicular collision, fall from height/roof with head trauma/unconsciousness, visible deformity
  const hasCatastrophicTrauma = !isAccidentDenied && (
    /\b(serious car accident|major car accident|serious road accident|trapped in vehicle|fall from (?:roof|building|height|tree)|severe accident|head injury.*unconscious|bone deformity|visible bone|open fracture|unable to move.*(?:accident|trauma)|third degree burn)\b/i.test(affirmativeText)
  );

  // 6. High Risk Pregnancy Emergency: Heavy vaginal bleeding, amniotic rupture / active labor, severe abdominal pain, eclampsia
  const hasHighRiskPregnancy = (
    /\b(pregnant|pregnancy|garbhwati|hamla|foetus|fetus)\b/i.test(rawText) &&
    /\b(heavy\s*(?:vaginal\s*)?bleed\w*|severe\s*(?:continuous\s*)?(?:abdominal|pelvic)\s*pain|water\s*broke|amniotic\s*sac|active\s*labor|eclampsia|seizures?|convulsions?|bleeding\s*during\s*pregnancy)\b/i.test(affirmativeText)
  );

  // 7. Prolonged Seizure (>5 minutes) or Status Epilepticus
  const hasProlongedSeizures = /\b(seizure.*(?:more than|lasting|over)\s*5\s*min|status epilepticus|continuous seizure|fits.*5 min)\b/i.test(affirmativeText);

  // 8. Acute Anaphylactic Airway Obstruction: Throat / tongue swelling restricting breathing
  const hasAnaphylaxis = /\b(anaphylaxis|swelling of (?:the )?(?:throat|tongue).*airway|airway restriction.*allergy)\b/i.test(affirmativeText);

  // 9. Acute Poisoning Ingestion with collapse
  const hasAcutePoisoning = /\b(drank poison|ingested poison|drank pesticide|acid ingestion).*unresponsive\b/i.test(affirmativeText);

  // 10. Snake Bite Envenomation: Life-threatening emergency requiring immediate Anti-Snake Venom (ASV)
  const hasSnakeBite =
    /\b(snake\s*bite|bitten by (?:a\s+)?snake|snake.*(?:bite|bit|bitten)|saap\s*(?:ne\s*)?kaat|saanp\s*(?:ne\s*)?kaat|snakebite|envenomation)\b/i.test(affirmativeText) ||
    /\b(snake\s*bite|bitten by (?:a\s+)?snake|snake.*(?:bite|bit|bitten)|saap\s*kaat|saanp\s*kaat|snakebite|envenomation)\b/i.test(rawText);

  // If a genuine life-and-death emergency is clinically verified:
  if (hasSnakeBite) {
    return { is108: true, reason: "Snake bite is a critical life-threatening emergency requiring immediate 108 Emergency Ambulance dispatch for anti-snake venom (ASV) and casualty resuscitation." };
  }
  if (hasSevereBreathing) {
    return { is108: true, reason: "Severe breathing failure: gasping for air, cyanosis, or inability to speak in full sentences requires immediate 108 Ambulance dispatch." };
  }
  if (hasUnconsciousness) {
    return { is108: true, reason: "Senselessness / Unconsciousness: unresponsive individual requires immediate 108 Ambulance dispatch." };
  }
  if (hasHeadInjury) {
    return { is108: true, reason: "Head injury / trauma requires urgent 108 Emergency Ambulance dispatch for trauma stabilization and immediate hospital neuro-evaluation." };
  }
  if (hasAccident) {
    return { is108: true, reason: "Accident / vehicular casualty requires immediate 108 Emergency Ambulance dispatch for onsite emergency rescue and rapid hospital transfer." };
  }
  if (hasWorkplaceInjury) {
    return { is108: true, reason: "Workplace / industrial injury with heavy cut or bleeding requires immediate 108 Emergency Ambulance dispatch for trauma management." };
  }
  if (hasUncontrollableBleeding) {
    return { is108: true, reason: "Heavy bleeding / severe deep cut (hand, finger, or limb) requires immediate 108 Ambulance dispatch for wound compression and resuscitation." };
  }
  if (hasHighRiskPregnancy) {
    return { is108: true, reason: "High-risk pregnancy emergency (heavy bleeding, active labor/water broke, or eclampsia) requires immediate 108 Ambulance dispatch." };
  }
  if (hasCardiacArrest) {
    return { is108: true, reason: "Suspected acute cardiac arrest / myocardial infarction with crushing chest pain requires immediate 108 Ambulance dispatch." };
  }
  if (hasCatastrophicTrauma) {
    return { is108: true, reason: "Severe catastrophic accident / major trauma casualty requires immediate 108 Ambulance dispatch." };
  }
  if (hasProlongedSeizures) {
    return { is108: true, reason: "Prolonged seizure (>5 minutes) / status epilepticus requires immediate 108 Ambulance dispatch." };
  }
  if (hasAnaphylaxis) {
    return { is108: true, reason: "Acute anaphylaxis with airway compromise requires immediate 108 Ambulance dispatch." };
  }
  if (hasAcutePoisoning) {
    return { is108: true, reason: "Severe acute poisoning ingestion requires immediate 108 Ambulance dispatch." };
  }

  // IF NOT A LIFE-AND-DEATH CRISIS: DO NOT CALL 108 AMBULANCE!
  // Evaluate manageable condition based on time-of-day:
  if (isNightAfter10PM) {
    return {
      is108: false,
      reason: "Night hours (after 10:00 PM): Condition is manageable without life-and-death threat. Routed to 104 Health Helpline for 24x7 doctor tele-consultation (or ESIC Hospital Casualty if urgent medical evaluation is needed)."
    };
  }

  if (isDaytimeOPD) {
    return {
      is108: false,
      reason: "Daytime (10:00 AM – 4:00 PM): Stable / manageable condition without acute life-and-death danger. Routed to ESIS Dispensary (or ESIC Hospital) for OPD evaluation and medicines."
    };
  }

  return {
    is108: false,
    reason: "Manageable clinical presentation without life-and-death collapse. Routed to ESIC Hospital or 104 Health Helpline."
  };
}

/**
 * Smart clinical red flags summarizer
 * Retains only symptoms and red flags actually reported by the IP.
 * Never fabricates synthetic self-harm, bleeding, or suicidal narratives if caller denies or didn't report them.
 */
/**
 * Summarizes clinical red flags strictly based on what the IP explicitly reported.
 * 
 * Rules:
 * - Only symptoms explicitly reported by the caller and NOT denied are valid red flags.
 * - If the caller denies a symptom (e.g. "nehi", "no", "nahi", "no fever", "safe"), it must NEVER be listed as a red flag.
 * - Never add synthetic red flags that were not told by the IP or that are unrelated.
 * - Never match helpline numbers (e.g. 104, 108, 1097, 14416) as medical temperatures or symptoms!
 */
/**
 * Removes negated medical clauses (e.g. "No, I do not have fever or body aches",
 * "no chest pain", "fever nahi hai", "without bleeding", "no injury", "no accident") from conversational text
 * so negative symptoms are never mistaken as active red flags or conditions.
 */
export function stripNegatedPhrases(text = "") {
  if (!text || typeof text !== "string") return "";
  let clean = text.toLowerCase();

  // 1. "no, i do not have X or Y" / "don't have X and Y" / "does not have X" / "not having X"
  clean = clean.replace(
    /\b(?:no,?\s*(?:i\s*)?)?(?:do\s*not|don'?t|does\s*not|doesn'?t|did\s*not|didn'?t|have\s*no|has\s*no|haven'?t\s*got|am\s*not\s*having|not\s*having|without\s*any|without)\s+(?:have\s+|any\s+|a\s+)?([a-z\s,/]+?)(?=[.,;!?]|$|\b(?:but|however|except|only|and i have|aur mujhe)\b)/gi,
    " "
  );

  // 1b. Compound negations: "no X or Y", "no X nor Y", "no X and no Y"
  // e.g. "no rash or breathing trouble", "no fever or body ache", "no cough and no cold"
  clean = clean.replace(
    /\bno\s+([a-z\s]+?)\s+(?:or|nor|,|and\s+no|and)\s+([a-z\s]+?)(?=[.,;!?]|$|\b(?:but|however|only|except)\b)/gi,
    (match, p1, p2) => {
      const p1Words = p1.trim().split(/\s+/).length;
      const p2Words = p2.trim().split(/\s+/).length;
      if (p1Words <= 4 && p2Words <= 4) {
        return " ";
      }
      return match;
    }
  );

  // 2. Direct "no X, no Y" or "no X or Y"
  const symptomKeywords = [
    "accident", "durghatna", "injury", "chot", "cut", "wound", "ghao", "fracture", "burn", "trauma",
    "fever", "bukhar", "high\\s*fever", "body\\s*aches?", "badan\\s*dard", "joint\\s*pain", "jodon\\s*me\\s*dard",
    "pain", "dard", "chest\\s*pain", "chhati\\s*me\\s*dard", "headache", "sar\\s*dard", "sir\\s*dard",
    "dizziness", "chakkar", "vomit\\w*", "ulti\\w*", "nausea", "bleeding", "khoon", "cough", "khansi",
    "cold", "sardi", "zukham", "chills", "shivering", "kapkapi",
    "breathing\\s*(?:trouble|difficulty|problem|issue|distress)?",
    "difficulty\\s*(?:in\\s*)?breathing", "trouble\\s*breathing", "shortness\\s*of\\s*breath",
    "saans\\s*(?:me\\s*)?(?:takleef|dikkat|phoolna)?", "breathlessness", "gasping", "wheezing",
    "rash", "khujli", "itching", "allerg\\w*", "seizure", "daura", "swelling", "sujan",
    "stomach\\s*pain", "pet\\s*dard", "cramps?", "loose\\s*motion", "diarrhea", "dast"
  ].join("|");

  clean = clean.replace(
    new RegExp(`\\bno\\s+(?:${symptomKeywords})(?:\\s*(?:or|nor|,|and)\\s*(?:${symptomKeywords}))*`, "gi"),
    " "
  );

  // 2b. "not an accident", "not injured", "without injury", "not an emergency", "no breathing trouble"
  clean = clean.replace(
    /\b(?:not\s+an?\s+(?:accident|injury|emergency)|not\s+injured|without\s+(?:injury|accident|chot|bleeding|fever|pain))\b/gi,
    " "
  );

  // 3. Hindi negations: "[symptom] nahi/nehi/nhi hai" / "[symptom] nahi" / "[symptom] theek hai"
  clean = clean.replace(
    new RegExp(`\\b(?:${symptomKeywords})\\s*(?:bhi\s+)?(?:nahi|nehi|nhi|na|theek|normal)\\s*(?:hai|h)?\\b`, "gi"),
    " "
  );

  // 4. Hindi prefix negation: "nahi hai [symptom]" / "koi [symptom] nahi hai"
  clean = clean.replace(
    new RegExp(`\\b(?:nahi|nehi|nhi|na)\\s*(?:hai|h)?\\s*(?:koi\\s+)?(?:${symptomKeywords})\\b`, "gi"),
    " "
  );

  // 5. Global denials of other symptoms: "no other symptoms", "no other problem", "no other pain", "nothing else", "pain is only in X"
  clean = clean.replace(
    /\b(?:no\s+other\s*symptoms?|no\s+other\s*problem|no\s+other\s*complaint|no\s+other\s*pain|nothing\s+else|koi\s+aur\s+(?:lakshan|dikkat|takleef)\s*nahi|aur\s+kuch\s*nahi)\b/gi,
    " "
  );

  // 6. Explicit clarification overrides (e.g. caller clarifies "no shivering" or "no chills" after chip had "fever with chills")
  if (
    /\b(?:no|without|bina|not\s+having)\s+(?:shivering|chills|kampkampi|hilaav|shaking)\b/i.test(text) ||
    /\b(?:shivering|chills|kampkampi)\s*(?:nahi|nehi|nhi|theek|normal)\b/i.test(text) ||
    /\b(?:mild\s+fever,?\s*no\s+shivering)\b/i.test(text)
  ) {
    clean = clean.replace(/\b(?:and\s+|with\s+)?(?:chills|shivering|kampkampi|shaking)\b/gi, " ");
  }

  return clean.replace(/\s+/g, " ").trim();
}

/**
 * Deduplicates and consolidates clinical red flags.
 * Eliminates exact duplicates, substring redundancies (e.g. "High fever with chills" vs "High fever with chills and shivering"),
 * and semantic template overlap (e.g. "Snake bite" vs "Poisoning / toxic chemical exposure or snake envenomation").
 */
export function deduplicateRedFlags(flags = []) {
  if (!Array.isArray(flags)) return [];

  const isDurationString = (str) => {
    return (
      /\b(duration|since|days?|hours?|weeks?|months?|dino?|ghante?|yesterday|today|4-7 days|2-3 days|less than 2 hours)\b/i.test(str) ||
      /^\d+\s*-\s*\d+\s*(?:days?|hours?|weeks?|months?)$/i.test(str.trim()) ||
      /^duration:?\s*/i.test(str.trim())
    );
  };

  const rawCleaned = [];
  for (const f of flags) {
    if (!f || typeof f !== "string") continue;
    const clean = f.trim().replace(/^[-*•\d.)\s]+/, "").trim();
    if (clean.length > 2 && !rawCleaned.includes(clean) && !isDurationString(clean)) {
      rawCleaned.push(clean);
    }
  }

  // Filter out generic filler flags if more specific ones exist
  const hasSpecificFlags = rawCleaned.some((f) => {
    const l = f.toLowerCase();
    return (
      !l.includes("acute presentation") &&
      !l.includes("high severity reported") &&
      !l.includes("urgent ambulance transfer") &&
      !l.includes("minor injury")
    );
  });

  const filteredCandidates = hasSpecificFlags
    ? rawCleaned.filter((f) => {
        const l = f.toLowerCase();
        return (
          !l.includes("acute presentation") &&
          !l.includes("high severity reported") &&
          !l.includes("urgent ambulance transfer")
        );
      })
    : rawCleaned;

  const result = [];

  for (const candidate of filteredCandidates) {
    const candLower = candidate.toLowerCase();

    // Skip duration just in case
    if (isDurationString(candLower)) continue;

    // 1. Check exact match or subsumption by an existing flag in result
    const isSubsumed = result.some((existing) => {
      const existLower = existing.toLowerCase();
      if (existLower === candLower) return true;
      if (existLower.includes(candLower) && existLower.length > candLower.length) return true;
      return false;
    });
    if (isSubsumed) continue;

    // 2. Check if candidate subsumes an existing flag (candidate is longer/more detailed)
    const existingIndexToReplace = result.findIndex((existing) => {
      const existLower = existing.toLowerCase();
      if (candLower.includes(existLower) && candLower.length > existLower.length) return true;
      return false;
    });
    if (existingIndexToReplace !== -1) {
      result[existingIndexToReplace] = candidate;
      continue;
    }

    // 3. Concept-specific deduplication (avoiding duplicate templates for same symptom)
    // Concept A: Snake bite vs Poisoning template
    const isSpecificSnake = /\b(snake\s*bite|fang\s*marks?|snake\s*envenomation)\b/i.test(candLower);
    const isGenericPoisonSnake = /\bpoisoning\s*\/\s*toxic chemical exposure or snake envenomation\b/i.test(candLower);

    if (isGenericPoisonSnake) {
      const hasSpecificSnake = result.some((r) => /\b(snake\s*bite|fang\s*marks?|snake\s*envenomation)\b/i.test(r));
      if (hasSpecificSnake) continue;
    }

    if (isSpecificSnake && !candLower.includes("fang")) {
      const genericIdx = result.findIndex((r) => /\bpoisoning\s*\/\s*toxic chemical exposure or snake envenomation\b/i.test(r));
      if (genericIdx !== -1) {
        result.splice(genericIdx, 1);
      }
    }

    // Concept B: Fever & Chills
    const isFeverChills = /\b(fever|bukhar|chills|shivering|rigor)\b/i.test(candLower);
    if (isFeverChills) {
      const feverIdx = result.findIndex((r) => /\b(fever|bukhar|chills|shivering|rigor)\b/i.test(r));
      if (feverIdx !== -1) {
        if (candidate.length > result[feverIdx].length) {
          result[feverIdx] = candidate;
        }
        continue;
      }
    }

    // Concept C: Chest pain
    const isChestPain = /\b(chest pain|chhati.*dard|cardiac pressure|angina)\b/i.test(candLower);
    if (isChestPain) {
      const chestIdx = result.findIndex((r) => /\b(chest pain|chhati.*dard|cardiac pressure|angina)\b/i.test(r));
      if (chestIdx !== -1) {
        if (candidate.length > result[chestIdx].length) {
          result[chestIdx] = candidate;
        }
        continue;
      }
    }

    // Concept D: Shortness of breath
    const isBreathing = /\b(shortness of breath|breathless|gasping|respiratory distress)\b/i.test(candLower);
    if (isBreathing) {
      const breathIdx = result.findIndex((r) => /\b(shortness of breath|breathless|gasping|respiratory distress)\b/i.test(r));
      if (breathIdx !== -1) {
        if (candidate.length > result[breathIdx].length) {
          result[breathIdx] = candidate;
        }
        continue;
      }
    }

    // Concept E: Bleeding / Hematemesis / Melena
    const isBleeding = /\b(uncontrolled bleeding|heavy bleed|profuse bleed|vascular injury|hematemesis|blood in vomit|melena)\b/i.test(candLower);
    if (isBleeding) {
      const bleedIdx = result.findIndex((r) =>
        /\b(uncontrolled bleeding|heavy bleed|profuse bleed|vascular injury|hematemesis|blood in vomit|melena)\b/i.test(r)
      );
      if (bleedIdx !== -1) {
        if (candidate.length > result[bleedIdx].length) {
          result[bleedIdx] = candidate;
        }
        continue;
      }
    }

    // Concept F: Unconscious / Syncope
    const isUnconscious = /\b(unconscious|behosh|loss of consciousness)\b/i.test(candLower);
    if (isUnconscious) {
      const uncIdx = result.findIndex((r) => /\b(unconscious|behosh|loss of consciousness)\b/i.test(r));
      if (uncIdx !== -1) {
        if (candidate.length > result[uncIdx].length) {
          result[uncIdx] = candidate;
        }
        continue;
      }
    }

    // Concept G: Weakness / Dizziness / Inability to stand / Confusion
    const isWeaknessDizzy = /\b(weakness|inability to stand|unable to stand|confusion and dizziness|postural dizziness|syncope|faint|chakkar)\b/i.test(candLower);
    if (isWeaknessDizzy) {
      const weakIdx = result.findIndex((r) =>
        /\b(weakness|inability to stand|unable to stand|confusion and dizziness|postural dizziness|syncope|faint|chakkar)\b/i.test(r)
      );
      if (weakIdx !== -1) {
        if (candLower.includes("postural") || candLower.includes("syncope") || candLower.includes("stand")) {
          result[weakIdx] = candidate;
        }
        continue;
      }
    }

    // Concept H: Abdominal pain / acute abdomen
    const isAbdominalPain = /\b(abdominal pain|acute abdomen|stomach pain|pet.*dard)\b/i.test(candLower);
    if (isAbdominalPain) {
      const abdomIdx = result.findIndex((r) =>
        /\b(abdominal pain|acute abdomen|stomach pain|pet.*dard)\b/i.test(r)
      );
      if (abdomIdx !== -1) {
        if (candidate.length > result[abdomIdx].length) {
          result[abdomIdx] = candidate;
        }
        continue;
      }
    }

    result.push(candidate);
  }

  // USER MANDATE: "dont put more than 5 and try to put the major ones"
  return result.slice(0, 5);
}

/**
 * Summarizes clinical red flags strictly based on what the IP explicitly reported.
 * 
 * Rules:
 * - Only symptoms explicitly reported by the caller and NOT denied are valid red flags.
 * - If the caller denies a symptom (e.g. "nehi", "no", "nahi", "no fever", "safe"), it must NEVER be listed as a red flag.
 * - Never add synthetic red flags that were not told by the IP or that are unrelated.
 * - Never match helpline numbers (e.g. 104, 108, 1097, 14416) as medical temperatures or symptoms!
 */
export function summarizeRedFlags(rawFlags = [], textContext = "", callerSaidSafe = false) {
  const points = [];

  const addPoint = (pt) => {
    if (!pt || typeof pt !== "string") return;
    const clean = pt.trim().replace(/^[-*•\d.)\s]+/, "").trim();
    if (
      /\b(duration|since|days?|hours?|weeks?|months?|dino?|ghante?|yesterday|today|4-7 days|2-3 days|less than 2 hours)\b/i.test(clean) ||
      /^\d+\s*-\s*\d+\s*(?:days?|hours?|weeks?|months?)$/i.test(clean) ||
      /^duration:?\s*/i.test(clean)
    ) {
      return;
    }
    if (
      clean.toLowerCase().includes("acute presentation") ||
      clean.toLowerCase().includes("high severity reported") ||
      clean.toLowerCase().includes("urgent ambulance transfer")
    ) {
      return;
    }
    if (clean.length > 3) {
      points.push(clean);
    }
  };

  const text = (textContext || "").toLowerCase();
  const affirmativeText = stripNegatedPhrases(text);

  // Explicit caller negations
  const deniesFever =
    /\b(no\s+fever|not\s+have\s+fever|don'?t\s+have\s+fever|do\s+not\s+have\s+fever|without\s+fever|fever\s+nahi|bukhar\s+nahi|no\s+chills|no\s+body\s*aches?|without\s+chills|nehi|nahi|not\s+having\s+fever)\b/i.test(text) &&
    !/\b(yes.*fever|fever.*hai|tez bukhar|severe fever|high grade fever)\b/i.test(text);
  const isSafe =
    callerSaidSafe ||
    /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(text);
  const deniesChestPain = /\b(no\s+chest\s*pain|not\s+have\s+chest|don'?t\s+have\s+chest|chhati\s*me\s*dard\s*nahi|no\s+pain\s*in\s*chest)\b/i.test(text);
  const deniesBleeding = /\b(no\s+bleed|not\s+bleeding|don'?t\s+have\s+bleed|khoon\s*nahi|no\s+cut)\b/i.test(text);
  const deniesBreathing = /\b(no\s+breath|no\s+shortness|saans\s*theek|able\s+to\s+breathe|speak\s+normally)\b/i.test(text);
  const isCallerMildFever =
    /\b(mild\s+fever|halka\s+bukhar|low\s+grade\s+fever|halka\s+sa\s+bukhar|fever\s+is\s+mild|mild\s+warmth|kam\s+bukhar)\b/i.test(text) ||
    (/\b(fever|bukhar)\b/i.test(text) && /\b(mild|halka|low grade|mild warmth|mild heat)\b/i.test(text));

  const callerDeniesChillsOrShivering =
    /\b(no\s+shivering|no\s+chills|without\s+shivering|without\s+chills|shivering\s+nahi|chills\s+nahi|no\s+kampkampi|kampkampi\s+nahi|bina\s+(?:zyada\s+)?hilaav|bina\s+shaking|mild fever,?\s*no shivering)\b/i.test(text);

  // Check if a raw flag is genuinely supported by what the IP actually said
  const isFlagSupportedByCaller = (flagStr) => {
    if (!flagStr || typeof flagStr !== "string") return false;
    const fLower = flagStr.toLowerCase();

    // GI Bleed / Hematemesis / Melena / Rectal bleeding
    if (
      fLower.includes("hematemesis") ||
      fLower.includes("gastrointestinal") ||
      fLower.includes("vomit.*blood") ||
      fLower.includes("blood in vomit") ||
      fLower.includes("melena") ||
      fLower.includes("stool")
    ) {
      if (deniesBleeding && !/\b(blood|hematemesis|vomit.*blood|khoon)\b/i.test(affirmativeText)) return false;
      return /\b(hematemesis|blood in vomit|vomit.*blood|blood.*stool|melena|khoon.*ulti|ulti.*khoon|gastrointestinal|gi bleed|bleeding)\b/i.test(affirmativeText);
    }

    // Fever / Chills / Rigors / Shivering
    if (
      fLower.includes("fever") ||
      fLower.includes("bukhar") ||
      fLower.includes("pyrexia") ||
      fLower.includes("chills") ||
      fLower.includes("shiver") ||
      fLower.includes("rigor")
    ) {
      if (deniesFever) return false;
      if (fLower.includes("high fever") || fLower.includes("shiver") || fLower.includes("chill")) {
        if (isCallerMildFever || callerDeniesChillsOrShivering) return false;
        return (
          /\b(high fever|tez bukhar|10[2-6]\s*(?:°|f|deg)|severe fever)\b/i.test(affirmativeText) &&
          /\b(chills|shivering|rigor|kapkapi)\b/i.test(affirmativeText)
        );
      }
      return /\b(high fever|tez bukhar|10[2-5]\s*(?:°|f|deg))\b/i.test(affirmativeText);
    }

    // Suicidal / Self-harm checks
    if (
      fLower.includes("self-harm") ||
      fLower.includes("suicid") ||
      fLower.includes("ending life") ||
      fLower.includes("kill")
    ) {
      if (isSafe) return false;
      return /\b(wanna die|want to die|kill myself|mar jaunga|jaan de dunga|suicid)\b/i.test(text);
    }

    // Chest pain / Cardiac checks
    if (
      fLower.includes("chest") ||
      fLower.includes("cardiac") ||
      fLower.includes("coronary") ||
      fLower.includes("angina") ||
      fLower.includes("myocardial")
    ) {
      if (deniesChestPain) return false;
      return /\b(chest|chhati|heart attack|dil ka dard|angina)\b/i.test(text);
    }

    // Bleeding / Cut checks
    if (
      fLower.includes("bleed") ||
      fLower.includes("hemorrhage") ||
      fLower.includes("wound") ||
      fLower.includes("laceration")
    ) {
      if (deniesBleeding) return false;
      return /\b(bleed|blood|khoon|deep wound|cut\s*wrist|fracture|arterial)\b/i.test(text);
    }

    // Breathlessness / Respiratory
    if (
      fLower.includes("breath") ||
      fLower.includes("respiratory") ||
      fLower.includes("dyspnea") ||
      fLower.includes("suffocat") ||
      fLower.includes("gasp")
    ) {
      return /\b(breath|saans|gasp|suffocat|wheez|asthma|airway)\b/i.test(text);
    }

    // Unconscious / Faint / Syncope
    if (
      fLower.includes("unconscious") ||
      fLower.includes("faint") ||
      fLower.includes("syncope") ||
      fLower.includes("blackout") ||
      fLower.includes("collapse")
    ) {
      return /\b(unconscious|behosh|fainted|blackout|collapsed|syncope)\b/i.test(text);
    }

    // Seizure / Convulsion
    if (
      fLower.includes("seizure") ||
      fLower.includes("convulsion") ||
      fLower.includes("fit") ||
      fLower.includes("mirgi")
    ) {
      return /\b(seizure|convulsion|fit|daura|mirgi)\b/i.test(text);
    }

    // Inability to retain fluids / Severe vomiting / Dehydration
    if (
      fLower.includes("fluid") ||
      fLower.includes("vomit") ||
      fLower.includes("dehydrat") ||
      fLower.includes("retain")
    ) {
      return /\b(fluid|drink|paani|vomit|ulti|nausea|dehydrat|retain|keep down)\b/i.test(text);
    }

    // Abdominal pain / acute abdomen
    if (fLower.includes("abdomin") || fLower.includes("stomach") || fLower.includes("pet") || fLower.includes("flank")) {
      return /\b(abdomin|stomach|pet|belly|flank|cramp|dard|pain)\b/i.test(text);
    }

    // Trauma / accident / fracture / burns / fall
    if (fLower.includes("accident") || fLower.includes("trauma") || fLower.includes("fall") || fLower.includes("fell") || fLower.includes("fracture") || fLower.includes("burn") || fLower.includes("injury")) {
      return /\b(accident|hit|fall|fell|falling|fallen|slip|slipped|tripped|chot|gir gaya|gir gayi|gira|fracture|burn|jala|injury|injured)\b/i.test(text);
    }

    // Snakebite / Poison / Chemical exposure
    if (fLower.includes("snake") || fLower.includes("poison") || fLower.includes("bite") || fLower.includes("chemical") || fLower.includes("pesticide")) {
      return /\b(snake|saap|bite|poison|zeher|pesticide|chemical)\b/i.test(text);
    }

    // Allergic / Anaphylaxis
    if (fLower.includes("anaphylaxis") || fLower.includes("allerg") || fLower.includes("swell")) {
      return /\b(allerg|anaphylaxis|swell|sujan|hives|rash)\b/i.test(text);
    }

    // If flag doesn't match any known pattern, check if core significant medical words appear in text
    const words = fLower
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 3 &&
          !["reported", "caller", "patient", "clinical", "urgent", "immediate", "acute", "with", "from", "sign", "signs"].includes(w)
      );
    return words.some((w) => text.includes(w));
  };

  // 1. Process caller/clinician-reported raw flags directly, filtering out unverified / hallucinated flags
  if (Array.isArray(rawFlags)) {
    for (const f of rawFlags) {
      if (!f || typeof f !== "string") continue;
      if (isFlagSupportedByCaller(f)) {
        addPoint(f);
        if (points.length >= 10) break;
      }
    }
  }

  // 2. Comprehensive situation detection directly from caller text & intake symptoms
  // GI Bleeding / Hematemesis / Melena
  if (
    /\b(hematemesis|blood in vomit|vomit.*blood|blood.*stool|melena|khoon.*ulti|ulti.*khoon|gastrointestinal bleeding|gi bleed)\b/i.test(
      text
    )
  ) {
    addPoint("Gastrointestinal bleeding / hematemesis (blood in vomit)");
  }

  // Inability to retain oral fluids / persistent continuous vomiting
  if (
    /\b(cannot keep.*fluid|inability to retain fluid|unable to retain fluid|can'?t retain fluid|can'?t drink|paani.*ruk nahi|paani.*nahi pi|persistent vomit|continuous vomit|bar bar ulti)\b/i.test(
      text
    )
  ) {
    addPoint("Inability to retain oral fluids / persistent vomiting");
  }

  // High Fever with chills, rigors, or shivering (Excluding helpline 104)
  if (
    !deniesFever &&
    !isCallerMildFever &&
    !callerDeniesChillsOrShivering &&
    /\b(high fever|tez bukhar|10[2-6]\s*(?:°|f|deg)|severe fever|bahut tez bukhar)\b/i.test(
      affirmativeText
    ) &&
    /\b(chills|shivering|rigor|kapkapi|thand lagna)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("High fever with chills and shivering");
  }

  // Severe respiratory distress / Breathing issues / Gasping
  if (
    !deniesBreathing &&
    /\b(struggling\s*(?:to|for)\s*breath\w*|struggle\s*to\s*breathe|cannot\s*breathe|can'?t\s*breathe|unable\s*to\s*breathe|hard\s*to\s*breathe|severe breathlessness|saans.*takleef|saans nahi|gasping|gasping for air|suffocat|wheez|inability to speak|speech.*sentence|cyanosis|blue.*lip)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Severe shortness of breath / struggling to breathe");
  }

  // Cardiac / Crushing chest pain radiating to left arm/jaw
  if (
    !deniesChestPain &&
    /\b(crushing chest|dil ka dard|chhati me dard|severe chest pain|left arm pain|pressure on chest|chest.*radiat|chest.*sweat)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Severe chest pain / cardiac pressure with radiation");
  }

  // Loss of consciousness / Fainting / Blackout
  if (/\b(unconscious|behosh|fainted|blackout|collapsed|syncope|unresponsive)\b/i.test(affirmativeText)) {
    addPoint("Loss of consciousness / fainting episode");
  }

  // Convulsions / Seizures / Fits
  if (/\b(seizure|convulsions?|fits?|mirgi ka daura|daura)\b/i.test(affirmativeText)) {
    addPoint("Seizure / convulsive episode");
  }

  // Heavy bleeding / deep laceration / arterial bleed / active bleeding
  if (
    !deniesBleeding &&
    /\b(heavy bleed|khoon beh raha|profuse bleed|deep wound|arterial bleed|slit.*wrist|cut.*wrist|active.*bleed|workplace.*injury.*bleed|wound depth)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Heavy uncontrollable bleeding / vascular injury");
  }

  // Weakness & dizziness / presyncope indicators
  if (
    /\b(dizzy and weak|weak and dizzy|feeling dizzy and weak|feeling faint|feel dizzy|faint|lightheaded|chakkar|chakkar aa raha|kamzori)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Weakness & dizziness / presyncope indicators");
  }

  // Severe acute abdominal pain / rigid abdomen
  if (
    /\b(severe abdominal pain|pet me bahut tez dard|acute abdomen|rigid abdomen|intense stomach pain)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Severe acute abdominal pain");
  }

  // Major trauma / fall from height / physical fall on hand/body / bone fracture / head injury
  if (
    /\b(fell on|fell down|had a fall|recent fall|fall from|gir gaya|gir gayi|gira tha|tripped|slip ho gaya)\b/i.test(
      affirmativeText
    ) ||
    (/\b(fell|fall)\b/i.test(affirmativeText) && /\b(hand|wrist|arm|knee|leg|head|ground|floor|road|bike|stair|stairs|bed)\b/i.test(affirmativeText))
  ) {
    const fallTarget = affirmativeText.match(/\bfell on (?:my\s+)?(hand|wrist|arm|knee|leg|head|back|shoulder)\b/i);
    if (fallTarget && fallTarget[1]) {
      addPoint(`Recent fall on ${fallTarget[1].toLowerCase()} / physical impact trauma`);
    } else {
      addPoint("Recent fall / physical impact trauma reported");
    }
  } else if (
    /\b(fracture|head injury|sir me chot|serious accident|car accident|severe burn)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Major trauma / suspected fracture or head injury");
  }

  // Acute severe allergic reaction / anaphylaxis (throat/face swelling)
  if (
    /\b(anaphylaxis|throat.*swell|lip.*swell|tongue.*swell|gale.*sujan|severe allergic)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Acute severe allergic reaction / airway swelling (anaphylaxis)");
  }

  // Poisoning / snakebite / pesticide exposure
  if (
    /\b(poison|zeher|snake\s*bite|saap kaat|pesticide|chemical ingestion)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Poisoning / toxic chemical exposure or snake envenomation");
  }

  // Severe dehydration / circulatory signs
  if (
    /\b(severe dehydration|sunken eyes|dark urine|extreme weakness.*dizzy|chakkar.*gir)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Severe dehydration / signs of circulatory compromise");
  }

  // Acute neurological deficit (slurred speech, facial asymmetry, weakness)
  if (
    /\b(slurred speech|facial droop|sudden weakness|paralysis|ek taraf kamzori)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Acute neurological deficit / suspected stroke signs");
  }

  // Menstrual danger signs / excessive bleeding or large blood clots
  if (
    !deniesBleeding &&
    /\b(heavy\s*flow|heavy\s*bleed.*period|large\s*clot|blood\s*clots?|soak.*pad|multiple\s*pad|excessive\s*bleed|period.*heavy|clots\s*passing|bleed.*clots)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Excessive menstrual bleeding / passing large blood clots");
  }

  // Intense / debilitating / unbearable pain reported by IP
  if (
    /\b(unbearable\s*pain|terrible\s*pain|severe\s*cramps?|extreme\s*pain|bahut\s*tez\s*dard|unbearable\s*cramps?|cannot\s*move|unable\s*to\s*walk|unable\s*to\s*sit|bedridden|crying.*pain|cannot\s*sleep.*pain|intense\s*cramps?)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Severe unbearable pain / unable to perform routine activities");
  }

  // Postural dizziness / near-fainting when standing
  if (
    /\b(chakkar.*gir|fainted|blackout|dizzy.*standing|unable\s*to\s*stand|kamzori.*gir|feeling\s*faint|chakkar\s*aana.*gir)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Postural dizziness / near-syncope episode");
  }

  // Acute panic attack / severe psychological crisis
  if (
    /\b(panic\s*attack|crying\s*uncontrollably|severe\s*anxiety|extreme\s*distress|shaking.*fear|hyperventilat|bechaini.*bahut|dil\s*ghabra)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Acute panic attack / severe psychological distress");
  }

  // Acute thunderclap / sudden unbearable headache
  if (
    /\b(worst\s*headache|thunderclap|sudden\s*severe\s*headache|sir\s*me\s*achanak\s*tez\s*dard|unbearable\s*headache)\b/i.test(
      affirmativeText
    )
  ) {
    addPoint("Sudden acute severe headache / migraine crisis");
  }

  // Suicidal intent (ONLY if caller explicitly stated and is NOT safe)
  if (
    !isSafe &&
    /\b(wanna die|want to die|kill myself|mar jaunga|jaan dena chahta)\b/i.test(affirmativeText)
  ) {
    addPoint("Explicit thoughts of ending life reported by IP");
  }

  return deduplicateRedFlags(points).slice(0, 5);
}

/**
 * Sanitizes clinical symptom description to ensure non-physician helpline guidelines:
 * - We are helpline operators, not diagnosing doctors.
 * - Never mention medical disease names, syndromes, or pathologies (e.g. Kidney Stone, Renal Colic, Appendicitis, Gastric Ulcer, Pathology)
 *   unless the caller explicitly named that disease in their own words.
 * - Never mention or prescribe pharmaceutical medicines.
 */
export function sanitizeSymptomOrCondition(rawCondition = "", callerSpokenText = "") {
  if (!rawCondition || typeof rawCondition !== "string") return "Reported Symptoms";

  let clean = rawCondition.trim();

  // If rawCondition is a referral channel name or generic consultation text, extract the actual clinical complaint
  const isChannelOnly =
    /^(104|108|ambulance|104 health|104 tele-doctor|tele-doctor|tele doctor|medical consultation|general consultation|phone consultation|health helpline|dispensary|hospital|tie-up|referral|primary care)$/i.test(clean) ||
    /\b(104 tele-doctor consultation|104 health helpline|108 ambulance dispatch|tele-doctor consultation|medical consultation)\b/i.test(clean);

  if (isChannelOnly) {
    const callerText = stripNegatedPhrases(callerSpokenText || "");
    if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari|periods cramps|period cramps|periods ka dard)\b/i.test(callerText)) {
      clean = "Dysmenorrhea / Menstrual Cramps";
    } else if (/\b(cut|wound|laceration|bleed|chot|injury|slit|scratch|tanka|dressing)\b/i.test(callerText)) {
      clean = "Laceration / Cut Injury";
    } else if (/\b(chest|angina|heart|dil ka dard|chhati)\b/i.test(callerText)) {
      clean = "Chest Discomfort / Pain";
    } else if (/\b(fever|bukhar|temperature|chills|shiver|tap)\b/i.test(callerText)) {
      clean = "Fever & Chills";
    } else if (/\b(headache|sar dard|sir dard|migraine)\b/i.test(callerText)) {
      clean = "Headache";
    } else if (/\b(stomach|abdom|pet dard|gastric|vomit|nausea|ulti|loose motion|dast|diarrhea)\b/i.test(callerText)) {
      clean = "Abdominal / Gastric Pain";
    } else if (/\b(dizzy|chakkar|weakness|kamzori|faint)\b/i.test(callerText)) {
      clean = "Weakness & Dizziness";
    } else if (/\b(breath|saans|cough|khansi|asthma)\b/i.test(callerText)) {
      clean = "Respiratory Symptoms / Cough";
    } else if (/\b(burn|jal gaya|acid)\b/i.test(callerText)) {
      clean = "Burn Injury";
    } else if (/\b(fracture|haddi|bone|twist|sprain|moch)\b/i.test(callerText)) {
      clean = "Orthopedic / Bone Injury";
    } else if (/\b(rash|khujli|itching|skin|allergy|dana|foda)\b/i.test(callerText)) {
      clean = "Skin Rash / Allergy";
    } else if (/\b(suicid|depress|anxiety|stress|mental|udaas)\b/i.test(callerText)) {
      clean = "Emotional Distress / Mental Health Support";
    } else if (/\b(hiv|aids|std|sti|gupt rog)\b/i.test(callerText)) {
      clean = "HIV / Sexual Health Consultation";
    } else if (/\b(wrist|kalai)\b/i.test(callerText) && /\b(hand|haath)\b/i.test(callerText)) {
      clean = "Hand & Wrist Pain";
    } else if (/\b(wrist|kalai)\b/i.test(callerText)) {
      clean = "Pain in Wrist Area";
    } else if (/\b(hand|haath|finger|ungli)\b/i.test(callerText)) {
      clean = "Pain in Hand";
    } else if (/\b(shoulder|kandha|arm|bazu|elbow|kohni)\b/i.test(callerText)) {
      clean = "Arm & Shoulder Pain";
    } else if (/\b(leg|knee|ankle|foot|pair|taang|ghutna)\b/i.test(callerText)) {
      clean = "Leg & Lower Extremity Pain";
    } else {
      clean = "Reported Clinical Symptoms";
    }
  }

  const callerText = stripNegatedPhrases(callerSpokenText || "");

  // If clean is generic, resolve from caller spoken text
  const isGeneric = /^(primary clinical assessment|clinical assessment|reported symptoms|reported clinical symptoms|general medical evaluation|general medical complaint)$/i.test(clean.trim());
  if (isGeneric) {
    if (/\b(wrist|kalai)\b/i.test(callerText) && /\b(hand|haath)\b/i.test(callerText)) {
      clean = "Hand & Wrist Pain";
    } else if (/\b(wrist|kalai)\b/i.test(callerText)) {
      clean = "Pain in Wrist Area";
    } else if (/\b(hand|haath|finger|ungli)\b/i.test(callerText)) {
      clean = "Pain in Hand";
    } else if (/\b(shoulder|kandha|arm|bazu|elbow|kohni)\b/i.test(callerText)) {
      clean = "Arm & Shoulder Pain";
    } else if (/\b(leg|knee|ankle|foot|feet|pair|taang|ghutna)\b/i.test(callerText)) {
      clean = "Leg & Lower Extremity Pain";
    } else if (/\b(headache|sir dard|sar dard|migraine)\b/i.test(callerText)) {
      clean = "Severe Headache / Migraine";
    } else if (/\b(chest|chhati|heart)\b/i.test(callerText)) {
      clean = "Chest Discomfort / Pain";
    } else if (/\b(stomach|pet|gastric|acidity)\b/i.test(callerText)) {
      clean = "Abdominal / Gastric Pain";
    } else if (/\b(fever|bukhar)\b/i.test(callerText)) {
      clean = "Fever & Chills";
    }
  }

  const hasKidneyStone = /\b(kidney stone|pathri|renal calculus|renal stone|gall stone)\b/i.test(callerText);
  const hasAppendicitis = /\b(appendicitis|appendix)\b/i.test(callerText);
  const hasUlcer = /\b(ulcer|peptic ulcer)\b/i.test(callerText);
  const hasCardiacDisease = /\b(heart attack|cardiac arrest|dil ka daura)\b/i.test(callerText);
  const hasChestComplaint = /\b(chest|chhati|heart|angina|crushing|dil ka dard|left arm)\b/i.test(callerText);

  // Replace fabricated medical diagnoses with non-physician symptom descriptions
  if (!hasKidneyStone) {
    clean = clean.replace(/renal colic \((?:kidney stone)\) or lower abdominal pathology/gi, "Abdominal Discomfort");
    clean = clean.replace(/renal colic \((?:kidney stone)\)/gi, "Abdominal Discomfort");
    clean = clean.replace(/renal colic/gi, "Abdominal / Flank Discomfort");
    clean = clean.replace(/\(?kidney stone\)?/gi, "Abdominal Discomfort");
    clean = clean.replace(/renal calculi/gi, "Flank Pain");
    clean = clean.replace(/urological \/ uti/gi, "Urinary Discomfort");
  }

  if (!hasAppendicitis) {
    clean = clean.replace(/acute appendicitis/gi, "Acute Lower Abdominal Pain");
    clean = clean.replace(/appendicitis/gi, "Abdominal Discomfort");
  }

  if (!hasCardiacDisease) {
    if (hasChestComplaint) {
      clean = clean.replace(/suspected acute coronary syndrome|acute coronary syndrome|myocardial infarction|acute mi\b/gi, "Chest Discomfort / Pressure");
    } else if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari)\b/i.test(callerText) || /\b(period|menstrual|dysmenorrhea)\b/i.test(clean)) {
      clean = clean.replace(/suspected acute coronary syndrome|acute coronary syndrome|myocardial infarction|acute mi\b/gi, "Dysmenorrhea / Menstrual Cramps");
    } else if (/\b(stomach|abdom|pet|gastric|cramp|colic)\b/i.test(callerText)) {
      clean = clean.replace(/suspected acute coronary syndrome|acute coronary syndrome|myocardial infarction|acute mi\b/gi, "Abdominal / Gastric Pain");
    } else {
      clean = clean.replace(/suspected acute coronary syndrome|acute coronary syndrome|myocardial infarction|acute mi\b/gi, "Reported Clinical Symptoms");
    }
  }

  // If caller specifically clarified periods/menstrual cramps, ensure condition reflects that
  if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari|periods cramps|period cramps|periods ka dard)\b/i.test(callerText)) {
    if (!clean.toLowerCase().includes("dysmenorrhea") && !clean.toLowerCase().includes("menstrual") && !clean.toLowerCase().includes("period")) {
      clean = clean && !/^(reported symptoms|clinical assessment|reported clinical symptoms)$/i.test(clean.trim())
        ? `Dysmenorrhea / Menstrual Cramps · ${clean}`
        : "Dysmenorrhea / Menstrual Cramps";
    }
  }

  // Strip generic doctor diagnostic jargon
  clean = clean.replace(/\bpathology\b/gi, "discomfort");
  clean = clean.replace(/\betiology\b/gi, "symptoms");
  clean = clean.replace(/\bsyndrome\b/gi, "symptoms");

  // Clean trailing phrases
  clean = clean.replace(/\s*or lower abdominal discomfort/gi, " and Abdominal Discomfort");
  clean = clean.replace(/\s*or lower abdominal pathology/gi, "");
  clean = clean.replace(/\s*under investigation/gi, "");

  // Strip accidental medicine names
  clean = clean.replace(/\b(paracetamol|ibuprofen|antibiotic|injection|antispasmodic|tramadol|diclofenac|tablet)\b/gi, "");

  clean = clean.replace(/^[\s,;-]+|[\s,;-]+$/g, "").trim();

  return clean || "Reported Clinical Symptoms";
}

/**
 * Comprehensively extracts all problems (pain, physical health conditions, mental health conditions)
 * reported by the caller / IP across chat history, intake symptom notes, and spoken text.
 * Orders clarified / latest reported symptoms first, and preserves all distinct clinical conditions.
 */
export function extractCallerReportedProblems(params = {}) {
  const result = params.result || (params.ekms_ai_context ? params : null);
  const callerIntake = params.callerIntake || result?.intake || {};
  const t = params.t || result?.triage || {};

  const chatMsgs = result?.ekms_ai_context?.chatHistory || params.chatHistory || [];
  const userMessages = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m && (m.sender === "user" || m.role === "user"))
        .map((m) => String(m.text || m.content || "").trim())
        .filter(Boolean)
    : [];

  // When caller has spoken in chat, the chat utterances are the canonical source of truth for what the IP actually said!
  const hasUserChat = userMessages.length > 0;
  const callerUtterances = userMessages.join(". ");
  const intakeNotes = String(callerIntake?.symptom_notes || result?.intake?.symptom_notes || "").trim();
  const intakeComplaint = String(callerIntake?.complaint || result?.intake?.complaint || "").trim();
  const callerSpokenText = String(result?.caller_spoken_text || params.callerSpokenText || "").trim();
  const rawCandidate = String(
    t?.primary_complaint ||
    result?.ekms_ai_context?.triageState?.suspectedCondition ||
    result?.ekms_ai_context?.triageState?.condition ||
    result?.ekms_ai_context?.condition ||
    ""
  ).trim();

  // If chat messages exist, ONLY use callerUtterances so synthetic notes or prior sessions cannot inject phantom symptoms!
  const combinedCallerText = hasUserChat
    ? callerUtterances.toLowerCase()
    : `${intakeNotes} ${intakeComplaint} ${callerSpokenText}`.trim().toLowerCase();
  const affirmativeText = stripNegatedPhrases(combinedCallerText);

  // Global check: did the caller say "no other symptoms", "only in my chest", "nothing else"?
  const deniesOtherSymptoms =
    /\b(no\s+other\s*symptoms?|no\s+other\s*problem|no\s+other\s*complaint|no\s+other\s*pain|nothing\s+else|only\s+in\s+my|pain\s+is\s+only|sirf\s+.*dard|koi\s+aur\s*(?:lakshan|dikkat|takleef)\s*nahi|aur\s+kuch\s*nahi)\b/i.test(combinedCallerText);

  // Checks for explicit denials across user messages
  const deniesChestPain = /\b(no\s+chest\s*pain|not\s+have\s+chest|don'?t\s+have\s+chest|chhati\s*me\s*dard\s*nahi|no\s+pain\s*in\s*chest)\b/i.test(combinedCallerText);
  const deniesFever = (deniesOtherSymptoms && !/\b(fever|bukhar)\b/i.test(combinedCallerText)) || /\b(no\s+fever|not\s+have\s+fever|don'?t\s+have\s+fever|bukhar\s+nahi|nehi\s+fever)\b/i.test(combinedCallerText);
  const deniesBleeding = (deniesOtherSymptoms && !/\b(bleed|blood|khoon)\b/i.test(combinedCallerText)) || /\b(no\s+bleed|not\s+bleeding|don'?t\s+have\s+bleed|khoon\s*nahi)\b/i.test(combinedCallerText);
  const deniesBreathing =
    (deniesOtherSymptoms && !/\b(breath|saans)\b/i.test(combinedCallerText)) ||
    /\b(?:no|without|not)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:breath\w*|saans\w*|shortness|respiratory)/i.test(combinedCallerText) ||
    /\b(no\s+breath\w*|no\s+shortness|saans\s*theek|breathing\s*trouble\s*nahi|no\s+difficulty\s*breathing|no\s+trouble\s*breathing|no\s+breathing\s*problem)\b/i.test(combinedCallerText);
  const deniesVomiting = (deniesOtherSymptoms && !/\b(vomit|ulti|nausea)\b/i.test(combinedCallerText)) || /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:vomit\w*|ulti\w*|nausea)/i.test(combinedCallerText);
  const deniesJoint = /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:joint\w*|jodon)/i.test(combinedCallerText);
  const deniesBodyAche = /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:body\s*aches?|badan\s*dard)/i.test(combinedCallerText);
  const deniesCough = /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:cough\w*|khansi)/i.test(combinedCallerText);
  const deniesCold = /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:cold|sardi|zukham)/i.test(combinedCallerText);
  const deniesSkin = /\b(?:no|without)\s+(?:[a-z\s]+?\s+(?:or|nor|and)\s+)?(?:rash|khujli|itching|skin|allergy)/i.test(combinedCallerText);
  const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(combinedCallerText);

  // Exclusive "only X" or "sirf X" detection:
  // e.g. "No rash or breathing trouble, only fever and body ache" -> strictly restrict allowed clinical concepts to FEVER and BODY_ACHE/JOINT!
  let exclusiveAllowedConcepts = null;
  const onlyMatch = combinedCallerText.match(/\b(?:only|sirf)\s+([a-z\s,]+?)(?=[.,;!?]|$|\b(?:please|can|help|advice|kuch|aur)\b)/i);
  if (onlyMatch && onlyMatch[1]) {
    const onlyClause = onlyMatch[1].toLowerCase();
    exclusiveAllowedConcepts = new Set();
    if (/\b(fever|bukhar|temperature|chills|shiver)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("FEVER");
    if (/\b(body\s*ache|body\s*pain|badan\s*dard|muscle|joint|jodon)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("JOINT");
    if (/\b(chest|chhati|heart|angina)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("CHEST");
    if (/\b(headache|sar\s*dard|sir\s*dard|migraine)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("HEADACHE");
    if (/\b(stomach|abdom|pet|gastric|acidity|cramp)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("ABDOMINAL");
    if (/\b(breath\w*|saans|cough|khansi|cold)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("RESPIRATORY");
    if (/\b(vomit|ulti|nausea)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("VOMITING");
    if (/\b(diarrhea|loose\s*motion|dast)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("DIARRHEA");
    if (/\b(period|periods|menstrua|menses)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("MENSTRUAL");
    if (/\b(hand|haath|palm|finger)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("HAND");
    if (/\b(wrist|kalai)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("WRIST");
    if (/\b(leg|knee|foot|pair|taang)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("LEG");
    if (/\b(snake|saap|saanp|bite)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("SNAKE_BITE");
    if (/\b(animal|dog|kutta)\b/i.test(onlyClause)) exclusiveAllowedConcepts.add("ANIMAL_BITE");
  }

  // Check the latest affirmative user message to see if a symptom was updated / clarified
  const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1].toLowerCase() : "";
  const lastAffirmative = stripNegatedPhrases(lastUserMsg);

  const getClinicalConcept = (conditionStr = "") => {
    const s = conditionStr.toLowerCase();
    if (/\b(snake\s*bite|saanp|saap|envenomation|snakebite)\b/i.test(s)) return "SNAKE_BITE";
    if (/\b(animal\s*bite|dog\s*bite|kutta\s*kaat)\b/i.test(s)) return "ANIMAL_BITE";
    if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari)\b/i.test(s)) return "MENSTRUAL";
    if (/\b(stomach|abdom|pet|gastric|acidity|gas problem|belly|cramp)\b/i.test(s)) return "ABDOMINAL";
    if (/\b(headache|sir dard|sar dard|migraine)\b/i.test(s)) return "HEADACHE";
    if (/\b(chest|angina|heart|chhati)\b/i.test(s)) return "CHEST";
    if (/\b(fever|bukhar|chills|shiver|temperature)\b/i.test(s)) return "FEVER";
    if (/\b(vomit|nausea|ulti)\b/i.test(s)) return "VOMITING";
    if (/\b(diarrhea|loose motion|dast)\b/i.test(s)) return "DIARRHEA";
    if (/\b(breath\w*|saans\w*|cough\w*|khansi\w*|wheez\w*|asthma|respiratory)\b/i.test(s)) return "RESPIRATORY";
    if (/\b(weakness|dizzy|kamzori|chakkar|vertigo)\b/i.test(s)) return "WEAKNESS";
    if (/\b(back|kamar)\b/i.test(s)) return "BACK";
    if (/\b(wrist|kalai)\b/i.test(s)) return "WRIST";
    if (/\b(hand|palm|finger|haath|ungli)\b/i.test(s)) return "HAND";
    if (/\b(shoulder|elbow|bazu|kandha|kohni|arm)\b/i.test(s)) return "ARM";
    if (/\b(leg|knee|ankle|foot|feet|pair|taang|ghutna|takhna)\b/i.test(s)) return "LEG";
    if (/\b(joint\w*|jodon|badan|body pain|muscle\w*|body ache)\b/i.test(s)) return "JOINT";
    if (/\b(cut|wound|laceration|bleed|chot|injury|fall|fell)\b/i.test(s)) return "TRAUMA";
    if (/\b(burn|jal gaya)\b/i.test(s)) return "BURN";
    if (/\b(rash|khujli|itching|skin|allergy)\b/i.test(s)) return "SKIN";
    if (/\b(urinary|peshab)\b/i.test(s)) return "URINARY";
    if (/\b(panic|anxiety|ghabrahat)\b/i.test(s)) return "PANIC";
    if (/\b(depress|hopeless|sadness|udaas|crying)\b/i.test(s)) return "DEPRESSION";
    if (/\b(suicid|wants to die|harm)\b/i.test(s)) return "CRISIS";
    if (/\b(insomnia|sleep|neend)\b/i.test(s)) return "SLEEP";
    if (/\b(hiv|aids|sti|std)\b/i.test(s)) return "HIV";
    return "OTHER";
  };

  const foundProblems = [];
  const seenConcepts = new Set();

  const addProblem = (prob, priority = false) => {
    if (!prob || typeof prob !== "string") return;
    const clean = prob.trim().replace(/^[-*•\d.)\s]+/, "").trim();
    if (clean.length < 3) return;

    if (/^(104|108|ambulance|tele-doctor|primary clinical assessment|clinical assessment|reported symptoms|reported clinical symptoms)$/i.test(clean.toLowerCase())) {
      return;
    }

    const concept = getClinicalConcept(clean);

    // If caller explicitly restricted symptoms via "only" clause, drop any unmentioned concept!
    if (exclusiveAllowedConcepts && exclusiveAllowedConcepts.size > 0) {
      if (concept !== "OTHER" && !exclusiveAllowedConcepts.has(concept)) {
        return;
      }
    }

    if (concept !== "OTHER" && seenConcepts.has(concept)) {
      if (priority) {
        const existIdx = foundProblems.findIndex((p) => getClinicalConcept(p) === concept);
        if (existIdx !== -1) {
          foundProblems.splice(existIdx, 1);
          foundProblems.unshift(clean);
        }
      }
      return;
    }

    // Avoid duplicates or substring collisions
    const exists = foundProblems.some(
      (p) => p.toLowerCase() === clean.toLowerCase() || p.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(p.toLowerCase())
    );
    if (!exists) {
      if (concept !== "OTHER") {
        seenConcepts.add(concept);
      }
      if (priority) {
        foundProblems.unshift(clean);
      } else {
        foundProblems.push(clean);
      }
    }
  };

  // 0. Universal Natural Language Symptom Extractor from live Caller Utterances
  // Always inspect and prioritize what the IP literally stated in the chat!
  if (hasUserChat) {
    for (let i = userMessages.length - 1; i >= 0; i--) {
      const uMsg = userMessages[i].trim();
      const uMsgLower = uMsg.toLowerCase();
      const uAffirmative = stripNegatedPhrases(uMsgLower);
      if (!uAffirmative || uAffirmative.length < 3) continue;

      const isPriority = i === userMessages.length - 1;

      // Pattern A: "pain in (my/the) [bodypart] (area)"
      const painInMatch = uAffirmative.match(/\bpain\s+in\s+(?:my|the|both)?\s*([a-z\s]+?)(?:\s+(?:area|region|part|side))?(?=[.,;!?]|$|\b(?:since|from|for|and|with|but|because)\b)/i);
      if (painInMatch && painInMatch[1]) {
        const bpRaw = painInMatch[1].trim();
        if (bpRaw.length >= 3 && !["much", "any", "some", "severe", "mild"].includes(bpRaw.toLowerCase())) {
          const bpClean = bpRaw.charAt(0).toUpperCase() + bpRaw.slice(1);
          const fullLabel = uMsgLower.includes("area") ? `Pain in ${bpClean} Area` : `Pain in ${bpClean}`;
          addProblem(fullLabel, isPriority);
        }
      }

      // Pattern B: "[bodypart] pain"
      const bodyPartPainMatch = uAffirmative.match(/\b([a-z]+)\s+pain\b/i);
      if (bodyPartPainMatch && bodyPartPainMatch[1]) {
        const bp = bodyPartPainMatch[1].trim();
        if (!["severe", "mild", "sharp", "dull", "terrible", "bad", "much", "any", "no"].includes(bp.toLowerCase()) && bp.length >= 3) {
          addProblem(`${bp.charAt(0).toUpperCase() + bp.slice(1)} Pain`, isPriority);
        }
      }

      // Pattern C: Hindi "[bodypart] me/mein dard"
      const hindiDardMatch = uAffirmative.match(/\b([a-z]+)\s*(?:me|mein)\s*dard\b/i);
      if (hindiDardMatch && hindiDardMatch[1]) {
        const bp = hindiDardMatch[1].trim().toLowerCase();
        if (bp === "haath" || bp === "hath") addProblem("Pain in Hand", isPriority);
        else if (bp === "kalai") addProblem("Pain in Wrist Area", isPriority);
        else if (bp === "kamar") addProblem("Lower Back Pain / Backache", isPriority);
        else if (bp === "seene" || bp === "chhati") addProblem("Chest Discomfort / Pain", isPriority);
        else if (bp === "pet") addProblem("Abdominal / Gastric Pain", isPriority);
        else if (bp === "sar" || bp === "sir") addProblem("Severe Headache / Migraine", isPriority);
        else if (bp === "gale") addProblem("Sore Throat / Pharyngeal Pain", isPriority);
        else if (bp === "pair" || bp === "taang") addProblem("Leg & Lower Extremity Pain", isPriority);
        else if (bp === "ghutne") addProblem("Knee Pain", isPriority);
      }
    }
  }

  // 0b. Snake Bite / Animal Bite (Life-Threatening Emergency Chief Complaint)
  const isSnakeBite = /\b(snake\s*bite|saap\s*(?:ne\s*)?kaat|saanp\s*(?:ne\s*)?kaat|snakebite|envenomation)\b/i.test(combinedCallerText);
  if (isSnakeBite) {
    addProblem("Snake Bite", true);
  }

  const isAnimalBite = !isSnakeBite && /\b(dog\s*bite|animal\s*bite|kutta\s*(?:ne\s*)?kaat|monkey\s*bite)\b/i.test(combinedCallerText);
  if (isAnimalBite) {
    addProblem("Animal / Dog Bite Injury", true);
  }

  // 1. Check for specific pain conditions
  // Menstrual / Dysmenorrhea
  if (/\b(period|periods|menstrua\w*|menses|dysmenorrhea|mahavari|periods cramps|period cramps|periods ka dard|period pain|bleeding and cramps)\b/i.test(affirmativeText)) {
    const isPriority = /\b(period|periods|menstrua|dysmenorrhea|menses)\b/i.test(lastAffirmative);
    addProblem("Dysmenorrhea / Menstrual Cramps", isPriority);
  }

  // Stomach / Abdominal / Gastric Pain & Cramps
  if (/\b(stomach cramps?|abdominal cramps?|stomach pain|abdominal pain|pet dard|pet me dard|pet me marod|gastric pain|gastric|acidity|gas problem|pet kharab|tummy ache|belly pain|stomach ache)\b/i.test(affirmativeText)) {
    const isPriority = /\b(stomach|abdom|pet|gastric|acidity)\b/i.test(lastAffirmative);
    let label = "Abdominal Pain";
    const hasCramp = /\b(cramp|marod)\b/i.test(affirmativeText);
    const hasGastric = /\b(gastric|acidity|gas\s*problem)\b/i.test(affirmativeText);
    const hasAbdom = /\b(stomach|abdom|pet|tummy|belly)\b/i.test(affirmativeText);
    if (hasCramp && hasGastric) label = "Abdominal Cramps & Gastric Discomfort";
    else if (hasCramp) label = "Abdominal Cramps";
    else if (hasGastric && hasAbdom) label = "Gastric Pain & Acidity";
    else if (hasGastric) label = "Gastric Discomfort / Acidity";
    else if (hasAbdom) label = "Abdominal Pain";
    addProblem(label, isPriority);
  }

  // Headache / Migraine
  if (/\b(headache|sir dard|sar dard|migraine|sar me dard|heavy head|throbbing head)\b/i.test(affirmativeText)) {
    const isPriority = /\b(headache|sir dard|sar dard|migraine)\b/i.test(lastAffirmative);
    addProblem("Severe Headache / Migraine", isPriority);
  }

  // Chest Discomfort / Pain
  if (!deniesChestPain && /\b(chest pain|chhati me dard|chest tightness|chest pressure|dil me dard|heaviness in chest|angina|chest)\b/i.test(affirmativeText)) {
    const isPriority = /\b(chest|chhati|heart|angina)\b/i.test(lastAffirmative);
    addProblem("Chest Discomfort / Pain", isPriority);
  }

  // Lower Back Pain / Backache
  if (/\b(back pain|backache|kamar dard|kamar me dard|lower back pain|spine pain)\b/i.test(affirmativeText)) {
    const isPriority = /\b(back|kamar)\b/i.test(lastAffirmative);
    addProblem("Lower Back Pain / Backache", isPriority);
  }

  // Hand & Wrist Pain
  if (/\b(wrist|kalai|wrist area|wrist joint)\b/i.test(affirmativeText)) {
    const isPriority = /\b(wrist|kalai)\b/i.test(lastAffirmative);
    addProblem("Pain in Wrist Area", isPriority);
  }
  if (/\b(hand|haath|palm|finger|fingers|thumb|ungli)\b/i.test(affirmativeText) && /\b(pain|dard|ache|hurts?|sore|sprain|swelling|sujan|injury|chot|fall|fell)\b/i.test(affirmativeText)) {
    const isPriority = /\b(hand|haath|palm|finger)\b/i.test(lastAffirmative);
    addProblem("Pain in Hand", isPriority);
  }

  // Arm, Shoulder & Elbow Pain
  if (/\b(shoulder|kandha|elbow|kohni|forearm|bazu|upper arm)\b/i.test(affirmativeText) && /\b(pain|dard|ache|hurts?|injury|chot)\b/i.test(affirmativeText)) {
    const isPriority = /\b(shoulder|elbow|arm)\b/i.test(lastAffirmative);
    const label = /\b(shoulder|kandha)\b/i.test(affirmativeText) ? "Pain in Shoulder" : "Arm & Elbow Pain";
    addProblem(label, isPriority);
  }

  // Leg, Knee, Ankle & Foot Pain
  if (/\b(knee|knees|ghutna|ankle|takhna|foot|feet|heel|calf|pair|taang|thigh)\b/i.test(affirmativeText) && /\b(pain|dard|ache|hurts?|sprain|injury|chot)\b/i.test(affirmativeText)) {
    const isPriority = /\b(knee|ankle|foot|pair|taang)\b/i.test(lastAffirmative);
    const label = /\b(knee|ghutna)\b/i.test(affirmativeText)
      ? "Knee Pain"
      : (/\b(ankle|takhna)\b/i.test(affirmativeText) ? "Ankle Pain & Sprain" : "Leg & Lower Extremity Pain");
    addProblem(label, isPriority);
  }

  // Joint Pain & Body Ache (Strict separation: never bundle unmentioned symptoms!)
  const hasJoint = !deniesJoint && /\b(joint pain|jodon me dard|joints?\b|jodon\b)/i.test(affirmativeText);
  const hasBodyAche = !deniesBodyAche && /\b(body ache|body pain|badan dard|generalized body ache)\b/i.test(affirmativeText);
  const hasMuscleAche = !deniesBodyAche && /\b(muscle ache|muscle pain|manspeshi)\b/i.test(affirmativeText);

  if (hasJoint && (hasBodyAche || hasMuscleAche)) {
    const isPriority = /\b(joint|jodon|badan|body|muscle)\b/i.test(lastAffirmative);
    addProblem("Joint Pain & Body Ache", isPriority);
  } else if (hasJoint) {
    const isPriority = /\b(joint|jodon)\b/i.test(lastAffirmative);
    addProblem("Joint Pain", isPriority);
  } else if (hasBodyAche) {
    const isPriority = /\b(badan|body)\b/i.test(lastAffirmative);
    addProblem("Body Ache", isPriority);
  } else if (hasMuscleAche) {
    const isPriority = /\b(muscle|manspeshi)\b/i.test(lastAffirmative);
    addProblem("Muscle Ache", isPriority);
  }

  // Sore Throat / Pharyngeal Pain
  if (/\b(throat pain|gale me dard|sore throat|gale me khash khash|pain swallowing)\b/i.test(affirmativeText)) {
    addProblem("Sore Throat / Pharyngeal Pain");
  }

  // Dental / Ear Pain
  if (/\b(tooth pain|daant dard|toothache|ear pain|kaan dard|earache)\b/i.test(affirmativeText)) {
    addProblem("Dental / Ear Pain");
  }

  // Eye Pain / Irritation
  if (/\b(eye pain|aankh me dard|burning eyes|aankhon me jalan)\b/i.test(affirmativeText)) {
    addProblem("Eye Pain & Irritation");
  }

  // 2. Health Conditions (Physical / Somatic)
  // Nausea & Persistent Vomiting: MUST be explicitly mentioned by caller
  const callerMentionedVomit = !deniesVomiting && /\b(vomit|vomiting|ulti|throwing up|cannot keep.*fluid|cannot keep.*food|retching)\b/i.test(combinedCallerText) && /\b(vomit|vomiting|ulti|throwing up|cannot keep.*fluid|cannot keep.*food|retching)\b/i.test(affirmativeText);
  const callerMentionedNausea = !deniesVomiting && /\b(nausea|ji machlana)\b/i.test(combinedCallerText) && /\b(nausea|ji machlana)\b/i.test(affirmativeText);

  if (callerMentionedVomit && callerMentionedNausea) {
    const isPriority = /\b(vomit|ulti|nausea)\b/i.test(lastAffirmative);
    addProblem("Nausea & Persistent Vomiting", isPriority);
  } else if (callerMentionedVomit) {
    const isPriority = /\b(vomit|ulti)\b/i.test(lastAffirmative);
    addProblem("Persistent Vomiting", isPriority);
  } else if (callerMentionedNausea) {
    const isPriority = /\b(nausea|ji machlana)\b/i.test(lastAffirmative);
    addProblem("Nausea", isPriority);
  }

  // Acute Diarrhea / Loose Motions
  const callerMentionedDiarrhea = /\b(loose motion|loose motions|diarrhea|dast|pet chalna|watery stool)\b/i.test(combinedCallerText);
  if (callerMentionedDiarrhea && !deniesOtherSymptoms && /\b(loose motion|loose motions|diarrhea|dast|pet chalna|watery stool)\b/i.test(affirmativeText)) {
    const isPriority = /\b(loose|diarrhea|dast)\b/i.test(lastAffirmative);
    addProblem("Acute Diarrhea / Loose Motions", isPriority);
  }

  // Fever & Chills / Shivering (Strict separation: never add chills if only fever was stated or if caller clarifies mild fever/no shivering!)
  const isCallerMildFeverInProb =
    /\b(mild\s+fever|halka\s+bukhar|low\s+grade\s+fever|halka\s+sa\s+bukhar|fever\s+is\s+mild|mild\s+warmth|kam\s+bukhar)\b/i.test(combinedCallerText) ||
    (/\b(fever|bukhar)\b/i.test(combinedCallerText) && /\b(mild|halka|low grade|mild warmth|mild heat)\b/i.test(combinedCallerText));

  const callerDeniesChillsInProb =
    /\b(no\s+shivering|no\s+chills|without\s+shivering|without\s+chills|shivering\s+nahi|chills\s+nahi|no\s+kampkampi|kampkampi\s+nahi|bina\s+(?:zyada\s+)?hilaav|bina\s+shaking|mild fever,?\s*no shivering)\b/i.test(combinedCallerText);

  const callerMentionedFever = !deniesFever && /\b(fever|bukhar|temperature|high fever|tez bukhar)\b/i.test(combinedCallerText) && /\b(fever|bukhar|temperature|high fever|tez bukhar)\b/i.test(affirmativeText);
  const callerMentionedChills = !deniesFever && !callerDeniesChillsInProb && !isCallerMildFeverInProb && /\b(chills|shivering|kapkapi|thand lag rahi)\b/i.test(combinedCallerText) && /\b(chills|shivering|kapkapi|thand lag rahi)\b/i.test(affirmativeText);

  if (callerMentionedFever && callerMentionedChills) {
    const isPriority = /\b(fever|bukhar|temperature|chills|shivering)\b/i.test(lastAffirmative);
    const isHigh = /\b(high|tez|10[2-5]|severe)\b/i.test(affirmativeText);
    addProblem(isHigh ? "High Fever with Chills & Shivering" : "Fever with Chills", isPriority);
  } else if (callerMentionedFever) {
    const isPriority = /\b(fever|bukhar|temperature)\b/i.test(lastAffirmative);
    const isHigh = !isCallerMildFeverInProb && /\b(high|tez|10[2-5]|severe)\b/i.test(affirmativeText);
    const label = isHigh ? "High Fever" : (isCallerMildFeverInProb ? "Mild Fever" : "Fever");
    addProblem(label, isPriority);
  } else if (callerMentionedChills) {
    const isPriority = /\b(chills|shivering|kapkapi)\b/i.test(lastAffirmative);
    addProblem("Chills & Shivering", isPriority);
  }

  // Respiratory Distress / Cough / Cold (Strict separation: never bundle Cough or Cold if caller only had breathing difficulty!)
  const hasStrugglingToBreathe = !deniesBreathing && /\b(struggling\s*(?:to|for)\s*breath\w*|struggle\s*to\s*breathe|cannot\s*breathe|can'?t\s*breathe|unable\s*to\s*breathe|hard\s*to\s*breathe|saans nahi aa rahi|gasping|gasping for air|suffocat)\b/i.test(affirmativeText);
  const hasBreathing = !deniesBreathing && (hasStrugglingToBreathe || /\b(shortness of breath|saans.*takleef|saans phoolna|breathlessness|difficulty breathing|trouble breathing|wheezing)\b/i.test(affirmativeText));
  const hasCough = !deniesCough && /\b(cough|khansi)\b/i.test(affirmativeText);
  const hasCold = !deniesCold && /\b(cold|zukham|sardi|runny nose|sneeze)\b/i.test(affirmativeText);

  if (hasStrugglingToBreathe) {
    addProblem("Severe Respiratory Distress / Struggling to Breathe", true);
  } else if (hasBreathing) {
    const isPriority = /\b(breath|saans|phoolna|difficulty)\b/i.test(lastAffirmative);
    if (hasCough) {
      addProblem("Cough with Difficulty Breathing", isPriority);
    } else if (/\b(shortness of breath|saans phoolna)\b/i.test(affirmativeText)) {
      addProblem("Shortness of Breath", isPriority);
    } else {
      addProblem("Difficulty Breathing", isPriority);
    }
  } else if (hasCough && hasCold) {
    const isPriority = /\b(cough|khansi|cold|sardi)\b/i.test(lastAffirmative);
    addProblem("Cough & Cold", isPriority);
  } else if (hasCough) {
    const isPriority = /\b(cough|khansi)\b/i.test(lastAffirmative);
    addProblem("Cough", isPriority);
  } else if (hasCold) {
    const isPriority = /\b(cold|sardi|zukham)\b/i.test(lastAffirmative);
    addProblem("Cold & Congestion", isPriority);
  }

  // Weakness & Dizziness
  const callerMentionedWeakness = /\b(dizziness|chakkar|vertigo|weakness|kamzori|feeling faint|lightheaded|unsteady|dizzy and weak|weak and dizzy|feel dizzy)\b/i.test(combinedCallerText);
  if (callerMentionedWeakness && !deniesOtherSymptoms && /\b(dizziness|chakkar|vertigo|weakness|kamzori|feeling faint|lightheaded|unsteady|dizzy and weak|weak and dizzy|feel dizzy)\b/i.test(affirmativeText)) {
    const isPriority = /\b(dizzy|weak|chakkar|kamzori)\b/i.test(lastAffirmative);
    addProblem("Weakness & Dizziness", isPriority);
  }

  // Cut / Wound / Bleeding
  const hasHeavyBleeding = !isSnakeBite && !isAnimalBite && !deniesBleeding && /\b(heavy bleed|active.*heavy|profuse bleed|active.*bleed|workplace.*injury|wound depth|deep wound|laceration|khoon beh raha|arterial)\b/i.test(combinedCallerText);
  const hasGeneralCut = !isSnakeBite && !isAnimalBite && !deniesBleeding && /\b(cut|wound|laceration|bleed|chot|injury|slit|scratch|khoon|tanka)\b/i.test(affirmativeText);

  if (hasHeavyBleeding) {
    const isWorkplace = /\b(workplace|machine|factory|industrial)\b/i.test(combinedCallerText);
    addProblem(isWorkplace ? "Workplace Injury with Active Bleeding" : "Laceration Injury with Active Bleeding", true);
  } else if (hasGeneralCut) {
    addProblem("Superficial Cut / Laceration Injury");
  }

  // Burn Injury / Scald
  if (/\b(burn|jal gaya|hot water burn|scald|acid burn)\b/i.test(affirmativeText)) {
    addProblem("Burn Injury / Thermal Scald");
  }

  // Skin Rash & Allergy
  if (!isSnakeBite && !deniesSkin && /\b(rash|khujli|itching|skin allergy|hives|redness|dana|chakatte)\b/i.test(affirmativeText)) {
    addProblem("Skin Rash & Allergic Reaction");
  }

  // Urinary Burning / Discomfort
  if (/\b(burning urination|peshab me jalan|frequent urination|bar bar peshab|dysuria|pain while urinating)\b/i.test(affirmativeText)) {
    addProblem("Urinary Burning / Discomfort");
  }

  // Orthopedic Trauma / Fracture
  if (/\b(fracture|haddi tutna|sprain|moch|bone broken|twisted ankle)\b/i.test(affirmativeText)) {
    addProblem("Orthopedic Trauma / Suspected Fracture");
  }

  // HIV / Sexual Health
  if (/\b(hiv|aids|std|sti|gupt rog|sexual disease|art center|ictc|cd4|pep|prep)\b/i.test(affirmativeText)) {
    addProblem("HIV / Sexual Health Consultation");
  }

  // 3. Mental Conditions
  // Acute Panic & Anxiety
  if (/\b(panic attack|severe anxiety|ghabrahat|bechaini|racing heart from anxiety|nervous breakdown|extreme panic)\b/i.test(affirmativeText)) {
    addProblem("Acute Panic Attack & Severe Anxiety");
  }

  // Depressive Episode & Emotional Distress
  if (/\b(depression|severe sadness|depressed|hopeless|udaas|ronaa aa raha|crying uncontrollably|grief|emotional breakdown|loneliness)\b/i.test(affirmativeText)) {
    addProblem("Depressive Episode & Emotional Distress");
  }

  // Crisis & Suicidal Distress Support
  if (!isSafe && /\b(suicid|wants to die|end my life|kill myself|marne ka man|cut wrist)\b/i.test(affirmativeText)) {
    addProblem("Crisis & Suicidal Distress Support", true);
  }

  // Sleep Disturbance / Insomnia
  if (/\b(insomnia|cannot sleep|sleeplessness|neend nahi aati|raat ko neend nahi|disturbed sleep|unable to sleep)\b/i.test(affirmativeText)) {
    addProblem("Sleep Disturbance / Insomnia");
  }

  // Severe Mental Stress & Overwhelm
  if (/\b(extreme stress|tanaav|mental pressure|overwhelmed|mental exhaustion)\b/i.test(affirmativeText)) {
    addProblem("Severe Mental Stress & Overwhelm");
  }

  // 4. Also check rawCandidate (ONLY if caller did not engage in live chat)
  if (rawCandidate && !hasUserChat) {
    const sanitizedCandidate = sanitizeSymptomOrCondition(rawCandidate, combinedCallerText);
    const isChannel = /^(104|108|ambulance|tele-doctor|primary clinical assessment|clinical assessment|reported symptoms|reported clinical symptoms)$/i.test(sanitizedCandidate.trim());
    if (!isChannel) {
      addProblem(sanitizedCandidate);
    }
  }

  if (foundProblems.length === 0) {
    foundProblems.push("Primary Clinical Assessment");
  }

  // USER MANDATE: "try to find out the main condiotion and try to give max 2 or 3 not more than that"
  return foundProblems.slice(0, 3);
}

export function formatClinicalSummary(intake = {}, condition = "Reported Symptoms", severity = 5, duration = "Reported today", primaryReferral = "104 Health Helpline") {
  const age = intake.age != null && intake.age !== "" ? Number(intake.age) : null;
  const sex = intake.sex ? String(intake.sex).trim() : "";

  let callerDemo = "Caller";
  if (age && sex) {
    callerDemo = `${age}-year-old ${sex.toLowerCase()} caller`;
  } else if (age) {
    callerDemo = `${age}-year-old caller`;
  } else if (sex) {
    callerDemo = `${sex} caller`;
  }

  let actionClause = "";
  const refLower = (primaryReferral || "").toLowerCase();
  if (refLower.includes("108") || refLower.includes("ambulance")) {
    actionClause = "requiring immediate 108 Emergency Ambulance dispatch for acute emergency/trauma care.";
  } else if (refLower.includes("104") || refLower.includes("helpline")) {
    actionClause = "guided to 104 Health Helpline for 24x7 tele-doctor consultation and medical advice.";
  } else if (refLower.includes("hospital") && (refLower.includes("esic") || !refLower.includes("district"))) {
    actionClause = "referred to nearest ESIC Hospital for in-person medical evaluation and secondary care.";
  } else if (refLower.includes("dispensary") || refLower.includes("esis")) {
    actionClause = "guided to nearest ESIS Dispensary for primary doctor consultation and medicine dispensing.";
  } else if (refLower.includes("tie")) {
    actionClause = "referred to nearest Empanelled Tie-Up Facility for specialized clinical care under ESI empanelment.";
  } else if (refLower.includes("district")) {
    actionClause = "referred to nearest Govt District Hospital for casualty evaluation and acute medical care.";
  } else {
    actionClause = `guided to ${primaryReferral} for medical evaluation.`;
  }

  const chatHistory = intake.ekms_ai_context?.chatHistory || intake.chatHistory || [];
  const historyText = Array.isArray(chatHistory)
    ? chatHistory
        .filter((m) => m && (m.sender === "user" || m.role === "user"))
        .map((m) => (typeof m.content === "string" ? m.content : m.text || ""))
        .join(" ")
    : "";
  const callerText = `${intake.symptom_notes || ""} ${intake.complaint || ""} ${intake.caller_spoken_text || ""} ${historyText}`.trim().toLowerCase();
  const cleanCond = sanitizeSymptomOrCondition(condition, callerText);
  const validDur = validateCallerMentionedDuration(duration, callerText);
  const durText = validDur && validDur !== "Reported today" ? validDur : "Reported today";

  const normSev = (s) => {
    const str = String(s || "").trim().toLowerCase();
    if (str.includes("sev") || str.includes("emerg") || str.includes("high") || Number(s) >= 8) return "Severe";
    if (str.includes("mod") || str.includes("urg") || (Number(s) >= 5 && Number(s) < 8)) return "Moderate";
    return "Mild";
  };
  const categoryLabel = normSev(severity);

  const summaryEn = `${callerDemo} reports ${cleanCond} (${categoryLabel} · ${durText}); ${actionClause}`;

  let hindiDemo = age ? `${age} वर्षीय ` : "";
  hindiDemo += sex ? (sex.toLowerCase() === "female" ? "महिला कॉलर" : "पुरुष कॉलर") : "कॉलर";
  const summaryHi = `${hindiDemo} को ${cleanCond} की शिकायत है (${categoryLabel}, अवधि: ${durText}); ${primaryReferral} द्वारा आवश्यक मार्गदर्शन दिया गया।`;

  return { summaryEn, summaryHi, cleanCond };
}

async function evaluateRawTriage(intake) {
  const ekmsCtx = intake.ekms_ai_context || {};
  const tState = ekmsCtx.triageState || ekmsCtx;
  const notes = String(intake.symptom_notes || "").toLowerCase();
  const age = intake?.age != null && intake.age !== "" ? parseInt(intake.age, 10) : (tState?.age != null && tState.age !== "" ? parseInt(tState.age, 10) : null);
  const severity = Number(intake.severity_reported) || (tState?.severityScore || (tState?.severity === "High" ? 9 : 5));
  let rawDur = String(intake.duration || tState?.duration || "Reported today");
  if (/\b(fall|fell|falling|accident|injury|trauma|pain|chot|gir gaya|impact)\b/i.test(rawDur)) {
    rawDur = "Reported today";
  }
  let duration = rawDur;

  // Extract caller's actual spoken text (excluding bot assistant prompts)
  const chatMsgs = ekmsCtx.chatHistory || [];
  const callerUtterances = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m.sender === "user" || m.role === "user")
        .map((m) => m.text || "")
        .join(" ")
    : "";
  const callerSpokenText = `${notes} ${callerUtterances}`.trim().toLowerCase();

  const combinedClinicalText = [notes, callerUtterances, tState?.condition, tState?.suspectedCondition]
    .filter(Boolean)
    .join(" ");
  const learnedSnippet = await buildLearnedPromptSnippet(combinedClinicalText, "triage");

  const isCallerSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|i'?m safe|fine|theek hoon)\b/i.test(callerSpokenText);
  const callerHasSuicideWords = !isCallerSafe && /\b(suicid\w*|wanna die|want to die|kill myself|mar ja\w*|jaan de dunga|apni zindagi khatam|end my life)\b/i.test(callerSpokenText);
  const callerHasActiveTraumaCut = !isCallerSafe && /\b(cut\s*(my|the)?\s*wrist|slit\s*(my|the)?\s*wrist|slashed|profuse\s*bleed|bleeding\s*from\s*cut|knife\s*wound|stab|drank\s*poison|zeher\s*pi|swallowed\s*pills)\b/i.test(callerSpokenText);

  const allText = `${callerSpokenText} ${tState?.condition || ""} ${tState?.suspectedCondition || ""} ${tState?.clinicalSummary || ""} ${(tState?.redFlagsDetected || []).join(" ")}`.toLowerCase();

  const isElderly = age != null && age >= 60;
  const isChild = age != null && age < 12;

  const isCallerMildFever =
    /\b(mild\s+fever|halka\s+bukhar|low\s+grade\s+fever|halka\s+sa\s+bukhar|fever\s+is\s+mild|mild\s+warmth|kam\s+bukhar)\b/i.test(allText) ||
    (/\b(fever|bukhar)\b/i.test(allText) && /\b(mild|halka|low grade|mild warmth|mild heat)\b/i.test(allText));

  const callerDeniesChillsOrShivering =
    /\b(no\s+shivering|no\s+chills|without\s+shivering|without\s+chills|shivering\s+nahi|chills\s+nahi|no\s+kampkampi|kampkampi\s+nahi|bina\s+(?:zyada\s+)?hilaav|bina\s+shaking|mild fever,?\s*no shivering)\b/i.test(allText);

  // Normal fever / mild illness check (e.g. 60+ with simple normal fever without red flags is NOT an emergency!)
  const isNormalFeverOrMild =
    (severity <= 5 || isCallerMildFever) &&
    !/\b(high fever|tez bukhar|severe breath|saans nahi|chest|bleed|unconscious|seizure)\b/i.test(allText) &&
    !duration.includes("week") &&
    !duration.includes("4-7");

  // Determine effective severity considering age, clinical condition, and red flags:
  let effectiveSeverity = severity;
  if (!isNormalFeverOrMild && !isCallerMildFever) {
    if (isElderly && (severity >= 6 || /\b(chills|rigor|breath|chest|fall|weakness|dizzy|unsteady)\b/i.test(allText))) {
      effectiveSeverity = Math.max(8, severity);
    } else if (isChild && severity >= 6) {
      effectiveSeverity = Math.max(8, severity);
    }
  }

  // NACO 1097: HIV / AIDS / Sexual Disease / STI inquiry
  const isNacoHIV = /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease|genital|penis discharge|vaginal discharge|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(allText);

  // Check ESIS Dispensary operating hours (Mon–Fri, 10:00 AM – 3:00 PM; Closed Sat & Sun)
  const dispensaryStatus = getDispensaryOperatingStatus();

  const isPsych = !isNacoHIV && Boolean(
    tState?.isPsychiatric ||
    ekmsCtx?.isPsychiatric ||
    (tState?.referralDestination && tState.referralDestination.toLowerCase().includes("psych")) ||
    (tState?.referralDestination && (tState.referralDestination.toLowerCase().includes("manas") || tState.referralDestination.includes("14416"))) ||
    /\b(suicid|mar ja|jaan de dunga|depress|udaas|hopeless|anxiety|ghabrahat|die\b|kill myself|self-harm|crying|cut.*wrist|end life|mental health|stress|grief|sadness)\b/i.test(allText)
  );

  const hasSelfHarmAction = callerHasActiveTraumaCut;

  let selfHarmActionEn = "";
  let selfHarmActionHi = "";

  if (callerHasActiveTraumaCut) {
    if (/\b(wrist|knife|cut|slit|laceration|bleed)\b/i.test(callerSpokenText)) {
      selfHarmActionEn = "active self-harm (wrist laceration with bleeding)";
      selfHarmActionHi = "कलाई काटना और रक्तस्राव";
    } else if (/\b(poison|zeher|pills|overdose|chemical)\b/i.test(callerSpokenText)) {
      selfHarmActionEn = "toxic ingestion / self-harm overdose";
      selfHarmActionHi = "हानिकारक पदार्थ/दवाओं का सेवन";
    } else {
      selfHarmActionEn = "active physical self-harm injury";
      selfHarmActionHi = "स्वयं को शारीरिक चोट पहुँचाना";
    }
  }

  // Check if current time is off-hours (between 4:00 PM and 10:00 AM)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const hour = istDate.getHours();
  const currentMinutes = hour * 60 + istDate.getMinutes();
  const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM (960) to 10:00 AM (600)

  // Conditions for Category 7: ESI Tie-Up Hospital (Strict: IPD admission, ESIC referral, or explicit tie-up request)
  const isIpdEmergency = /\b(ipd|inpatient|admit|admission|admitted|icu|intensive care|emergency admit)\b/i.test(allText);
  const hasEsicReferral = /\b(esic referral|referred by esic|referral letter|doctor referral|referred to tie.?up)\b/i.test(allText);
  const isTieUpEligible = isIpdEmergency || hasEsicReferral || /\b(tie.?up|empanelled)\b/i.test(allText);

  // Conditions for Category 8: District Hospital (Public Healthcare outside ESIC)
  const isDistHospRequest = /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|immunization|vaccination|tika|tika karan|child vaccine)\b/i.test(allText);

  // FAST DIRECT SYNTHESIS (Instant, <5ms): Clinical Severity Engine according to standard triage guidelines
  const shouldRunFastPath = true;
  if (shouldRunFastPath) {
    const rawFlags = [
      ...(tState?.redFlagsDetected || []),
      ...(tState?.associated || []),
    ];

    if (isElderly && !isNormalFeverOrMild && effectiveSeverity >= 8) {
      rawFlags.push("Elderly patient (Age 60+) with clinical risk vulnerability");
    }
    if (isChild && !isNormalFeverOrMild && effectiveSeverity >= 8) {
      rawFlags.push("Pediatric vulnerability (Child < 12 years) requiring acute care");
    }

    const summarizedFlags = summarizeRedFlags(rawFlags, allText, isCallerSafe);

    // Check if beneficiary has physical health / medical symptoms alongside any psychiatric complaints
    const hasPhysicalHealthSymptoms =
      callerHasActiveTraumaCut ||
      effectiveSeverity >= 6 ||
      /\b(fever|bukhar|chest|chhati|heart|pain|dard|bleed|wound|cut|accident|injury|chot|vomit|ulti|loose motion|dast|fracture|burn|poison|snake|bite|breath|saans|cough|dizzy|chakkar|kamzori|stone|bp|headache|rash|infection)\b/i.test(allText);

    const ambulanceEval = isLifeThreateningAmbulanceCase(allText, effectiveSeverity, intake, tState);
    const isEmergency108 = ambulanceEval.is108;
    const chatChoseHospital =
      (tState?.referralDestination || "").toLowerCase().includes("hospital") ||
      /\b(hospital|aspatal|hospital jaana|hospital jana|visit hospital|esic hospital|admit|bada aspatal|hospital me dikhana|emergency ward|emergency casualty|visit esic hospital casualty|hospital casualty|visit esic hospital|go to hospital|wants to go to hospital|want to go to hospital)\b/i.test(allText);

    // User Mandate: Divide ALL clinical cases into 3 main categories only: Severe, Moderate, Mild.
    // - Severe: Forward to 108 Ambulance (Immediate Emergency Dispatch) & ESIC Hospital casualty (or 104 if psych)
    // - Moderate: Forward to ESIC Hospital & Govt Hospital (Govt District Hospital)
    // - Mild: Forward to 104 Health Helpline & ESIS Dispensary (Open Mon-Fri 10am-4pm, 1st & 3rd Sat 10am-12pm)

    duration = validateCallerMentionedDuration(duration, callerSpokenText);

    // Calculate clinical score (1-10) and standard category (Mild, Moderate, Severe)
    const clinicalScoreResult = calculateClinicalSeverityScore({
      symptom: intake.primary_complaint || tState?.symptom,
      condition: tState?.condition || tState?.suspectedCondition,
      callerSpokenText,
      allText,
      duration,
      chatHistory: chatMsgs,
      intake,
      tState,
    });

    const triageUrgencyScore = clinicalScoreResult.score;
    const normUrgency = clinicalScoreResult.urgency_level;

    let primaryReferral = "ESIS Dispensary";
    let primaryReason = "Routine primary care; visit nearest ESIS Dispensary (Open Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Saturday 10:00 AM – 12:00 PM) for doctor evaluation and medicines.";
    let secondaryReferral = "104 Health Helpline";
    let secondaryReason = "104 Health Helpline for 24x7 tele-doctor consultation backup.";
    let isDualProtocol = false;
    let call108 = false;

    const isExtremeLifeThreat = Boolean(
      /\b(cardiac arrest|unconscious|behosh|not breathing|saans nahi|collapse|crushing chest.*(?:sweat|pasina|left arm|radiat)|arterial bleed|snake\s*bite|drank poison|status epilepticus)\b/i.test(allText)
    );
    const hasAcuteLifeThreat = Boolean(
      isEmergency108 ||
      clinicalScoreResult.isLifeThreatening ||
      /\b(struggling\s*(?:to|for)\s*breath\w*|cannot\s*breathe|unable\s*to\s*breathe|gasping for air|not breathing|saans nahi|cyanosis|heavy active bleed|spurting bleed|arterial bleed|crushing chest.*(?:sweat|pasina|left arm|radiat|collapse)|cardiac arrest|unconscious|behosh|unresponsive|collapse|seizure.*>|status epilepticus|drank poison|acid ingestion|snake\s*bite)\b/i.test(allText) ||
      isExtremeLifeThreat
    );

    // Score 8 or manageable presentation routes to Hospital; only score 9-10 life-threatening emergencies route to 108
    const isScore8 = triageUrgencyScore === 8;
    const isScore8Manageable = isScore8 && !isExtremeLifeThreat;
    const shouldForward108 = normUrgency === "Severe" && ((triageUrgencyScore >= 9 && hasAcuteLifeThreat) || isExtremeLifeThreat) && !isScore8Manageable;

    if (normUrgency === "Severe") {
      if (shouldForward108) {
        primaryReferral = "108 Ambulance";
        primaryReason = ambulanceEval.reason || "Severe life-threatening emergency; dispatch 108 Ambulance immediately.";
        call108 = true;
        if (isPsych) {
          secondaryReferral = "104 Health Helpline";
          secondaryReason = "Concurrent acute psychiatric crisis; connect with 104 Health Helpline for emotional stabilization once ambulance is en route.";
          isDualProtocol = false;
        } else {
          secondaryReferral = "ESIC Hospital";
          secondaryReason = "24x7 Casualty & Emergency Department at nearest ESIC Hospital for trauma resuscitation and admission.";
          isDualProtocol = false;
        }
      } else {
        // Severe condition manageable at hospital (Score 8, or severe presentation without life threat)
        call108 = false;
        primaryReferral = "ESIC Hospital";
        primaryReason = "Severe condition manageable at hospital; direct patient immediately to nearest ESIC Hospital 24x7 Casualty (or Govt District Hospital).";
        secondaryReferral = "Govt District Hospital";
        secondaryReason = "Govt District Hospital for secondary hospital casualty backup.";
        isDualProtocol = false;
      }
    } else if (normUrgency === "Moderate") {
      call108 = false;
      if (isDistHospRequest) {
        primaryReferral = "Govt District Hospital";
        primaryReason = "Beneficiary needs public healthcare services outside the ESIC network; guide to nearest Govt District Hospital.";
        secondaryReferral = "ESIC Hospital";
        secondaryReason = "ESIC Hospital for specialized evaluation and coverage.";
        isDualProtocol = false;
      } else {
        primaryReferral = "ESIC Hospital";
        primaryReason = "Moderate clinical condition requiring hospital evaluation and care. Direct patient to nearest ESIC Hospital.";
        secondaryReferral = "Govt District Hospital";
        secondaryReason = "Govt District Hospital for secondary hospital medical consultation backup.";
        isDualProtocol = false;
      }
    } else {
      // Mild
      call108 = false;
      const wantsPhoneDoctor = allText.includes("phone doctor") || allText.includes("104") || allText.includes("tele-doctor");
      if (dispensaryStatus.isOpen && !wantsPhoneDoctor) {
        primaryReferral = "ESIS Dispensary";
        primaryReason = "Mild sub-acute presentation; visit nearest ESIS Dispensary (Open Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Saturday 10:00 AM – 12:00 PM) for doctor evaluation and medicines.";
        secondaryReferral = "104 Health Helpline";
        secondaryReason = "104 Health Helpline for 24x7 tele-doctor consultation backup.";
        isDualProtocol = false;
      } else {
        primaryReferral = "104 Health Helpline";
        primaryReason = "Mild non-emergency presentation. Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
        secondaryReferral = "ESIS Dispensary";
        secondaryReason = "Visit nearest ESIS Dispensary during operating hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Saturday 10:00 AM – 12:00 PM) for doctor checkup and medicines.";
        isDualProtocol = false;
      }
    }

    if (primaryReferral === secondaryReferral) {
      secondaryReferral = primaryReferral === "ESIC Hospital" ? "Govt District Hospital" : (primaryReferral === "ESIS Dispensary" ? "104 Health Helpline" : "ESIS Dispensary");
    }

    const callerExtractedProblems = extractCallerReportedProblems({
      result: {
        intake,
        caller_spoken_text: callerSpokenText,
        ekms_ai_context: {
          chatHistory: chatMsgs,
          triageState: tState,
        },
      },
      callerIntake: intake,
    });
    const callerProblemsSummary =
      callerExtractedProblems.length > 0 && callerExtractedProblems[0] !== "Primary Clinical Assessment"
        ? callerExtractedProblems.join(" · ")
        : null;

    const rawComp = callerProblemsSummary || tState?.suspectedCondition || tState?.condition || tState?.symptom || notes || "Primary Clinical Assessment";
    const cleanPrimaryComplaint = sanitizeSymptomOrCondition(rawComp, callerSpokenText);

    const primaryComplaint = isPsych && hasSelfHarmAction
      ? "Acute Self-Harm Crisis & Bleeding"
      : (isPsych && callerHasSuicideWords
        ? "Acute Suicidal Ideation / Mental Health Crisis"
        : (isPsych
          ? (tState?.suspectedCondition || tState?.condition || "Emotional Distress & Mental Health Support")
          : (isNacoHIV
            ? "HIV / AIDS / STI Health Consultation"
            : cleanPrimaryComplaint)));

    const clinicalSummaryObj = formatClinicalSummary(
      intake,
      primaryComplaint,
      normUrgency,
      duration,
      primaryReferral
    );

    let summaryEn = clinicalSummaryObj.summaryEn;
    let summaryHi = clinicalSummaryObj.summaryHi;

    if (isNacoHIV) {
      summaryEn = formatClinicalSummary(intake, "HIV / AIDS / STI Consultation", normUrgency, duration, "104 Health Helpline").summaryEn;
      summaryHi = `कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी मार्गदर्शन चाहता है (${normUrgency}); 104 गोपनीय परामर्श और आईसीटीसी केंद्र रेफरल आवश्यक है।`;
    } else if (isPsych && hasSelfHarmAction) {
      summaryEn = formatClinicalSummary(intake, `Acute Emotional Crisis with ${selfHarmActionEn}`, normUrgency, duration, "108 Ambulance").summaryEn;
      summaryHi = `कॉलर गंभीर मानसिक संकट में है और उसने ${selfHarmActionHi} की है (${normUrgency}); तुरंत 108 एम्बुलेंस और चिकित्सकीय सहायता आवश्यक है।`;
    } else if (isPsych && callerHasSuicideWords) {
      summaryEn = formatClinicalSummary(intake, "Acute Emotional Distress with Suicidal Ideation", normUrgency, duration, "104 Health Helpline").summaryEn;
      summaryHi = `कॉलर ने गंभीर मानसिक तनाव और आत्महत्या के विचारों की शिकायत की है (${normUrgency}), जिसके लिए 104 हेल्पलाइन द्वारा तत्काल परामर्श आवश्यक है।`;
    } else if (isPsych) {
      summaryEn = formatClinicalSummary(intake, "Emotional Distress and Psychological Disturbance", normUrgency, duration, "104 Health Helpline").summaryEn;
      summaryHi = `कॉलर को मानसिक तनाव और भावनात्मक परेशानी की शिकायत है (${normUrgency}); 104 हेल्पलाइन द्वारा परामर्श उपयुक्त है।`;
    }

    const triageUrgencyLevel = normUrgency;
    const triageAssessedSeverity = normUrgency;

    const decision = {
      urgency_level: triageUrgencyLevel,
      urgency_score: triageUrgencyScore,
      severity_score: triageUrgencyScore,
      assessed_severity_score: triageUrgencyScore,
      confidence: "high",
      is_psychiatric: isPsych,
      has_self_harm: hasSelfHarmAction,
      is_dual_protocol: isDualProtocol,
      call_108: call108,
      primary_complaint: primaryComplaint,
      duration: duration,
      assessed_severity: triageAssessedSeverity,
      call_referral_primary: primaryReferral,
      call_referral_primary_reason: primaryReason,
      call_referral_secondary: secondaryReferral,
      call_referral_secondary_reason: secondaryReason,
      referral_destination: primaryReferral,
      referral_reason: primaryReason,
      secondary_referral_destination: secondaryReferral,
      secondary_referral_reason: secondaryReason,
      summary_en: summaryEn,
      summary_hi: summaryHi,
      reasoning: isPsych
        ? (hasSelfHarmAction
            ? "Active physical self-harm trauma casualty requires immediate emergency dispatch followed by medical stabilization."
            : "Caller is experiencing emotional distress or mental health challenges. Connecting with 104 Health Helpline provides 24x7 confidential crisis counselling and doctor support.")
        : (tState?.referralReason || "Clinical evaluation based on reported symptoms, onset, and duration."),
      red_flags: summarizedFlags,
      recommended_facility_type: primaryReferral === "108 Ambulance"
        ? "108 Emergency Ambulance / ESIC Hospital Casualty"
        : (primaryReferral === "104 Health Helpline"
          ? "104 Health Helpline (Doctor on Call)"
          : primaryReferral),
      recommended_action: primaryReason,
      detected_language: "Hinglish",
      followup_questions: [
        "Kya unke sath is waqt koi parivaar ka sadasya mojud hai?",
        "Kya unhone pehle koi dawai ya treatment liya hai?",
      ],
      model_used: "ekms-adaptive-triage-fastpath",
    };


    return decision;
  }

  // 1. Primary AI Evaluation via Centralized LLM Proxy (Groq 21-Keys -> Gemini -> Claude -> Other)
  try {
    const triageSystemPrompt = `You are an expert ESIC / ESIS medical triage clinical evaluator in Assam, India. Evaluate symptoms and classify strictly into 3 urgency levels based on standard clinical criteria: 'Severe', 'Moderate', 'Mild' (DO NOT use Emergency, Urgent, Routine, Self-care, or numerical ratings).
Clinical Criteria:
- Mild: Low-intensity, localized, or early-stage symptoms. Little to no disruption of daily activities, normal functions, or vital signs. Managed via OPDs, primary health centers (PHCs / ESIS Dispensary), or basic supportive/conservative care.
- Moderate: Noticeable symptoms requiring active intervention or medication. Measurable interference with normal daily functioning, work, or physical activity. Managed by general physicians, district centers, stepped-up pharmacological treatments.
- Severe: High-intensity, widespread, or life-threatening symptoms. Gross/total interference with basic physical function, organ systems, or consciousness. Requires urgent, specialized, or inpatient/intensive care (ICU/emergency stabilization).

Forwarding Hierarchy Rules:
- Mild:
  * Dispensary open hours (Mon-Fri 10am-4pm, 1st & 3rd Sat 10am-12pm): 1st: ESIS Dispensary, 2nd: 104 Health Helpline, 3rd: ESIC Hospital, 4th: Govt District Hospital, 5th: Tie-Up Hospital, 6th: 108 Ambulance.
  * Dispensary closed hours: 1st: 104 Health Helpline, 2nd: ESIS Dispensary, 3rd: ESIC Hospital, 4th: Govt District Hospital, 5th: Tie-Up Hospital, 6th: 108 Ambulance.
- Moderate:
  * If ESIC Hospital <= 15 KM: 1st: ESIC Hospital, 2nd: Govt District Hospital, 3rd: Tie-Up Hospital, 4th: ESIS Dispensary, 5th: 104 Health Helpline, 6th: 108 Ambulance.
  * If ESIC Hospital > 15 KM: 1st: Govt District Hospital, 2nd: Tie-Up Hospital, 3rd: ESIC Hospital, 4th: ESIS Dispensary, 5th: 104 Health Helpline, 6th: 108 Ambulance.
- Severe:
  * During morning/daytime (6am-6pm) if manageable in hospital directly (no active collapse): 1st: Hospital Casualty (ESIC if <= 15km, else Govt), 2nd: Govt Hospital / Tie-Up, 3rd: Tie-Up / ESIC, 4th: 108 Ambulance, 5th: 104, 6th: Dispensary.
  * If needs 108 (critical collapse, acute respiratory failure, cardiac arrest, arterial bleed, seizure, poisoning, or caller requests 108): 1st: 108 Ambulance (Immediate Emergency Dispatch), 2nd: ESIC Hospital, 3rd: Govt District Hospital, 4th: Tie-Up Hospital, 5th: 104, 6th: Dispensary.

Output strict JSON with keys: urgency_level ('Severe'|'Moderate'|'Mild'), assessed_severity ('Severe'|'Moderate'|'Mild'), urgency_score (10 for Severe, 6 for Moderate, 3 for Mild), confidence ('high'|'medium'|'low'), summary_en, summary_hi, reasoning, red_flags (array of strings), recommended_facility_type, recommended_action, call_108 (boolean), detected_language ('English'|'Hindi'|'Hinglish'), followup_questions (array of 2-3 questions).${learnedSnippet ? `\n\n${learnedSnippet}` : ""}`;
    const proxyResult = await executeCentralizedLlmProxy({
      messages: [
        {
          role: "system",
          content: triageSystemPrompt,
        },
        {
          role: "user",
          content: `Intake data:\n${JSON.stringify(intake, null, 2)}`,
        },
      ],
      system: triageSystemPrompt,
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.2,
    });

    if (proxyResult?.content) {
      const cleaned = proxyResult.content.replace(/```json/gi, "").replace(/```/g, "").trim();
      return normalizeTriageDecision(JSON.parse(cleaned), intake);
    }
  } catch (proxyErr) {
    console.warn("[Triage Cascade] Centralized LLM Proxy evaluation error:", proxyErr.message);
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
  let urgency_level = "Mild";
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

  // Evaluate Level (Strictly 3 Tiers: Severe, Moderate, Mild)
  // Not all chest pain is an emergency! Only real life-threatening presentations trigger 108:
  // crushing retrosternal pain radiating to left arm/jaw WITH cold sweating or severe breathlessness.
  if (isCardiac && ((hasRadiation && hasDiaphoresis) || (hasRadiation && hasDyspnea))) {
    urgency_level = "Severe";
    urgency_score = 10;
    call_108 = true;
    red_flags.push("Severe acute chest pain with radiation & diaphoresis");
    if (hasRadiation) red_flags.push("Left arm tingling / radiation");
    if (hasDiaphoresis) red_flags.push("Cold sweating (diaphoresis)");
    if (hasDyspnea) red_flags.push("Difficulty breathing (dyspnea)");
  } else if (isCardiac) {
    urgency_level = severity >= 8 ? "Severe" : "Moderate";
    urgency_score = severity >= 8 ? 8 : 6;
    call_108 = false;
    red_flags.push("Chest discomfort reported");
  } else if (isPoison) {
    red_flags.push("Toxic / agricultural chemical exposure");
    if (notes.includes("aankh") || notes.includes("eye")) {
      red_flags.push("Ocular mucosal irritation");
    }
    if (severity >= 8 || hasDyspnea) {
      urgency_level = "Severe";
      urgency_score = 10;
      call_108 = true;
    } else {
      urgency_level = "Moderate";
      urgency_score = 6;
      call_108 = false;
    }
  } else if (isNeuro || isSevereBleed) {
    urgency_level = "Severe";
    urgency_score = 10;
    call_108 = true;
    if (isNeuro) red_flags.push("Altered consciousness / neurological deficit");
    if (isSevereBleed) red_flags.push("Uncontrolled hemorrhage");
  } else if (severity >= 4 || notes.includes("bukhar") || notes.includes("fever")) {
    urgency_level = "Moderate";
    urgency_score = 6;
    call_108 = false;
    if (notes.includes("chills") || notes.includes("kampkampi") || notes.includes("rigor")) {
      red_flags.push("High fever accompanied by rigors / chills");
    }
  } else {
    urgency_level = "Mild";
    urgency_score = 3;
    call_108 = false;
  }

  // Generate Reasoning, Summaries and Actions
  let summary_en = "";
  let summary_hi = "";
  let reasoning = "";
  let recommended_facility_type = "ESIS Dispensary";
  let recommended_action = "Visit nearest dispensary for standard consultation.";
  let followup_questions = [];

  const ageStr = age ? `${age}-year-old` : "Caller";
  const sexStr = intake.sex ? intake.sex.toLowerCase() : "patient";

  if (urgency_level === "Severe") {
    summary_en = `${ageStr} ${sexStr} reporting acute high-acuity symptoms (Severe) requiring immediate emergency intervention.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को तीव्र गंभीर लक्षण (Severe) हैं, तुरंत आपातकालीन देखभाल की आवश्यकता है।`;
    reasoning = `The reported symptoms include clear red-flag indicators (such as acute chest pain with radiating discomfort/diaphoresis or potential vital instability). Clinical safety guidelines mandate immediate 108 Ambulance dispatch.`;
    recommended_facility_type = "108 Ambulance / Nearest Emergency Casualty";
    recommended_action = "Instruct caller to lie down, remain calm, and immediately call 108 for an ambulance. Do not drive oneself.";
    followup_questions = [
      "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
      "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
      "Kya unhe koi pehle se dil ki bimari ya high BP hai? (History of cardiac disease or hypertension?)",
    ];
  } else if (urgency_level === "Moderate") {
    summary_en = `${ageStr} ${sexStr} presents with acute symptoms (Moderate) requiring evaluation at ESIC Hospital or Govt District Hospital.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को मध्यम लक्षण (Moderate) हैं, ईएसआईसी अस्पताल या सरकारी अस्पताल में जांच आवश्यक है।`;
    reasoning = `Symptoms present clinical acuity or occupational exposure that warrants hospital medical assessment to prevent decompensation.`;
    recommended_facility_type = "ESIC Hospital / Govt District Hospital";
    recommended_action = "Advise patient to proceed to the nearest ESIC Hospital or Govt District Hospital for clinical evaluation.";
    followup_questions = [
      "How many hours ago did this problem intensify?",
      "Have you washed the affected area thoroughly with clean running water?",
      "Are you experiencing any vomiting, vision disturbance, or disorientation?",
    ];
  } else {
    // Mild
    summary_en = `${ageStr} ${sexStr} reports sub-acute symptoms (Mild) suitable for ESIS Dispensary OPD or 104 Health Helpline consultation.`;
    summary_hi = `${age || ""} वर्षीय ${sexStr === "female" ? "महिला" : "पुरुष"} को सामान्य लक्षण (Mild) हैं, 104 हेल्पलाइन या डिस्पेंसरी में नियमित जांच कराएं।`;
    reasoning = `Stable clinical presentation without systemic danger signs. Can be managed safely during standard dispensary operating hours (Mon-Fri 10am-4pm, 1st, 3rd & 5th Sat 10am-12pm) or via 104 Health Helpline.`;
    recommended_facility_type = "ESIS Dispensary / 104 Health Helpline";
    recommended_action = "Visit nearest ESIS Dispensary during regular OPD hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM) or call 104 for tele-doctor consultation.";
    followup_questions = [
      "Has anyone else in the household or workplace fallen sick recently?",
      "Are you currently taking any regular medications?",
    ];
  }

  return normalizeTriageDecision(
    {
      urgency_level,
      urgency_score,
      assessed_severity: urgency_level,
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
    },
    intake
  );
}

/**
 * Normalizes triage output to strictly synchronize with EKMS AI consultative triage state.
 * Ensures psychiatric/counselling distress, Tele-MANAS, 104, e-Sanjeevani, and Pharmacy
 * are not erroneously collapsed into 108 Ambulance or default dispensary.
 */
function normalizeTriageDecision(triage, intake) {
  if (!triage) return triage;

  const ekmsCtx = intake.ekms_ai_context || {};
  const tState = ekmsCtx.triageState || ekmsCtx;
  const referral = (tState?.referralDestination || "").toLowerCase();

  const chatMsgs = ekmsCtx.chatHistory || [];
  const callerUtterances = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m.sender === "user" || m.role === "user")
        .map((m) => m.text || "")
        .join(" ")
    : "";
  const callerSpokenText = `${intake.symptom_notes || ""} ${callerUtterances}`.trim().toLowerCase();
  const notes = `${callerSpokenText} ${tState?.symptom || ""} ${tState?.condition || ""}`.toLowerCase();

  if (triage.primary_complaint) {
    triage.primary_complaint = sanitizeSymptomOrCondition(triage.primary_complaint, callerSpokenText);
  }
  if (triage.summary_en) {
    triage.summary_en = sanitizeSymptomOrCondition(triage.summary_en, callerSpokenText);
  }

  const isPsych = Boolean(
    tState?.isPsychiatric ||
    referral.includes("psych") ||
    referral.includes("counsel") ||
    referral.includes("manas") ||
    referral.includes("14416") ||
    /\b(suicid|mar ja|jaan de dunga|depress|udaas|hopeless|anxiety|ghabrahat|die\b|kill myself|self-harm|self harm|crying|cut.*wrist|wrist.*cut|slit.*wrist|end life|cannot cope|can't cope)\b/i.test(notes)
  );

  const isPoisonOrTrauma = /\b(pesticide|spray|chemical|zeher|poison|slit|overdose|hanging|severe bleed|unconscious|behosh)\b/i.test(notes);

  const ambulanceEval = isLifeThreateningAmbulanceCase(notes, triage.urgency_score || intake.severity_reported, intake, tState);
  const isEmergency108 = ambulanceEval.is108;

  const clinicalScore = calculateClinicalSeverityScore({
    symptom: triage.primary_complaint || tState?.symptom,
    condition: tState?.condition || tState?.suspectedCondition,
    callerSpokenText,
    allText: notes,
    duration: triage.duration || tState?.duration,
    chatHistory: chatMsgs,
    intake,
    tState,
  });

  let finalLevel = clinicalScore.urgency_level;
  let finalScore = clinicalScore.score;

  triage.urgency_level = finalLevel;
  triage.assessed_severity = finalLevel;
  triage.urgency_score = finalScore;
  triage.severity_score = finalScore;
  triage.assessed_severity_score = finalScore;

  const dispensaryStatus = getDispensaryOperatingStatus();
  const isDistHospRequest = /\b(district hospital|dist hosp|civil hospital|govt hospital|public hospital|non-esic|immunization|vaccination|tika)\b/i.test(notes);
  const isAdviceSeeking = /\b(phone doctor|tele.?consult|104 health|call doctor|doctor on phone|phone par baat|phone par doctor)\b/i.test(notes);

  // Time-of-day check for Severe daytime manageability
  const nowUtc = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
  const istHour = istDate.getHours();
  const isMorningOrDaytime = istHour >= 6 && istHour < 18;

  const isExtremeLifeThreat = Boolean(
    /\b(cardiac arrest|unconscious|behosh|not breathing|saans nahi|collapse|crushing chest.*(?:sweat|pasina|left arm|radiat)|arterial bleed|snake\s*bite|drank poison|status epilepticus)\b/i.test(allText)
  );
  const hasAcuteLifeThreat = Boolean(
    ambulanceEval.is108 ||
    referral.includes("108") ||
    /\b(struggling\s*(?:to|for)\s*breath\w*|cannot\s*breathe|unable\s*to\s*breathe|unconscious|behosh|unresponsive|not breathing|saans nahi|collapse|cyanosis|cardiac arrest|crushing chest.*(?:sweat|pasina|left arm|radiat|collapse)|gasping|choking|heavy active bleed|spurting bleed|arterial|seizure.*>|status epilepticus|drank poison|acid ingestion|snake\s*bite)\b/i.test(allText) ||
    isExtremeLifeThreat
  );

  // User mandate:
  // - Forward to 108 if it is severe life-threatening emergency in case of score 9 and 10.
  // - In score 8 forward to hospital if not life-threatening and manageable in the hospital!
  // - Not all chest pain is an emergency! Only real life-threatening chest pain forwards to 108.
  const isScore8 = finalScore === 8;
  const isScore8Manageable = isScore8 && !isExtremeLifeThreat;
  const shouldForward108 = finalLevel === "Severe" && ((finalScore >= 9 && hasAcuteLifeThreat) || isExtremeLifeThreat) && !isScore8Manageable;

  if (finalLevel === "Severe") {
    triage.is_dual_protocol = true;
    if (!shouldForward108) {
      triage.call_108 = false;
      triage.referral_destination = "ESIC Hospital";
      triage.call_referral_primary = "ESIC Hospital";
      triage.referral_reason = "Severe condition manageable at hospital; direct patient immediately to nearest ESIC Hospital Casualty (or Govt District Hospital).";
      triage.secondary_referral_destination = "Govt District Hospital";
      triage.call_referral_secondary = "Govt District Hospital";
      triage.secondary_referral_reason = "Govt District Hospital for secondary hospital casualty backup.";
      triage.recommended_facility_type = "ESIC Hospital (24x7 Casualty) / Govt District Hospital";
      triage.recommended_action = "Advise patient to proceed immediately to nearest ESIC Hospital 24x7 Casualty or Govt District Hospital for acute emergency care.";
    } else {
      triage.call_108 = true;
      triage.referral_destination = "108 Ambulance";
      triage.call_referral_primary = "108 Ambulance";
      triage.referral_reason = ambulanceEval.reason || "Severe life-threatening emergency; dispatch 108 Ambulance immediately.";
      triage.secondary_referral_destination = isPsych ? "104 Health Helpline" : "ESIC Hospital";
      triage.call_referral_secondary = triage.secondary_referral_destination;
      triage.secondary_referral_reason = isPsych
        ? "104 Health Helpline for emotional stabilization and counselling once ambulance is en route."
        : "24x7 Casualty & Emergency Department at nearest ESIC Hospital for trauma resuscitation and admission.";
      triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
      triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    }
  } else if (finalLevel === "Moderate") {
    triage.call_108 = false;
    triage.is_dual_protocol = false;
    if (isDistHospRequest) {
      triage.referral_destination = "Govt District Hospital";
      triage.call_referral_primary = "Govt District Hospital";
      triage.referral_reason = "Beneficiary needs public healthcare services outside ESIC network; guide to nearest Govt District Hospital.";
      triage.secondary_referral_destination = "ESIC Hospital";
      triage.call_referral_secondary = "ESIC Hospital";
      triage.secondary_referral_reason = "ESIC Hospital for specialized evaluation and coverage.";
      triage.recommended_facility_type = "Govt District Hospital / ESIC Hospital";
    } else {
      triage.referral_destination = "ESIC Hospital";
      triage.call_referral_primary = "ESIC Hospital";
      triage.referral_reason = "Moderate clinical condition requiring hospital evaluation and care. Direct patient to nearest ESIC Hospital (or Govt District Hospital if ESIC > 15km).";
      triage.secondary_referral_destination = "Govt District Hospital";
      triage.call_referral_secondary = "Govt District Hospital";
      triage.secondary_referral_reason = "Govt District Hospital for secondary hospital medical consultation backup.";
      triage.recommended_facility_type = "ESIC Hospital / Govt District Hospital";
    }
    triage.recommended_action = "Advise patient to proceed to the nearest ESIC Hospital (if within 15km) or Govt District Hospital for clinical evaluation.";
  } else {
    // Mild
    triage.call_108 = false;
    triage.is_dual_protocol = false;
    if (dispensaryStatus.isOpen && !referral.includes("104") && !isAdviceSeeking) {
      triage.referral_destination = "ESIS Dispensary";
      triage.call_referral_primary = "ESIS Dispensary";
      triage.referral_reason = "Routine primary care; visit nearest ESIS Dispensary (Open Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Saturday 10:00 AM – 12:00 PM) for doctor evaluation and medicines.";
      triage.secondary_referral_destination = "104 Health Helpline";
      triage.call_referral_secondary = "104 Health Helpline";
      triage.secondary_referral_reason = "104 Health Helpline for 24x7 tele-doctor consultation backup.";
    } else {
      triage.referral_destination = "104 Health Helpline";
      triage.call_referral_primary = "104 Health Helpline";
      triage.referral_reason = "Mild non-emergency presentation. Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
      triage.secondary_referral_destination = "ESIS Dispensary";
      triage.call_referral_secondary = "ESIS Dispensary";
      triage.secondary_referral_reason = "Visit nearest ESIS Dispensary during operating hours (Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Saturday 10:00 AM – 12:00 PM) for doctor checkup and medicines.";
    }
    triage.recommended_facility_type = "ESIS Dispensary / 104 Health Helpline";
    triage.recommended_action = "Visit nearest ESIS Dispensary (Open Mon–Fri 10:00 AM – 4:00 PM, 1st, 3rd & 5th Sat 10:00 AM – 12:00 PM) or call 104 for tele-doctor consultation.";
  }

  return triage;
}

/**
 * Evaluates clinical triage and automatically applies human agent learned overrides.
 * Any decision (algorithmic or LLM-generated) is checked against active agent feedback rules.
 */
export async function evaluateTriage(intake) {
  const decision = await evaluateRawTriage(intake);
  if (!decision) return decision;

  try {
    const override = await applyAlgorithmicFeedbackOverrides(intake, decision);
    if (override) {
      return {
        ...decision,
        urgency_level: override.urgency_level || decision.urgency_level,
        referral_destination: override.referral_destination || decision.referral_destination,
        referral_reason: override.reason || decision.referral_reason,
        reasoning: `${decision.reasoning || ""} [Agent-Learned Override: ${override.reason}]`.trim(),
        learned_override_applied: true,
        learned_from_rule_id: override.learned_from_rule_id,
      };
    }
  } catch (err) {
    console.warn("[TriageEngine] Algorithmic feedback override check failed:", err.message);
  }

  return decision;
}

