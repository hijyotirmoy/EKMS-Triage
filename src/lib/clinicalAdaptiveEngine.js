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
  ONCOLOGY: "oncology",
  DIABETES: "diabetes",
  RENAL: "renal",
  HEPATIC: "hepatic",
  INFECTIOUS: "infectious",
  NEUROLOGICAL: "neurological",
  ORTHOPEDIC: "orthopedic",
  SURGICAL: "surgical",
  GYNECOLOGY: "gynecology",
  DERMATOLOGY: "dermatology",
  DENTAL: "dental",
  PSYCHIATRIC: "psychiatric",
  VOMITING: "vomiting",
  LEG_PAIN: "leg_pain",
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
  [CLINICAL_DOMAINS.ONCOLOGY]: "Oncological Condition / Cancer Care",
  [CLINICAL_DOMAINS.DIABETES]: "Endocrine / Diabetes Fluctuation",
  [CLINICAL_DOMAINS.RENAL]: "Renal / Kidney / Urological Disorder",
  [CLINICAL_DOMAINS.HEPATIC]: "Hepato-Biliary / Jaundice / Liver Disease",
  [CLINICAL_DOMAINS.INFECTIOUS]: "Tropical / Acute Infectious Illness",
  [CLINICAL_DOMAINS.NEUROLOGICAL]: "Acute Neurological / Stroke / Seizure",
  [CLINICAL_DOMAINS.ORTHOPEDIC]: "Orthopedic / Joint / Musculoskeletal",
  [CLINICAL_DOMAINS.SURGICAL]: "Acute Surgical / Abdominal Condition",
  [CLINICAL_DOMAINS.GYNECOLOGY]: "Maternal / Gynecological Health",
  [CLINICAL_DOMAINS.DERMATOLOGY]: "Dermatological / Skin Disorder",
  [CLINICAL_DOMAINS.DENTAL]: "Dental / Oral Emergency",
  [CLINICAL_DOMAINS.PSYCHIATRIC]: "Mental Health / Crisis Assessment",
  [CLINICAL_DOMAINS.VOMITING]: "Acute Gastroenteritis / Vomiting Disorder",
  [CLINICAL_DOMAINS.LEG_PAIN]: "Lower Limb Distress / Deep Vein Thrombosis / Trauma",
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
    // If prompt is a stage answer (severity, medication, duration, etc.), retain established domain!
    const p = (allText || "").toLowerCase();
    const isStageAnswer =
      p.includes("high") ||
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
      p.includes("month") ||
      p.includes("med") ||
      p.includes("dawai") ||
      p.includes("medicine") ||
      p.includes("tablet") ||
      p.includes("paracetamol") ||
      p.includes("dolo") ||
      p.includes("crocin") ||
      p.includes("antibiotic") ||
      p.includes("painkiller") ||
      p.includes("yes") ||
      p.includes("no") ||
      p.includes("none") ||
      p.includes("nahi");

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

  // 2a. Vomiting / Acute Nausea / Gastroenteritis
  if (
    has(/\b(vomit|vomiting|ulti|throwing up|emesis|nausea|food poison)\b/i) &&
    !has(/\b(chest|chhati|heart|seena)\b/i)
  ) {
    return CLINICAL_DOMAINS.VOMITING;
  }

  // 2b. Leg Pain / Calf Pain / DVT / Lower Limb Distress
  if (
    has(/\b(leg pain|calf pain|thigh pain|pair dard|tang me dard|leg swell|swollen leg|dvt|put weight on|weight on leg|calf muscle|sciatica)\b/i)
  ) {
    return CLINICAL_DOMAINS.LEG_PAIN;
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

  // 13. Oncology / Cancer / Malignancy / Tumor / Chemotherapy
  if (
    has(/\b(cancer|tumor|tumour|oncolog|malignan|carcinoma|leukemia|lymphoma|chemo|chemotherapy|sarcoma|melanoma|metastasis|lump|biopsy|myeloma)\b/i)
  ) {
    return CLINICAL_DOMAINS.ONCOLOGY;
  }

  // 14. Endocrine / Diabetes / Sugar Crisis
  if (
    has(/\b(diabet|sugar|hypoglycem|hyperglycem|ketoacidosis|dka|insulin|glucometer)\b/i)
  ) {
    return CLINICAL_DOMAINS.DIABETES;
  }

  // 15. Renal / Kidney Stones / Urological / UTI
  if (
    has(/\b(kidney|renal|pathri|stone|dialysis|creatinine|urinary|urine|peshab|micturition|nephro|hematuria|bladder)\b/i)
  ) {
    return CLINICAL_DOMAINS.RENAL;
  }

  // 16. Hepato-Biliary / Jaundice / Liver Disease
  if (
    has(/\b(jaundice|peelia|hepat|liver|cirrhosis|bilirubin|sgpt|sgot|ascites)\b/i)
  ) {
    return CLINICAL_DOMAINS.HEPATIC;
  }

  // 17. Acute Tropical / Specific Infections (Dengue, Malaria, Typhoid, TB, Pneumonia)
  if (
    has(/\b(dengue|malaria|typhoid|tuberculosis|tb|pneumonia|cholera|chikungunya|sepsis|infection)\b/i)
  ) {
    return CLINICAL_DOMAINS.INFECTIOUS;
  }

  // 18. Acute Neurological / Stroke / Seizures / Paralysis
  if (
    has(/\b(stroke|paralysis|lakwa|seizure|mirgi|epilepsy|daura|fits|convulsion|unconscious|behoshi|coma|slurred speech|facial droop|neuropathy)\b/i)
  ) {
    return CLINICAL_DOMAINS.NEUROLOGICAL;
  }

  // 19. Orthopedic / Arthritis / Fractures / Severe Musculoskeletal
  if (
    has(/\b(arthritis|gathiya|fracture|haddi|bone|joint|sciatica|spondylitis|slip disc|sprain|ligament|kamar dard)\b/i)
  ) {
    return CLINICAL_DOMAINS.ORTHOPEDIC;
  }

  // 20. Acute Surgical / Appendicitis / Hernia
  if (
    has(/\b(appendix|appendicitis|hernia|gallstone|piles|bawasir|fistula|fissure|abscess|bowel obstruction)\b/i)
  ) {
    return CLINICAL_DOMAINS.SURGICAL;
  }

  // 21. Maternal / Pregnancy / Gynecological Health
  if (
    has(/\b(pregnant|pregnancy|garbh|delivery|labor pain|miscarriage|period|menstrual|bleeding per vagin|pv bleeding)\b/i)
  ) {
    return CLINICAL_DOMAINS.GYNECOLOGY;
  }

  // 22. Dermatological / Severe Skin Disorders / Skin Swelling & Infection
  if (
    has(/\b(swelling|skin swelling|sujan|soojan|edema|swollen|cellulitis|boil|abscess|blister|furuncle|psoriasis|eczema|fungal|ringworm|dad|khaj|twacha)\b/i)
  ) {
    return CLINICAL_DOMAINS.DERMATOLOGY;
  }

  // 23. Dental / Tooth Emergency
  if (
    has(/\b(tooth|teeth|dant|gum|dant dard|cavity|dental)\b/i)
  ) {
    return CLINICAL_DOMAINS.DENTAL;
  }

  // 24. Mental Health / Crisis
  if (
    has(/\b(depression|panic|anxiety|suicid|mental|psych|hallucination)\b/i)
  ) {
    return CLINICAL_DOMAINS.PSYCHIATRIC;
  }

  return CLINICAL_DOMAINS.GENERAL;
}

/**
 * Extracts severity rating (1-10) and duration string from conversational text
 */
