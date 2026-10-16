// Clinical Scoring & Severity Engine
// Enforces standard clinical criteria (WHO / NHS / Emergency Severity Index)
// Backend Numbering System:
// - Score 1 to 4: Mild
// - Score 5 to 7: Moderate
// - Score 8 to 10: Severe

/**
 * Validates whether a candidate duration is actually grounded in text explicitly spoken by the caller.
 * Prevents LLMs or loose regexes from fabricating timelines like "More than a month" when the caller never stated it.
 */
export function validateCallerMentionedDuration(candidateDuration = "", callerSpokenText = "") {
  if (!candidateDuration || typeof candidateDuration !== "string") return "Reported today";
  const dur = candidateDuration.trim();
  const durLower = dur.toLowerCase();
  const textLower = (callerSpokenText || "").toLowerCase();

  // If candidate is a placeholder, default safely
  if (
    durLower === "reported today" ||
    durLower === "today" ||
    durLower === "recent" ||
    durLower === "not specified" ||
    durLower === "acute"
  ) {
    return "Reported today";
  }

  // Check if candidate mentions months / chronic
  if (/\b(month|mahina|mahine|chronic|purani bimari)\b/i.test(durLower)) {
    const hasCallerMonth = /\b(month|mahina|mahine|saal|year|chronic|purani bimari|pichle mahine)\b/i.test(textLower);
    if (!hasCallerMonth) {
      // Caller NEVER mentioned month or chronic; reject hallucination
      return "Reported today";
    }
  }

  // Check if candidate mentions weeks
  if (/\b(week|hafta|hafte|wks?)\b/i.test(durLower)) {
    const hasCallerWeek = /\b(week|hafta|hafte|wks?|10 days|several weeks|days?|din)\b/i.test(textLower);
    if (!hasCallerWeek) {
      return "Reported today";
    }
  }

  // Check if candidate mentions multiple days (e.g. 2-3 days, 4-7 days)
  if (/\b(\d+\s*(?:to|-)?\s*\d*\s*days?|\d+\s*din|yesterday|kal)\b/i.test(durLower)) {
    const hasCallerDays = /\b(day|days|din|yesterday|kal|parso|hours|ghante|today|aaj|week|hafta|hafte)\b/i.test(textLower);
    if (!hasCallerDays) {
      return "Reported today";
    }
  }

  return dur;
}

/**
 * Maps a numerical score (1 to 10) to strict 3-tier clinical urgency level:
 * - 1 to 4: Mild
 * - 5 to 7: Moderate
 * - 8 to 10: Severe
 */
export function mapScoreToUrgency(score) {
  const num = Math.max(1, Math.min(10, Math.round(Number(score) || 3)));
  if (num >= 8) return "Severe";
  if (num >= 5) return "Moderate";
  return "Mild";
}

/**
 * Maps an urgency label to standard score baseline:
 * - Mild: 3 (range 1-4)
 * - Moderate: 6 (range 5-7)
 * - Severe: 9 (range 8-10)
 */
export function mapUrgencyToBaselineScore(urgency) {
  const s = String(urgency || "").toLowerCase();
  if (s.includes("sev") || s.includes("emerg") || s.includes("high")) return 9;
  if (s.includes("mod") || s.includes("urg") || s.includes("med")) return 6;
  return 3;
}

/**
 * Evaluates the clinical severity score (1-10) and urgency category (Mild, Moderate, Severe)
 * holistically across all turns of the conversation and clinical intake.
 *
 * Considers:
 * 1. Main symptom & specific disease criteria (Cuts/Trauma, Fever, Breathlessness, Cardiac, GI, Neuro)
 * 2. Grounded duration (only if actually stated by caller)
 * 3. Functional disruption (mobility, speech, work, self-care)
 * 4. Dangerous vital signs / red flags (arterial bleeding, unconsciousness, cyanosis) vs mitigating facts (antiseptic cream applied, bleeding stopped, superficial wound)
 * 5. Dynamic re-analysis across turns:
 *    If an early turn showed high/severe risk (e.g. initial keyword 'cut' or 'injury'), but subsequent
 *    caller answers clarify that the wound is superficial, bleeding stopped, antiseptic cream applied,
 *    and vitals are normal:
 *    THE SCORE IS DYNAMICALLY DOWNGRADED TO MILD (1-4) or MODERATE (5-7).
 */
