// Clinical Adaptive Questioning Engine for ESIC/ESIS Triage
// Dynamically classifies diseases, adapts questions, red-flag probing, and companion symptoms

export const CLINICAL_DOMAINS = {
  FEVER: "fever",
  CARDIAC: "cardiac",
  HEADACHE: "headache",
  ABDOMINAL: "abdominal",
  RESPIRATORY: "respiratory",
  TRAUMA: "trauma",
  PESTICIDE: "pesticide",
  BP_CRISIS: "bp_crisis",
  FATIGUE: "fatigue",
  ALLERGY: "allergy",
  ENT_EYE: "ent_eye",
  GENERAL: "general",
};

export const DOMAIN_LABELS = {
  [CLINICAL_DOMAINS.FEVER]: "Acute Febrile Illness / Infection",
  [CLINICAL_DOMAINS.CARDIAC]: "Suspected Acute Coronary Syndrome / Angina",
  [CLINICAL_DOMAINS.HEADACHE]: "Acute Neurological / Severe Headache",
  [CLINICAL_DOMAINS.ABDOMINAL]: "Acute Abdomen / Gastrointestinal Distress",
  [CLINICAL_DOMAINS.RESPIRATORY]: "Acute Respiratory Distress / Bronchospasm",
  [CLINICAL_DOMAINS.TRAUMA]: "Occupational Trauma / Acute Injury",
  [CLINICAL_DOMAINS.PESTICIDE]: "Toxic Chemical / Pesticide Exposure",
  [CLINICAL_DOMAINS.BP_CRISIS]: "Acute Blood Pressure Fluctuation",
  [CLINICAL_DOMAINS.FATIGUE]: "Systemic Fatigue / Heat Exhaustion / Musculoskeletal",
  [CLINICAL_DOMAINS.ALLERGY]: "Allergic Reaction / Dermatological Distress",
  [CLINICAL_DOMAINS.ENT_EYE]: "Acute ENT / Ocular Emergency",
  [CLINICAL_DOMAINS.GENERAL]: "General Medical Complaint",
};

/**
 * Intelligently classifies the clinical domain based on cumulative conversation,
 * triage summary, and the latest prompt (in English, Hindi, or Hinglish).
 */
/**
 * Intelligently classifies the clinical domain based on cumulative conversation,
 * triage summary, and the latest prompt (in English, Hindi, or Hinglish).
 */
export function detectClinicalDomain(allText = "", currentTriage = {}) {
  // 0. If domain is already firmly established in currentTriage, preserve it unless explicitly overwritten
  if (currentTriage.domain && Object.values(CLINICAL_DOMAINS).includes(currentTriage.domain)) {
    // If prompt is just a stage answer (severity rating, duration, etc.), retain established domain!
    const p = (allText || "").toLowerCase();
    const isStageAnswer =
      p.includes("high grade") ||
      p.includes("moderate") ||
      p.includes("mild") ||
      p.includes("severe") ||
      p.includes("distressing") ||
      p.includes("crushing") ||
      p.includes("thunderclap") ||
      p.includes("day") ||
      p.includes("today") ||
      p.includes("hour") ||
      p.includes("week") ||
      p.includes("month");

    if (isStageAnswer && currentTriage.domain !== CLINICAL_DOMAINS.GENERAL) {
      return currentTriage.domain;
    }
  }

  // Combine text for new classification
  const combined = [
    currentTriage.symptom || "",
    allText,
  ]
    .join(" ")
    .toLowerCase();

  // Helper for whole-word or boundary matching
  const has = (re) => re.test(combined);

  // 1. Pesticide & Poisoning / Envenomation (High acuity priority)
  if (
    has(/\b(pesticide|poison|chemical|spray|keetnashak|zeher|snake|saanp|dog bite|kutta|animal bite|organophosphate|danka)\b/i)
  ) {
    return CLINICAL_DOMAINS.PESTICIDE;
  }

  // 2. Cardiac / Chest Pain / Angina
  if (
    has(/\b(chest|chhati|seena|heart|cardiac|angina|crushing|radiating|baayein haath|left arm|stent|infarction)\b/i) ||
    (has(/\bghabrahat\b/i) && has(/\bpasina\b/i))
  ) {
    return CLINICAL_DOMAINS.CARDIAC;
  }

  // 3. Trauma / Cut / Laceration / Fracture / Bleeding
  if (
    has(/\b(cut|cuts|injury|injuries|chot|wound|wounds|bleed|bleeding|khoon|fracture|haddi|burn|burns|jala|electric shock|accident|laceration)\b/i)
  ) {
    return CLINICAL_DOMAINS.TRAUMA;
  }

  // 4. Respiratory / Breathlessness / Asthma / Wheezing
  if (
    has(/\b(saans|breath|breathing|breathlessness|asthma|wheez|wheezing|seeti|dyspnea|stridor|inhaler|chest congestion)\b/i) ||
    (has(/\bkhansi\b/i) && has(/\bsaans\b/i))
  ) {
    return CLINICAL_DOMAINS.RESPIRATORY;
  }

  // 5. Fever / Chills / Infections / Dengue / Malaria
  if (
    has(/\b(fever|bukhar|temperature|tapmaan|chills|shivering|kapkapi|dengue|malaria|typhoid|viral|febrile)\b/i) ||
    has(/10[0-5]\s*°?\s*f/i)
  ) {
    return CLINICAL_DOMAINS.FEVER;
  }

  // 6. Neurological / Headache / Stroke / Dizziness / Seizure
  if (
    has(/\b(headache|headaches|sar dard|sir dard|migraine|chakkar|giddiness|vertigo|behoshi|faint|syncope|stroke|paralysis|slurred|ladkhada|seizure|daura)\b/i)
  ) {
    return CLINICAL_DOMAINS.HEADACHE;
  }

  // 7. Gastrointestinal / Abdominal Pain / Vomiting / Diarrhea
  if (
    has(/\b(abdominal|abdomen|pet dard|pet me dard|stomach|gastric|acidity|gas ban|vomit|vomiting|ulti|dast|loose motion|diarrhea|cramps|colic|appendix|malena)\b/i)
  ) {
    return CLINICAL_DOMAINS.ABDOMINAL;
  }

  // 8. Blood Pressure Crisis
  if (
    has(/\b(blood pressure|bp issue|high bp|low bp|hypertension|bp badha|bp kam)\b/i)
  ) {
    return CLINICAL_DOMAINS.BP_CRISIS;
  }

  // 9. Allergic Reaction / Skin Rash
  if (
    has(/\b(rash|rashes|itch|itching|khujli|allergy|allergic|daane|hives|urticaria|soojan|anaphylaxis)\b/i)
  ) {
    return CLINICAL_DOMAINS.ALLERGY;
  }

  // 10. Systemic Fatigue / Heat Exhaustion / Body Ache
  if (
    has(/\b(body ache|badan dard|fatigue|kamzori|thakan|weakness|heat stroke|loo lagna|dehydration|joint pain)\b/i)
  ) {
    return CLINICAL_DOMAINS.FATIGUE;
  }

  // 11. ENT / Eye Emergencies
  if (
    has(/\b(eye|aankh|vision|ear|kaan|nosebleed|nakseer|throat|gala)\b/i)
  ) {
    return CLINICAL_DOMAINS.ENT_EYE;
  }

  // 12. Cough & Cold (if cough without breathlessness)
  if (has(/\b(cough|khansi|cold|sardi|phlegm|balgam)\b/i)) {
    return CLINICAL_DOMAINS.RESPIRATORY;
  }

  return CLINICAL_DOMAINS.GENERAL;
}

/**
 * Extracts severity rating (1-10) and duration string from conversational text
 */