export function extractSeverityAndDuration(allText = "") {
  const lower = allText.toLowerCase();

  // Duration Detection (Supports years, months, weeks, days, and small time frames / hours)
  let detectedDuration = null;

  // 1. Years Extraction (e.g. 2 years, 1 year, 5 years, 2 saal, ek saal, saalon se, chronic)
  const yearMatch = lower.match(/\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch)\s*(?:\+|-|\s)*)?(?:years?|yrs?|saal|sal)\b/i);
  if (yearMatch) {
    const rawVal = yearMatch[1] || "";
    const numMap = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", ek: "1", do: "2", teen: "3", char: "4", paanch: "5" };
    const num = numMap[rawVal.toLowerCase()] || rawVal || "1";
    detectedDuration = `${num} ${Number(num) === 1 ? "year" : "years"} (Chronic)`;
  } else if (/\b(since last year|pichle saal se|saalon se|for years|many years|several years)\b/i.test(lower)) {
    detectedDuration = "1+ years (Chronic)";
  }
  // 2. Months Extraction (e.g. 6 months, 3 months, 1 month, 2 mahine, pichle mahine se)
  else if (/\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhah)\s*(?:\+|-|\s)*)?(?:months?|mos?|mahine|mahina|maheene)\b/i.test(lower)) {
    const monthMatch = lower.match(/\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhah)\s*(?:\+|-|\s)*)?(?:months?|mos?|mahine|mahina|maheene)\b/i);
    const rawVal = monthMatch ? monthMatch[1] || "" : "";
    const numMap = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", ek: "1", do: "2", teen: "3", char: "4", paanch: "5", chhah: "6" };
    const num = numMap[rawVal.toLowerCase()] || rawVal || "1";
    detectedDuration = `${num} ${Number(num) === 1 ? "month" : "months"}`;
  } else if (/\b(since last month|pichle mahine se|few months)\b/i.test(lower)) {
    detectedDuration = "1-2 months";
  }
  // 3. Weeks Extraction (e.g. 3 weeks, 2 weeks, 1 week, do hafte, several weeks)
  else if (/\b(?:(\d+|one|two|three|four|ek|do|teen|char)\s*(?:\+|-|\s)*)?(?:weeks?|wks?|hafte|hafta)\b/i.test(lower)) {
    const weekMatch = lower.match(/\b(?:(\d+|one|two|three|four|ek|do|teen|char)\s*(?:\+|-|\s)*)?(?:weeks?|wks?|hafte|hafta)\b/i);
    const rawVal = weekMatch ? weekMatch[1] || "" : "";
    const numMap = { one: "1", two: "2", three: "3", four: "4", ek: "1", do: "2", teen: "3", char: "4" };
    const num = numMap[rawVal.toLowerCase()] || rawVal || "1";
    detectedDuration = `${num} ${Number(num) === 1 ? "week" : "weeks"}`;
  } else if (/\b(more than a week|ek hafte se|several weeks|10 days)\b/i.test(lower)) {
    detectedDuration = "1-2 weeks";
  }
  // 4. Days Range (e.g. 4-7 days, 2-3 days)
  else if (/\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:days?|din)\b/i.test(lower)) {
    const rangeMatch = lower.match(/\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:days?|din)\b/i);
    detectedDuration = `${rangeMatch[1]}-${rangeMatch[2]} days`;
  }
  // 5. Specific Days (e.g. 4 days, 3 days, 5 days, 2 days, 1 day)
  else if (/\b(\d+|one|two|three|four|five|six|seven|ek|do|teen|char|paanch)\s*(?:days?|din)\b/i.test(lower)) {
    const dayMatch = lower.match(/\b(\d+|one|two|three|four|five|six|seven|ek|do|teen|char|paanch)\s*(?:days?|din)\b/i);
    const rawVal = dayMatch[1];
    const numMap = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", ek: "1", do: "2", teen: "3", char: "4", paanch: "5" };
    const num = numMap[rawVal.toLowerCase()] || rawVal;
    detectedDuration = `${num} ${Number(num) === 1 ? "day" : "days"}`;
  } else if (/\b(kal se|yesterday|24 hours|ek din)\b/i.test(lower)) {
    detectedDuration = "1 day";
  }
  // 6. Hours & Small Time Frame / Acute Onset (e.g. 2-4 hours, 3 hours, 30 minutes, subah se, achanak)
  else if (/\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:hours?|hrs?|ghante)\b/i.test(lower)) {
    const hrRange = lower.match(/\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:hours?|hrs?|ghante)\b/i);
    detectedDuration = `${hrRange[1]}-${hrRange[2]} hours`;
  } else if (/\b(\d+)\s*(?:hours?|hrs?|ghante)\b/i.test(lower)) {
    const hrMatch = lower.match(/\b(\d+)\s*(?:hours?|hrs?|ghante)\b/i);
    detectedDuration = `${hrMatch[1]} ${Number(hrMatch[1]) === 1 ? "hour" : "hours"}`;
  } else if (/\b(\d+)\s*(?:minutes?|mins?|minute)\b/i.test(lower)) {
    const minMatch = lower.match(/\b(\d+)\s*(?:minutes?|mins?|minute)\b/i);
    detectedDuration = `${minMatch[1]} minutes`;
  } else if (
    lower.includes("less than 2 hours") ||
    lower.includes("< 2") ||
    lower.includes("< 30") ||
    lower.includes("just started") ||
    lower.includes("achanak") ||
    lower.includes("sudden")
  ) {
    detectedDuration = "Less than 2 hours";
  } else if (
    lower.includes("today") ||
    lower.includes("aaj") ||
    lower.includes("subah se") ||
    lower.includes("few hours")
  ) {
    detectedDuration = "Today (few hours)";
  }

  // Severity Detection (1-10)
  let detectedSeverity = null;
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
 * Returns disease-adaptive medication probing questions and selectable options.
 */
export function getMedicationQuestionData(domain, currentTriage = {}) {
  const activeCondition = currentTriage.symptom || "your condition";

  switch (domain) {
    case CLINICAL_DOMAINS.CARDIAC:
      return {
        agentScript:
          "Ask the IP: 'Are you taking any regular medications for blood pressure, heart, or blood thinners (Aspirin/Sorbitrate), or did you take any medicine for this chest discomfort?'",
        options: [
          "No medications taken",
          "Yes — Blood Pressure / Heart medicine (Sorbitrate / Aspirin)",
          "Yes — Acidity / Gas medicine (Antacid / Pantocid)",
          "Yes — Painkiller / Paracetamol",
          "Yes — Other regular daily medicines",
        ],
        probingQuestions: [
          "Kya emergency mein Sorbitrate (zubaan ke neeche) ya Aspirin li hai? (Did you take Sorbitrate sublingual or Aspirin?)",
          "Kya rozana BP ya cholesterol ki dawa chal rahi hai aur aaj li thi? (Are you on daily BP/cholesterol meds and did you take them today?)",
          "Kya dawai lene ke baad seene ke dard mein thoda aaram aaya? (Did the chest pain reduce after taking the medicine?)",
        ],
      };
    case CLINICAL_DOMAINS.RESPIRATORY:
      return {
        agentScript:
          "Ask the IP: 'Are you using any inhaler, nebulizer, asthalin, or taking any allergy/asthma medicines?'",
        options: [
          "No medications taken",
          "Yes — Inhaler / Puff (Asthalin / Budecort / Foracort)",
          "Yes — Nebulizer / Steam treatment",
          "Yes — Cough syrup / Antibiotics",
          "Yes — Allergy tablet (Cetirizine / Montair-LC)",
          "Yes — Other medicines",
        ],
        probingQuestions: [
          "Inhaler ke kitne puffs liye aur kya usse saans lene mein aaram mila? (How many puffs were taken and did breathing improve?)",
          "Kya regular asthma/allergy ki koi dawa rozana chalti hai? (Do you take daily maintenance inhalers or allergy pills?)",
          "Pichle 4 ghante mein koi cough syrup ya goli li hai? (Any cough syrup or oral tablet taken in last 4 hours?)",
        ],
      };
    case CLINICAL_DOMAINS.DIABETES:
      return {
        agentScript:
          "Ask the IP: 'Are you taking insulin injections or regular diabetes tablets (like Metformin), or did you take any sweet/glucose?'",
        options: [
          "No medications taken",
          "Yes — Insulin injection (Regular / Lantus)",
          "Yes — Diabetes tablets (Metformin / Glimepiride)",
          "Yes — Sugar / Glucose / Sweet juice taken",
          "Yes — Blood pressure or other regular meds",
        ],
        probingQuestions: [
          "Kya aaj subah insulin ya tablet li thi aur kya theek se khana khaya tha? (Did you take morning insulin/tablets and have a meal on time?)",
          "Kya chakkar aane par cheeni, gur ya meetha paani diya gaya? (Was sugar, jaggery, or sweet water given for dizziness?)",
          "Aakhri baar blood sugar kab aur kitna check kiya tha? (When and what was the last measured blood sugar reading?)",
        ],
      };
    case CLINICAL_DOMAINS.BP_CRISIS:
      return {
        agentScript:
          "Ask the IP: 'Are you taking regular high blood pressure medicines, and did you take your BP tablet today?'",
        options: [
          "No medications taken / Not diagnosed before",
          "Yes — Regular BP medicine taken today (Telmisartan / Amlodipine)",
          "Yes — Missed BP medicine for 1-2 days",
          "Yes — Emergency BP tablet (Clonidine / Sorbitrate)",
          "Yes — Other regular medications",
        ],
        probingQuestions: [
          "Kya aaj BP ki dawai time par li thi ya chhut gayi? (Did you take the BP pill on time today or miss it?)",
          "Kya doctor ne pehle se koi specific BP medicine likhi hai? (Which specific BP medicine has the doctor prescribed?)",
          "Kya koi nayi dawai ya dard ki goli (NSAID) li thi jisse BP badh gaya ho? (Any new medicine or painkiller taken that might spike BP?)",
        ],
      };
    case CLINICAL_DOMAINS.FEVER:
      return {
        agentScript:
          "Ask the IP: 'Have you taken Paracetamol (Crocin/Dolo) or any antibiotics for this fever?'",
        options: [
          "No medications taken",
          "Yes — Paracetamol / Dolo / Crocin 650mg",
          "Yes — Antibiotics (Amoxicillin / Azithromycin / Cefixime)",
          "Yes — Painkiller / Combiflam / Ibuprofen",
          "Yes — Cough / Cold / Antiallergic medicine",
        ],
        probingQuestions: [
          "Paracetamol lene ke kitni der baad bukhar kam hota hai? (How long after taking Paracetamol does fever come down?)",
          "Aakhri baar bukhar ki dawai kitne baje li thi? (What exact time was the last antipyretic dose taken?)",
          "Kya kisi dawai se pehle reaction ya allergy hui hai? (Any known drug allergy to sulfa or penicillin?)",
        ],
      };
    case CLINICAL_DOMAINS.ABDOMINAL:
      return {
        agentScript:
          "Ask the IP: 'Have you taken any antacid, gas medicine, painkiller, or ORS for this stomach problem?'",
        options: [
          "No medications taken",
          "Yes — Antacid / Gas medicine (Pantocid / Omez / Digene)",
          "Yes — Antispasmodic painkiller (Meftal-Spas / Cyclopam)",
          "Yes — ORS / Electrolyte solution / Electral",
          "Yes — Loose motions medicine (Norflox / Sporlac)",
          "Yes — Other medicines",
        ],
        probingQuestions: [
          "Dawai lene ke baad kya ulti ho gayi ya pet dard kam hua? (Did vomiting occur after taking medicine, or did cramps subside?)",
          "Kya patient ne ORS ghol ya nimbu-paani peena shuru kiya hai? (Has ORS or lemon-salt water hydration started?)",
          "Kya pehle se koi regular dawa (jaise BP, sugar ya arthritis) chal rahi hai? (Any daily chronic medications for BP, sugar, or arthritis?)",
        ],
      };
    case CLINICAL_DOMAINS.HEADACHE:
      return {
        agentScript:
          "Ask the IP: 'Have you taken any painkiller, migraine medicine, or BP tablet for this headache?'",
        options: [
          "No medications taken",
          "Yes — Painkiller (Paracetamol / Combiflam / Saridon)",
          "Yes — Migraine specific medicine (Vasograin / Rizatriptan)",
          "Yes — Blood pressure tablet",
          "Yes — Other regular medicines",
        ],
        probingQuestions: [
          "Kya dawai lene ke baad sar dard mein aaram aaya ya dard waise hi bana hua hai? (Did the headache improve or remain unchanged after medication?)",
          "Aap mahine mein kitni baar sar dard ke liye goli lete hain? (How frequently per month do you take headache pills?)",
          "Kya koi neend ya ghabrahat ki dawai chal rahi hai? (Any medication for anxiety or sleep?)",
        ],
      };
    case CLINICAL_DOMAINS.TRAUMA:
      return {
        agentScript:
          "Ask the IP: 'Have you taken any painkiller, antiseptic, or received a Tetanus (TT) injection for this injury?'",
        options: [
          "No medications / First aid not yet done",
          "Yes — Tetanus toxoid (TT) injection within last 6 months",
          "Yes — Painkiller taken (Paracetamol / Diclofenac / Tramadol)",
          "Yes — Antiseptic applied & bandage tied",
          "Yes — Blood thinner medicines (Aspirin / Clopidogrel / Warfarin)",
        ],
        probingQuestions: [
          "Pichle 5 saal mein kya Tetanus (TT) ka injection laga tha? (Was a Tetanus toxoid injection received in the last 5 years?)",
          "Kya patient khoon patla karne wali dawai (Aspirin/Blood thinner) lete hain? (Is the patient on blood thinners that increase bleeding risk?)",
          "Kya zakhm par koi antiseptic malham lagaya gaya hai? (Was any antiseptic ointment or dressing applied?)",
        ],
      };
    case CLINICAL_DOMAINS.PESTICIDE:
      return {
        agentScript:
          "Ask the IP: 'Was any first aid, antidote, vomiting induction, or water wash done after the chemical exposure?'",
        options: [
          "No first aid / No medicines given yet",
          "Yes — Thorough skin wash with soap & fresh clothes changed",
          "Yes — Patient made to vomit (Note: do not induce if drowsy)",
          "Yes — Given milk / charcoal / water to drink",
          "Yes — Immediate Atropine / emergency injection given at local clinic",
        ],
        probingQuestions: [
          "Kya patient ke kapde badal kar pure sharir ko sabun aur taaze paani se dhoya gaya? (Were clothes changed and entire body washed with soap and water?)",
          "Kya unhe koi gharelu cheez (doodh/tel) pilayi gayi? (Was any home remedy or fluid forcefully ingested?)",
          "Kya nazdeeki clinic mein koi injection (Atropine/Pralidoxime) lagaya gaya? (Was any antidote injection given at a local clinic?)",
        ],
      };
    case CLINICAL_DOMAINS.ONCOLOGY:
      return {
        agentScript:
          "Ask the IP: 'What oncology, chemotherapy, or pain medications (such as Tramadol or Morphine) are currently prescribed?'",
        options: [
          "No oncology medicines taken currently",
          "Yes — Prescribed cancer painkillers (Tramadol / Morphine / Fentanyl patch)",
          "Yes — Active chemotherapy tablets or recent IV chemo infusion",
          "Yes — Steroids / Antiemetic (Ondansetron / Dexamethasone)",
          "Yes — Antibiotics / Neutropenic prophylaxis",
          "Yes — Other routine medicines",
        ],
        probingQuestions: [
          "Aakhri baar chemotherapy ya immunotherapy session kab hua tha? (When was the last chemotherapy or immunotherapy cycle?)",
          "Kya prescribed painkiller lene se dard mein aaram mil raha hai? (Is the prescribed analgesic providing adequate pain relief?)",
          "Kya bukhar aane par doctor dwara batai gayi emergency antibiotic li gayi hai? (Was any emergency antibiotic taken for fever?)",
        ],
      };
    case CLINICAL_DOMAINS.RENAL:
      return {
        agentScript:
          "Ask the IP: 'Are you taking any kidney medicines, urine infection antibiotics, or pain relief tablets?'",
        options: [
          "No medications taken",
          "Yes — Painkiller / Antispasmodic for stone pain",
          "Yes — Urine infection antibiotic (Nitrofurantoin / Ciprofloxacin)",
          "Yes — Regular dialysis or kidney prescription",
          "Yes — Water pills / Diuretics (Torsemide / Furosemide)",
          "Yes — Blood pressure / diabetes medicines",
        ],
        probingQuestions: [
          "Kya kidney stones ke dard ke liye koi injection ya goli li hai? (Has any antispasmodic injection or tablet been taken for stone colic?)",
          "Kya patient regular dialysis par hain aur aakhri dialysis kab hua tha? (Is the patient on maintenance hemodialysis, and when was the last session?)",
          "Kya rozana chalne wali BP ya kidney ki dawa aaj li gayi thi? (Were regular BP or renal medications taken today?)",
        ],
      };
    default:
      return {
        agentScript:
          `Ask the IP: 'Are you currently taking any regular medications, or did you take any medicine for ${activeCondition}?'`,
        options: [
          "No medications taken",
          "Yes — Painkiller / Paracetamol",
          "Yes — Blood Pressure / Heart medicine",
          "Yes — Diabetes / Insulin",
          "Yes — Antibiotics or other prescribed medicine",
          "Yes — Other regular daily medicines",
        ],
        probingQuestions: [
          "Kya is takleef ke liye pichle 2-4 ghante mein koi dawai li hai aur uska naam kya hai? (Did you take any medicine in the last 2-4 hours, and what is its name?)",
          "Kya rozana chalne wali koi dawai (BP, Sugar, Thyroid) chhut gayi hai? (Did you miss any daily scheduled doses of BP/Sugar/Thyroid?)",
          "Kya kisi dawai se pehle allergy ya reaction hua tha? (Any known drug allergy or adverse reaction?)",
        ],
      };
  }
}

