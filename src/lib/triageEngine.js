// Clinical Triage Evaluation Engine
import { groqChatCompletion } from "./groqPool.js";
import { executeCentralizedLlmProxy } from "./llmProxy.js";
import {
  buildLearnedPromptSnippet,
  applyAlgorithmicFeedbackOverrides,
} from "./feedbackLearningEngine.js";

/**
 * Evaluates whether ESIS Dispensaries are currently open in Assam (IST UTC+5:30).
 * Operating hours: Monday to Friday, 10:00 AM to 4:00 PM.
 * Closed: Saturday & Sunday.
 */
export function getDispensaryOperatingStatus(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const isWeekend = day === 0 || day === 6;
  const isOpenHours = currentMinutes >= 600 && currentMinutes < 960; // 10:00 AM (600) to 4:00 PM (960)
  const isNight = hour >= 20 || hour < 6; // 8:00 PM to 6:00 AM

  const isOpen = !isWeekend && isOpenHours;

  let reason = "";
  if (isWeekend) {
    reason = `ESIS Dispensaries are closed on weekends (${day === 0 ? "Sunday" : "Saturday"})`;
  } else if (currentMinutes < 600) {
    reason = "ESIS Dispensaries open at 10:00 AM (Mon–Fri, 10:00 AM – 4:00 PM)";
  } else if (currentMinutes >= 960) {
    reason = "ESIS Dispensaries closed for the day at 4:00 PM (Hours: 10:00 AM – 4:00 PM)";
  }

  return {
    isOpen,
    isWeekend,
    isNight,
    reason,
    operatingHoursText: "Mon–Fri: 10:00 AM – 4:00 PM (Closed Sat & Sun)",
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
  const text = `${textContext || ""} ${intake?.symptom_notes || ""} ${intake?.complaint || ""} ${tState?.symptom || ""} ${tState?.condition || ""} ${tState?.suspectedCondition || ""}`.toLowerCase();

  // Explicit caller intent for 108 Ambulance
  if (/\b(call 108|dispatch ambulance|send ambulance|108 ambulance|ambulance chahiye|ambulance bulao|need ambulance|108 call)\b/i.test(text)) {
    return { is108: true, reason: "Caller explicitly requested 108 Emergency Ambulance dispatch." };
  }

  // Check IST daytime: 6:00 AM (360 min) to 6:00 PM (1080 min)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
  const isDaytime6to6 = currentMinutes >= 360 && currentMinutes < 1080;

  const numSeverity = Number(severity) || Number(intake?.severity_reported) || (tState?.severityScore || (tState?.severity === "High" ? 9 : 5));

  // Must be critical severity (at least 8, typically 9 or 10)
  if (numSeverity < 8) {
    return { is108: false, reason: "Severity is below emergency threshold." };
  }

  // Explicit caller negations: e.g. "I can speak normally", "no gasping", "bleeding stopped"
  const canSpeakNormally = /\b(can speak normally|able to speak|speak in full sentences|bol pa raha|bol sakti hoon|bol sakta hoon|no gasping|not gasping|not turning blue|speaking normally)\b/i.test(text);
  const bleedingControlled = /\b(bleeding stopped|khoon ruk gaya|not heavy bleeding|bleeding controlled|minor cut|small cut)\b/i.test(text);
  const isConsciousAlert = /\b(conscious|hosh me|awake|alert|responding normally|talking)\b/i.test(text);

  // 1. Severe Breathing Issues: Gasping for air, skin turning blue, or inability to speak in full sentences
  const hasSevereBreathing = !canSpeakNormally && (
    /\b(gasping for air|gasping|skin turning blue|lips turning blue|turning blue|blue skin|cyanosis|unable to speak in full sentences|cannot speak in full sentences|saans lene me haanf|choking|stridor)\b/i.test(text)
  );

  // 2. Unconsciousness: The person is unresponsive and will not wake up
  const hasUnconsciousness = !isConsciousAlert && /\b(unresponsive|will not wake up|won'?t wake up|unconscious|behosh|behoshi|not waking up|coma|collapsed and not responding)\b/i.test(text);

  // 3. Uncontrollable Bleeding: Heavy bleeding that does not stop after 10 minutes of firm, direct pressure
  const hasUncontrollableBleeding = !bleedingControlled && /\b(uncontrollable bleed|does not stop after 10 min|not stop after 10 min|heavy bleeding.*10 min|spurting bleed|arterial bleed|massive bleed|bleeding profusely|amputation|crushed limb)\b/i.test(text);

  // 4. Major Trauma: Serious car accidents, head/spinal injuries, falls from a significant height, or severe burns covering a large area
  const hasMajorTrauma = /\b(serious car accident|major car accident|serious road accident|serious bike accident|head injury.*unconscious|spinal injury|spine injury|neck injury|fall from.*height|fall from roof|fall from building|fall from tree|severe burn.*large area|extensive burns|third degree burn|trapped in vehicle|machine crushed)\b/i.test(text);

  // 5. Prolonged Seizures: A seizure lasting more than 5 minutes, or a person having their first-ever seizure
  const hasProlongedSeizures = /\b(seizure.*(?:more than|lasting|over)\s*5\s*min|status epilepticus|first-ever seizure|first time seizure|pehle kabhi daura nahi|continuous seizure|fits.*5 min)\b/i.test(text);

  // 6. Anaphylaxis: A severe allergic reaction causing the throat, lips, or tongue to swell, restricting airways
  const hasAnaphylaxis = /\b(anaphylaxis|swelling of (?:the )?(?:throat|lips|tongue)|throat.*swelling.*airway|tongue.*swelling.*breath|airway restriction.*allergy)\b/i.test(text);

  // 7. Cardiac arrest / crushing chest pain radiating to left arm or jaw with cold sweating
  const hasCardiacArrest = /\b(cardiac arrest|heart attack.*crushing|crushing chest pain.*left arm|chest pain.*sweating.*radiating)\b/i.test(text);

  // Active severe self-harm wound with spurting bleeding
  const hasActiveTraumaCut = /\b(slit.*wrist|cut.*wrist.*heavy bleed|stab.*heavy bleed)\b/i.test(text) && !bleedingControlled;

  if (hasSevereBreathing) {
    return { is108: true, reason: "Severe breathing issues with gasping for air, cyanosis, or inability to speak in full sentences." };
  }
  if (hasUnconsciousness) {
    return { is108: true, reason: "Unconsciousness: person is unresponsive and will not wake up." };
  }
  if (hasUncontrollableBleeding || hasActiveTraumaCut) {
    return { is108: true, reason: "Uncontrollable bleeding: heavy bleeding failing to stop after 10 minutes of direct pressure." };
  }
  if (hasMajorTrauma) {
    return { is108: true, reason: "Major trauma: serious car accident, head/spinal injury, fall from height, or extensive burns." };
  }
  if (hasProlongedSeizures) {
    return { is108: true, reason: "Prolonged seizure lasting more than 5 minutes or first-ever seizure." };
  }
  if (hasAnaphylaxis) {
    return { is108: true, reason: "Anaphylaxis: severe allergic reaction causing throat, lips, or tongue swelling restricting airways." };
  }
  if (hasCardiacArrest) {
    return { is108: true, reason: "Acute cardiac arrest / myocardial infarction with crushing chest pain radiating to arm." };
  }

  // Between 6 AM and 6 PM: No life-threatening emergency -> DO NOT CALL 108 AMBULANCE! Refer to Hospital!
  return {
    is108: false,
    reason: isDaytime6to6
      ? "Between 6:00 AM and 6:00 PM, patient is referred to Hospital (ESIC Hospital) as there are no life-threatening emergency signs."
      : "Non-life-threatening presentation; patient guided to Hospital casualty for clinical evaluation."
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
export function summarizeRedFlags(rawFlags = [], textContext = "", callerSaidSafe = false) {
  const points = [];
  const seen = new Set();

  const addPoint = (pt) => {
    if (!pt || typeof pt !== "string") return;
    const clean = pt.trim();
    const norm = clean.toLowerCase();
    if (!seen.has(norm) && clean.length > 3) {
      seen.add(norm);
      points.push(clean);
    }
  };

  const text = (textContext || "").toLowerCase();

  // Explicit caller negations
  const deniesFever =
    /\b(no fever|nehi|nahi|not having fever|without fever|fever nahi|bukhar nahi|no chills|mild discomfort|just not feeling good)\b/i.test(text) &&
    !/\b(yes.*fever|fever.*hai|tez bukhar|severe fever)\b/i.test(text);
  const isSafe =
    callerSaidSafe ||
    /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(text);
  const deniesChestPain = /\b(no chest pain|chhati me dard nahi|no pain in chest)\b/i.test(text);
  const deniesBleeding = /\b(no bleed|khoon nahi|no cut)\b/i.test(text);

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
      if (deniesBleeding && !/\b(blood|hematemesis|vomit.*blood|khoon)\b/i.test(text)) return false;
      return /\b(hematemesis|blood in vomit|vomit.*blood|blood.*stool|melena|khoon.*ulti|ulti.*khoon|gastrointestinal|gi bleed|bleeding)\b/i.test(text);
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
      return /\b(high fever|tez bukhar|bukhar|fever|chills|shivering|rigor|kapkapi|10[2-5]\s*(?:°|f|deg))\b/i.test(text);
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
      return /\b(chest|chhati|heart attack|dil ka dard|left arm|pressure on chest)\b/i.test(text);
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

    // Trauma / accident / fracture / burns
    if (fLower.includes("accident") || fLower.includes("trauma") || fLower.includes("fall") || fLower.includes("fracture") || fLower.includes("burn")) {
      return /\b(accident|hit|fall|chot|gir gaya|fracture|burn|jala)\b/i.test(text);
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
    /\b(high fever|tez bukhar|chills|shivering|rigor|kapkapi|thand lagna|10[2-6]\s*(?:°|f|deg))\b/i.test(
      text
    )
  ) {
    addPoint("High fever with chills and shivering");
  }

  // Severe respiratory distress / Breathing issues / Gasping
  if (
    /\b(severe breathlessness|saans.*takleef|gasping|gasping for air|suffocat|wheez|inability to speak|speech.*sentence|cyanosis|blue.*lip)\b/i.test(
      text
    )
  ) {
    addPoint("Severe shortness of breath / gasping for air");
  }

  // Cardiac / Crushing chest pain radiating to left arm/jaw
  if (
    !deniesChestPain &&
    /\b(crushing chest|dil ka dard|chhati me dard|severe chest pain|left arm pain|pressure on chest|chest.*radiat|chest.*sweat)\b/i.test(
      text
    )
  ) {
    addPoint("Severe chest pain / cardiac pressure with radiation");
  }

  // Loss of consciousness / Fainting / Blackout
  if (/\b(unconscious|behosh|fainted|blackout|collapsed|syncope|unresponsive)\b/i.test(text)) {
    addPoint("Loss of consciousness / fainting episode");
  }

  // Convulsions / Seizures / Fits
  if (/\b(seizure|convulsions?|fits?|mirgi ka daura|daura)\b/i.test(text)) {
    addPoint("Seizure / convulsive episode");
  }

  // Heavy bleeding / deep laceration / arterial bleed
  if (
    !deniesBleeding &&
    /\b(heavy bleed|khoon beh raha|profuse bleed|deep wound|arterial bleed|slit.*wrist|cut.*wrist)\b/i.test(
      text
    )
  ) {
    addPoint("Heavy uncontrollable bleeding / vascular injury");
  }

  // Severe acute abdominal pain / rigid abdomen
  if (
    /\b(severe abdominal pain|pet me bahut tez dard|acute abdomen|rigid abdomen|intense stomach pain)\b/i.test(
      text
    )
  ) {
    addPoint("Severe acute abdominal pain");
  }

  // Major trauma / fall from height / bone fracture / head injury
  if (
    /\b(fall from height|gir gaya|fracture|head injury|sir me chot|serious accident|car accident|severe burn)\b/i.test(
      text
    )
  ) {
    addPoint("Major trauma / suspected fracture or head injury");
  }

  // Acute severe allergic reaction / anaphylaxis (throat/face swelling)
  if (
    /\b(anaphylaxis|throat.*swell|lip.*swell|tongue.*swell|gale.*sujan|severe allergic)\b/i.test(
      text
    )
  ) {
    addPoint("Acute severe allergic reaction / airway swelling (anaphylaxis)");
  }

  // Poisoning / snakebite / pesticide exposure
  if (
    /\b(poison|zeher|snake\s*bite|saap kaat|pesticide|chemical ingestion)\b/i.test(
      text
    )
  ) {
    addPoint("Poisoning / toxic chemical exposure or snake envenomation");
  }

  // Severe dehydration / circulatory signs
  if (
    /\b(severe dehydration|sunken eyes|dark urine|extreme weakness.*dizzy|chakkar.*gir)\b/i.test(
      text
    )
  ) {
    addPoint("Severe dehydration / signs of circulatory compromise");
  }

  // Acute neurological deficit (slurred speech, facial asymmetry, weakness)
  if (
    /\b(slurred speech|facial droop|sudden weakness|paralysis|ek taraf kamzori)\b/i.test(
      text
    )
  ) {
    addPoint("Acute neurological deficit / suspected stroke signs");
  }

  // Suicidal intent (ONLY if caller explicitly stated and is NOT safe)
  if (
    !isSafe &&
    /\b(wanna die|want to die|kill myself|mar jaunga|jaan dena chahta)\b/i.test(text)
  ) {
    addPoint("Explicit thoughts of ending life reported by IP");
  }

  return points.slice(0, 10);
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

  const callerText = (callerSpokenText || "").toLowerCase();

  const hasKidneyStone = /\b(kidney stone|pathri|renal calculus|renal stone|gall stone)\b/i.test(callerText);
  const hasAppendicitis = /\b(appendicitis|appendix)\b/i.test(callerText);
  const hasUlcer = /\b(ulcer|peptic ulcer)\b/i.test(callerText);
  const hasCardiacDisease = /\b(heart attack|cardiac arrest|dil ka daura)\b/i.test(callerText);

  let clean = rawCondition;

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
    clean = clean.replace(/suspected acute coronary syndrome|acute coronary syndrome|myocardial infarction|acute mi\b/gi, "Chest Discomfort / Pressure");
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

  return clean || "Reported Symptoms";
}

async function evaluateRawTriage(intake) {
  const ekmsCtx = intake.ekms_ai_context || {};
  const tState = ekmsCtx.triageState || ekmsCtx;
  const notes = String(intake.symptom_notes || "").toLowerCase();
  const severity = Number(intake.severity_reported) || (tState?.severityScore || (tState?.severity === "High" ? 9 : 5));
  const age = intake.age != null && intake.age !== "" ? Number(intake.age) : null;
  const duration = String(intake.duration || tState?.duration || "Reported today");

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

  // Normal fever / mild illness check (e.g. 60+ with simple normal fever without red flags is NOT an emergency!)
  const isNormalFeverOrMild =
    severity <= 5 &&
    !/\b(chills|shivering|rigor|breath|saans|chest|bleed|fall|unconscious|headache|vomit|seizure|confusion)\b/i.test(allText) &&
    !duration.includes("week") &&
    !duration.includes("4-7");

  // Determine effective severity considering age, clinical condition, and red flags:
  let effectiveSeverity = severity;
  if (isElderly && !isNormalFeverOrMild && (severity >= 6 || /\b(chills|rigor|breath|chest|fall|weakness|dizzy|unsteady)\b/i.test(allText))) {
    effectiveSeverity = Math.max(8, severity);
  } else if (isChild && !isNormalFeverOrMild && severity >= 6) {
    effectiveSeverity = Math.max(8, severity);
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

  // FAST DIRECT SYNTHESIS (Instant, <5ms): If evaluated by chat engine OR psychiatric crisis OR NACO HIV OR Dist Hosp OR Tie-Up OR high effective severity (emergency)
  if (isPsych || isNacoHIV || isDistHospRequest || isTieUpEligible || effectiveSeverity >= 8 || (tState && (tState.condition || tState.symptom || tState.suspectedCondition || tState.severity || tState.redFlagsDetected?.length))) {
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
    const chatChoseHospital = (tState?.referralDestination || "").toLowerCase().includes("hospital");

    // Resolve TWO best-fitting referrals based on the 8-tier hierarchy:
    let primaryReferral = "ESIS Dispensary";
    let primaryReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
    let secondaryReferral = "104 Health Helpline";
    let secondaryReason = "Tele-doctor telephone consultation via 104 Health Helpline.";
    let isDualProtocol = false;
    let call108 = false;

    // Tier 1: 108 Ambulance Services (Priority: Life-Threatening / Transport Emergency)
    if (isEmergency108) {
      primaryReferral = "108 Ambulance";
      primaryReason = ambulanceEval.reason || "Severe life-threatening emergency or acute trauma casualty; dispatch 108 Ambulance immediately.";
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
    }
    // If chat or clinical engine explicitly resolved to ESIC Hospital, and NO life-threatening 108 emergency:
    else if (chatChoseHospital) {
      primaryReferral = "ESIC Hospital";
      primaryReason = "Patient evaluated for hospital secondary care / 24x7 emergency casualty. Direct patient to nearest ESIC Hospital.";
      secondaryReferral = "104 Health Helpline";
      secondaryReason = "104 Health Helpline for 24x7 tele-doctor consultation backup.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 2: Mental Health & Emotional Distress -> 104 Health Helpline
    else if (isPsych && !hasPhysicalHealthSymptoms) {
      primaryReferral = "104 Health Helpline";
      primaryReason = "Beneficiary requires psychological counseling, emotional support or tele-doctor guidance; connect with 104 Health Helpline for 24x7 doctor & counselling assistance.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "ESIC Hospital for physical checkup if symptoms persist.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 3: HIV/AIDS / STI -> 104 Health Helpline
    else if (isNacoHIV) {
      primaryReferral = "104 Health Helpline";
      primaryReason = "Confidential sexual health / HIV-AIDS medical guidance; connect with 104 Health Helpline for 24x7 confidential doctor guidance and testing information.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "Nearest ESIC Hospital Integrated Counselling & Testing Centre (ICTC) and Specialist OPD.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 6: Dist Hosp (Priority: Public Healthcare outside ESIC)
    else if (isDistHospRequest) {
      primaryReferral = "Govt District Hospital";
      primaryReason = "Beneficiary needs public healthcare services outside the ESIC network (public admissions, specialist care, or child immunization); guide to nearest Govt District Hospital.";
      secondaryReferral = "104 Health Helpline";
      secondaryReason = "104 Health Helpline for 24x7 tele-doctor assistance.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 5: ESI Tie-up Hospital (Explicit IPD admission or ESIC referral)
    else if (isTieUpEligible) {
      primaryReferral = "Nearest Tie-Up Facility";
      primaryReason = isIpdEmergency
        ? "Inpatient (IPD) emergency; refer to nearest Empanelled Tie-Up Facility for cashless emergency admission under ESI guidelines."
        : hasEsicReferral
        ? "Patient possesses direct referral from ESIC Hospital; refer to nearest Empanelled Tie-Up Facility for specialist treatment."
        : "Refer to nearest Empanelled Tie-Up Facility for cashless treatment under ESI empanelment guidelines.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "ESIC Hospital casualty / triage desk.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 6: Non-Emergency Cases After 4:00 PM or off-hours -> Prefer 104 Health Helpline
    else if (isOffHours || !dispensaryStatus.isOpen) {
      primaryReferral = "104 Health Helpline";
      primaryReason = "Dispensary and general hospital OPD hours are closed (10:00 AM – 4:00 PM). Connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "ESIC Hospital for in-person medical evaluation if symptoms persist or escalate.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 7: Daytime Regular Hours (Dispensary open) -> ESIS Dispensary
    else if (dispensaryStatus.isOpen && effectiveSeverity < 8) {
      primaryReferral = "ESIS Dispensary";
      primaryReason = "Routine primary care; visit nearest ESIS dispensary during regular OPD hours (10:00 AM – 4:00 PM) for doctor evaluation and medicines.";
      secondaryReferral = "104 Health Helpline";
      secondaryReason = "104 Health Helpline for 24x7 tele-doctor consultation.";
      isDualProtocol = false;
      call108 = false;
    }
    // Tier 8: Daytime Hospital Care
    else {
      primaryReferral = "ESIC Hospital";
      primaryReason = "Beneficiary clinical consultation: guide to ESIC Hospital (if within 25km) or nearest district/tie-up hospital.";
      secondaryReferral = "104 Health Helpline";
      secondaryReason = "104 Health Helpline for 24x7 tele-doctor consultation and phone guidance.";
      isDualProtocol = false;
      call108 = false;
    }


    if (primaryReferral === secondaryReferral) {
      secondaryReferral = primaryReferral === "ESIC Hospital" ? "104 Health Helpline" : "ESIC Hospital";
    }

    let summaryEn = "";
    let summaryHi = "";

    if (isNacoHIV) {
      summaryEn = "Caller seeks consultation or guidance regarding HIV/AIDS or sexual health. Reassurance, confidential 104 tele-doctor counseling, and ICTC testing referral indicated.";
      summaryHi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी मार्गदर्शन चाहता है; 104 गोपनीय परामर्श और आईसीटीसी केंद्र रेफरल आवश्यक है।";
    } else if (isPsych && hasSelfHarmAction) {
      summaryEn = `Caller in acute emotional crisis with ${selfHarmActionEn}, presenting a life safety risk requiring emergency 108 ambulance dispatch and medical intervention.`;
      summaryHi = `कॉलर गंभीर मानसिक संकट में है और उसने ${selfHarmActionHi} की है; तुरंत 108 एम्बुलेंस और चिकित्सकीय सहायता आवश्यक है।`;
    } else if (isPsych && callerHasSuicideWords) {
      summaryEn = "Caller reports acute emotional distress with thoughts of ending their life, requiring urgent tele-doctor intervention and support via 104 Health Helpline.";
      summaryHi = "कॉलर ने गंभीर मानसिक तनाव और आत्महत्या के विचारों की शिकायत की है, जिसके लिए 104 हेल्पलाइन द्वारा तत्काल परामर्श आवश्यक है।";
    } else if (isPsych) {
      summaryEn = "Caller reports emotional distress and psychological disturbance, requiring professional counseling and mental health support via 104 Health Helpline.";
      summaryHi = "कॉलर को मानसिक तनाव और भावनात्मक परेशानी की शिकायत है; 104 हेल्पलाइन द्वारा परामर्श उपयुक्त है।";
    } else if (primaryReferral === "104 Health Helpline" && (effectiveSeverity <= 4 || tState?.severity === "Mild" || needsDoctorAdvice)) {
      const rawCond = tState?.condition || tState?.suspectedCondition || tState?.symptom || notes || "mild symptoms";
      const cleanCond = sanitizeSymptomOrCondition(rawCond, callerSpokenText);
      summaryEn = `Caller inquires regarding ${cleanCond}; condition is non-serious and suitable for 104 Health Helpline tele-doctor consultation and general health advice.`;
      summaryHi = `कॉलर को ${cleanCond} संबंधी चिकित्सकीय सलाह की आवश्यकता है; स्थिति गंभीर नहीं है और 104 टेली-डॉक्टर परामर्श उपयुक्त है।`;
    } else {
      const rawCond = tState?.condition || tState?.suspectedCondition || tState?.symptom || notes || "symptoms";
      const cleanCond = sanitizeSymptomOrCondition(rawCond, callerSpokenText);
      summaryEn = `Caller reports ${cleanCond} with reported severity ${severity}/10 (${duration}), requiring prompt medical evaluation.`;
      summaryHi = `कॉलर को ${cleanCond} की शिकायत है (तीव्रता: ${severity}/10, अवधि: ${duration}), जिसके लिए उचित चिकित्सकीय परामर्श आवश्यक है।`;
    }

    const rawComp = tState?.suspectedCondition || tState?.condition || tState?.symptom || notes || "Primary Clinical Assessment";
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

    const triageUrgencyLevel = isPsych
      ? (hasSelfHarmAction || callerHasSuicideWords ? "Emergency" : "Urgent")
      : (isNacoHIV
        ? (allText.includes("pep") || allText.includes("exposure") ? "Urgent" : "Routine")
        : (tState?.severity === "High" ? "Emergency" : (tState?.severity === "Moderate" ? "Urgent" : (effectiveSeverity >= 8 ? "Emergency" : (effectiveSeverity >= 5 ? "Urgent" : "Routine")))));

    const triageUrgencyScore = isPsych
      ? (hasSelfHarmAction ? 10 : (callerHasSuicideWords ? 9 : 7))
      : (isNacoHIV
        ? (allText.includes("pep") || allText.includes("exposure") ? 6 : 4)
        : (tState?.severityScore || (tState?.severity === "High" ? 9 : (effectiveSeverity || 6))));

    const triageAssessedSeverity = isPsych
      ? (hasSelfHarmAction ? "High (10/10)" : (callerHasSuicideWords ? "High (9/10)" : "Moderate (7/10)"))
      : (isNacoHIV
        ? (triageUrgencyLevel === "Urgent" ? "Moderate (6/10)" : "Routine (4/10)")
        : (tState?.severity ? `${tState.severity} (${tState?.severityScore || effectiveSeverity}/10)` : (effectiveSeverity >= 8 ? "High (8/10)" : (effectiveSeverity >= 5 ? "Moderate (5/10)" : "Mild (3/10)"))));

    const decision = {
      urgency_level: triageUrgencyLevel,
      urgency_score: triageUrgencyScore,
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
    const triageSystemPrompt = `You are an expert ESIC / ESIS medical triage clinical evaluator in Assam, India. Evaluate symptoms and output strict JSON with keys: urgency_level ('Emergency'|'Urgent'|'Routine'|'Self-care'), urgency_score (1-10), confidence ('high'|'medium'|'low'), summary_en, summary_hi, reasoning, red_flags (array of strings), recommended_facility_type, recommended_action, call_108 (boolean), detected_language ('English'|'Hindi'|'Hinglish'), followup_questions (array of 2-3 questions).${learnedSnippet ? `\n\n${learnedSnippet}` : ""}`;
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

  return normalizeTriageDecision(
    {
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
  const notes = `${intake.symptom_notes || ""} ${tState?.symptom || ""} ${tState?.condition || ""} ${triage.summary_en || ""} ${triage.reasoning || ""}`.toLowerCase();

  const chatMsgs = ekmsCtx.chatHistory || [];
  const callerUtterances = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m.sender === "user" || m.role === "user")
        .map((m) => m.text || "")
        .join(" ")
    : "";
  const callerSpokenText = `${intake.symptom_notes || ""} ${callerUtterances}`.trim().toLowerCase();

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

  const isNacoHIV = Boolean(
    referral.includes("naco") ||
    referral.includes("1097") ||
    /\b(hiv|aids|naco|1097|sexually transmitted|std|sti\b|gupt rog|sexual disease|genital|penis discharge|vaginal discharge|art center|ictc|cd4|pep\b|prep\b|syphilis|gonorrhea|unprotected sex)\b/i.test(notes)
  );

  const dispensaryStatus = getDispensaryOperatingStatus();

  // 1. HIV / AIDS / Sexual Disease: 104 Health Helpline
  if (isNacoHIV) {
    triage.is_psychiatric = false;
    triage.call_108 = false;
    triage.referral_destination = "104 Health Helpline";
    triage.referral_reason =
      "Confidential sexual health, STI & HIV tele-consultation; connect with 104 Health Helpline for 24x7 doctor guidance and testing centre locator.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason =
      "Nearest ESIC Hospital Integrated Counselling & Testing Centre (ICTC) and Specialist OPD.";
    triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
    triage.recommended_action =
      "Transfer call to 104 Health Helpline for 24x7 confidential doctor counselling, STI guidance, and testing support.";
    triage.call_referral_primary = "104 Health Helpline";
    triage.call_referral_secondary = "ESIC Hospital";
    if (!triage.summary_en || triage.summary_en.includes("distress") || triage.summary_en.includes("psychological") || triage.summary_en.includes("Tele-MANAS")) {
      triage.summary_en = "Caller seeks consultation or guidance regarding HIV/AIDS or sexual health. Reassurance, confidential 104 tele-doctor counseling, and ICTC testing referral indicated.";
      triage.summary_hi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी मार्गदर्शन चाहता है; 104 गोपनीय परामर्श और आईसीटीसी केंद्र रेफरल आवश्यक है।";
    }
    if (!triage.primary_complaint || triage.primary_complaint.includes("Distress") || triage.primary_complaint.includes("Mental")) {
      triage.primary_complaint = "HIV / AIDS / STI Health Consultation";
    }
    return triage;
  }

  // 1b. Explicit caller request for telephone doctor consultation
  const isAdviceSeeking = /\b(phone doctor|tele.?consult|104 health|call doctor|doctor on phone|phone par baat|phone par doctor)\b/i.test(notes);

  if (isAdviceSeeking && !isPsych && !isNacoHIV && !triage.call_108 && triage.urgency_level !== "Emergency") {
    triage.is_psychiatric = false;
    triage.call_108 = false;
    triage.referral_destination = "104 Health Helpline";
    triage.referral_reason = "Condition is non-serious; caller requests medical tele-consultation. Transfer call to 104 Health Helpline for 24x7 doctor consultation over the phone.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason = "ESIC Hospital for in-person doctor checkup if symptoms persist.";
    triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
    triage.recommended_action = "Transfer call to 104 Health Helpline for tele-doctor consultation and medical guidance.";
    triage.call_referral_primary = "104 Health Helpline";
    triage.call_referral_secondary = "ESIC Hospital";
    if (!triage.summary_en || triage.summary_en.includes("distress") || triage.summary_en.includes("emergency")) {
      triage.summary_en = "Condition is non-serious and caller requested tele-doctor consultation via 104 Health Helpline.";
      triage.summary_hi = "स्थिति गंभीर नहीं है और 104 टेली-डॉक्टर परामर्श व स्वास्थ्य सलाह उपयुक्त है।";
    }
    return triage;
  }

  // 2. Combined Psychological + Physical Trauma / Hemorrhage
  if (isPsych && isPoisonOrTrauma) {
    triage.call_108 = true;
    triage.is_psychiatric = true;
    triage.is_dual_protocol = true;
    triage.referral_destination = "108 Ambulance";
    triage.referral_reason =
      "Active physical trauma or severe self-harm injury; immediate 108 emergency ambulance dispatch required.";
    triage.secondary_referral_destination = "104 Health Helpline";
    triage.secondary_referral_reason =
      "104 Health Helpline for emotional stabilization and counselling once ambulance is en route.";
    triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
    triage.recommended_action =
      "Dispatch 108 Emergency Ambulance immediately. Maintain call connection and provide compassionate reassurance.";
    return triage;
  }

  // 3. Pure Psychiatric Crisis / Depression / Suicidal Ideation: 104 Health Helpline + ESIC Hospital
  if (isPsych && !isPoisonOrTrauma) {
    triage.is_psychiatric = true;
    triage.call_108 = false;
    triage.is_dual_protocol = false;
    triage.referral_destination = "104 Health Helpline";
    triage.referral_reason =
      "Transfer call immediately to 104 Health Helpline for 24x7 confidential doctor consultation and emotional support.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason =
      "ESIC Hospital for in-person doctor checkup if symptoms persist.";
    triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
    triage.recommended_action =
      "Transfer call immediately to 104 Health Helpline. Speak with calm empathy and do not disconnect.";
    if (!triage.summary_en || triage.summary_en.toLowerCase().includes("physical") || triage.summary_en.toLowerCase().includes("hospital")) {
      triage.summary_en = "Caller presents with severe emotional distress / suicidal ideation requiring urgent counselling via 104 Health Helpline.";
      triage.summary_hi = "कॉलर गंभीर मानसिक तनाव/अवसाद में है, तुरंत 104 हेल्पलाइन परामर्श सहायता की आवश्यकता है।";
    }
    return triage;
  }

  const ambulanceEval = isLifeThreateningAmbulanceCase(notes, triage.urgency_score || intake.severity_reported, intake, tState);
  const isEmergency108 = ambulanceEval.is108;
  const chatChoseHospital = referral.includes("esic hospital") || referral.includes("hospital");

  // If chat or clinical engine explicitly resolved to ESIC Hospital, and NO life-threatening 108 emergency:
  if (chatChoseHospital && !isEmergency108) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "ESIC Hospital";
    triage.call_referral_primary = "ESIC Hospital";
    triage.referral_reason = "Patient evaluated for hospital secondary care / 24x7 emergency casualty. Direct patient to nearest ESIC Hospital.";
    triage.secondary_referral_destination = "104 Health Helpline";
    triage.call_referral_secondary = "104 Health Helpline";
    triage.secondary_referral_reason = "104 Health Helpline for 24x7 tele-doctor consultation backup.";
    triage.recommended_facility_type = "ESIC Hospital (24x7 Casualty & Emergency)";
    triage.recommended_action = "Advise patient to proceed immediately to nearest ESIC Hospital casualty for clinical evaluation.";
    return triage;
  }

  // 4. Physical Emergency / 108 Dispatch / Accident Casualty (Only if true life-threatening ambulance case)
  if (isEmergency108) {
    triage.call_108 = true;
    triage.is_dual_protocol = true;
    triage.referral_destination = "108 Ambulance";
    triage.referral_reason = ambulanceEval.reason || "Severe life-threatening emergency or trauma casualty; dispatch 108 Ambulance immediately.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.call_referral_secondary = "ESIC Hospital";
    triage.secondary_referral_reason =
      "24x7 Casualty & Emergency Department at nearest ESIC Hospital for trauma resuscitation and admission.";
    triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
    triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    return triage;
  }

  // Calculate IST Time and Off-Hours (after 4:00 PM / before 10:00 AM / weekends)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const istMinutes = istDate.getHours() * 60 + istDate.getMinutes();
  const isOffHours = istMinutes >= 960 || istMinutes < 600 || istDate.getDay() === 0 || istDate.getDay() === 6;

  const isAcuteEmergency =
    triage.urgency_level === "Emergency" ||
    Number(triage.urgency_score || 0) >= 8;

  // 5. Emergency / Acute Hospital Care (When severity is high 8-10, but not life-threatening 108 ambulance)
  if (isAcuteEmergency) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "ESIC Hospital";
    triage.call_referral_primary = "ESIC Hospital";
    triage.referral_reason = "Emergency clinical assessment; proceed directly to nearest ESIC Hospital casualty for doctor evaluation.";
    triage.secondary_referral_destination = "104 Health Helpline";
    triage.call_referral_secondary = "104 Health Helpline";
    triage.secondary_referral_reason = "104 Health Helpline for tele-doctor consultation backup.";
    triage.recommended_facility_type = "ESIC Hospital (24x7 Casualty & Emergency)";
    triage.recommended_action = "Advise patient to proceed immediately to nearest ESIC Hospital casualty for emergency stabilization.";
    return triage;
  }

  // 6. Explicit 104 Health Helpline request OR After 4:00 PM / Off-Hours Non-Emergency
  if (referral.includes("104") || isOffHours) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "104 Health Helpline";
    triage.call_referral_primary = "104 Health Helpline";
    triage.referral_reason = isOffHours
      ? "After 4:00 PM (regular OPD closed), connect with 104 Health Helpline for 24x7 doctor tele-consultation over the phone."
      : "Caller requested tele-doctor phone consultation; transfer call queue to 104 Health Helpline.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.call_referral_secondary = "ESIC Hospital";
    triage.secondary_referral_reason = "ESIC Hospital for in-person doctor checkup if symptoms persist or escalate.";
    triage.recommended_facility_type = "104 Health Helpline (Doctor on Call)";
    triage.recommended_action = "After 4:00 PM (regular OPD closed), advise caller to connect with 104 Health Helpline for 24x7 confidential doctor tele-consultation over the phone, or visit ESIC Hospital if symptoms escalate.";
    return triage;
  }

  // 7. Daytime Urgent (Urgent score 7 during 10 AM - 4 PM)
  if (triage.urgency_level === "Urgent" || Number(triage.urgency_score || 0) >= 7) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "ESIC Hospital";
    triage.call_referral_primary = "ESIC Hospital";
    triage.referral_reason = "Urgent clinical assessment needed during OPD hours. Direct patient to ESIC Hospital.";
    triage.secondary_referral_destination = "104 Health Helpline";
    triage.call_referral_secondary = "104 Health Helpline";
    triage.secondary_referral_reason = "104 Health Helpline for tele-doctor consultation backup.";
    triage.recommended_facility_type = "ESIC Hospital / Urgent OPD";
    triage.recommended_action = "Advise patient to visit the nearest ESIC Hospital for clinical evaluation.";
    return triage;
  }

  // 8. Daytime Routine / Mild / Normal Default (10 AM - 4 PM)
  triage.call_108 = false;
  triage.is_dual_protocol = true;
  triage.referral_destination = "ESIS Dispensary";
  triage.call_referral_primary = "ESIS Dispensary";
  triage.referral_reason = "Non-emergency clinical consultation. Guide patient to nearest ESIS Dispensary for doctor checkup and medicine dispensing.";
  triage.secondary_referral_destination = "104 Health Helpline";
  triage.call_referral_secondary = "104 Health Helpline";
  triage.secondary_referral_reason = "104 Health Helpline for 24x7 tele-doctor consultation over the phone.";
  triage.recommended_facility_type = "ESIS Dispensary (Primary Care OPD)";
  triage.recommended_action = "Guide patient to the nearest ESIS Dispensary during regular OPD hours (10:00 AM – 4:00 PM) for clinical checkup.";
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