export function extractSeverityAndDuration(allText = "") {
  const lower = allText.toLowerCase();

  // Duration Detection
  let detectedDuration = "Today";
  if (
    lower.includes("less than 2 hours") ||
    lower.includes("< 2") ||
    lower.includes("< 30") ||
    lower.includes("30 min") ||
    lower.includes("minutes") ||
    lower.includes("just started") ||
    lower.includes("1 to 2 hour") ||
    lower.includes("1-2 hour") ||
    lower.includes("achanak") ||
    lower.includes("sudden")
  ) {
    detectedDuration = "Less than 2 hours";
  } else if (
    lower.includes("4 day") ||
    lower.includes("4-7 day") ||
    lower.includes("char din") ||
    lower.includes("4 din") ||
    lower.includes("5 day") ||
    lower.includes("6 day") ||
    lower.includes("7 day")
  ) {
    detectedDuration = "4-7 days";
  } else if (
    lower.includes("2 day") ||
    lower.includes("3 day") ||
    lower.includes("2-3 day") ||
    lower.includes("do din") ||
    lower.includes("teen din") ||
    lower.includes("do teen din")
  ) {
    detectedDuration = "2-3 days";
  } else if (
    lower.includes("1 day") ||
    lower.includes("ek din") ||
    lower.includes("kal se") ||
    lower.includes("yesterday") ||
    lower.includes("24 hours")
  ) {
    detectedDuration = "1 day";
  } else if (
    lower.includes("more than a week") ||
    lower.includes("hafta") ||
    lower.includes("10 days") ||
    lower.includes("two weeks") ||
    lower.includes("2 weeks")
  ) {
    detectedDuration = "More than a week";
  } else if (
    lower.includes("month") ||
    lower.includes("mahina") ||
    lower.includes("chronic")
  ) {
    detectedDuration = "More than a month";
  } else if (
    lower.includes("today") ||
    lower.includes("aaj") ||
    lower.includes("subah se") ||
    lower.includes("few hours")
  ) {
    detectedDuration = "Today";
  }

  // Severity Detection (1-10)
  let detectedSeverity = 5;
  if (
    lower.includes("crushing") ||
    lower.includes("squeezing") ||
    lower.includes("thunderclap") ||
    lower.includes("worst headache") ||
    lower.includes("unbearable") ||
    lower.includes("extremely severe") ||
    lower.includes("unable to function") ||
    lower.includes("high grade") ||
    lower.includes(">102") ||
    lower.includes("pesticide") ||
    lower.includes("bleeding") ||
    lower.includes("arterial") ||
    lower.includes("fracture") ||
    lower.includes("cannot speak") ||
    lower.includes("gasping") ||
    lower.includes("anaphylaxis") ||
    lower.includes(">180")
  ) {
    detectedSeverity = 9;
  } else if (
    lower.includes("severe") ||
    lower.includes("distressing") ||
    lower.includes("shivering") ||
    lower.includes("rigors") ||
    lower.includes("throbbing") ||
    lower.includes("colicky") ||
    lower.includes("continuous vomiting") ||
    lower.includes("wheezing")
  ) {
    detectedSeverity = 8;
  } else if (
    lower.includes("moderate") ||
    lower.includes("uncomfortable") ||
    lower.includes("100.5") ||
    lower.includes("101") ||
    lower.includes("102") ||
    lower.includes("aching")
  ) {
    detectedSeverity = 6;
  } else if (
    lower.includes("mild") ||
    lower.includes("manageable") ||
    lower.includes("halka") ||
    lower.includes("minor") ||
    lower.includes("low-grade")
  ) {
    detectedSeverity = 3;
  }

  return { detectedSeverity, detectedDuration };
}

/**
 * Returns condition-specific, step-specific data:
 * - agentScript
 * - options
 * - probingQuestions (Hindi + English)
 * - isMultiSelect
 */