/**
 * Comprehensive Disease-Specific Clinical Probing Protocols (5 Steps per disease)
 * Guides the operator through detailed red flags, clinical character, hydration, and history
 * before completing intake.
 */
export function getDiseaseProbingProtocol(domain, currentTriage = {}) {
  const activeCondition = currentTriage.symptom || "your condition";

  switch (domain) {
    case CLINICAL_DOMAINS.VOMITING:
      return [
        {
          id: "vomit_q1",
          title: "Frequency & Duration",
          question: "When did the vomiting start, and roughly how many times has the patient vomited in the last few hours?",
          options: [
            "Started today — Vomited 1 to 2 times (Early stage)",
            "Started today — Frequent / continuous vomiting (>5 times, cannot stop)",
            "Started 1-2 days ago — Frequent episodes with nausea",
            "Ongoing for several days / intermittent episodes",
          ],
        },
        {
          id: "vomit_q2",
          title: "Content (Crucial)",
          question: "Is there any blood in the vomit, or does it look like dark coffee grounds?",
          options: [
            "Contains bright red blood or dark coffee-ground material (High Emergency)",
            "Greenish-yellow bile with intense bitter taste",
            "Clear stomach fluid, water, or undigested food",
            "No blood or black particles visible",
          ],
        },
        {
          id: "vomit_q3",
          title: "Associated Symptoms",
          question: "Is the patient experiencing severe abdominal pain, chest pain, or a high fever?",
          options: [
            "Severe acute abdominal pain / rigid cramping (Emergency)",
            "Chest pain, pressure, or palpitations",
            "High fever (>101°F) with chills and severe shivering",
            "Mild stomach discomfort / nausea only (No severe pain or fever)",
          ],
        },
        {
          id: "vomit_q4",
          title: "Hydration Status",
          question: "Are they able to keep small sips of water down, or are they bringing everything back up? When did they last pass urine?",
          options: [
            "Severe dehydration: Unable to keep even water/ORS down, no urine in 8+ hours",
            "Moderate: Vomits if eating solids, but keeping small sips of ORS/water",
            "Mild: Able to drink fluids and passed normal urine recently",
            "Feeling very dizzy / faint upon standing up",
          ],
        },
        {
          id: "vomit_q5",
          title: "Medical History",
          question: "Is the patient pregnant, diabetic, or currently taking any new medications?",
          options: [
            "Pregnant patient (Severe hyperemesis / morning sickness)",
            "Diabetic on insulin/tablets (Risk of DKA / ketoacidosis)",
            "Took anti-vomiting tablet (Ondansetron / Domperidone / Vomikind)",
            "Started drinking ORS / electrolyte water",
            "No pregnancy, diabetes, or medications taken",
          ],
        },
      ];

    case CLINICAL_DOMAINS.LEG_PAIN:
      return [
        {
          id: "leg_q1",
          title: "Trauma Check",
          question: "Did the patient fall, twist the leg, or have an accident? If so, are they completely unable to put any weight on it?",
          options: [
            "Recent trauma / fall / twist — Completely unable to put any weight on it (Suspected Fracture)",
            "Direct trauma / injury — Able to walk with moderate limp",
            "No trauma or accident — Pain started spontaneously",
            "Minor sports sprain / muscle pull",
          ],
        },
        {
          id: "leg_q2",
          title: "Clot/DVT Check (Critical)",
          question: "Is the pain mostly in the calf muscle? Is one leg suddenly swollen, red, and warm to the touch compared to the other?",
          options: [
            "One leg / calf is suddenly swollen, red, and warm to the touch (Critical DVT warning)",
            "Pain in calf muscle without swelling, redness, or heat",
            "Both legs equally swollen around ankles (Fluid retention / Edema)",
            "No calf swelling, redness, or heat",
          ],
        },
        {
          id: "leg_q3",
          title: "Circulation Check",
          question: "Is the painful leg or foot feeling very cold, numb, or turning pale or blue?",
          options: [
            "Painful leg / foot is feeling very cold, numb, or turning pale / blue (Vascular Emergency)",
            "Tingling / pins-and-needles sensation in foot or toes",
            "Normal warmth and healthy skin color in foot and toes",
            "Mild heaviness or throbbing in leg",
          ],
        },
        {
          id: "leg_q4",
          title: "Infection Check",
          question: "Does the patient also have a high fever along with a red, swollen area on the leg?",
          options: [
            "High fever along with an expanding red, swollen, hot area on leg (Cellulitis warning)",
            "Open cut, insect bite, or ulcer draining pus / fluid",
            "Mild rash or itch on leg without fever",
            "No fever, wound, or red swollen skin",
          ],
        },
        {
          id: "leg_q5",
          title: "Nerve/Chronic Check",
          question: "Is it a shooting pain that travels from the lower back down the leg, or is this a long-term joint pain (like arthritis)?",
          options: [
            "Shooting electric pain traveling from lower back down the leg (Sciatica / Slip Disc)",
            "Long-term knee or hip joint pain (Osteoarthritis / Gathiya)",
            "Severe nocturnal calf cramps after physical work",
            "Acute localized bone or muscle tenderness",
          ],
        },
      ];

    case CLINICAL_DOMAINS.CARDIAC:
      return [
        {
          id: "card_q1",
          title: "Pain Nature & Intensity",
          question: "How would you describe the chest pain? Is it a heavy crushing pressure, tightness, squeezing, or burning?",
          options: [
            "Heavy crushing pressure / squeezing weight on chest (High Emergency)",
            "Sharp stabbing pain that worsens on taking a deep breath",
            "Burning retrosternal sensation (Acid reflux / Acidity)",
            "Dull muscular ache across chest wall",
          ],
        },
        {
          id: "card_q2",
          title: "Pain Radiation",
          question: "Does the chest pain radiate or travel anywhere — such as to your left arm, shoulder, jaw, neck, or back?",
          options: [
            "Radiating to left arm, left shoulder, neck, or jaw (High Cardiac Red Flag)",
            "Radiating directly through to the back between shoulder blades",
            "Localized to one specific spot on chest (tender to touch)",
            "No radiation to arm, neck, or back",
          ],
        },
        {
          id: "card_q3",
          title: "Emergency Autonomic Red Flags",
          question: "Is there cold profuse sweating, shortness of breath, extreme dizziness, or nausea?",
          options: [
            "Cold profuse sweating with severe anxiety / clamminess (Red Flag)",
            "Severe breathlessness / gasping on lying flat",
            "Dizziness, lightheadedness, or feeling of passing out",
            "No cold sweating, severe breathlessness, or dizziness",
          ],
        },
        {
          id: "card_q4",
          title: "Onset & Duration",
          question: "When exactly did the chest pain start, and did it come on suddenly during rest or physical exertion?",
          options: [
            "Started less than 30 minutes ago (Acute sudden onset)",
            "1 to 2 hours ago (Persistent)",
            "Started today during physical work / walking",
            "Coming and going over past few days / weeks",
          ],
        },
        {
          id: "card_q5",
          title: "Medication & Medical History",
          question: "Have you taken Sorbitrate, Aspirin, or BP medicines, and is there any past history of heart attack, stent, or high BP?",
          options: [
            "Took Sorbitrate under tongue / Dispersible Aspirin",
            "Known heart patient (Previous stent / bypass / heart attack)",
            "Taking regular Blood Pressure / Diabetes medications",
            "Took antacid / gas tablet (pain did not relieve)",
            "No heart history and no medicines taken",
          ],
        },
      ];

    case CLINICAL_DOMAINS.FEVER:
      return [
        {
          id: "fev_q1",
          title: "Temperature & Shivering",
          question: "How high is the fever, and is it accompanied by severe chills, rigors, or uncontrollable shivering?",
          options: [
            "High Grade (>102°F) with intense chills & shivering (Kapkapi)",
            "Moderate fever (100.5°F - 102°F) with body ache",
            "Mild low-grade fever (99°F - 100°F) manageable",
            "Intermittent fever spikes coming and going in cycles",
          ],
        },
        {
          id: "fev_q2",
          title: "Red Flags & Neurological Check",
          question: "Is there any severe headache with stiff neck, photophobia, confusion, delirium, or red spots on the skin?",
          options: [
            "Stiff neck, severe headache, confusion, or light sensitivity (Meningitis warning)",
            "Red spots or bleeding from gums/nose (Dengue hemorrhagic warning)",
            "Extreme drowsiness or fainting upon standing",
            "No neck stiffness, confusion, or skin rashes",
          ],
        },
        {
          id: "fev_q3",
          title: "Duration & Onset",
          question: "How many days has the fever been present, and is anyone else sick in your family or locality?",
          options: [
            "Started today (Sudden high spike)",
            "Past 2 - 3 days (Continuous)",
            "Past 4 - 7 days (Persistent high fever)",
            "More than a week / recurring fever",
          ],
        },
        {
          id: "fev_q4",
          title: "Medication Response",
          question: "Have you taken Paracetamol (Crocin/Dolo) or any antibiotics for this fever, and did the fever come down?",
          options: [
            "Took Paracetamol / Dolo 650mg — fever did not come down",
            "Took Paracetamol / Dolo 650mg — fever reduced temporarily",
            "Taking prescribed antibiotics / other medicines",
            "No medications taken yet",
          ],
        },
        {
          id: "fev_q5",
          title: "Associated Symptoms",
          question: "Are you experiencing productive cough, burning urination, repeated vomiting, or severe loose motions?",
          options: [
            "Persistent vomiting and unable to retain water/ORS",
            "Burning sensation and pain during urination (UTI)",
            "Chest congestion with yellow/green phlegm (Pneumonia)",
            "Severe body and joint pain without other symptoms",
            "None of these companion symptoms",
          ],
        },
      ];

    case CLINICAL_DOMAINS.ABDOMINAL:
      return [
        {
          id: "abd_q1",
          title: "Location & Pain Character",
          question: "Where is the abdominal pain located, and is it sharp, cramping/colicky, or a constant dull ache?",
          options: [
            "Right lower abdomen pain (Appendicitis warning)",
            "Upper center / right upper stomach pain radiating to back (Gallbladder/Gastric)",
            "Severe cramping pain coming and going in waves (Colic / Obstruction)",
            "Generalized diffuse abdominal discomfort",
          ],
        },
        {
          id: "abd_q2",
          title: "Peritoneal & Rigidity Check",
          question: "Is the abdomen rigid/hard like a board, and does the pain get unbearable when walking, coughing, or pressing gently?",
          options: [
            "Abdomen is rock-hard, rigid, and agonizing on gentle touch (Acute Peritonitis)",
            "Pain worsens noticeably with every cough, bump, or step",
            "Abdomen is soft to touch despite pain",
            "Bloated feeling with excess gas",
          ],
        },
        {
          id: "abd_q3",
          title: "Bowel & Obstruction Check",
          question: "Have you had repeated vomiting, blood in vomit, inability to pass gas or stool, or dark black tarry stools?",
          options: [
            "Unable to pass gas or stool with repeated vomiting (Bowel Obstruction)",
            "Blood in vomit or dark black tarry stool (Bleeding GI warning)",
            "Watery loose motions / diarrhea multiple times",
            "Normal bowel movements and passing gas easily",
          ],
        },
        {
          id: "abd_q4",
          title: "Duration & Progression",
          question: "When did the stomach pain start, and has it become progressively worse in the last few hours?",
          options: [
            "Started suddenly <4 hours ago (Acute severe pain)",
            "Started today — progressively getting worse",
            "Started 1 to 2 days ago",
            "Long-standing recurrent stomach pain",
          ],
        },
        {
          id: "abd_q5",
          title: "Medication & Hydration",
          question: "Have you taken any antacid, painkiller (Meftal/Cyclopam), or ORS, and are you able to retain fluids?",
          options: [
            "Took antacid / Pantocid / Digene (No relief)",
            "Took antispasmodic painkiller (Meftal-Spas / Cyclopam)",
            "Able to drink water and ORS",
            "Cannot drink anything — throws up immediately",
            "No medicines taken",
          ],
        },
      ];

    case CLINICAL_DOMAINS.RESPIRATORY:
      return [
        {
          id: "resp_q1",
          title: "Breathing Effort & Speech",
          question: "Can the patient speak full sentences without gasping, or are they struggling for breath at rest?",
          options: [
            "Cannot speak more than 2 words without gasping for air (High Emergency)",
            "Can speak short sentences with noticeable breathlessness",
            "Short of breath only when walking or climbing stairs",
            "Breathing normally at rest, but persistent cough",
          ],
        },
        {
          id: "resp_q2",
          title: "Cyanosis & Wheezing Check",
          question: "Are the lips, tongue, or fingertips turning bluish, or is there loud audible wheezing or whistling from the chest?",
          options: [
            "Lips or fingertips are turning blue/gray (Cyanosis Emergency)",
            "Audible wheezing or whistling sound during breathing",
            "Noisy stridor / harsh sound in throat when breathing in",
            "No blue color, wheezing, or stridor",
          ],
        },
        {
          id: "resp_q3",
          title: "Onset & Triggers",
          question: "Did the breathing trouble start suddenly (asthma attack/allergy) or build up over days with cough and cold?",
          options: [
            "Sudden acute attack (<1 hour) after dust/cold air/allergen",
            "Started today and progressively getting harder to breathe",
            "Building up over 2-3 days with wet cough and phlegm",
            "Chronic long-term shortness of breath (COPD/Asthma)",
          ],
        },
        {
          id: "resp_q4",
          title: "Inhaler & Medication Check",
          question: "Has the patient used an inhaler (Asthalin/Budecort), nebulizer, or taken any breathing medicines?",
          options: [
            "Used inhaler / nebulizer — No relief in breathing",
            "Used inhaler — Partial relief, but still breathless",
            "Has regular asthma/COPD inhaler, but ran out",
            "No inhaler or breathing medicines available",
          ],
        },
        {
          id: "resp_q5",
          title: "Cardiac & Infection Red Flags",
          question: "Is there severe chest pain, high fever with green phlegm, or sudden swelling in both feet/ankles?",
          options: [
            "Chest tightness or chest pain accompanying breathlessness",
            "High fever with thick yellow/green phlegm or coughing blood",
            "Both ankles/feet swollen (Congestive heart failure warning)",
            "Dry hacking cough without fever or chest pain",
            "None of these companion symptoms",
          ],
        },
      ];

    case CLINICAL_DOMAINS.HEADACHE:
      return [
        {
          id: "head_q1",
          title: "Onset & Severity",
          question: "Did the headache hit suddenly like a thunderclap (worst headache of life) or has it been a throbbing ache?",
          options: [
            "Sudden thunderclap onset — Worst headache of my life (Emergency SAH)",
            "Severe throbbing one-sided pain with sensitivity to light (Migraine)",
            "Constant band-like tightness around forehead and neck (Tension)",
            "Mild to moderate dull ache",
          ],
        },
        {
          id: "head_q2",
          title: "FAST Neurological Check",
          question: "Is there any facial droop, arm weakness or numbness, slurred speech, or sudden vision loss?",
          options: [
            "Sudden facial droop, arm weakness, or slurred speech (FAST Positive Emergency)",
            "Sudden loss of vision or double vision in one or both eyes",
            "Tingling or numbness in fingertips/face",
            "No weakness, facial droop, or speech difficulty",
          ],
        },
        {
          id: "head_q3",
          title: "Meningitis & Increased ICP Check",
          question: "Is there a high fever with painful stiff neck (unable to touch chin to chest), or projectile vomiting?",
          options: [
            "High fever with severe stiff neck and sensitivity to light (Meningitis warning)",
            "Repeated projectile vomiting without nausea",
            "Mild nausea without vomiting or fever",
            "No fever, stiff neck, or vomiting",
          ],
        },
        {
          id: "head_q4",
          title: "Duration & Head Trauma",
          question: "How long has this headache lasted, and was there any recent head injury, fall, or accident?",
          options: [
            "Started within last 1 to 2 hours (Acute)",
            "Recent head trauma, fall, or blow to the head",
            "Started 1 to 2 days ago",
            "Recurrent chronic headache over several months",
          ],
        },
        {
          id: "head_q5",
          title: "Medication & Blood Pressure",
          question: "Have you taken any painkiller (Paracetamol/Combiflam) or BP medicine, and what was your last BP reading?",
          options: [
            "Took painkiller (Paracetamol/Saridon/Combiflam) — No relief",
            "Known high BP patient — BP was elevated today (>160/100)",
            "Took migraine specific medication (Vasograin/Triptan)",
            "Normal blood pressure / Not checked",
            "No medications taken",
          ],
        },
      ];

    case CLINICAL_DOMAINS.DERMATOLOGY:
      return [
        {
          id: "derm_q1",
          title: "Infection & Cellulitis Check",
          question: "Is the skin swelling bright red, hot to touch, throbbing, or spreading rapidly in size?",
          options: [
            "Bright red, hot to touch, throbbing & spreading rapidly (Cellulitis warning)",
            "Localized boil / abscess with pus formation and throbbing pain",
            "Moderate localized swelling without heat or spreading redness",
            "Mild painless swelling / bump",
          ],
        },
        {
          id: "derm_q2",
          title: "Airway & Anaphylaxis Check",
          question: "Is there any swelling on the lips, face, eyelids, or tongue, or difficulty in swallowing or breathing?",
          options: [
            "Swelling of lips, tongue, or face with breathing difficulty (Anaphylaxis Emergency)",
            "Widespread itchy hives / red welts across whole body",
            "Swelling localized only to arm, leg, hand, or foot",
            "No facial or throat swelling and breathing is completely normal",
          ],
        },
        {
          id: "derm_q3",
          title: "Wound & Trigger Check",
          question: "Is there an open cut, insect/bee sting, or an abscess draining pus or foul-smelling fluid?",
          options: [
            "Abscess or wound actively draining pus, yellow fluid, or blood",
            "Started after an insect bite, bee sting, or garden exposure",
            "Followed a cut, puncture wound, or scrape at work",
            "Intact skin with no visible cuts, bites, or fluid drainage",
          ],
        },
        {
          id: "derm_q4",
          title: "Duration & Spread",
          question: "When did the swelling or rash first appear, and has it grown larger in the last few hours or days?",
          options: [
            "Started suddenly today (<6 hours) and expanding rapidly",
            "Started 1 to 2 days ago — progressively increasing",
            "Persisting for 3 to 7 days",
            "Chronic lesion present for weeks",
          ],
        },
        {
          id: "derm_q5",
          title: "Fever & Medication Check",
          question: "Is there high fever with shivering, and have you taken any antiallergic, painkiller, or antibiotic?",
          options: [
            "High fever (>101°F) with shivering (Systemic infection warning)",
            "Took antiallergic medicine (Cetirizine / Avil / Allegra)",
            "Took painkiller or antibiotic",
            "Applied antiseptic ointment or ice pack",
            "No fever and no medicines taken",
          ],
        },
      ];

    case CLINICAL_DOMAINS.TRAUMA:
      return [
        {
          id: "trauma_q1",
          title: "Accident Location, Time & Mechanism",
          question: "Where did the accident occur, at what exact time, and what happened (road traffic collision, workplace machinery, or high fall)?",
          options: [
            "Road traffic collision on highway / road — Fresh accident (<30 mins)",
            "Workplace / factory machine accident — Fresh injury (<1 hour)",
            "Fall from height / roof / construction scaffolding",
            "Severe domestic accident / blunt trauma",
          ],
        },
        {
          id: "trauma_q2",
          title: "Casualty Count & Entrapment",
          question: "How many casualties / people are injured, and is anyone trapped inside a vehicle or under machinery?",
          options: [
            "Multiple casualties (>2 victims injured) — Multiple ambulances required",
            "Single victim — Critically injured / trapped / unconscious",
            "Single victim — Conscious with bleeding / fracture",
            "Minor casualties — Alert and out of danger",
          ],
        },
        {
          id: "trauma_q3",
          title: "Bleeding & Wound Severity",
          question: "Is there active spurting bleeding that does not stop with direct pressure, or a deep open wound?",
          options: [
            "Active severe bleeding / Spurting blood (High Trauma Emergency)",
            "Deep cut / laceration with heavy blood loss",
            "Severe crush injury or amputated digit/finger",
            "Minor surface scrape or abrasion with stopped bleeding",
          ],
        },
        {
          id: "trauma_q4",
          title: "Bone & Deformity Check",
          question: "Is there visible bone deformity, bone piercing skin (open fracture), or complete inability to move limb?",
          options: [
            "Visible bone deformity or bone protruding through skin (Open Fracture)",
            "Severe pain and inability to bear weight or move limb",
            "Swelling and tenderness, but able to move fingers/toes",
            "No bone deformity or inability to move",
          ],
        },
        {
          id: "trauma_q5",
          title: "Head & Spine Injury Check",
          question: "Was there a blow to the head, loss of consciousness, confusion, vomiting, or severe neck/spine pain?",
          options: [
            "Loss of consciousness, amnesia, or repeated vomiting (Head Trauma)",
            "Severe neck or spine pain (Do not move patient)",
            "Mild headache without dizziness or loss of consciousness",
            "No head, neck, or spine impact",
          ],
        },
      ];

    case CLINICAL_DOMAINS.PSYCHIATRIC:
      return [
        {
          id: "psych_q1",
          title: "Emotional Distress & Cause",
          question: "What has happened that is causing you so much pain or distress, and when did this feeling begin? (Hindi: क्या बात आपको बहुत परेशान कर रही है?)",
          options: [
            "Severe overwhelming stress / sudden personal crisis",
            "Deep ongoing depression and feeling empty inside",
            "Severe panic, fast heartbeat, and extreme fear / anxiety",
            "Workplace harassment or family conflict",
          ],
        },
        {
          id: "psych_q2",
          title: "Safety & Self-Harm Screening",
          question: "Are you feeling completely hopeless, or have you had thoughts of hurting yourself or ending your life? (Hindi: क्या मन में खुद को नुकसान पहुँचाने का विचार आया है?)",
          options: [
            "Active thoughts of self-harm or suicide (Immediate Crisis)",
            "Feeling exhausted and hopeless, but no wish to harm myself",
            "Severe sadness and crying, needing someone to listen",
            "High anxiety without thoughts of self-harm",
          ],
        },
        {
          id: "psych_q3",
          title: "Emotional Symptoms & Sleep",
          question: "Are you crying continuously, unable to sleep, or finding it difficult to eat or breathe calmly?",
          options: [
            "Continuous crying and feeling broken down",
            "Severe insomnia (no sleep for days) and no appetite",
            "Panic attacks with shaking hands and chest tightness",
            "Difficulty concentrating or talking to anyone",
          ],
        },
        {
          id: "psych_q4",
          title: "Support System & Surroundings",
          question: "Is someone with you right now, or are you alone? Can you sit somewhere safe and calm?",
          options: [
            "I am completely alone right now",
            "Family member or friend is nearby at home",
            "At workplace / factory floor",
            "Sitting in a quiet, safe space",
          ],
        },
        {
          id: "psych_q5",
          title: "Counseling & Tele-MANAS Referral",
          question: "We care about your safety. Can we immediately connect you to our Psychological Counselling Department and National Tele-MANAS (14416)?",
          options: [
            "Yes, please connect me to a counselor right now",
            "Yes, please forward this call to the mental health team",
            "I just want someone to listen to me for a few minutes",
            "I will talk to my family first",
          ],
        },
      ];

    default:
      return [
        {
          id: "gen_q1",
          title: "Severity & Daily Function",
          question: `Regarding ${activeCondition}, how severe is the distress right now — is it unbearable, moderate, or mild?`,
          options: [
            "High / Severe distress — Unable to perform normal activities or resting in bed",
            "Moderate distress — Significant pain or discomfort but manageable",
            "Mild distress — Early stage symptoms / Seeking guidance",
            `Urgent specialist opinion needed for ${activeCondition}`,
          ],
        },
        {
          id: "gen_q2",
          title: "Emergency Red Flags Check",
          question: "Are you experiencing any shortness of breath, chest pain, high fever, or dizziness with this condition?",
          options: [
            "Shortness of breath or chest pain",
            "High fever with severe shivering",
            "Extreme dizziness or feeling faint",
            "No breathing difficulty, chest pain, or high fever",
          ],
        },
        {
          id: "gen_q3",
          title: "Duration & Onset",
          question: "How long have you had this condition, and did it start suddenly or develop gradually?",
          options: [
            "Started today (Sudden / Recent)",
            "Past 2 - 3 days",
            "Past 4 - 7 days",
            "More than a week / chronic",
          ],
        },
        {
          id: "gen_q4",
          title: "Medication & Treatment",
          question: "Have you taken any prescription medicines, painkillers, or home remedies for this, and did they provide relief?",
          options: [
            "Took painkiller / OTC medicine — Temporary or no relief",
            "Taking regular prescription medicines (BP, Sugar, etc.)",
            "Tried home remedies without improvement",
            "No medications taken yet",
          ],
        },
        {
          id: "gen_q5",
          title: "Associated Health Difficulties",
          question: "Are you having difficulty eating, drinking fluids, sleeping, or walking comfortably?",
          options: [
            "Unable to eat or drink fluids normally",
            "Difficulty walking or bearing weight",
            "Disturbed sleep due to continuous pain",
            "Able to eat, drink, and move comfortably",
          ],
        },
      ];
  }
}

