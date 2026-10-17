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
  const hasLOCDenial = /\b(no\s+(?:loss\s+of\s+consciousness|blackout|behoshi|unconscious)|conscious|alert|not\s+unconscious|no\s+blackout)\b/i.test(combinedContext);
  const hasVomitDenial = /\b(no\s+vomit\w*|without\s+vomit\w*|ulti\s+nahi|no\s+ulti)\b/i.test(combinedContext);
  const hasSevereHeadTrauma =
    !hasLOCDenial &&
    (/\b(head injury|hit head|head trauma|sar.*chot|concussion|skull).*(?:unconscious|lost consciousness|loss of consciousness|blackout|blacked out|behosh|vomit|confusion|memory loss)|(?:unconscious|lost consciousness|loss of consciousness|blackout|blacked out|behosh|vomit).*(?:head injury|hit head|head trauma|sar.*chot|concussion)|skull fracture|unequal pupils|severe head trauma\b/i.test(combinedContext));
  const hasDeepCutMuscleFat =
    /\b(muscle|fat|bone|deep gaping cut|gaping cut|exposing fat|exposing muscle|visible bone)\b/i.test(combinedContext) &&
    /\b(cut|laceration|wound|ghao|bleed)\b/i.test(combinedContext) &&
    /\b(heavy|profuse|continuous|uncontrolled|severe pain|intense pain|spurting)\b/i.test(combinedContext);
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
    hasDeepCutMuscleFat ||
    hasProlongedSeizure ||
    hasPoisoningCrisis ||
    hasStrokeCrisis ||
    hasSevereHeadTrauma ||
    hasMajorAccident ||
    hasExplicit108Request;

  if (isSevereCrisis) {
    let score = 9;
    if (hasCardiacArrest || hasUnconsciousness || hasArterialBleed || hasSnakeBite || hasDeepCutMuscleFat) {
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

  // --- A0. HEAD INJURY / HEAD TRAUMA / CONCUSSION ---
  const isHeadTrauma = /\b(head\s*injury|head\s*trauma|sar\s*(?:par|me|pe)?\s*chot|concussion|skull|hit.*head|head\s*wound)\b/i.test(combinedContext);
  if (isHeadTrauma) {
    // 1. Critical Life-Threatening Head Trauma (108 Ambulance):
    // Active coma/unresponsiveness, skull fracture, CSF or bleeding from ears/nose, repeated seizures, continuous arterial scalp hemorrhage
    const isLifeThreateningHead = /\b(unresponsive|will not wake up|won'?t wake up|coma|skull fracture|fluid.*(?:ear|nose)|bleeding from (?:ear|nose)|continuous seizure|status epilepticus|spurting|arterial bleed|unconscious for a long time)\b/i.test(combinedContext);
    if (isLifeThreateningHead) {
      return {
        score: 10,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Critical neurotrauma with coma, CSF leak, or intracranial compromise requiring immediate 108 Emergency Ambulance dispatch for trauma resuscitation.",
        isLifeThreatening: true,
      };
    }

    // 2. Severe Head Injury (IPD / Hospital Casualty):
    // "severa for litle bit seriaous and ipd"
    // Any loss of consciousness / blackout (even for a few seconds!), repeated vomiting, persistent severe headache, severe dizziness, confusion, disorientation, memory loss, blurred vision, or open scalp cut
    const hasLOC = !hasLOCDenial && /\b(loss\s*of\s*consciousness|lost\s*consciousness|blackout|blacked\s*out|fainted|behosh|unconscious|passed\s*out)\b/i.test(combinedContext);
    const hasNeuroRedFlags = (!hasVomitDenial && /\b(vomit|vomiting|ulti)\b/i.test(combinedContext)) || /\b(severe headache|tez sar dard|confusion|disorient|blurred vision|dhundhla|memory|bhool|stiff neck|gardan)\b/i.test(combinedContext);
    const hasScalpBleeding = !isBleedingControlled && /\b(bleeding|bleed|khoon|cut|wound)\b/i.test(combinedContext);

    if (hasLOC || hasNeuroRedFlags || hasScalpBleeding) {
      return {
        score: 9,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Head injury with loss of consciousness or neurological red flags; requires urgent hospital casualty evaluation, IPD neuro-observation, and CT scan.",
        isLifeThreatening: false, // Hospital IPD care (routes to ESIC Hospital casualty, or 108 if acute deterioration)
      };
    }

    // 3. Moderate Head Trauma:
    // Impact to head, but NO loss of consciousness, alert, mild localized bump/pain, no vomiting
    // USER MANDATE: Major trauma, head injury, severe damage CANNOT BE MILD!
    return {
      score: 6,
      urgency_level: "Moderate",
      assessed_severity: "Moderate",
      duration: validatedDuration,
      reasoning: "Head impact without reported loss of consciousness; requires doctor physical examination and neurological monitoring at hospital / dispensary.",
      isLifeThreatening: false,
    };
  }

  // --- A. CUTS / LACERATIONS / WOUNDS / TRAUMA ---
  const isWoundOrCut = !isHeadTrauma && /\b(cut|laceration|wound|ghao|injury|chot|scraped?|stab|bleeding)\b/i.test(combinedContext);
  if (isWoundOrCut) {
    // 1. Deep cut exposing fat, muscle, or bone WITH heavy continuous bleeding / severe pain -> 108 Ambulance!
    const hasExposedDeepTissue = /\b(muscle|fat|bone|deep gaping cut|gaping cut|exposing fat|exposing muscle|visible bone)\b/i.test(combinedContext);
    const hasHeavyBleedingOrPain = /\b(heavy\s*bleed\w*|profuse\s*bleed\w*|continuous\s*bleed\w*|spurting|cannot stop|uncontrolled|severe pain|intense pain|asahniya dard)\b/i.test(combinedContext);

    if (hasExposedDeepTissue && (hasHeavyBleedingOrPain || !isBleedingControlled)) {
      return {
        score: 10,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Deep laceration exposing subcutaneous fat or muscle with heavy active bleeding; requires immediate 108 Ambulance dispatch for surgical hemostasis and trauma management.",
        isLifeThreatening: true,
      };
    }

    // 2. Heavy active bleeding or deep gaping wound without exposed muscle/fat -> Severe
    if (hasHeavyBleedingOrPain && !isBleedingControlled) {
      return {
        score: 9,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Severe laceration with heavy active bleeding; requires urgent hospital emergency casualty care and surgical intervention.",
        isLifeThreatening: true,
      };
    }

    // 3. Moderate wound: Deep laceration, stitches needed, oozing, but bleeding controlled with direct pressure, no exposed muscle/fat
    if (/\b(deep cut|stitches|taanke|oozing|painful movement|swollen hand|swollen finger)\b/i.test(combinedContext) || (hasExposedDeepTissue && isBleedingControlled)) {
      return {
        score: 6,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Noticeable open laceration or wound requiring doctor evaluation, wound toilet, and suturing at hospital (ESIC Hospital / Govt District Hospital).",
        isLifeThreatening: false,
      };
    }

    // 4. Mild wound: ONLY superficial scrape, paper cut, small scratch with bleeding stopped / antiseptic cream applied
    if (isSuperficialOrMinorCut || (isBleedingControlled && !hasHeavyBleedingOrPain)) {
      // Score 1 to 4: Mild
      const score = (isSuperficialOrMinorCut && isBleedingControlled) ? 2 : 3;
      return {
        score,
        urgency_level: "Mild",
        assessed_severity: "Mild",
        duration: validatedDuration,
        reasoning: "Superficial cut / minor localized injury with controlled bleeding; manageable via routine outpatient care (ESIS Dispensary / 104) for wound dressing and tetanus verification.",
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
      /\b(high\s*fever|>102|103|104|105|bahut\s*tez\s*bukhar|tez\s*bukhar|severe\s*fever|high\s*temp\w*)\b/i.test(combinedContext);

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

    // STRICT USER MANDATE:
    // - 2-3 days duration is considered MILD if other symptoms/answers are mild.
    // - DO NOT decide Mild, Moderate, or Severe based on only one isolated condition or word!
    // - Take ALL answers into account.
    const isDuration2to3DaysOrRecent = /\b(2\s*-\s*3\s*days?|2\s*to\s*3\s*days?|2\s*or\s*3\s*days?|do\s*teen\s*din|2\s*din|3\s*din|1\s*-\s*3\s*days?|1\s*to\s*3\s*days?|today|yesterday|kal|aaj|since\s*morning|morning|subah)\b/i.test(combinedContext);
    const hasManageableFeverIndicators = canWalkAndFunction || isAlertConscious || !hasAlteredMental || /\b(paracetamol|tablet|dawai|relief|aaram|manageable|mild|tolerable)\b/i.test(combinedContext);

    // Only prolonged fever (> 5-7 days) or fever specifically requiring hospital lab blood test / IPD admission is Moderate
    const isProlongedFever = /\b(more than a week|weeks?|>7 days|5-7 days|persistent fever|continuous vomiting|cannot drink)\b/i.test(combinedContext);
    const requiresLabOrHospitalInFever = /\b(lab|blood test|cbc|serology|pathology|x-ray|xray|iv fluid|iv drip|saline drip|admit|admission|ipd|hospitaliz\w*)\b/i.test(combinedContext);

    if (requiresLabOrHospitalInFever || isProlongedFever) {
      return {
        score: 6,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: requiresLabOrHospitalInFever
          ? "Febrile illness requiring diagnostic laboratory blood tests (CBC, serology) or hospital clinical evaluation."
          : "Prolonged febrile illness (> 5-7 days) requiring physician evaluation and laboratory workup at hospital.",
        isLifeThreatening: false,
      };
    }

    if (isDuration2to3DaysOrRecent && hasManageableFeverIndicators && !hasAlteredMental) {
      return {
        score: 3,
        urgency_level: "Mild",
        assessed_severity: "Mild",
        duration: validatedDuration,
        reasoning: "Mild viral or seasonal febrile presentation (2-3 days duration) with preserved functional status; manageable via outpatient care (ESIS Dispensary / 104 Health Helpline) with antipyretics and rest.",
        isLifeThreatening: false,
      };
    }

    if ((hasHighTemp || hasShakingChills) && !isCallerStatingMildFever && !isDuration2to3DaysOrRecent) {
      // Score 5 to 7: Moderate
      const score = hasShakingChills ? 7 : 6;
      return {
        score,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Moderate febrile illness with elevated temperature requiring physician evaluation and laboratory workup at hospital.",
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

  // --- D0. UPPER GI BLEEDING & PERSISTENT FLUID LOSS (HEMATEMESIS / DEHYDRATION) ---
  const hasHematemesis = /\b(hematemesis|blood in (?:the\s+)?vomit|blood.*vomit|vomit.*blood|vomiting blood|coffee.?ground|khoon.*ulti|ulti.*khoon|blood in stool|melena|black tarry stool)\b/i.test(combinedContext) &&
    !/\b(no\s+blood|without\s+blood|blood\s*nahi|khoon\s*nahi)\b/i.test(combinedContext);
  const hasInabilityToRetainFluids = /\b(cannot keep.*fluid|unable to retain fluid|can'?t retain fluid|can'?t drink|vomit immediately after drinking|pani nahi ruk raha|continuous vomit\w*|persistent vomit\w*)\b/i.test(combinedContext);

  if (hasHematemesis || hasInabilityToRetainFluids) {
    const isLifeThreateningGI = /\b(large amount of blood|massive blood|bright red.*large|fainted|blackout|behosh|collapse|unresponsive|pale and clammy|dizzy upon standing)\b/i.test(combinedContext);
    if (isLifeThreateningGI) {
      return {
        score: 10,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Acute severe upper gastrointestinal hemorrhage with hemodynamic compromise; requires immediate 108 Emergency Ambulance dispatch for resuscitation and emergency endoscopy.",
        isLifeThreatening: true,
      };
    }

    if (hasHematemesis) {
      return {
        score: 8,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Hematemesis (blood in vomit) indicates upper gastrointestinal mucosal bleeding; requires immediate hospital casualty evaluation, IV fluid resuscitation, and emergency endoscopy.",
        isLifeThreatening: false,
      };
    }

    return {
      score: 7,
      urgency_level: "Moderate",
      assessed_severity: "Moderate",
      duration: validatedDuration,
      reasoning: "Persistent vomiting with inability to retain oral fluids; requires physician examination, parenteral antiemetics, and IV rehydration at hospital.",
      isLifeThreatening: false,
    };
  }

  if (isAbdominal) {
    if (/\b(severe pet dard|rigid|intense cramp|cannot stand)\b/i.test(combinedContext)) {
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
  // STRICT CLINICAL MANDATE:
  // Normal / routine OPD conditions must NOT be sent to hospital and must NOT be Moderate!
  // Send to Dispensary or 104.
  // Moderate is STRICTLY where:
  // 1. IPD Treatment / Hospitalization Needed: >= 1 day admission, observation bed, or continuous IV fluids / drip.
  // 2. Specialist Doctor Consultation or Treatment Needed: specialist physician (orthopedic, cardiologist, neurologist, surgeon, gynecologist, pediatrician) or procedural care (sutures/stitches, fracture reduction/plaster cast, minor OT, incision & drainage).
  // 3. Diagnostic Lab Workup or Imaging Needed: blood tests (CBC, serology, biochemistry), X-ray, ECG, USG/ultrasound, CT.
  const requiresIpdOrHospitalization = /\b(ipd|admit|admission|hospitaliz\w*|overnight|observation|bed|day care|inpatient|iv fluid|iv drip|saline drip|intravenous)\b/i.test(combinedContext);

  const requiresSpecialistOrHospitalProcedure = /\b(specialist|cardiologist|orthopedic|orthopedist|neurologist|surgeon|general surgeon|gynecolog\w*|pediatrician|ent specialist|stitches|sutur\w*|taanke|fracture|broken bone|dislocation|plaster|cast|minor ot|wound toilet|incision|abscess drainage)\b/i.test(combinedContext);

  const requiresLabOrImaging = /\b(lab|blood test|cbc|x-ray|xray|ecg|ultrasound|usg|scan|imaging|serology|pathology|biochemistry|cardiac enzyme|troponin)\b/i.test(combinedContext);

  const hasHospitalCareNeed = requiresIpdOrHospitalization || requiresSpecialistOrHospitalProcedure || requiresLabOrImaging;

  // USER MANDATE:
  // 1. For 1-3 days duration (or 2-3 days, today, yesterday):
  //    If other condition or answers are Moderate level or Severe level, then based on the situation show Moderate or Severe!
  //    DO NOT restrict anything. Based on every situation show the forward referral.
  // 2. Only if other answers are genuinely mild, evaluate as Mild.
  const is2to3Days = /\b(2\s*-\s*3\s*days?|2\s*to\s*3\s*days?|2\s*or\s*3\s*days?|do\s*teen\s*din|2\s*din|3\s*din|1\s*-\s*3\s*days?|1\s*to\s*3\s*days?|today|yesterday|kal|aaj)\b/i.test(combinedContext);
  const rawSev = Number(intake?.severity_reported || tState?.severityScore);

  const hasModerateSymptoms = Boolean(
    hasHospitalCareNeed ||
    (rawSev && rawSev >= 5 && rawSev <= 7) ||
    /\b(moderate|painful|unable to walk|limping|swollen joint|sprain|burn|second degree|persistent|worsening|severe headache|migraine|urinary burning|hematuria|blood in urine|ear discharge|eye injury|blurred vision)\b/i.test(combinedContext)
  );

  const hasSevereSymptoms = Boolean(
    isSevereCrisis ||
    (rawSev && rawSev >= 8) ||
    /\b(severe|intense|unbearable|high fever|rigors|cannot breathe|unconscious|behosh|convulsion|head injury|deep cut)\b/i.test(combinedContext)
  );

  if (is2to3Days) {
    if (hasSevereSymptoms) {
      return {
        score: (rawSev && rawSev >= 8) ? rawSev : 8,
        urgency_level: "Severe",
        assessed_severity: "Severe",
        duration: validatedDuration,
        reasoning: "Acute presentation (1-3 days duration) with severe symptoms requiring urgent hospital casualty evaluation.",
        isLifeThreatening: isSevereCrisis,
      };
    }
    if (hasModerateSymptoms) {
      return {
        score: (rawSev && rawSev >= 5 && rawSev <= 7) ? rawSev : 6,
        urgency_level: "Moderate",
        assessed_severity: "Moderate",
        duration: validatedDuration,
        reasoning: "Presentation (1-3 days duration) with moderate clinical acuity requiring hospital / dispensary medical assessment.",
        isLifeThreatening: false,
      };
    }
    return {
      score: 3,
      urgency_level: "Mild",
      assessed_severity: "Mild",
      duration: validatedDuration,
      reasoning: "Sub-acute presentation (1-3 days duration) with stable functional status and absence of hospital red flags; safely manageable via routine outpatient care (ESIS Dispensary / 104 Health Helpline).",
      isLifeThreatening: false,
    };
  }

  if (hasSevereSymptoms || (rawSev && rawSev >= 8)) {
    return {
      score: (rawSev && rawSev >= 8) ? rawSev : 8,
      urgency_level: "Severe",
      assessed_severity: "Severe",
      duration: validatedDuration,
      reasoning: "High-intensity clinical presentation requiring urgent hospital casualty stabilization.",
      isLifeThreatening: isSevereCrisis,
    };
  }

  if (hasModerateSymptoms) {
    const score = (rawSev && rawSev >= 5 && rawSev <= 7) ? rawSev : 6;
    let specificReason = "Condition requires secondary hospital facilities (diagnostic lab tests, specialist doctor consultation, procedural care, or IPD admission).";
    if (requiresIpdOrHospitalization) specificReason = "Condition requires IPD treatment, inpatient observation, or IV fluid rehydration at hospital.";
    else if (requiresSpecialistOrHospitalProcedure) specificReason = "Condition requires specialist doctor consultation or specialized procedural treatment (sutures, plaster, minor OT) at hospital.";
    else if (requiresLabOrImaging) specificReason = "Condition requires diagnostic laboratory investigations (blood tests) or imaging (X-ray / USG / ECG) at hospital.";
    else specificReason = "Condition exhibits moderate symptom severity requiring clinical assessment at hospital / dispensary.";

    return {
      score,
      urgency_level: "Moderate",
      assessed_severity: "Moderate",
      duration: validatedDuration,
      reasoning: specificReason,
      isLifeThreatening: false,
    };
  }

  // ALL other normal / routine OPD conditions MUST be MILD (Dispensary / 104)
  const mildScore = (rawSev && rawSev >= 1 && rawSev <= 4) ? rawSev : 3;
  return {
    score: mildScore,
    urgency_level: "Mild",
    assessed_severity: "Mild",
    duration: validatedDuration,
    reasoning: "Normal outpatient condition manageable via routine OPD (ESIS Dispensary / 104 Health Helpline); does not require IPD hospitalization, specialist consultation, or hospital lab investigations.",
    isLifeThreatening: false,
  };
}

/**
 * Evaluates whether a case requires physical in-person medical treatment (doctor examination,
 * medication dispensing, wound care/dressing, IV fluids, injections, procedures, or hospital admission)
 * versus a case that can be safely managed by telephone consultation alone (104 Health Helpline).
 *
 * USER MANDATE:
 * - Send to 104 ONLY where the condition can be fixed by consultation (advice, guidance, counselling).
 * - If more than consultation is needed (medical treatment needed), and dispensary is closed,
 *   DO NOT stop at 104; forward to healthcare facilities (ESIC Hospital / Govt District Hospital).
 */
export function doesCaseNeedMedicalTreatment({
  severity = "Mild",
  score = 3,
  text = "",
  isPsych = false,
  isNaco = false,
} = {}) {
  // Pure consultation cases: Tele-MANAS emotional distress or NACO/HIV informational counselling
  if (isPsych || isNaco) return false;

  // Moderate or Severe presentations ALWAYS require hospital/physical clinical care
  if (severity === "Severe" || severity === "Moderate" || Number(score) >= 5) {
    return true;
  }

  const clean = (text || "").toLowerCase();

  // Pure phone advice inquiries where caller explicitly only wants advice / information / helpline / counseling
  const isPurePhoneAdvice =
    /\b(phone doctor|tele.?consult|104 health|call doctor|doctor on phone|phone par baat|phone par doctor|advice only|salah chahiye|guidance|diet advice|home remedy|gharelu|vaccine schedule|tika schedule|general inquiry|general information|health tips)\b/i.test(clean) &&
    !/\b(blood|bleed|cut|wound|fracture|burn|vomit.*blood|blood.*vomit|severe pain|intense pain|cannot breathe|fainted|fever|bukhar|infection|medicine prescription)\b/i.test(clean);

  if (isPurePhoneAdvice) {
    return false;
  }

  // Any reported physical symptom/illness that warrants doctor physical checkup or prescription medicines
  const hasPhysicalMedicalSymptom = /\b(fever|bukhar|vomit|ulti|blood|khoon|cut|wound|ghao|pain|dard|cough|khansi|cold|sardi|burn|jalna|injury|chot|accident|sprain|fracture|rash|diarrhea|dast|loose motion|swelling|sujan|ear|eye|infection|stitch|abscess|chills|shivering|headache|weakness|dizzy|ache|sore|ill|sick|bimari|dawai|tablet|dose)\b/i.test(clean);

  return hasPhysicalMedicalSymptom || !clean.includes("advice");
}