export function getClinicalQuestionData({
  domain,
  stage,
  prompt = "",
  history = [],
  currentTriage = {},
}) {
  if (stage === "complete") {
    return {
      agentScript:
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."',
      options: [],
      probingQuestions: [],
      isComplete: true,
    };
  }

  const isHighSeverity =
    (currentTriage.severity &&
      (currentTriage.severity.toLowerCase().includes("severe") ||
        currentTriage.severity.toLowerCase().includes("high grade") ||
        currentTriage.severity.toLowerCase().includes("crushing") ||
        currentTriage.severity.toLowerCase().includes("thunderclap"))) ||
    prompt.toLowerCase().includes("severe") ||
    prompt.toLowerCase().includes("high grade");

  const durationText = (currentTriage.duration || prompt || "").toLowerCase();
  const isProlongedDuration =
    durationText.includes("4-7") ||
    durationText.includes("week") ||
    durationText.includes("month");

  // Step 1 / Clarification: If in symptom stage, ask to clarify the exact symptom / disease
  if (stage === "symptom") {
    const lowerPrompt = (prompt || "").toLowerCase();
    let symptomOptions = [
      "Fever / Bukhar",
      "Chest Pain / Pressure",
      "Severe Headache",
      "Abdominal Pain / Gastric",
      "Breathlessness / Asthma",
      "Cough & Cold",
      "Cut / Injury at work",
      "Body Ache & Extreme Weakness",
    ];

    if (lowerPrompt.includes("pain") || lowerPrompt.includes("dard")) {
      symptomOptions = [
        "Chest Pain (Seena dard)",
        "Severe Headache (Sar dard)",
        "Abdominal / Stomach Pain (Pet dard)",
        "Body Ache / Joint Pain (Badan dard)",
        "Throat / Ear / Eye Pain",
      ];
    } else if (lowerPrompt.includes("breath") || lowerPrompt.includes("saans") || lowerPrompt.includes("chest") || lowerPrompt.includes("chhati")) {
      symptomOptions = [
        "Shortness of Breath / Asthma",
        "Chest Pain / Tightness",
        "Persistent Cough with phlegm",
        "Wheezing / Whistling chest sound",
      ];
    } else if (lowerPrompt.includes("stomach") || lowerPrompt.includes("pet") || lowerPrompt.includes("vomit") || lowerPrompt.includes("loose")) {
      symptomOptions = [
        "Abdominal / Stomach Cramps",
        "Continuous Vomiting / Nausea",
        "Acidity / Severe Gas / Burning",
        "Loose Motions / Diarrhea",
      ];
    } else if (lowerPrompt.includes("chot") || lowerPrompt.includes("wound") || lowerPrompt.includes("fall") || lowerPrompt.includes("cut")) {
      symptomOptions = [
        "Deep Cut / Active Bleeding",
        "Head / Eye Injury",
        "Suspected Bone Fracture",
        "Burn / Chemical injury",
      ];
    } else if (lowerPrompt.includes("weak") || lowerPrompt.includes("thakan") || lowerPrompt.includes("sick")) {
      symptomOptions = [
        "High Fever with Weakness",
        "Body Ache & Fatigue",
        "Dizziness / Fainting sensation",
        "Nausea & Loss of appetite",
      ];
    }

    return {
      agentScript:
        "Ask the IP: 'Could you please describe the specific health complaint or symptom you are experiencing? (e.g., fever, chest pain, headache, stomach ache, breathing issue, or injury?)'",
      options: symptomOptions,
      probingQuestions: [
        "Kripya spasht batayein sharir ke kis hisse mein ya kya mukhya takleef ho rahi hai? (Please describe which part of the body or what main symptom is troubling you?)",
        "Kya unhe bukhar, seene mein dard, pet dard, ulti ya saans phoolne jaisi koi pareshani hai? (Is there fever, chest pain, stomach ache, vomiting, or breathing trouble?)",
        "Yeh takleef kab shuru hui aur kaisa mehsoos ho raha hai? (When did this complaint begin and how are they feeling?)",
      ],
      isClarification: true,
    };
  }

  switch (domain) {
    // -------------------------------------------------------------------------
    // 1. FEVER / INFECTION
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.FEVER: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How high is the fever, and is it accompanied by chills, rigors, or extreme shivering?'",
          options: [
            "High Grade (>102°F) with Shivering & Rigors",
            "Moderate fever (100.5°F - 102°F) with body ache",
            "Mild low-grade (99°F - 100°F) manageable",
            "Intermittent fever spikes coming and going",
          ],
          probingQuestions: [
            "Kya gardan mein akadpan ya tez sar dard hai? (Is there neck stiffness, severe headache, or confusion?)",
            "Kya sharir par koi laal daane (rashes) ya masoodon se khoon aa raha hai? (Any skin petechiae, red spots, or bleeding gums?)",
            "Kya patient paani aur ORS pee pa rahe hain ya lagatar ulti ho rahi hai? (Can the patient retain fluids/ORS or continuous vomiting?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne din se bukhar hai? (How many days or hours have you had this fever?)'",
          options: [
            "Less than 2 hours (Sudden high spike)",
            "Today (Started a few hours ago)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days (Persistent high fever)",
            "More than a week",
          ],
          probingQuestions: isHighSeverity
            ? [
                "Kya bukhar ke dauran behoshi, jhatke (febrile seizures) ya behki baatein hui hain? (Any episodes of delirium or convulsions?)",
                "Kya pishab mein jalan ya pishab kam aur gehre peele rang ka aa raha hai? (Is there burning micturition or reduced dark urine?)",
                "Pichle 2-3 dino mein kya koi CBC, Malaria ya Dengue test karwaya hai? (Any recent lab tests done for malaria or dengue?)",
              ]
            : [
                "Kya bukhar ke saath khansi, gale mein dard ya saans lene mein dikkat hai? (Is fever accompanied by cough, sore throat, or breathlessness?)",
                "Kya bukhar dawai (Paracetamol) lene par utarta hai? (Does temperature lower after antipyretic medicine?)",
                "Kya ghar ya mohalle mein kisi aur ko bhi aisi bimari ya bukhar hua hai? (Is there any similar outbreak in the locality?)",
              ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Chills & severe shivering (Kapkapi)",
            "Severe headache & pain behind eyes",
            "Persistent vomiting / Inability to drink",
            "Body rashes or red spots (Petechiae)",
            "Burning sensation during urination",
            "Dry cough or chest congestion",
            "Extreme weakness / Drowsiness",
            "None of these",
          ],
          probingQuestions: isProlongedDuration
            ? [
                "Kya bukhar 4 din se lagatar chadh raha hai aur dawai se aaram nahi mil raha? (Has fever persisted for >4 days despite medication?)",
                "Kya pet mein daayein taraf sujan ya dard hai (Liver/Spleen tenderness)? (Any right upper abdominal pain or tenderness?)",
                "Kya dehydration ke lakshan hain jaise sookhe honth ya 6 ghante se pishab na aana? (Signs of dehydration like dry lips or no urination for 6 hours?)",
              ]
            : [
                "Kya bukhar dawai lene ke 4 ghante baad fir se tez ho jata hai? (Does fever spike repeatedly after antipyretic wears off?)",
                "Kya patient bina sahare chal pa rahe hain ya kamzori se gir rahe hain? (Is caller able to ambulate safely or unsteady?)",
                "Kya unhone pichle 24 ghante mein ORS ya garam soup liya hai? (Have they been taking oral rehydration solution or fluids?)",
              ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 2. CARDIAC / CHEST PAIN
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.CARDIAC: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How would you describe the chest pain sensation and intensity?'",
          options: [
            "Heavy crushing / Squeezing pressure on chest",
            "Sharp stabbing / Worsens with deep breath",
            "Burning sensation behind breastbone (Reflux/Acidity)",
            "Mild ache / Muscular tightness",
          ],
          probingQuestions: [
            "Kya dard baayein haath, jabde, gale ya peeth mein phail raha hai? (Is pain radiating to left arm, jaw, neck, or back?)",
            "Kya thanda pasina (clammy sweat), ghabrahat ya chakkar aa raha hai? (Is there cold profuse sweating, extreme anxiety, or syncope?)",
            "Kya Sorbitrate/BP dawai li hai, aur pehle koi heart attack ya stent laga hai? (Has emergency nitrate been taken, or prior cardiac stent?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'When exactly did this chest discomfort start? Is it constant or coming in waves?'",
          options: [
            "Less than 30 minutes (Acute onset)",
            "1 to 2 hours",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days intermittent",
            "More than a week",
          ],
          probingQuestions: [
            "Kya chalne ya seedhi chadhne par dard badhta hai aur baithne se aaram milta hai? (Does exertion aggravate pain and rest relieve it?)",
            "Kya letne par saans zyada phool rahi hai? (Does lying flat worsen breathing difficulty - Orthopnea?)",
            "Pehle kabhi ECG ya heart test karwaya tha? (Any prior history of abnormal ECG or cardiac evaluation?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Cold sweating & clamminess",
            "Pain radiating to left arm / jaw / back",
            "Shortness of breath / gasping",
            "Dizziness / Near-fainting sensation",
            "Nausea or vomiting",
            "Heart racing / Palpitations",
            "Pain worsens on deep breath",
            "None of these",
          ],
          probingQuestions: [
            "Kya dil ki dhadkan achanak bohot tez ya aniyamit mehsoos ho rahi hai? (Is there tachycardia or irregular heart rate?)",
            "Kya unhone pichle 1 ghante mein koi aspirin ya blood thinner dawai li hai? (Has any dispersible aspirin or blood thinner been taken?)",
            "Kya unke paas abhi hospital le jane ke liye koi saathi ya gaadi maujood hai? (Is an attendant or transport available immediately?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 3. HEADACHE / NEUROLOGICAL
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.HEADACHE: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How severe is the headache? Did it start suddenly or build up slowly?'",
          options: [
            "Sudden thunderclap / Worst headache of entire life",
            "Severe throbbing one-sided headache with nausea",
            "Moderate constant band-like pressure around forehead",
            "Mild headache / manageable with rest",
          ],
          probingQuestions: [
            "Kya sar dard achanak bijli jaisa teekha (worst headache ever) shuru hua? (Was there sudden thunderclap onset?)",
            "Kya chehre ka ek hissa tedha hua, ya bolne mein ladkhadahat hai? (Any facial asymmetry, slurred speech, or arm weakness - BEFAST stroke signs?)",
            "Kya gardan jhukane mein tez dard (neck stiffness) ya tez ultiyan ho rahi hain? (Is there severe neck rigidity or projectile vomiting?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'How many hours or days have you had this headache? Exactly when did it start?'",
          options: [
            "Less than 2 hours (Sudden sharp onset)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week / Chronic",
          ],
          probingQuestions: [
            "Kya aankhon ke aage andhera, double vision ya roshni dekhne se dard badh raha hai? (Is there blurred vision, double vision, or photophobia?)",
            "Kya pichle 24-48 ghante mein sar par koi chot lagi thi? (Any history of head injury or fall in the last 48 hours?)",
            "Kya unka blood pressure pehle se high rehta hai aur kya aaj dawai li? (Is there a history of hypertension, and was today's BP medicine taken?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Severe neck stiffness (Gardan akadna)",
            "Persistent nausea or projectile vomiting",
            "Sensitivity to light and loud noise (Photophobia)",
            "Blurred or double vision",
            "Facial drooping or slurred speech",
            "High fever accompanying headache",
            "Numbness or weakness in arm/leg",
            "None of these",
          ],
          probingQuestions: [
            "Kya pehle bhi aisa sar dard hota tha ya yeh pehli baar itna tez hua hai? (Any past migraine history or is this first time so severe?)",
            "Kya andhere kamre mein chup-chap letne se dard mein aaram milta hai? (Does resting in a quiet dark room relieve the pain?)",
            "Kya patient hosh mein hain aur sahi samay aur jagah pehchan pa rahe hain? (Is caller fully oriented to time, place, and person?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 4. ABDOMINAL / GASTRIC / VOMITING / DIARRHEA
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.ABDOMINAL: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How would you describe the stomach pain and how intense is it?'",
          options: [
            "Severe continuous stabbing / Board-like hard abdomen",
            "Colicky cramping pain with repeated vomiting / loose motion",
            "Burning upper stomach / acid reflux & nausea",
            "Mild dull aching / discomfort",
          ],
          probingQuestions: [
            "Kya pet chhoone par pathar jaisa sakht (rigid/tender) mehsoos ho raha hai? (Is the abdomen board-like rigid or severely tender to touch?)",
            "Kya ulti ya stool mein khoon, ya kaale rang ka pakhana (malena) aaya hai? (Any blood in vomit or dark black tarry stool?)",
            "Kya dard pet ke daayein taraf neeche (Right Lower Quadrant - Appendix) badh raha hai? (Is pain concentrated in the right lower abdomen?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne ghante ya dino se pet mein dard ho raha hai? (How many hours or days has this stomach pain lasted?)'",
          options: [
            "Less than 2 hours (Sudden severe colic)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kitni baar ulti ya loose motion hua hai, aur kya paani pee pa rahe hain? (Frequency of vomiting/diarrhea and fluid tolerance?)",
            "Kya gas pass ho rahi hai aur pichla pakhana (bowel movement) kab hua tha? (Is gas/flatus passing and when was the last bowel movement?)",
            "Kya unhone koi dard niwarak dawai (painkiller) khali pet li thi? (Any NSAID painkillers taken on empty stomach?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Repeated vomiting (>3 times)",
            "Blood in vomit or dark black stool",
            "Severe watery loose motions / diarrhea",
            "High fever with chills",
            "Hard board-like swollen abdomen",
            "Severe dizziness or extreme thirst",
            "Pain radiating to back or groin",
            "None of these",
          ],
          probingQuestions: [
            "Kya dehydration ho rahi hai jaise bohot tez pyas, sookhe honth ya chakkar aana? (Signs of dehydration like intense thirst or giddiness?)",
            "Kya dard khana khane ke baad badhta hai ya kam hota hai? (Does food intake worsen or relieve the abdominal pain?)",
            "Kya pehle kabhi kidney stone, gall stone ya ulcer ki bimari rahi hai? (Any prior history of kidney stone, gallstones, or peptic ulcer?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 5. RESPIRATORY / BREATHLESSNESS / ASTHMA / COUGH
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.RESPIRATORY: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How difficult is the breathing? Can you speak complete sentences without pausing?'",
          options: [
            "Severe distress / Cannot speak full sentence without gasping",
            "Moderate shortness of breath with audible wheezing",
            "Mild breathlessness on walking or climbing stairs",
            "Chest tightness with dry or hacking cough",
          ],
          probingQuestions: [
            "Kya wo bina saans toote pura sentence bol pa rahe hain? (Can caller speak full continuous sentences without gasping?)",
            "Kya honth, jeebh ya nakhun neele (cyanosis) pad rahe hain? (Are lips, tongue, or fingertips turning bluish?)",
            "Kya unke paas emergency inhaler (Asthalin/Levolin) hai aur kya puffs liye? (Do they have rescue inhaler and taken puffs?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'When did the breathing difficulty or cough start? Did it worsen suddenly?'",
          options: [
            "Less than 30 minutes (Sudden severe attack)",
            "1 to 2 hours",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya letne par saans lene mein aur zyada dikkat hoti hai? (Does breathing worsen when lying down flat?)",
            "Kya khansi mein khoon (hemoptysis) ya peela-hara balgam aa raha hai? (Is there blood in phlegm or thick yellowish-green sputum?)",
            "Pehle kabhi asthma ya allergy ke liye oxygen support ya ICU lagna pada tha? (Any past history of ICU admission or oxygen for asthma?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Audible whistling sound (Wheezing)",
            "Bluish discoloration of lips / nails",
            "Chest tightness or congestion",
            "High fever with chills",
            "Inability to lie flat in bed",
            "Blood or thick pus in sputum",
            "Stridor / Choking sensation in throat",
            "None of these",
          ],
          probingQuestions: [
            "Kya dhool, dhuwan, mausam badalne ya kisi specific cheez se saans phooli? (Was it triggered by dust, smoke, weather change, or cold air?)",
            "Kya inhaler ke 2-4 puffs lene ke baad bhi koi aaram nahi mila? (Is there lack of relief even after 2-4 puffs of rescue inhaler?)",
            "Kya ghar par oxygen cylinder ya nebulizer machine available hai? (Is oxygen cylinder or nebulizer available at home?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 6. TRAUMA / CUT / OCCUPATIONAL INJURY
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.TRAUMA: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Is there active continuous bleeding, or deep wound involving muscle or bone?'",
          options: [
            "Active arterial continuous bleeding / Deep open wound",
            "Suspected bone fracture with severe deformity / inability to move",
            "Moderate cut / laceration, bleeding partially controlled",
            "Minor superficial cut / scrape / abrasion",
          ],
          probingQuestions: [
            "Kya khoon seedhe dabav (direct pressure) dene ke baad bhi lagatar beh raha hai? (Is active bleeding continuing despite 10 mins direct pressure?)",
            "Kya chot wale hisse par haddi tedhi dikh rahi hai ya sunn (numb) pad gaya hai? (Is there visible bone deformity or loss of sensation in digits?)",
            "Kya chot lagne ke baad behoshi, ulti ya sar par tez maar lagi thi? (Was there loss of consciousness, vomiting, or head trauma?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'How long ago did the accident or injury occur? (Kitne der pehle chot lagi thi?)'",
          options: [
            "Just now (Under 30 minutes)",
            "1 to 2 hours ago",
            "Today (A few hours ago)",
            "1 day (Yesterday)",
            "2-3 days ago (Delayed presentation)",
            "More than a week ago",
          ],
          probingQuestions: [
            "Kya pichle 6 mahine mein Tetanus (TT) injection lagwaya tha? (Has Tetanus toxoid vaccination been taken within 6 months?)",
            "Kya chot wali jagah par kapda ya saaf patti bandh kar khoon rokne ki koshish ki? (Has a clean cloth/bandage been applied for pressure dressing?)",
            "Kya patient ko thanda pasina, chakkar ya behoshi aa rahi hai? (Is the patient feeling dizzy, pale, or fainting - signs of shock?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Continuous bleeding not stopping with pressure",
            "Visible bone deformity / abnormal mobility",
            "Numbness or tingling sensation in fingers/toes",
            "Dizziness, pale skin, or fainting (Shock)",
            "Deep wound exposing muscle or tendon",
            "Severe burning pain or skin blister",
            "Head hit with nausea or confusion",
            "None of these",
          ],
          probingQuestions: [
            "Kya koi loha, jung laga taar ya factory machine ka part chot mein phasa hai? (Is any rusty metal, glass, or foreign object stuck in the wound?)",
            "Kya emergency dressing ya splint lagane mein madad ke liye aas-paas log maujood hain? (Are coworkers or family available to help with first aid/splinting?)",
            "Kya chot lagte waqt koi chemical ya ganda paani wound ke sampark mein aaya tha? (Did any chemical or contaminated water enter the open wound?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 7. PESTICIDE / POISONING / CHEMICAL
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.PESTICIDE: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Are you having eye burning, excessive drooling, continuous vomiting, or breathing trouble?'",
          options: [
            "Severe poisoning / Pinpoint pupils, frothing from mouth, convulsions",
            "Severe eye irritation, continuous vomiting & chemical smell",
            "Dizziness, nausea, excessive sweating & weakness",
            "Mild skin itching / superficial chemical contact",
          ],
          probingQuestions: [
            "Kya munh se jhaag/laar (excess salivation), ulti ya saans lene mein seeti aa rahi hai? (Is there frothing, drooling, pinpoint pupils, or wheezing?)",
            "Kya zehrele kapde turant utaar kar sharir ko saaf paani aur sabun se dhoya gaya? (Have exposed clothes been stripped and skin decontaminated?)",
            "Kya aankhon mein tez jalan hai ya chemical seedhe aankh mein gaya tha? (Was there direct chemical splash into eyes - flush with water for 15 mins?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne der pehle chemical/pesticide ka sampark ya danka laga tha? (How long ago did the exposure occur?)'",
          options: [
            "Less than 30 minutes ago",
            "30 to 60 minutes ago",
            "1 to 2 hours ago",
            "Today (A few hours ago)",
            "1 day (Yesterday)",
            "More than a day",
          ],
          probingQuestions: [
            "Kya chemical/pesticide ka dabba ya label safe rakha hai doctor ko dikhane ke liye? (Is the exact poison container/label preserved for medical team?)",
            "Kya snakebite ya animal bite ka nishaan (fang marks) aur tezi se sujan badh rahi hai? (Are there two puncture fang marks with spreading swelling?)",
            "Kya patient hosh kho rahe hain ya ajeeb behki-behki baatein kar rahe hain? (Is caller losing consciousness or having confusion/delirium?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Excessive sweating and salivation (Drooling)",
            "Pinpoint pupils or blurred vision",
            "Repeated vomiting or abdominal cramps",
            "Drowsiness, confusion, or convulsions",
            "Chemical odor on body or clothes",
            "Severe local swelling, blackening, or bleeding",
            "Breathlessness or choking feeling",
            "None of these",
          ],
          probingQuestions: [
            "Kripya dhyaan dein: Patient ko jabardasti ulti na karwayein (Do NOT induce vomiting). Kya wo abhi hosh mein hain? (Is caller still conscious?)",
            "Kya bite wali jagah par koi cheera ya rassi (tourniquet) to nahi baandhi? (Ensure no incision, suction, or tight tourniquet applied!)",
            "Kya hospital pahunchne ke liye emergency ambulance ya transport ka intezam hai? (Is transport arranged to the nearest hospital with ICU/Antidote?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 8. BLOOD PRESSURE CRISIS
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.BP_CRISIS: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'What was the last BP reading, and are you having severe headache, chest tightness, or blurry vision?'",
          options: [
            "Severely high BP (>180/110) with pounding headache or chest pain",
            "High BP (150-170) with dizziness, anxiety & restlessness",
            "Low BP (<90/60) with extreme fainting sensation & cold limbs",
            "Mild fluctuation / Routine medication inquiry",
          ],
          probingQuestions: [
            "Kya sar ke peeche tez phadakne wala dard (occipital headache) ya aankhon ke aage andhera hai? (Is there throbbing headache at back of head or blurry vision?)",
            "Kya chhati mein bhari-pan, ghabrahat ya naak se khoon (epistaxis) aa raha hai? (Is there chest heaviness, palpitations, or nosebleed?)",
            "Kya aaj ki regular BP ki dawai li thi ya koi dose chhoot gayi thi? (Was today's regular antihypertensive dose taken or missed?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'How long have you been feeling this blood pressure fluctuation or discomfort?'",
          options: [
            "Less than 2 hours (Sudden spike)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "Chronic / Long-standing",
          ],
          probingQuestions: [
            "Kya chalte waqt chakkar aana ya santulan khona (loss of balance) mehsoos ho raha hai? (Is there severe imbalance or spinning sensation when standing?)",
            "Pehle kabhi BP ki wajah se hospital admit ya paralysis ka jhatka laga tha? (Any prior history of hypertensive crisis or mini-stroke?)",
            "Kya unhone namak wali cheezein ya koi aisi dawai li jisse achanak BP badh gaya? (Any heavy salt intake or OTC medicine that triggered this spike?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Pounding headache at back of head",
            "Chest heaviness or palpitations",
            "Blurred vision or seeing black spots",
            "Severe dizziness / Unsteady gait",
            "Nosebleed (Nakseer footna)",
            "Nausea or tingling in fingers",
            "Cold clammy hands & feet",
            "None of these",
          ],
          probingQuestions: [
            "Kya patient shant hokar baith pa rahe hain ya bohot ghabrahat ho rahi hai? (Can patient sit calmly in a quiet place, or extreme anxiety?)",
            "Kya unke paas abhi BP naapne ki machine (BP monitor) ghar par maujood hai? (Is a digital BP apparatus available right now to re-check?)",
            "Kya unhe kidney ki bimari ya diabetes bhi hai? (Any associated chronic kidney disease or diabetic history?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 9. BODY ACHE & FATIGUE / HEAT EXHAUSTION
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.FATIGUE: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How severe is the fatigue or pain? Does it prevent you from standing or normal tasks?'",
          options: [
            "Extreme exhaustion — unable to stand or walk, feeling faint",
            "Severe generalized body pain with heavy head & muscle stiffness",
            "Moderate aching in back, legs & shoulders with tiredness",
            "Mild fatigue / manageable with rest",
          ],
          probingQuestions: [
            "Kya tez dhoop ya garmi mein kaam karne ke baad pasina aana band ho gaya aur sharir garm hai? (Did sweating stop with hot skin - Heat stroke emergency?)",
            "Kya khade hone par achanak behoshi, andhera chhana ya girne jaisa hua? (Was there postural blackouts, syncope, or unsteady gait?)",
            "Kya patient paani, namak-cheeni ka ghol (ORS) pee pa rahe hain? (Can they take fluids/ORS comfortably?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne dino se yeh kamzori ya sharir mein dard ho raha hai? (How long have you had this body ache or fatigue?)'",
          options: [
            "Today (Started during work)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
            "More than a month",
          ],
          probingQuestions: [
            "Kya pishab ka rang gehra peela hai ya pichle 6 ghante se pishab nahi aaya? (Is urine dark amber or no urine for 6 hours - Dehydration sign?)",
            "Kya kisi ek specific joint (ghutna/kohni) mein laal sujan aur tez garmi hai? (Is one specific joint swollen, red, hot, and severely painful?)",
            "Kya unko diabetes hai aur kya sugar level check kiya gaya? (Is there diabetes history, and could this be hypoglycemia?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Dizziness when standing up",
            "Extreme dry mouth & sunken eyes",
            "High body temperature without sweating",
            "Severe painful swelling in joints",
            "Severe muscle cramps in calves/arms",
            "Persistent extreme drowsiness",
            "Loss of appetite & nausea",
            "None of these",
          ],
          probingQuestions: [
            "Kya patient ko thande kamre mein aaram karwa kar ORS/nimbu-paani diya gaya? (Has patient been shifted to shade/cool room and given ORS?)",
            "Kya koi purani bimari jaise anemia, thyroid ya arthritis hai? (Any chronic history of severe anemia, thyroid, or arthritis?)",
            "Kya kal raat ki neend theek thi ya lagatar bhari sharirik kaam kiya gaya? (Was there severe sleep deprivation or unaccustomed heavy manual labor?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 10. ALLERGY / SKIN RASH
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.ALLERGY: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Is there any swelling of lips, face, or throat difficulty in breathing?'",
          options: [
            "Severe anaphylaxis / Swollen lips, tongue, throat tightness & stridor",
            "Spreading red painful blisters or peeling skin with high fever",
            "Widespread itchy red wheals (Hives/Urticaria) across body",
            "Localized mild skin rash / itching without facial swelling",
          ],
          probingQuestions: [
            "Kya honth, jeebh ya gale mein sujan aa rahi hai aur saans lene mein rukawat lag rahi hai? (Is there throat tightness, swollen tongue/lips, or stridor - Anaphylaxis?)",
            "Kya koi nayi dawai, injection, ya anjaan khana khane ke baad turant shuru hua? (Did it develop immediately after a new drug, food, or insect sting?)",
            "Kya sharir par chhale (fluid-filled blisters) ya twacha chhil rahi hai? (Are there skin blisters, mucosal ulcers, or skin peeling?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'When did this rash or swelling start? Did it spread rapidly?'",
          options: [
            "Less than 1 hour (Rapid onset)",
            "1 to 3 hours ago",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya pehle bhi kisi dawai ya khane se aisi teekhi allergy hui thi? (Any prior history of drug or food allergies?)",
            "Kya unhone koi antiallergic dawai (Avil/Cetirizine) li hai? (Has any antihistamine like Cetirizine or Avil been taken?)",
            "Kya ghabrahat, chakkar ya BP kam hone jaisa lag raha hai? (Is there dizziness, syncope, or hypotension sensation?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Swollen face, lips, or eyelids",
            "Throat tightness or voice hoarseness",
            "Severe generalized itching (Hives)",
            "Dizziness or low BP sensation",
            "High fever accompanying rash",
            "Blisters or pus-filled lesions",
            "Breathing difficulty or wheezing",
            "None of these",
          ],
          probingQuestions: [
            "Kya twacha ke chhale munh ke andar, aankhon mein ya private parts mein bhi hain? (Are there mucosal erosions in mouth, eyes, or genitalia - SJS warning?)",
            "Kya kisi keede ya madhumakkhi ne kata tha? (Was there an insect, wasp, or bee sting?)",
            "Kya emergency injection (Adrenaline/Hydrocortisone) ki jarurat pad sakti hai agar saans phool rahi hai? (Note: Immediate emergency care needed if respiratory compromise!)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 11. ENT / EYE / GENERAL DEFAULT
    // -------------------------------------------------------------------------
    default: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Can you describe how intense this pain or symptom is, and does it prevent normal activity?'",
          options: [
            "Extremely severe — unable to function or bear pain",
            "Severe — distressing and worsening",
            "Moderate — uncomfortable but manageable",
            "Mild — noticeable but functioning",
          ],
          probingQuestions: [
            "Kya yeh takleef achanak bohot tezi se shuru hui ya dheere-dheere badhi? (Did this symptom start suddenly and rapidly or gradually?)",
            "Kya iski wajah se saans lene, bolne ya chalne mein koi rukawat aa rahi hai? (Does it interfere with breathing, speaking, or walking?)",
            "Kya pehle se koi purani bimari ya regular dawai chal rahi hai? (Any significant chronic medical history or regular medications?)",
          ],
        };
      }

      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'How long have you had this condition? Exactly when did it start?'",
          options: [
            "Less than 2 hours (Sudden / Recent)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya pichle kuch ghanton mein yeh takleef pehle se zyada badh rahi hai? (Has the symptom been progressively worsening over the past hours?)",
            "Kya unhone iske liye koi dawai ya gharelu upchaar kiya tha? (Have any medications or home remedies been tried?)",
            "Kya patient abhi aaram se baith ya let pa rahe hain? (Is the caller comfortably seated or lying down right now?)",
          ],
        };
      }

      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "High fever with shivering",
            "Dizziness or fainting sensation",
            "Persistent nausea or vomiting",
            "Severe localized swelling or redness",
            "Shortness of breath on exertion",
            "Extreme weakness or body pain",
            "Loss of appetite or dehydration",
            "None of these",
          ],
          probingQuestions: [
            "Kya is bimari ke saath koi bukhar, chakkar ya ulti aayi hai? (Has any fever, dizziness, or vomiting accompanied this complaint?)",
            "Kya unke paas zaroorat padne par turant hospital le jane ke liye koi family member maujood hai? (Is a family member available to accompany them if hospital visit needed?)",
            "Kya patient ko pichle 24 ghante mein theek se neend ya paani lene mein pareshani hui? (Any difficulty sleeping or taking fluids in past 24 hours?)",
          ],
        };
      }
      break;
    }
  }

  if (stage === "complete") {
    return {
      agentScript:
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."',
      options: [],
      probingQuestions: [],
      isComplete: true,
    };
  }

  if (stage === "associated") {
    return {
      agentScript:
        "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
      options: [
        "High fever with shivering",
        "Dizziness or fainting sensation",
        "Persistent nausea or vomiting",
        "Severe localized swelling or redness",
        "Shortness of breath on exertion",
        "Extreme weakness or body pain",
        "Loss of appetite or dehydration",
        "None of these",
      ],
      probingQuestions: [
        "Kya is bimari ke saath koi bukhar, chakkar ya ulti aayi hai? (Has any fever, dizziness, or vomiting accompanied this complaint?)",
        "Kya unke paas zaroorat padne par turant hospital le jane ke liye koi family member maujood hai? (Is a family member available to accompany them if hospital visit needed?)",
        "Kya patient ko pichle 24 ghante mein theek se neend ya paani lene mein pareshani hui? (Any difficulty sleeping or taking fluids in past 24 hours?)",
      ],
    };
  }

  if (stage === "duration") {
    return {
      agentScript:
        "Ask the IP: 'How long have you had this condition? Exactly when did it start?'",
      options: [
        "Less than 2 hours (Sudden / Recent)",
        "Today (A few hours)",
        "1 day (Started yesterday)",
        "2-3 days",
        "4-7 days",
        "More than a week",
      ],
      probingQuestions: [
        "Kya pichle kuch ghanton mein yeh takleef pehle se zyada badh rahi hai? (Has the symptom been progressively worsening over the past hours?)",
        "Kya unhone iske liye koi dawai ya gharelu upchaar kiya tha? (Have any medications or home remedies been tried?)",
        "Kya patient abhi aaram se baith ya let pa rahe hain? (Is the caller comfortably seated or lying down right now?)",
      ],
    };
  }

  return {
    agentScript:
      "Ask the IP: 'Can you describe your symptoms and any difficulties you are experiencing?'",
    options: stage === "severity" ? ["High", "Moderate", "Mild"] : [],
    probingQuestions: [
      "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
      "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
      "Kya unhe koi pehle se purani bimari ya dawai chal rahi hai? (Any significant chronic medical history?)",
    ],
  };
}

/**
 * Real-Time Clinical NLP Entity Extractor
 * Extracts primary symptom, companion symptoms, duration, severity, and disease classification
 * from raw speech / conversational text in English, Hindi, and Hinglish.
 * Produces clean clinical keywords without conversational filler.
 */
export function extractClinicalEntities(rawText = "", currentStage = "symptom", currentTriage = {}) {
  if (!rawText || !rawText.trim()) {
    return {
      hasClinicalContent: false,
      cleanKeywords: "",
      primarySymptom: null,
      companionSymptoms: [],
      detectedDuration: null,
      detectedSeverity: null,
      cleanSeverity: null,
      domain: null,
      conditionLabel: null,
      probingAnswer: null,
    };
  }

  const text = rawText.toLowerCase();

  // 1. Detect Domain & Condition
  const domain = detectClinicalDomain(text, currentTriage);
  const conditionLabel = DOMAIN_LABELS[domain] || "General Medical Complaint";

  // 2. Identify Primary Symptom keywords
  let primarySymptom = null;
  if (/\b(fever|bukhar|temperature|pyrexia|feverish|garam sharir|chills)\b/i.test(text)) {
    primarySymptom = "Fever";
  } else if (/\b(chest|chhati|seena|heart|cardiac|angina|left arm|pressure on chest|heavy chest)\b/i.test(text)) {
    primarySymptom = "Chest Pain / Pressure";
  } else if (/\b(headache|sar dard|sir dard|migraine|thunderclap|heavy head|sir bhari)\b/i.test(text)) {
    primarySymptom = "Headache";
  } else if (/\b(abdominal|stomach|pet dard|pet|gastric|acidity|cramps|marod|pet kharab)\b/i.test(text)) {
    primarySymptom = "Abdominal Pain";
  } else if (/\b(breathless|shortness of breath|saans phoolna|saans lene|asthma|wheezing|duma)\b/i.test(text)) {
    primarySymptom = "Breathlessness / Asthma";
  } else if (/\b(cough|khansi|cold|sardi|phlegm|balgam|sneezing)\b/i.test(text)) {
    primarySymptom = "Cough & Cold";
  } else if (/\b(cut|cuts|injury|chot|wound|bleed|bleeding|khoon|fracture|haddi|accident)\b/i.test(text)) {
    primarySymptom = "Injury / Trauma";
  } else if (/\b(pesticide|poison|zeher|spray|keetnashak|snake|bite|saanp|kutta)\b/i.test(text)) {
    primarySymptom = "Pesticide / Poisoning Exposure";
  } else if (/\b(blood pressure|bp high|bp low|bp issue|hypertension)\b/i.test(text)) {
    primarySymptom = "Blood Pressure Fluctuation";
  } else if (/\b(weak|weakness|kamzori|kamjori|thakan|fatigue|body ache|badan dard)\b/i.test(text)) {
    primarySymptom = "Weakness & Body Ache";
  } else if (/\b(vomit|vomiting|ulti|nausea|ji machlana)\b/i.test(text)) {
    primarySymptom = "Vomiting / Nausea";
  } else if (/\b(rash|khujli|itching|allergy|daane|rashes)\b/i.test(text)) {
    primarySymptom = "Skin Rash / Allergy";
  } else if (/\b(burn|jal gaya|aag se jala|burns)\b/i.test(text)) {
    primarySymptom = "Burn Injury";
  } else if (/\b(eye|aankh|ear|kaan|throat|gala|vision)\b/i.test(text)) {
    primarySymptom = "ENT / Eye Emergency";
  }

  // 3. Identify Companion / Associated Symptoms
  const companionSymptoms = [];
  if (/\b(weak|weakness|kamzori|kamjori|thakan|exhausted|tired|behal)\b/i.test(text) && primarySymptom !== "Weakness & Body Ache") {
    companionSymptoms.push("Weakness / Malaise");
  }
  if (/\b(chills|shivering|rigors|thand|thithuran|kaanpna)\b/i.test(text)) {
    companionSymptoms.push("Chills / Shivering");
  }
  if (/\b(body ache|badan dard|joint pain|muscle pain|kamar dard)\b/i.test(text) && primarySymptom !== "Weakness & Body Ache") {
    companionSymptoms.push("Body Ache");
  }
  if (/\b(headache|sar dard|sir dard|migraine|head pain|sir bhari)\b/i.test(text) && primarySymptom !== "Headache") {
    companionSymptoms.push("Headache");
  }
  if (/\b(vomit|vomiting|ulti|nausea|ji machlana)\b/i.test(text) && primarySymptom !== "Vomiting / Nausea") {
    companionSymptoms.push("Nausea / Vomiting");
  }
  if (/\b(cough|khansi|cold|sardi|balgam|phlegm)\b/i.test(text) && primarySymptom !== "Cough & Cold") {
    companionSymptoms.push("Cough & Cold");
  }
  if (/\b(sore throat|gala dard|gale me dard|throat pain|kharash)\b/i.test(text)) {
    companionSymptoms.push("Sore Throat");
  }
  if (/\b(chest pain|seena dard|chhati me dard|chest tightness|pressure)\b/i.test(text) && primarySymptom !== "Chest Pain / Pressure") {
    companionSymptoms.push("Chest Discomfort");
  }
  if (/\b(stomach|pet dard|pet me dard|cramps|acidity|gas|burning stomach)\b/i.test(text) && primarySymptom !== "Abdominal Pain") {
    companionSymptoms.push("Abdominal Discomfort");
  }
  if (/\b(loose motion|loose motions|diarrhea|dast|pet kharab)\b/i.test(text)) {
    companionSymptoms.push("Loose Motions / Diarrhea");
  }
  if (/\b(burning urine|pishab me jalan|peshab me jalan|burning micturition)\b/i.test(text)) {
    companionSymptoms.push("Burning Urination");
  }
  if (/\b(dizziness|chakkar|giddiness|fainting|behoshi)\b/i.test(text)) {
    companionSymptoms.push("Dizziness / Vertigo");
  }
  if (/\b(sweat|sweating|pasina|cold sweat|thanda pasina)\b/i.test(text)) {
    companionSymptoms.push("Cold Sweats");
  }
  if (/\b(breathless|saans phoolna|shortness of breath|asthma)\b/i.test(text) && primarySymptom !== "Breathlessness / Asthma") {
    companionSymptoms.push("Breathlessness");
  }
  if (/\b(neck stiffness|gardan akad|stiff neck)\b/i.test(text)) {
    companionSymptoms.push("Neck Stiffness");
  }
  if (/\b(rash|rashes|daane|laal daane|petechiae)\b/i.test(text) && primarySymptom !== "Skin Rash / Allergy") {
    companionSymptoms.push("Skin Rash");
  }
  if (/\b(loss of appetite|bhookh nahi|cannot eat|bhookh na lagna)\b/i.test(text)) {
    companionSymptoms.push("Loss of Appetite");
  }
  if (/\b(palpitations|heart racing|dil ki dhadkan|dhadkan)\b/i.test(text)) {
    companionSymptoms.push("Palpitations");
  }
  if (/\b(left arm|arm pain|jaw pain|radiating)\b/i.test(text)) {
    companionSymptoms.push("Radiating Pain to Arm/Jaw");
  }

  // If a primary symptom is already established in currentTriage, or we are in the associated stage:
  // ANY other newly identified symptom keyword (e.g. Fever caller mentions Cough or Headache)
  // must be treated as an associated companion condition!
  if (currentTriage?.symptom || currentStage === "associated") {
    if (primarySymptom && currentTriage?.symptom && primarySymptom !== currentTriage.symptom) {
      if (!companionSymptoms.includes(primarySymptom)) {
        companionSymptoms.push(primarySymptom);
      }
    }
  }

  // 4. Extract Duration
  const { detectedSeverity, detectedDuration } = extractSeverityAndDuration(text);
  let cleanDuration = null;
  if (/\b(morning|subah|from morning|since morning|subah se|aaj subah)\b/i.test(text)) {
    cleanDuration = "Since morning (Today)";
  } else if (/\b(yesterday|kal se|kal|1 day|one day|24 hours|ek din)\b/i.test(text)) {
    cleanDuration = "Since yesterday (1 day)";
  } else if (/\b(2[\s-]*3\s*(?:days|din)|two\s*(?:to|or|-)?\s*three\s*days|2\s*(?:days|din)|3\s*(?:days|din)|two\s*days|three\s*days|do\s*se\s*teen\s*din|do\s*teen\s*din|do\s*din|teen\s*din|parso|parso\s*se)\b/i.test(text)) {
    cleanDuration = "2-3 days";
  } else if (/\b(4[\s-]*7\s*(?:days|din)|four\s*(?:to|or|-)?\s*seven\s*days|4\s*(?:days|din)|5\s*(?:days|din)|6\s*(?:days|din)|7\s*(?:days|din)|week|hafta|ek hafta|chaar\s*se\s*saat\s*din|char\s*se\s*saat\s*din|char\s*din|chaar\s*din|paanch\s*din|panch\s*din|chheh\s*din|che\s*din|saat\s*din)\b/i.test(text)) {
    cleanDuration = "4-7 days";
  } else if (/\b(more than a week|two weeks|10 days|bahut din|several weeks)\b/i.test(text)) {
    cleanDuration = "More than a week";
  } else if (/\b(month|mahina|chronic|purani bimari)\b/i.test(text)) {
    cleanDuration = "More than a month";
  } else if (/\b(just|minutes|few minutes|achanak|sudden|< 2|< 1)\b/i.test(text)) {
    cleanDuration = "Less than 2 hours";
  } else if (detectedDuration && detectedDuration !== "Today") {
    cleanDuration = detectedDuration;
  }

  // 5. Extract Clean Severity (High, Moderate, Mild)
  let cleanSeverity = null;
  let severityScore = detectedSeverity || 5;

  if (/\b(very\s*mush|very\s*much|too\s*much|so\s*much|a\s*lot|lot\s*of\s*pain|bahut\s*zyada|bohot\s*zyada|bahut\s*jyada|bohot\s*jyada|bahut\s*tez|bohot\s*tez|unbearable|extreme|crushing|thunderclap|critical|emergency|intense|acute|drastic|asahyani|high|severe|severely|high\s*grade|>102|103|104|105|highest|worse|worst|tez|zyada|jyada)\b/i.test(text)) {
    cleanSeverity = "High";
    severityScore = 9;
  } else if (/\b(low|mild|mildly|little|a\s*little|a\s*bit|slight|slightly|minor|small|halka|halki|thoda|thodi|kam|halka\s*phulka|thoda\s*sa|low\s*grade|99|99\.5)\b/i.test(text)) {
    cleanSeverity = "Mild";
    severityScore = 3;
  } else if (/\b(medium|normal|moderate|moderately|in\s*between|middle|average|manageable|tolerable|bearable|thik\s*thak|theek\s*thaak|beech\s*ka|madhyam|so-so|soso|okay-okay|na\s*zyada\s*na\s*kam|100|101|102|intermittent)\b/i.test(text)) {
    cleanSeverity = "Moderate";
    severityScore = 6;
  } else {
    const numMatch = text.match(/\b([1-9]|10)\s*(?:\/\s*10)?\b/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      if (val >= 7) {
        cleanSeverity = "High";
        severityScore = val;
      } else if (val >= 4) {
        cleanSeverity = "Moderate";
        severityScore = val;
      } else {
        cleanSeverity = "Mild";
        severityScore = val;
      }
    }
  }

  // 6. Probing Answer Detection (Yes / No / specific answers - only for follow-up stages)
  let probingAnswer = null;
  if (currentStage !== "symptom") {
    if (/\b(ha|haan|yes|yep|present|hai|ji haan)\b/i.test(text)) {
      probingAnswer = "Affirmative (Yes)";
    } else if (!text.includes("not feeling well") && /\b(nahi|no|none|nahi hai|kuch nahi|not present)\b/i.test(text)) {
      probingAnswer = "Negative (No / None)";
    }
  }

  const isGeneralComplaint = /\b(not feeling well|feeling unwell|tabiyat kharab|bimar|bimaar|sick|unwell|takleef|problem|ill|pareshani|pain|dard)\b/i.test(text);

  // 7. Check if meaningful clinical content was found
  const hasClinicalContent = Boolean(
    primarySymptom ||
    companionSymptoms.length > 0 ||
    cleanSeverity ||
    cleanDuration ||
    probingAnswer ||
    isGeneralComplaint
  );

  // 8. Generate Clean Keywords string (strictly clinical keywords, NO conversational fluff)
  const parts = [];
  const effectivePrimarySymptom = currentTriage?.symptom || primarySymptom || null;

  if (effectivePrimarySymptom) {
    parts.push(effectivePrimarySymptom);
  } else if (isGeneralComplaint) {
    parts.push("General Health Complaint");
  }

  if (companionSymptoms.length > 0) {
    parts.push(`Accompanying: ${companionSymptoms.join(", ")}`);
  }

  if (cleanDuration) {
    parts.push(`Onset: ${cleanDuration}`);
  }

  if (cleanSeverity) {
    parts.push(`Severity: ${cleanSeverity}`);
  }

  const cleanKeywords = parts.length > 0
    ? parts.join(" · ")
    : effectivePrimarySymptom || (isGeneralComplaint ? "General Health Complaint" : "Clinical finding");

  return {
    hasClinicalContent,
    cleanKeywords,
    primarySymptom: effectivePrimarySymptom,
    companionSymptoms,
    detectedDuration: cleanDuration || null,
    detectedSeverity: cleanSeverity ? severityScore : null,
    cleanSeverity,
    domain,
    conditionLabel,
    probingAnswer,
  };
}

/**
 * Step 2: Validate and extract Severity answer.
 * Uses NLP to convert colloquial terms ("high", "medium", "normal", "low", "very much/mush", etc.)
 * into standardized severity language: "High", "Moderate", "Mild".
 */
export function detectSeverityAnswer(rawText = "", options = []) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  let label = null;
  let score = null;

  // 1. Direct match with any of the options
  for (const opt of options) {
    const optLow = opt.toLowerCase();
    if (optLow === lower || optLow.includes(lower) || (lower.length > 3 && optLow.startsWith(lower))) {
      if (/high|severe|crushing|extreme/i.test(opt)) {
        label = "High";
        score = 9;
      } else if (/mild|low/i.test(opt)) {
        label = "Mild";
        score = 3;
      } else if (/moderate|medium|intermittent/i.test(opt)) {
        label = "Moderate";
        score = 6;
      } else {
        label = opt;
        score = 6;
      }
      break;
    }
  }

  if (!label) {
    // 2. High severity keywords ("very much", "very mush", "too much", "high", "extreme", "severe", "bahut zyada", etc.)
    if (/\b(very\s*mush|very\s*much|too\s*much|so\s*much|a\s*lot|lot\s*of\s*pain|bahut\s*zyada|bohot\s*zyada|bahut\s*jyada|bohot\s*jyada|bahut\s*tez|bohot\s*tez|unbearable|extreme|crushing|thunderclap|critical|emergency|intense|acute|drastic|asahyani|high|severe|severely|high\s*grade|>102|103|104|105|highest|worse|worst|tez|zyada|jyada)\b/i.test(lower)) {
      label = "High";
      score = 9;
    }
    // 3. Mild keywords ("low", "mild", "little", "slight", "halka", "thoda", etc.)
    else if (/\b(low|mild|mildly|little|a\s*little|a\s*bit|slight|slightly|minor|small|halka|halki|thoda|thodi|kam|halka\s*phulka|thoda\s*sa|low\s*grade|99|99\.5)\b/i.test(lower)) {
      label = "Mild";
      score = 3;
    }
    // 4. Moderate keywords ("medium", "normal", "moderate", "in between", "thik thak", etc.)
    else if (/\b(medium|normal|moderate|moderately|in\s*between|middle|average|manageable|tolerable|bearable|thik\s*thak|theek\s*thaak|beech\s*ka|madhyam|so-so|soso|okay-okay|na\s*zyada\s*na\s*kam|100|101|102|intermittent)\b/i.test(lower)) {
      label = "Moderate";
      score = 6;
    }
    // 5. Numeric score e.g. "8/10", "8", "9/10", "7"
    else {
      const numMatch = lower.match(/\b([1-9]|10)\s*(?:\/\s*10)?\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 7) {
          label = "High";
          score = val;
        } else if (val >= 4) {
          label = "Moderate";
          score = val;
        } else {
          label = "Mild";
          score = val;
        }
      }
    }
  }

  if (!label) return null;

  return {
    label,
    score,
    toString: () => label,
    valueOf: () => label,
  };
}

/**
 * Step 3: Validate and extract Duration answer.
 * Returns clean duration string or null if not an answer to duration.
 */
export function detectDurationAnswer(rawText = "", options = []) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match with options
  for (const opt of options) {
    const optLow = opt.toLowerCase();
    if (optLow === lower || optLow.includes(lower) || (lower.length > 3 && optLow.startsWith(lower))) {
      return opt;
    }
  }

  // 2. Sudden / Less than 2 hours
  if (/\b(just|minutes|few minutes|achanak|sudden|< 2|< 1|2 hours|1 hour|aadha ghanta|ek ghanta|abhi|abhi abhi)\b/i.test(lower)) {
    return "Less than 2 hours";
  }

  // 3. Today / Morning
  if (/\b(today|aaj|morning|subah|from morning|since morning|subah se|aaj subah|few hours|kuch ghante)\b/i.test(lower)) {
    return "Today (A few hours)";
  }

  // 4. 1 day / Yesterday
  if (/\b(yesterday|kal|kal se|1 day|one day|24 hours|ek din)\b/i.test(lower)) {
    return "1 day (Started yesterday)";
  }

  // 5. 2-3 days
  if (/\b(2[\s-]*3\s*(?:days|din)|two\s*(?:to|or|-)?\s*three\s*days|2\s*(?:days|din)|3\s*(?:days|din)|two\s*days|three\s*days|do\s*se\s*teen\s*din|do\s*teen\s*din|do\s*din|teen\s*din|parso|parso\s*se)\b/i.test(lower)) {
    return "2-3 days";
  }

  // 6. 4-7 days
  if (/\b(4[\s-]*7\s*(?:days|din)|four\s*(?:to|or|-)?\s*seven\s*days|4\s*(?:days|din)|5\s*(?:days|din)|6\s*(?:days|din)|7\s*(?:days|din)|week|hafta|ek hafta|chaar\s*se\s*saat\s*din|char\s*se\s*saat\s*din|char\s*din|chaar\s*din|paanch\s*din|panch\s*din|chheh\s*din|che\s*din|saat\s*din)\b/i.test(lower)) {
    return "4-7 days";
  }

  // 7. More than a week
  if (/\b(more than a week|two weeks|10 days|bahut din|several weeks|do hafte)\b/i.test(lower)) {
    return "More than a week";
  }

  // 8. Month / Chronic
  if (/\b(month|mahina|chronic|purani bimari|months|mahine)\b/i.test(lower)) {
    return "More than a month";
  }

  // 9. Generic number of hours/days/weeks/months
  const genericMatch = lower.match(/\b(\d+)\s*(days?|din|hours?|ghante?|weeks?|hafte?|months?|mahine?)\b/i);
  if (genericMatch) {
    const num = parseInt(genericMatch[1], 10);
    const unit = genericMatch[2].toLowerCase();
    if (unit.startsWith("h") || unit.startsWith("g")) {
      return num <= 2 ? "Less than 2 hours" : "Today (A few hours)";
    }
    if (unit.startsWith("d") || unit.startsWith("din")) {
      if (num === 1) return "1 day (Started yesterday)";
      if (num <= 3) return "2-3 days";
      if (num <= 7) return "4-7 days";
      return "More than a week";
    }
    if (unit.startsWith("w")) {
      return num === 1 ? "4-7 days" : "More than a week";
    }
    return "More than a month";
  }

  return null;
}

/**
 * Step 4: Validate and extract Associated conditions answer.
 * Returns { isNone: boolean, items: string[] } or null if not a valid associated answer.
 */
export function detectAssociatedAnswer(rawText = "", options = [], companionSymptoms = []) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // 1. None / Negative confirmation
  if (/\b(none|nahi|no|nahi hai|kuch nahi|not present|nothing else|only this|sirf yahi|no other|none of these)\b/i.test(lower)) {
    return { isNone: true, items: ["None reported"] };
  }

  // 2. If companion symptoms already detected by NLP
  if (companionSymptoms && companionSymptoms.length > 0) {
    return { isNone: false, items: companionSymptoms };
  }

  // 3. Check if rawText matches any of the options chips (e.g. from clicking or typing chip text)
  const matched = [];
  for (const opt of options) {
    if (opt.toLowerCase().includes("none")) continue;
    if (lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower)) {
      matched.push(opt);
    }
  }
  if (matched.length > 0) {
    return { isNone: false, items: Array.from(new Set(matched)) };
  }

  // 4. Common companion symptom keywords
  const found = [];
  if (/\b(chill|chills|shivering|rigors|thand|kaanpna)\b/i.test(lower)) found.push("Chills / Shivering");
  if (/\b(vomit|vomiting|ulti|nausea|ji machlana)\b/i.test(lower)) found.push("Nausea / Vomiting");
  if (/\b(headache|sar dard|sir dard)\b/i.test(lower)) found.push("Headache");
  if (/\b(body ache|badan dard|joint pain)\b/i.test(lower)) found.push("Body Ache");
  if (/\b(dizziness|chakkar|fainting)\b/i.test(lower)) found.push("Dizziness");
  if (/\b(cough|khansi|cold|sardi)\b/i.test(lower)) found.push("Cough & Cold");
  if (/\b(breathless|saans phoolna)\b/i.test(lower)) found.push("Shortness of breath");
  if (/\b(weakness|kamzori|thakan)\b/i.test(lower)) found.push("Weakness / Body Pain");

  if (found.length > 0) {
    return { isNone: false, items: found };
  }

  return null;
}