/**
 * Generates 3 distinct, disease-specific clinical probing questions.
 * Each question has its own tailored set of 4-5 selectable answers that appear directly below it.
 */
export function getDiseaseProbingQuestions(domain, currentTriage = {}, stage = "severity") {
  return getDiseaseProbingProtocol(domain, currentTriage);
}

/**
 * Returns condition-specific, step-specific data:
 * - agentScript
 * - options
 * - probingQuestions (Hindi + English)
 * - isMultiSelect
 */
function _internalGetClinicalQuestionData({
  domain,
  stage,
  prompt = "",
  history = [],
  currentTriage = {},
}) {
  const diseaseProbing = getDiseaseProbingQuestions(domain, currentTriage, stage);
  const activeCondition = currentTriage.symptom || "your condition";

  if (stage === "complete") {
    return {
      agentScript:
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."',
      options: [],
      probingQuestions: [],
      probingQuestionsWithAnswers: [],
      isComplete: true,
    };
  }

  if (stage === "medication") {
    const medData = getMedicationQuestionData(domain, currentTriage);
    return {
      ...medData,
      probingQuestionsWithAnswers: diseaseProbing,
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
    // ONCOLOGY (Cancer / Tumor / Chemotherapy)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.ONCOLOGY: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Which type or stage of cancer is diagnosed, and how severe is the current distress (such as unbearable pain, chemo fever, or severe vomiting)?'",
          options: [
            "High / Unbearable pain (Immediate pain relief needed)",
            "High fever (>101°F) during chemotherapy (Neutropenic emergency)",
            "Severe breathlessness / Inability to retain food",
            "Moderate pain / Ongoing oncology care",
            "Mild / Seeking ESIS referral & routine prescription",
          ],
          probingQuestions: [
            "Kya chemotherapy chal rahi hai aur pichle 2-3 dino mein tez bukhar aaya hai? (Is patient on active chemotherapy with fever?)",
            "Kya dard ki dawai (Painkiller/Morphine) se aaram mil raha hai? (Is breakthrough pain relieved by prescribed analgesics?)",
            "Kya munh ya mal ke raste khoon aa raha hai? (Any bleeding from mouth, vomit, or stool?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne din se yeh takleef zyada badh gayi hai? (When did these acute cancer-related symptoms or pain worsen?)'",
          options: [
            "Less than 2 hours (Sudden acute flare / Crisis)",
            "Today (Since morning)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya patient chal-phir pa rahe hain ya bilkul bistar par hain? (Is caller bedbound or ambulatory?)",
            "Pichla chemo ya radiation session kab hua tha? (When was the last chemotherapy or radiation session?)",
            "Kya ESIC tie-up hospital mein regular oncologist se contact hua hai? (Have they consulted their treating oncologist?)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion complications? (Select all that apply)'",
          options: [
            "High fever with chills (Chemo risk)",
            "Bleeding from mouth, vomit or stool",
            "Severe dehydration / Continuous vomiting",
            "Severe weakness / Unable to walk",
            "Extreme bone or body ache",
            "None of these",
          ],
          probingQuestions: [
            "Kya platelet ya hemoglobin bohot kam hone ki history hai? (Any recent lab report showing severe anemia or low platelets?)",
            "Kya dehydration ke lakshan hain? (Are there signs of severe dehydration?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // DIABETES (Blood Sugar / DKA)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.DIABETES: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How high or low is the blood sugar level, and are there signs like confusion, heavy sweating, or drowsiness?'",
          options: [
            "Very High Sugar (>300 mg/dL) with drowsiness / rapid breathing (DKA risk)",
            "Critically Low Sugar (<60 mg/dL) with shaking & cold sweat (Hypoglycemia)",
            "Moderate elevation (180-250 mg/dL) with excess thirst/urination",
            "Mild / Routine diabetic follow-up",
          ],
          probingQuestions: [
            "Kya glucometer se abhi sugar check ki gayi hai? (What was the exact glucometer reading?)",
            "Kya patient behosh ho rahe hain ya baat samajh pa rahe hain? (Is patient conscious and coherent?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne der ya dino se sugar fluctuate ho rahi hai? (How long have you had this sugar issue or symptoms?)'",
          options: [
            "Less than 2 hours (Sudden collapse / Tremors)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya insulin ya diabetic dawai time par li gayi thi? (Was regular insulin or oral medication taken?)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Confusion or unresponsiveness",
            "Rapid deep breathing with fruity odor",
            "Continuous vomiting / Can't take oral insulin",
            "Non-healing foot wound / Ulcer",
            "Blurry vision / Extreme dizziness",
            "None of these",
          ],
          probingQuestions: [
            "Kya pairon mein koi zakham ya sujan hai? (Any non-healing diabetic foot ulcer or cellulitis?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // RENAL (Kidney Stone / Flank Pain / UTI)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.RENAL: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'How intense is the kidney or back pain, and can you pass urine normally?'",
          options: [
            "Severe unbearable flank colic radiating to groin",
            "Complete inability to pass urine (Acute urinary retention)",
            "Severe burning with high fever & chills (Pyelonephritis)",
            "Moderate dull aching flank/back pain",
            "Mild burning during urination",
          ],
          probingQuestions: [
            "Kya pishab mein laal rang ka khoon (hematuria) dikh raha hai? (Is visible blood present in urine?)",
            "Kya pichle 12 ghante se pishab bilkul band hai? (Has there been complete anuria for >12 hours?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kab se yeh pet ya kamar dard aur peshab mein takleef ho rahi hai? (When did the kidney/urinary symptoms start?)'",
          options: [
            "Less than 2 hours (Sudden excruciating colic)",
            "Today (Started few hours ago)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: [
            "Pehle kabhi pathri (kidney stone) ya sonography karwayi thi? (Any prior ultrasound or history of renal calculi?)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Visible red blood in urine (Hematuria)",
            "High fever with violent shivering",
            "Persistent vomiting / Nausea",
            "Swelling in feet and face (Edema)",
            "Known history of kidney stones (Pathri)",
            "None of these",
          ],
          probingQuestions: [
            "Kya chehre ya pairo par sujan hai? (Is there facial puffiness or pedal edema?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // HEPATIC / TROPICAL (Jaundice / Liver / Dengue / Malaria)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.HEPATIC:
    case CLINICAL_DOMAINS.INFECTIOUS: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Is there yellowing of eyes, dark urine, or high fever with intense shivering or abdominal swelling?'",
          options: [
            "Severe jaundice with confusion / drowsiness (Acute liver failure risk)",
            "High grade fever (>102°F) with shivering & bleeding spots (Dengue/Malaria)",
            "Moderate yellow eyes/skin with nausea & loss of appetite",
            "Mild yellowing / Early onset symptoms",
          ],
          probingQuestions: [
            "Kya patient behki baatein kar rahe hain ya neend bohot zyada aa rahi hai? (Signs of hepatic encephalopathy?)",
            "Kya masoodon ya naak se khoon aa raha hai? (Any bleeding tendencies?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kitne dino se peelia ya bukhar ki shikayat hai? (How many days has jaundice or fever lasted?)'",
          options: [
            "Less than 2 hours (Sudden onset)",
            "Today (A few hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days (Progressive worsening)",
            "More than a week",
          ],
          probingQuestions: [
            "Kya pichle 2 dino mein LFT ya CBC report karwayi hai? (Any recent liver function or platelet test?)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Dark yellow/cola-colored urine",
            "Severe right side abdominal pain (Liver area)",
            "Bleeding from nose, gums, or skin spots",
            "Swollen belly / Fluid accumulation (Ascites)",
            "Clay-colored pale stool",
            "None of these",
          ],
          probingQuestions: [
            "Kya pet mein paani bharne (ascites) jaisi sujan hai? (Is there abdominal distension?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // NEUROLOGICAL (Stroke / Seizure / Paralysis)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.NEUROLOGICAL: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Is there sudden facial droop, arm weakness, slurred speech, active seizure, or loss of consciousness?'",
          options: [
            "High Emergency: Sudden face droop / Arm weakness / Slurred speech",
            "High Emergency: Active seizure / Fits / Unconscious",
            "Severe thunderclap headache with vomiting",
            "Moderate weakness / Dizziness / Tingling",
            "Mild numbness / Manageable",
          ],
          probingQuestions: [
            "Kya patient muskurane par chehra tedha ho raha hai ya dono haath uthane par ek gir raha hai? (FAST test positive?)",
            "Kya daura padte waqt munh se jhaag ya aankhen upar hui thi? (Any frothing or tonic-clonic convulsions?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Yeh lakshan kitne baje ya kitni der pehle shuru hue? (Exactly when did the neurological weakness or seizure occur?)'",
          options: [
            "Less than 30 minutes (Golden Window)",
            "1 to 3 hours (Urgent Thrombolysis Window)",
            "Today (3 to 6 hours)",
            "1 day (Started yesterday)",
            "2-3 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya turant CT scan aur emergency hospital le jane ki tayyari hai? (Immediate emergency hospital transfer needed!)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Loss of vision or double vision",
            "Inability to speak or understand words",
            "Loss of bladder/bowel control",
            "Difficulty swallowing or choking",
            "Confusion or memory loss",
            "None of these",
          ],
          probingQuestions: [
            "Kya pehle kabhi lakwa ya daure ki shikayat rahi hai? (Any past history of TIA, stroke, or epilepsy?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // ORTHOPEDIC / SURGICAL (Fracture / Severe Arthritis / Appendicitis / Hernia)
    // -------------------------------------------------------------------------
    case CLINICAL_DOMAINS.ORTHOPEDIC:
    case CLINICAL_DOMAINS.SURGICAL: {
      if (stage === "severity") {
        return {
          agentScript:
            "Ask the IP: 'Can the patient bear weight or move the limb, or is there rigid acute abdominal tenderness / painful bulge?'",
          options: [
            "Severe unbearable pain / Visible bone fracture / Unable to walk",
            "Severe sharp localized abdominal pain (Appendicitis / Strangulated Hernia)",
            "Moderate swelling and movement pain",
            "Mild ache / Discomfort",
          ],
          probingQuestions: [
            "Kya haddi twacha se bahar aa gayi hai (Open fracture)? (Any open bone protrusion?)",
            "Kya pet pathar jaisa katha ho gaya hai? (Is abdomen rigid and board-like?)",
          ],
        };
      }
      if (stage === "duration") {
        return {
          agentScript:
            "Ask the IP: 'Kab se yeh dard ya takleef hai? (When did this acute injury or pain start?)'",
          options: [
            "Less than 2 hours (Sudden trauma / Colic)",
            "Today (Started a few hours ago)",
            "1 day (Started yesterday)",
            "2-3 days",
            "4-7 days",
            "More than a week",
          ],
          probingQuestions: [
            "Kya chot lagne ke baad turant sujan aa gayi thi? (Did rapid swelling occur post-injury?)",
          ],
        };
      }
      if (stage === "associated") {
        return {
          agentScript:
            "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'",
          options: [
            "Numbness or coldness in fingers/toes",
            "Visible bone deformity or inability to move limb",
            "High fever with shivering",
            "Continuous vomiting and unable to pass gas",
            "None of these",
          ],
          probingQuestions: [
            "Kya pairo ki ungliyon mein samvedna mehsoos ho rahi hai? (Any neurovascular deficit?)",
          ],
        };
      }
      break;
    }

    // -------------------------------------------------------------------------
    // GYNECOLOGY / DERMATOLOGY / DENTAL / PSYCHIATRIC / GENERAL DEFAULT
    // -------------------------------------------------------------------------
    default: {
      const activeCondition = currentTriage.symptom || "your condition";
      if (stage === "severity") {
        return {
          agentScript:
            `Ask the IP: 'Regarding ${activeCondition}, could you please describe how severe the symptoms are right now, and whether there are any emergency difficulties?'`,
          options: [
            "High / Severe distress (Affecting breathing, consciousness or unbearable pain)",
            "Moderate distress (Pain or discomfort manageable with medication)",
            "Mild distress (Early stage / Stable / Seeking ESIS guidance)",
            `Urgent specialist consultation required for ${activeCondition}`,
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
  * Exported function serving disease-specific, clickable probing questions with selectable options
  * across all disease domains and adaptive probing stages.
  */
export function getClinicalQuestionData(params = {}) {
  const {
    domain = "general",
    stage = "symptom",
    prompt = "",
    history = [],
    currentTriage = {},
  } = params;

  if (stage === "complete") {
    return {
      agentScript:
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."',
      options: [],
      probingQuestions: [],
      probingQuestionsWithAnswers: [],
      isComplete: true,
      stage: "complete",
    };
  }

  // Symptom clarification stage: when caller input has not identified a known symptom
  if (stage === "symptom") {
    const sympResult = _internalGetClinicalQuestionData(params);
    const diseaseProbing = getDiseaseProbingProtocol(domain, currentTriage);
    return {
      ...sympResult,
      probingQuestionsWithAnswers: diseaseProbing || [],
      probingQuestions: (diseaseProbing || []).map((q) => q.question),
    };
  }

  // Adaptive Disease-Specific 5-step probing protocol
  const targetDomain = domain || currentTriage.domain || "general";
  const protocol = getDiseaseProbingProtocol(targetDomain, currentTriage);

  let stepIdx = 0;
  if (typeof currentTriage.probingStepIndex === "number") {
    stepIdx = currentTriage.probingStepIndex;
  } else if (typeof params.probingStepIndex === "number") {
    stepIdx = params.probingStepIndex;
  } else if (stage && String(stage).startsWith("probing_")) {
    stepIdx = parseInt(String(stage).replace("probing_", ""), 10) || 0;
  } else if (stage === "severity") {
    stepIdx = 0;
  } else if (stage === "duration") {
    stepIdx = 1;
  } else if (stage === "associated") {
    stepIdx = 2;
  } else if (stage === "medication") {
    stepIdx = 4;
  }

  if (stepIdx >= protocol.length) {
    return {
      agentScript:
        'Ask the IP: "Please wait for a moment while I review your details and locate the nearest ESIS facility."',
      options: [],
      probingQuestions: [],
      probingQuestionsWithAnswers: [],
      isComplete: true,
      stage: "complete",
    };
  }

  const currentStep = protocol[stepIdx] || protocol[0];

  return {
    agentScript: `Ask the IP: "${currentStep.question}"`,
    title: currentStep.title || "",
    question: currentStep.question,
    options: currentStep.options || [],
    probingQuestionsWithAnswers: protocol,
    probingQuestions: protocol.map((p) => p.question),
    stepIndex: stepIdx,
    totalSteps: protocol.length,
    isComplete: false,
    stage: `probing_${stepIdx}`,
    isMultiSelect: false,
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

  // 2. Identify Primary Symptom keywords & Recognized Diseases
  let primarySymptom = null;
  if (/\b(cancer|tumor|tumour|oncolog|malignan|carcinoma|leukemia|lymphoma|chemo|chemotherapy|sarcoma|melanoma|metastasis|lump|biopsy|myeloma)\b/i.test(text)) {
    primarySymptom = "Cancer / Oncology";
  } else if (/\b(diabet|sugar|hypoglycem|hyperglycem|ketoacidosis|dka|insulin)\b/i.test(text)) {
    primarySymptom = "Diabetes / Blood Sugar";
  } else if (/\b(kidney|renal|pathri|stone|dialysis|creatinine|urinary|urine|peshab|micturition|nephro)\b/i.test(text)) {
    primarySymptom = "Kidney Stone / Renal Issue";
  } else if (/\b(jaundice|peelia|hepat|liver|cirrhosis|bilirubin)\b/i.test(text)) {
    primarySymptom = "Jaundice / Liver Complaint";
  } else if (/\b(dengue|malaria|typhoid|tuberculosis|tb|pneumonia|cholera|chikungunya|sepsis)\b/i.test(text)) {
    primarySymptom = "Infection (Dengue/Malaria/Typhoid/TB)";
  } else if (/\b(stroke|paralysis|lakwa|seizure|mirgi|epilepsy|daura|fits|convulsion|unconscious|behoshi|coma)\b/i.test(text)) {
    primarySymptom = "Stroke / Seizure / Neurological";
  } else if (/\b(arthritis|gathiya|fracture|haddi|bone|joint|sciatica|spondylitis|slip disc)\b/i.test(text)) {
    primarySymptom = "Joint Pain / Arthritis / Fracture";
  } else if (/\b(appendix|appendicitis|hernia|gallstone|piles|bawasir|fistula)\b/i.test(text)) {
    primarySymptom = "Surgical / Appendicitis / Hernia";
  } else if (/\b(pregnant|pregnancy|garbh|delivery|labor pain|miscarriage|period|menstrual)\b/i.test(text)) {
    primarySymptom = "Maternal / Gynecological Health";
  } else if (/\b(tooth|teeth|dant|gum|dant dard)\b/i.test(text)) {
    primarySymptom = "Dental / Tooth Pain";
  } else if (/\b(depression|panic|anxiety|suicid|mental)\b/i.test(text)) {
    primarySymptom = "Mental Health / Anxiety Crisis";
  } else if (/\b(fever|bukhar|temperature|pyrexia|feverish|garam sharir|chills)\b/i.test(text)) {
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
  } else if (/\b(vomit|vomiting|ulti|nausea|ji machlana|throwing up)\b/i.test(text)) {
    primarySymptom = "Vomiting / Nausea";
  } else if (/\b(leg pain|calf pain|thigh pain|pair dard|tang me dard|leg swell|swollen leg|dvt|put weight on|weight on leg)\b/i.test(text)) {
    primarySymptom = "Leg Pain / Lower Limb";
  } else if (/\b(swelling|skin swelling|sujan|soojan|edema|swollen|cellulitis|abscess|boil|blister)\b/i.test(text)) {
    primarySymptom = "Skin Swelling";
  } else if (/\b(rash|khujli|itching|allergy|daane|rashes|psoriasis|eczema)\b/i.test(text)) {
    primarySymptom = "Skin Rash / Allergy / Dermatological";
  } else if (/\b(burn|jal gaya|aag se jala|burns)\b/i.test(text)) {
    primarySymptom = "Burn Injury";
  } else if (/\b(eye|aankh|ear|kaan|throat|gala|vision)\b/i.test(text)) {
    primarySymptom = "ENT / Eye Emergency";
  }

  // Universal Fallback: If no keyword regex matched, accept any non-small-talk medical disease input
  if (!primarySymptom && currentStage === "symptom") {
    const cleanWord = text.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const isSmallTalk = /\b(hi|hello|hey|test|ok|okay|yes|haan|no|nahi|thanks|thank you|good morning)\b/i.test(cleanWord);
    if (cleanWord.length >= 3 && !isSmallTalk) {
      primarySymptom = cleanWord
        .split(" ")
        .slice(0, 4)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
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
 * Processes transcribed speech with NLP, filters silence hallucinations & conversational filler,
 * prevents duplicate emissions, and formats into a standardized clinical format for the AI chat.
 */
export function processTranscriptionForAi(rawSpeech, currentClinicalState = {}, sentSignaturesSet = new Set()) {
  if (!rawSpeech) return null;
  const text = String(rawSpeech).trim();
  if (!text || text.length < 2) return null;

  // 1. Filter out Whisper silence/subtitle hallucinations
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const hallucinationPatterns = [
    /thank\s*you\s*(for\s*watching)?/gi,
    /thanks\s*(for\s*watching)?/gi,
    /please\s*subscribe/gi,
    /subscribe\s*to\s*(my|the)?\s*channel/gi,
    /like\s*and\s*subscribe/gi,
    /subtitles\s*by/gi,
    /amara\s*org/gi,
    /what\s*will\s*walk/gi,
    /please\s*take\s*your\s*priority/gi,
    /see\s*you\s*(in\s*the\s*next\s*video|next\s*time|tomorrow|again)/gi,
    /bye\s*bye/gi,
    /mbc/gi,
  ];

  for (const pattern of hallucinationPatterns) {
    if (pattern.test(normalized)) {
      const stripped = normalized.replace(pattern, "").trim();
      if (stripped.length < 4) return null;
    }
  }

  // 2. Filter out pure small talk, greetings, phone audio test checks
  const isPureSmallTalk = /^(hello|hi|namaskar|good morning|testing|can you hear me|awaz aa rahi hai|haan|theek hai|accha|okay|yes|no|nahi|thanks|thank you|bye)$/i.test(normalized);
  if (isPureSmallTalk) return null;

  // 3. Extract clinical entities via NLP
  const nlp = extractClinicalEntities(text, "probing", currentClinicalState);

  // Check specific intent requests (104, 108, e-Sanjeevani, Pharmacy, Psychiatric)
  const is104 = /\b(104|phone consultation|phone doctor|tele consultation|tele-consultation|tele doctor|tele-doctor|call with 104|104 doctor|doctor on call)\b/i.test(normalized);
  const is108 = /\b(108|ambulance|emergency vehicle|108 call)\b/i.test(normalized);
  const isESanjeevani = /\b(e sanjeevani|esanjeevani|online doctor|video consultation)\b/i.test(normalized);
  const isPharmacy = /\b(pharmacy|chemist|dawai ki dukan|medicine refill)\b/i.test(normalized);
  const isPsychiatric = /\b(tele manas|tele-manas|psychiat|counseling|depression|suicid|mental health)\b/i.test(normalized);

  const hasClinicalContent = Boolean(
    nlp.primarySymptom ||
    (nlp.companionSymptoms && nlp.companionSymptoms.length > 0) ||
    nlp.detectedDuration ||
    nlp.cleanSeverity ||
    nlp.probingAnswer ||
    is104 || is108 || isESanjeevani || isPharmacy || isPsychiatric
  );

  if (!hasClinicalContent) {
    // Pure conversational chatter without clinical or referral relevance: do not send to AI!
    return null;
  }

  // 4. Construct Clean Standard Format for the AI Chat
  let standardText = "";
  let entitySignature = "";

  if (is104 && !nlp.primarySymptom) {
    standardText = "Caller Request: Requesting 104 Tele-Doctor phone consultation";
    entitySignature = "req::104";
  } else if (is108 && !nlp.primarySymptom) {
    standardText = "Caller Request: Emergency 108 Ambulance required";
    entitySignature = "req::108";
  } else if (isESanjeevani && !nlp.primarySymptom) {
    standardText = "Caller Request: Seeking e-Sanjeevani online doctor tele-consultation";
    entitySignature = "req::esanjeevani";
  } else if (isPharmacy && !nlp.primarySymptom) {
    standardText = "Caller Request: Medicine refill at nearest dispensary pharmacy";
    entitySignature = "req::pharmacy";
  } else if (isPsychiatric && !nlp.primarySymptom) {
    standardText = "Caller Request: Transfer to Tele-MANAS / Psychiatric Counseling Team";
    entitySignature = "req::telemanas";
  } else if (nlp.primarySymptom) {
    const items = [`Complaint: ${nlp.primarySymptom}`];
    if (nlp.detectedDuration) items.push(`Duration: ${nlp.detectedDuration}`);
    if (nlp.cleanSeverity) items.push(`Severity: ${nlp.cleanSeverity}`);
    if (nlp.companionSymptoms && nlp.companionSymptoms.length > 0) {
      items.push(`Associated: ${nlp.companionSymptoms.join(", ")}`);
    }
    standardText = items.join(" | ");
    entitySignature = `sym::${nlp.primarySymptom}::${nlp.detectedDuration || ""}::${nlp.cleanSeverity || ""}::${(nlp.companionSymptoms || []).sort().join(",")}`;
  } else if (nlp.detectedDuration) {
    standardText = `Duration: ${nlp.detectedDuration}`;
    entitySignature = `dur::${nlp.detectedDuration}`;
  } else if (nlp.cleanSeverity) {
    standardText = `Severity: ${nlp.cleanSeverity}`;
    entitySignature = `sev::${nlp.cleanSeverity}`;
  } else if (nlp.probingAnswer) {
    standardText = `Answer: ${nlp.probingAnswer}`;
    entitySignature = `ans::${nlp.probingAnswer}`;
  } else {
    standardText = `Clinical Finding: ${nlp.cleanKeywords || text}`;
    entitySignature = `obs::${(nlp.cleanKeywords || text).toLowerCase()}`;
  }

  // 5. Deduplication: Don't send same thing multiple times
  if (sentSignaturesSet.has(entitySignature)) {
    return null;
  }

  return {
    standardText,
    entitySignature,
    nlp,
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
    if (optLow === lower || lower.includes(optLow) || optLow.includes(lower) || (lower.length > 3 && optLow.startsWith(lower))) {
      if (/high|severe|crushing|extreme|emergency|danger|critical|unbearable|cellulitis|abscess|warning|unable|anaphylaxis|poison|bleeding/i.test(opt)) {
        label = "High";
        score = 9;
      } else if (/mild|low|painless|minor|early/i.test(opt)) {
        label = "Mild";
        score = 3;
      } else if (/moderate|medium|intermittent|manageable|localized/i.test(opt)) {
        label = "Moderate";
        score = 6;
      } else {
        label = "Moderate";
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

  // Guard: If input is purely a symptom/disease word, never treat as duration!
  if (/^(fever|bukhar|chest pain|headache|cough|rash|swelling|skin swelling|dard|injury|trauma|cancer|stone|pathri|sugar|bp)\b/i.test(lower) && !lower.includes("day") && !lower.includes("hour") && !lower.includes("week") && !lower.includes("month") && !lower.includes("since") && !lower.includes("kal") && !lower.includes("aaj")) {
    return null;
  }

  // 1. Direct match with true duration options
  for (const opt of options) {
    const optLow = opt.toLowerCase();
    const isDurationOption = /\b(hour|hours|ghante?|day|days|din|week|weeks|hafte?|month|months|mahine?|today|yesterday|sudden|< 2|< 1|recent|just|morning|subah|kal|parso|chronic|since)\b/i.test(optLow);
    if (isDurationOption && (optLow === lower || lower.includes(optLow) || optLow.includes(lower) || (lower.length > 3 && optLow.startsWith(lower)))) {
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

/**
 * Validates and extracts Medication answer.
 * Identifies:
 * - isNo: user says no medications or clicks 'No medications taken'
 * - isBareYes: user just says 'Yes' / 'Haan' without specifying drug -> need to prompt what medicines
 * - text: clean string of medication details if provided
 */
export function detectMedicationAnswer(rawText = "", options = []) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // 1. Negative response (No medications taken)
  if (
    /^(no|none|nahi|na|nahin|not taking|never|kuch nahi|koi nahi|no medication|no medicines|no medicines taken|nil|not yet)\b/i.test(lower) ||
    lower === "no medications taken" ||
    lower === "no medications" ||
    lower === "none" ||
    lower === "nahi li" ||
    lower.includes("kuch nahi li")
  ) {
    return { isYes: false, isNo: true, isBareYes: false, text: "None / No medications taken" };
  }

  // 2. Bare Yes (User confirmed taking medicine but hasn't said what yet)
  const isBareYes =
    /^(yes|haan|ha|ji|yes taking|taking meds|dawai li hai|li hai|medicine li hai)\b/i.test(lower) &&
    !lower.includes("paracetamol") &&
    !lower.includes("bp") &&
    !lower.includes("pressure") &&
    !lower.includes("sugar") &&
    !lower.includes("insulin") &&
    !lower.includes("pain") &&
    !lower.includes("sorbitrate") &&
    !lower.includes("inhaler") &&
    !lower.includes("antibiotic") &&
    !lower.includes("tablet") &&
    !lower.includes("crocin") &&
    !lower.includes("dolo") &&
    !lower.includes("pan") &&
    !lower.includes("ome") &&
    !lower.includes("aspirin") &&
    lower.length < 18;

  if (isBareYes) {
    return { isYes: true, isNo: false, isBareYes: true, text: "Yes" };
  }

  // 3. Matched against selectable options
  for (const opt of options) {
    if (opt.toLowerCase().includes("no medication")) continue;
    if (lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower)) {
      return { isYes: true, isNo: false, isBareYes: false, text: opt };
    }
  }

  // 4. Freeform medication response (e.g. "Paracetamol 650", "Metformin 500mg", "took Sorbitrate")
  return { isYes: true, isNo: false, isBareYes: false, text: trimmed };
}