export function calculateClinicalSeverityScore({
  symptom = "",
  condition = "",
  callerSpokenText = "",
  allText = "",
  duration = "Reported today",
  chatHistory = [],
  intake = {},
  tState = {},
}) {
  // Aggregate all caller utterances from history
  const historyUserTexts = Array.isArray(chatHistory)
    ? chatHistory
        .filter((m) => m && (m.sender === "user" || m.role === "user"))
        .map((m) => m.text || m.content || "")
        .join(" ")
    : "";

  const aggregatedCallerText = `${callerSpokenText || ""} ${historyUserTexts} ${intake?.symptom_notes || ""}`.toLowerCase();
  const combinedContext = `${aggregatedCallerText} ${symptom} ${condition} ${allText || ""}`.toLowerCase();

  // Validate duration against caller text
  const validatedDuration = validateCallerMentionedDuration(duration, aggregatedCallerText);

  // 1. Mitigating / Mild presentations (Explicitly reported relief, superficial nature, or mild indicators)
  const isSuperficialOrMinorCut = /\b(superficial|superficial cut|minor cut|small cut|paper cut|shallow cut|antiseptic cream|applied.*cream|cream.*applied|applied.*ointment|bandaid|bandage|scrape|scratch|scratched|chhoti chot|halki chot|minor injury|small scratch)\b/i.test(combinedContext);
  const isBleedingControlled = /\b(bleeding stopped|khoon ruk gaya|not heavy bleeding|bleeding controlled|no bleeding|bleeding nahi|no active bleeding|stopped bleeding)\b/i.test(combinedContext);
  const canWalkAndFunction = /\b(can walk|able to walk|walking normally|can move|moving fingers|normal movement|working|doing chores|no disruption)\b/i.test(combinedContext);
  const speaksNormally = /\b(speaking normally|can speak normally|no gasping|not gasping)\b/i.test(combinedContext);
  const isAlertConscious = /\b(conscious|hosh me|awake|alert|responding normally)\b/i.test(combinedContext);

  // 2. Severe Red Flags (Immediate Life-Threatening Crises)
  const hasSnakeBite = /\b(snake\s*bite|bitten by (?:a\s+)?snake|snake.*(?:bite|bit|bitten)|saap|saanp|envenomation)\b/i.test(combinedContext);
  // Cardiac crisis is ONLY acute life-threatening (score 9-10) when true red flags are present:
  // Crushing retrosternal pressure radiating to left arm/jaw/neck WITH cold diaphoresis (sweating), collapse, or cardiac arrest.
  // Not all chest pain is an emergency! Isolated chest pain, dull ache, burning/gas, or muscular pain is not 108.
  const hasCardiacArrest = !/\b(no\s+chest\s+pain|history\s+of\s+heart|gas|acidity|muscle)\b/i.test(combinedContext) && (
    /\b(cardiac arrest|heart attack.*unconscious|heart attack.*collapse|crushing chest pain.*(?:left arm|jaw|sweat|pasina|collapse|gasping)|chest pain.*(?:sweat|pasina).*(?:radiat|left arm|baayein haath|behosh|collapse)|seena dard.*paseena.*baayein)\b/i.test(combinedContext)
  );
  const hasRespiratoryFailure = !speaksNormally && /\b(gasping for air|turning blue|cyanosis|unable to speak|cannot speak in full sentences|stridor|severe respiratory distress)\b/i.test(combinedContext);
  const hasUnconsciousness = !isAlertConscious && /\b(unconscious|behosh|unresponsive|will not wake up|collapsed and not responding|coma)\b/i.test(combinedContext);
  const hasArterialBleed = !isBleedingControlled && !isSuperficialOrMinorCut && /\b(arterial bleed|spurting blood|massive hemorrhage|uncontrolled bleeding > 10 min|amputation|severed finger|severed limb|crushed hand|crushed limb)\b/i.test(combinedContext);
  const hasProlongedSeizure = /\b(seizure.*> 5 min|continuous seizure|status epilepticus|continuous fits)\b/i.test(combinedContext);
  const hasPoisoningCrisis = /\b(drank poison|ingested pesticide|acid ingestion|consumed poison|poisoning|zeher)\b/i.test(combinedContext);
  const hasStrokeCrisis = /\b(stroke|paralysis|facial droop|slurred speech|sudden weakness one side|hemiplegia)\b/i.test(combinedContext);
  const hasSevereHeadTrauma = /\b(head injury|hit head).*unconscious|skull fracture|unequal pupils|head trauma.*vomit|severe head trauma\b/i.test(combinedContext);
  const hasMajorAccident = /\b(major car accident|serious road accident|fall from (?:height|roof)|severe burn|third degree burn)\b/i.test(combinedContext);

  // Explicit caller 108 request
  const hasExplicit108Request = /\b(call 108|dispatch ambulance|send ambulance|108 ambulance|ambulance chahiye|need ambulance)\b/i.test(combinedContext);

  // Check if true severe crisis is present
  const isSevereCrisis =
    hasSnakeBite ||
    hasCardiacArrest ||
    hasRespiratoryFailure ||
    hasUnconsciousness ||
    hasArterialBleed ||
    hasProlongedSeizure ||
    hasPoisoningCrisis ||
    hasStrokeCrisis ||
    hasSevereHeadTrauma ||
    hasMajorAccident ||
    hasExplicit108Request;

  if (isSevereCrisis) {
    let score = 9;
    if (hasCardiacArrest || hasUnconsciousness || hasArterialBleed || hasSnakeBite) {
      score = 10;
    }
    return {
      score,
      urgency_level: "Severe",
      assessed_severity: "Severe",
      duration: validatedDuration,
      reasoning: "High-intensity, life-threatening symptoms with potential vital instability requiring urgent emergency stabilization (108 Ambulance / Emergency Casualty).",
      isLifeThreatening: true,
    };
  }

  // 3. Domain-Specific Analysis:

  // --- A. CUTS / LACERATIONS / WOUNDS / TRAUMA ---
  const isWoundOrCut = /\b(cut|laceration|wound|ghao|injury|chot|scraped?|stab|bleeding)\b/i.test(combinedContext);
  if (isWoundOrCut) {
    // If superficial cut with antiseptic cream or bleeding stopped
    if (isSuperficialOrMinorCut || (isBleedingControlled && !hasArterialBleed)) {
      // Score 1 to 4: Mild
      const score = (isSuperficialOrMinorCut && isBleedingControlled) ? 2 : 3;
      return {
        score,
        urgency_level: "Mild",
        assessed_severity: "Mild",
        duration: validatedDuration,
        reasoning: "Superficial cut / minor localized injury with controlled bleeding; manageable via outpatient care (ESIS Dispensary / 104) for wound dressing and tetanus verification.",
        isLifeThreatening: false,
      };
    }

    // Moderate wound: Deep laceration, active oozing, needs stitches or tetanus toxoid, but no arterial spurting
    if (/\b(deep cut|gaping|stitches|taanke|oozing|painful movement|swollen hand|swollen finger)\b/i.test(combinedContext)) {
      // Score 5 to 7: Moderate
      const score = 6;
      return {
        score,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Noticeable open laceration or wound requiring doctor evaluation, wound toilet, and possible suturing at secondary hospital (ESIC Hospital / Govt District Hospital).",
        isLifeThreatening: false,
      };
    }
  }

  // --- B. FEVER / INFECTION ---
  const isFever = /\b(fever|bukhar|temperature|taapman|chills|shivering|kampkampi|rigor)\b/i.test(combinedContext);
  if (isFever) {
    const isCallerStatingMildFever =
      /\b(mild\s+fever|halka\s+bukhar|low\s+grade\s+fever|halka\s+sa\s+bukhar|fever\s+is\s+mild|mild\s+warmth|kam\s+bukhar)\b/i.test(combinedContext) ||
      (/\b(fever|bukhar)\b/i.test(combinedContext) && /\b(mild|halka|low grade|mild warmth|mild heat)\b/i.test(combinedContext));

    const deniesChillsOrShivering =
      /\b(no\s+shivering|no\s+chills|without\s+shivering|without\s+chills|shivering\s+nahi|chills\s+nahi|no\s+kampkampi|kampkampi\s+nahi|bina\s+(?:zyada\s+)?hilaav|bina\s+shaking|mild fever,?\s*no shivering)\b/i.test(combinedContext);

    const hasHighTemp =
      !isCallerStatingMildFever &&
      /\b(high fever|>102|103|104|105|bahut tez bukhar|severe fever)\b/i.test(combinedContext);

    const hasShakingChills =
      !deniesChillsOrShivering &&
      !isCallerStatingMildFever &&
      /\b(shivering|chills|kampkampi|rigor|teeth chattering)\b/i.test(combinedContext);

    const hasAlteredMental =
      /\b(delirium|confusion|stiff neck|gardan akad|petechiae|purpura)\b/i.test(combinedContext);

    if ((hasHighTemp && hasShakingChills) || hasAlteredMental) {
      // Severe febrile presentation with systemic sepsis signs
      return {
        score: 8,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "High-grade fever accompanied by severe rigors/chills or systemic red flags requiring hospital casualty evaluation.",
        isLifeThreatening: false, // hospital manageable
      };
    }

    // Prolonged fever (> 5-7 days / > 1 week) or high fever without chills or persistent vomiting
    const isProlongedFever = /\b(more than a week|weeks?|>7 days|5-7 days|persistent fever|continuous vomiting|cannot drink)\b/i.test(combinedContext);

    if ((hasHighTemp || hasShakingChills || isProlongedFever) && !isCallerStatingMildFever) {
      // Score 5 to 7: Moderate
      const score = hasShakingChills ? 7 : 6;
      return {
        score,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Moderate febrile illness with high temperature or prolonged course (> 5-7 days) requiring physician evaluation and laboratory workup at hospital.",
        isLifeThreatening: false,
      };
    }

    // Mild low-grade fever (even with body aches or lasting 1-3 days): Score 1 to 4 (Mild)
    return {
      score: 3,
      urgency_level: "Mild",
      assessed_severity: "Mild",
      duration: validatedDuration,
      reasoning: "Mild low-grade fever with stable vitals; manageable through outpatient care (ESIS Dispensary / 104 Health Helpline) with oral antipyretics, hydration, and rest.",
      isLifeThreatening: false,
    };
  }

  // --- C. RESPIRATORY SYMPTOMS ---
  const isRespiratory = /\b(cough|khansi|cold|sardi|zukham|breathless|saans|wheez|asthma)\b/i.test(combinedContext);
  if (isRespiratory) {
    const hasShortnessOfBreath = /\b(shortness of breath|breathless|saans phool|wheez|asthma attack)\b/i.test(combinedContext);
    if (hasShortnessOfBreath && speaksNormally) {
      // Moderate respiratory symptoms: Score 5 to 7
      return {
        score: 6,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Noticeable respiratory distress with wheezing or shortness of breath; requires clinical evaluation and nebulization/medication at hospital.",
        isLifeThreatening: false,
      };
    }

    // Simple cough/cold: Score 1 to 4 (Mild)
    return {
      score: 2,
      urgency_level: "Mild",
      assessed_severity: "Mild",
      duration: validatedDuration,
      reasoning: "Mild upper respiratory tract symptoms without dyspnea; suitable for primary care at ESIS Dispensary or 104 tele-consultation.",
      isLifeThreatening: false,
    };
  }

  // --- D. CHEST & ABDOMINAL SYMPTOMS ---
  const isChest = /\b(chest|chhati|seena)\b/i.test(combinedContext);
  const isAbdominal = /\b(stomach|pet dard|abdominal|loose motion|diarrhea|dast|vomit|ulti)\b/i.test(combinedContext);

  if (isChest) {
    // Non-cardiac chest pain (e.g. muscular, gastritis, acid reflux, gas)
    if (/\b(gas|acidity|acid reflux|gerd|muscle|pressing|coughing|sharp prick|stinging|localized|movement)\b/i.test(combinedContext)) {
      return {
        score: 3,
        urgency_level: "Mild",
        assessed_severity: "Mild",
        duration: validatedDuration,
        reasoning: "Localized chest wall discomfort or acid dyspepsia without ischemic signs; manageable via primary care consultation (ESIS Dispensary / 104).",
        isLifeThreatening: false,
      };
    }
    // Severe but hospital-manageable chest pain (Score 8): persistent severe chest pain / stable angina requiring hospital ECG and troponin, but WITHOUT acute collapse / cold diaphoresis / gasping
    if (/\b(severe|intense|unbearable|continuous|tightness|angina|heavy|pressure)\b/i.test(combinedContext)) {
      return {
        score: 8,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Severe chest discomfort requiring hospital medical evaluation, ECG screening, and cardiac enzyme testing at nearest hospital casualty.",
        isLifeThreatening: false, // Hospital manageable (Score 8 routes to Hospital, NOT 108)
      };
    }
    // Moderate chest discomfort requiring ECG (Score 6)
    return {
      score: 6,
      urgency_level: "Moderate",
      assessed_severity: "Moderate",
      duration: validatedDuration,
      reasoning: "Chest discomfort requiring hospital medical evaluation and ECG screening to rule out acute pathology.",
      isLifeThreatening: false,
    };
  }

  if (isAbdominal) {
    if (/\b(severe pet dard|rigid|vomiting blood|intense cramp|cannot stand)\b/i.test(combinedContext)) {
      return {
        score: 7,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Moderate-to-high acute abdominal pain requiring doctor physical palpation and medical management at hospital.",
        isLifeThreatening: false,
      };
    }
    // Mild gastroenteritis / indigestion: Score 1 to 4
    return {
      score: 3,
      urgency_level: "Mild",
      assessed_severity: "Mild",
      duration: validatedDuration,
      reasoning: "Mild abdominal discomfort or loose stools with preserved oral hydration; manageable via ESIS Dispensary or 104 Helpline.",
      isLifeThreatening: false,
    };
  }

  // --- E. GENERAL / DEFAULT EVALUATION ---
  const rawSev = Number(intake?.severity_reported || tState?.severityScore);
  if (rawSev && rawSev >= 1 && rawSev <= 10) {
    const urgency = mapScoreToUrgency(rawSev);
    return {
      score: rawSev,
      urgency_level: urgency,
      assessed_severity: urgency,
      duration: validatedDuration,
      reasoning: `Clinical assessment based on reported symptom severity (Score ${rawSev}/10).`,
      isLifeThreatening: urgency === "Severe",
    };
  }

  // Default to Mild (Score 3) for standard queries
  return {
    score: 3,
    urgency_level: "Mild",
    assessed_severity: "Mild",
    duration: validatedDuration,
    reasoning: "Sub-acute presentation without acute red-flag signs; suitable for routine consultation at ESIS Dispensary or 104 Health Helpline.",
    isLifeThreatening: false,
  };
}
