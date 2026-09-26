// Clinical Triage Evaluation Engine
// Supports Anthropic Claude, Google Gemini, or intelligent rule-based clinical triage
import { groqChatCompletion } from "./groqPool.js";

/**
 * Evaluates whether ESIS Dispensaries are currently open in Assam (IST UTC+5:30).
 * Operating hours: Monday to Friday, 10:00 AM to 3:00 PM.
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
  const isOpenHours = currentMinutes >= 600 && currentMinutes < 900; // 10:00 AM (600) to 3:00 PM (900)
  const isNight = hour >= 20 || hour < 6; // 8:00 PM to 6:00 AM

  const isOpen = !isWeekend && isOpenHours;

  let reason = "";
  if (isWeekend) {
    reason = `ESIS Dispensaries are closed on weekends (${day === 0 ? "Sunday" : "Saturday"})`;
  } else if (currentMinutes < 600) {
    reason = "ESIS Dispensaries open at 10:00 AM (Mon–Fri, 10:00 AM – 3:00 PM)";
  } else if (currentMinutes >= 900) {
    reason = "ESIS Dispensaries closed for the day at 3:00 PM (Hours: 10:00 AM – 3:00 PM)";
  }

  return {
    isOpen,
    isWeekend,
    isNight,
    reason,
    operatingHoursText: "Mon–Fri: 10:00 AM – 3:00 PM (Closed Sat & Sun)",
  };
}

export function getHospitalOpdOperatingStatus(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  // ESIS / ESIC Hospitals are open from 5:00 AM (300 min) to 11:00 PM (1380 min) daily
  const isOpdOpen = currentMinutes >= 300 && currentMinutes < 1380;

  let reason = "";
  if (currentMinutes < 300) {
    reason = "ESIC / ESIS Hospitals open at 5:00 AM (Operating Hours: 5:00 AM – 11:00 PM daily)";
  } else if (currentMinutes >= 1380) {
    reason = "ESIC / ESIS Hospitals closed for the night at 11:00 PM (Hours: 5:00 AM – 11:00 PM; 24x7 Casualty open for acute emergencies)";
  }

  return {
    isOpen: isOpdOpen,
    hour,
    reason,
    operatingHoursText: "Daily: 5:00 AM – 11:00 PM (Casualty 24x7)",
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

    // Fever checks
    if (
      fLower.includes("fever") ||
      fLower.includes("bukhar") ||
      fLower.includes("pyrexia") ||
      fLower.includes("chills")
    ) {
      if (deniesFever) return false;
      // Must have actual fever words in text (excluding helpline 104!)
      return /\b(high fever|tez bukhar|bukhar|fever|chills|shivering|rigor|10[2-5]\s*(?:°|f|deg))\b/i.test(
        text
      );
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
      return /\b(bleed|blood|khoon|deep wound|cut\s*wrist|fracture)\b/i.test(text);
    }

    // Breathlessness checks
    if (
      fLower.includes("breath") ||
      fLower.includes("respiratory") ||
      fLower.includes("dyspnea") ||
      fLower.includes("suffocat")
    ) {
      return /\b(breath|saans|gasp|suffocat|wheez|asthma)\b/i.test(text);
    }

    // Unconscious / Faint checks
    if (
      fLower.includes("unconscious") ||
      fLower.includes("faint") ||
      fLower.includes("syncope") ||
      fLower.includes("blackout") ||
      fLower.includes("collapse")
    ) {
      return /\b(unconscious|behosh|fainted|blackout|collapsed)\b/i.test(text);
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

    // Vomiting / Dehydration
    if (fLower.includes("vomit") || fLower.includes("dehydrat")) {
      // If caller explicitly can drink fluids, it's not acute severe dehydration
      if (fLower.includes("dehydrat") && /\b(can drink|drinking fluid|paani pi)\b/i.test(text)) {
        return false;
      }
      return /\b(vomit|ulti|blood in vomit|hematemesis|cannot keep fluid|dehydrat)\b/i.test(text);
    }

    // General severe condition
    if (fLower.includes("accident") || fLower.includes("trauma") || fLower.includes("fall")) {
      return /\b(accident|hit|fall|chot|gir gaya)\b/i.test(text);
    }

    if (fLower.includes("snake") || fLower.includes("poison") || fLower.includes("bite")) {
      return /\b(snake|saap|bite|poison|zeher)\b/i.test(text);
    }

    // If flag doesn't match any known pattern, only keep if keywords appear in caller's text
    const words = fLower
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 4 &&
          !["reported", "caller", "patient", "clinical", "urgent", "immediate"].includes(w)
      );
    return words.some((w) => text.includes(w));
  };

  // 1. Process caller/clinician-reported raw flags directly, filtering out unverified / hallucinated flags
  if (Array.isArray(rawFlags)) {
    for (const f of rawFlags) {
      if (!f || typeof f !== "string") continue;
      if (isFlagSupportedByCaller(f)) {
        addPoint(f);
        if (points.length >= 4) break;
      }
    }
  }

  // 2. Synthesize ONLY what was actually reported by the IP in text
  if (points.length < 4) {
    // Cardiac / Severe respiratory (Only if caller explicitly mentioned)
    if (
      !deniesChestPain &&
      /\b(crushing chest|dil ka dard|chhati me dard|severe chest pain|left arm pain|pressure on chest)\b/i.test(
        text
      )
    ) {
      addPoint("Severe chest pain / pressure reported by IP");
    }
    if (
      /\b(severe breathlessness|saans lene me bahut takleef|gasping for air|suffocating)\b/i.test(
        text
      )
    ) {
      addPoint("Severe shortness of breath reported by IP");
    }
    // High Fever (NEVER match 104 helpline!)
    if (
      !deniesFever &&
      /\b(high fever|tez bukhar|chills and rigors|shivering with fever|10[2-5]\s*(?:°|f|deg))\b/i.test(
        text
      )
    ) {
      addPoint("High fever with chills reported by IP");
    }
    // Loss of consciousness / collapse
    if (/\b(unconscious|behosh|fainted|blackout|collapsed)\b/i.test(text)) {
      addPoint("Loss of consciousness / fainting episode reported by IP");
    }
    // Heavy bleeding / open wound
    if (
      !deniesBleeding &&
      /\b(heavy bleed|khoon beh raha|fracture|deep wound|arterial bleed)\b/i.test(text)
    ) {
      addPoint("Traumatic injury / bleeding reported by IP");
    }
    // Suicidal intent (ONLY if caller explicitly stated and is NOT safe)
    if (
      !isSafe &&
      /\b(wanna die|want to die|kill myself|mar jaunga|jaan dena chahta)\b/i.test(text)
    ) {
      addPoint("Explicit thoughts of ending life reported by IP");
    }
    // Convulsions / seizures
    if (/\b(seizure|convulsions|fits|mirgi ka daura)\b/i.test(text)) {
      addPoint("Seizure / convulsions reported by IP");
    }
    // Blood in vomit
    if (/\b(blood in vomit|khoon ki ulti|hematemesis)\b/i.test(text)) {
      addPoint("Blood in vomit (hematemesis) reported by IP");
    }
  }

  return points.slice(0, 4);
}

export async function evaluateTriage(intake) {
  const ekmsCtx = intake.ekms_ai_context || {};
  const tState = ekmsCtx.triageState || ekmsCtx;
  const notes = (intake.symptom_notes || "").toLowerCase();
  const severity = Number(intake.severity_reported) || (tState?.severityScore || (tState?.severity === "High" ? 9 : 5));
  const age = intake.age != null && intake.age !== "" ? Number(intake.age) : null;
  const duration = intake.duration || tState?.duration || "Reported today";

  // Extract caller's actual spoken text (excluding bot assistant prompts)
  const chatMsgs = ekmsCtx.chatHistory || [];
  const callerUtterances = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m.sender === "user" || m.role === "user")
        .map((m) => m.text || "")
        .join(" ")
    : "";
  const callerSpokenText = `${notes} ${callerUtterances}`.trim().toLowerCase();

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

  // FAST DIRECT SYNTHESIS (Instant, <5ms): If evaluated by chat engine OR psychiatric/suicidal crisis detected OR NACO HIV inquiry OR high effective severity (emergency)
  if (isPsych || isNacoHIV || effectiveSeverity >= 8 || (tState && (tState.condition || tState.symptom || tState.suspectedCondition || tState.severity || tState.redFlagsDetected?.length))) {
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

    const summarizedFlags = summarizeRedFlags(rawFlags, callerSpokenText, isCallerSafe);

    // Resolve TWO best-fitting referrals (Guaranteed Primary 01 and Secondary 02)
    let primaryReferral = "ESIS Dispensary";
    let primaryReason = "Routine primary care; visit nearest ESIS dispensary for doctor evaluation and medicines.";
    let secondaryReferral = "104 Medical Team";
    let secondaryReason = "Tele-doctor telephone consultation via 104 Health Helpline.";
    let isDualProtocol = false;
    let call108 = false;

    if (isNacoHIV) {
      // 1. HIV / AIDS / Sexual Diseases (NACO 1097 Helpline)
      primaryReferral = "NACO 1097 Helpline";
      primaryReason = "National AIDS Control Organisation (NACO) Helpline (Toll-Free 1097); 24x7 confidential counselling, STI guidance, and ART/ICTC testing center locator.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "Nearest ESIC Hospital Integrated Counselling & Testing Centre (ICTC) and Specialist OPD.";
      isDualProtocol = false;
      call108 = false;
    } else if (isPsych && hasSelfHarmAction) {
      // 2. COMBINED PSYCHOLOGICAL + MEDICAL TRAUMA:
      primaryReferral = "108 Ambulance";
      primaryReason = "Active physical self-harm trauma with bleeding; immediate 108 emergency ambulance dispatch required.";
      secondaryReferral = "Psychological Counselling Department";
      secondaryReason = "Concurrent acute psychiatric crisis; transfer to Tele-MANAS (14416) for emotional stabilization once ambulance is en route.";
      isDualProtocol = true;
      call108 = true;
    } else if (isPsych) {
      // 3. PURE PSYCHIATRIC / CRISIS:
      primaryReferral = "Psychological Counselling Department";
      primaryReason = "Caller exhibits emotional distress; transfer immediately to Tele-MANAS (14416) for confidential crisis counselling.";
      secondaryReferral = "104 Medical Team";
      secondaryReason = "104 Health Helpline Psychiatric Tele-Consultation with on-duty government medical officers.";
      isDualProtocol = true;
      call108 = false;
    } else if (
      effectiveSeverity >= 8 ||
      /\b(heart attack|crushing chest|stroke|unconscious|behosh|massive bleed|bleeding profusely|road accident|accident casualty|machine accident|worker trapped|crushed limb|amputation)\b/i.test(allText)
    ) {
      // 4. MEDICAL EMERGENCY / ACCIDENT / LIFE-AND-DEATH SITUATION:
      primaryReferral = "108 Ambulance";
      primaryReason = "Severe life-threatening emergency or acute trauma casualty; dispatch 108 Ambulance immediately.";
      secondaryReferral = "ESIC Hospital";
      secondaryReason = "24x7 Casualty & Emergency Department at nearest ESIC Hospital for trauma resuscitation and admission.";
      call108 = true;
      isDualProtocol = false;
    } else if (!dispensaryStatus.isOpen) {
      // 5. DISPENSARY CLOSED (After 3 PM, Before 10 AM, Sat/Sun, or Night) -> NEVER REFER TO DISPENSARY!
      const hospitalOpdStatus = getHospitalOpdOperatingStatus();

      // If Hospital regular OPD is ALSO closed (night, after 4 PM, Sunday) and NOT an emergency:
      // Can be handled by doctor on call (104). Never show closed hospital OPD or closed dispensary as primary!
      if (!hospitalOpdStatus.isOpen) {
        primaryReferral = "104 Medical Team";
        primaryReason = `ESIS Dispensaries and Hospital regular OPD are closed for the night (${hospitalOpdStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation, or visit nearest Empanelled Tie-Up Facility.`;
        secondaryReferral = (effectiveSeverity >= 6 || tState?.severity === "Moderate") ? "Nearest Tie-Up Facility" : "e-Sanjeevani";
        secondaryReason = (effectiveSeverity >= 6 || tState?.severity === "Moderate")
          ? "Proceed to nearest empanelled tie-up facility or 24x7 ESIC casualty if immediate medical attention is required."
          : "Government online e-Sanjeevani portal for tele-consultation from home.";
        isDualProtocol = false;
        call108 = false;
      } else {
        // Hospital OPD is OPEN (5:00 AM - 11:00 PM):
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
        const hour = istDate.getHours();
        const isAfter7PM = hour >= 19 || hour < 5; // 7:00 PM onwards

        if (effectiveSeverity >= 6 || tState?.severity === "Moderate") {
          primaryReferral = "ESIC Hospital";
          primaryReason = `ESIS Dispensaries are closed (${dispensaryStatus.reason}). ESIC Hospital is open until 11:00 PM for doctor examination today.`;
          // After 7:00 PM, guarantee at least 1 call referral option (104 Doctor on Call)
          secondaryReferral = isAfter7PM ? "104 Medical Team" : "Nearest Tie-Up Facility";
          secondaryReason = isAfter7PM
            ? "After 7:00 PM: Connect with 104 Health Helpline (Doctor on Call) for immediate tele-consultation over the phone, or visit nearest empanelled tie-up facility."
            : "Nearest empanelled tie-up facility or 104 Health Helpline for consultation.";
          isDualProtocol = false;
          call108 = false;
        } else {
          primaryReferral = "104 Medical Team";
          primaryReason = `ESIS Dispensaries are closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone, or visit nearest tie-up facility.`;
          secondaryReferral = "Nearest Tie-Up Facility";
          secondaryReason = "Empanelled tie-up facility or government online e-Sanjeevani portal.";
          isDualProtocol = false;
          call108 = false;
        }
      }
    } else if (effectiveSeverity >= 6 || tState?.severity === "Moderate") {
      // 6. MODERATE DURING OPEN HOURS (10 AM - 3 PM):
      primaryReferral = "ESIS Dispensary";
      primaryReason = "Primary clinic care suitable for regular doctor OPD consultation and prescription (Open Mon–Fri, 10:00 AM – 3:00 PM).";
      secondaryReferral = "104 Medical Team";
      secondaryReason = "104 Health Helpline tele-doctor consultation for medical advice over the phone.";
      isDualProtocol = false;
      call108 = false;
    } else {
      // 7. ROUTINE / MILD DURING OPEN HOURS:
      const needsDoctorAdvice = /\b(advice|doctor|consult|health advice|medical advice|phone doctor|guidance|information|kya karu|kya karein|salah|mashwara|ghar par kya karein)\b/i.test(allText);

      if (needsDoctorAdvice || effectiveSeverity <= 4 || tState?.severity === "Mild") {
        primaryReferral = "104 Medical Team";
        primaryReason = "Condition is not serious / mild; caller requires medical advice or tele-consultation. Transfer call to 104 Medical Team for 24x7 doctor consultation over the phone.";
        secondaryReferral = "ESIS Dispensary";
        secondaryReason = "Visit nearest registered ESIS Dispensary for physical doctor checkup and free medicine dispensing during OPD hours.";
      } else {
        primaryReferral = "ESIS Dispensary";
        primaryReason = "Routine outpatient evaluation and free medicine dispensing (Open Mon–Fri, 10:00 AM – 3:00 PM).";
        secondaryReferral = "104 Medical Team";
        secondaryReason = "104 Health Helpline tele-doctor consultation for medical advice over the phone.";
      }
      isDualProtocol = false;
      call108 = false;
    }

    let summaryEn = "";
    let summaryHi = "";

    if (isNacoHIV) {
      summaryEn = "Caller seeks consultation or guidance regarding HIV/AIDS or sexual health. Reassurance, confidential counseling (1097), and ICTC testing referral indicated.";
      summaryHi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी मार्गदर्शन चाहता है; गोपनीय परामर्श (1097) और आईसीटीसी केंद्र रेफरल आवश्यक है।";
    } else if (isPsych && hasSelfHarmAction) {
      summaryEn = `Caller in acute emotional crisis with ${selfHarmActionEn}, presenting a life safety risk requiring emergency 108 ambulance dispatch and psychiatric intervention.`;
      summaryHi = `कॉलर गंभीर मानसिक संकट में है और उसने ${selfHarmActionHi} की है; तुरंत 108 एम्बुलेंस और मनोचिकित्सकीय सहायता आवश्यक है।`;
    } else if (isPsych && callerHasSuicideWords) {
      summaryEn = "Caller reports acute emotional distress with thoughts of ending their life, requiring urgent psychiatric intervention and support via Tele-MANAS (14416).";
      summaryHi = "कॉलर ने गंभीर मानसिक तनाव और आत्महत्या के विचारों की शिकायत की है, जिसके लिए तत्काल मनोचिकित्सकीय परामर्श (14416) आवश्यक है।";
    } else if (isPsych) {
      summaryEn = "Caller reports emotional distress and psychological disturbance, requiring professional counseling and mental health support via Tele-MANAS (14416).";
      summaryHi = "कॉलर को मानसिक तनाव और भावनात्मक परेशानी की शिकायत है; टेली-मानस (14416) द्वारा परामर्श आवश्यक है।";
    } else if (primaryReferral === "104 Medical Team" && (effectiveSeverity <= 4 || tState?.severity === "Mild" || needsDoctorAdvice)) {
      const cond = tState?.condition || tState?.suspectedCondition || "mild symptoms";
      summaryEn = `Caller inquires regarding ${cond}; condition is non-serious and suitable for 104 Health Helpline tele-doctor consultation and general health advice.`;
      summaryHi = `कॉलर को ${cond} संबंधी चिकित्सकीय सलाह की आवश्यकता है; स्थिति गंभीर नहीं है और 104 टेली-डॉक्टर परामर्श उपयुक्त है।`;
    } else {
      const cond = tState?.condition || tState?.suspectedCondition || "symptoms";
      summaryEn = `Caller reports ${cond} with reported severity ${severity}/10 (${duration}), requiring prompt medical evaluation.`;
      summaryHi = `कॉलर को ${cond} की शिकायत है (तीव्रता: ${severity}/10, अवधि: ${duration}), जिसके लिए उचित चिकित्सकीय परामर्श आवश्यक है।`;
    }

    const primaryComplaint = isPsych && hasSelfHarmAction
      ? "Acute Self-Harm Crisis & Bleeding"
      : (isPsych && callerHasSuicideWords
        ? "Acute Suicidal Ideation / Mental Health Crisis"
        : (isPsych
          ? (tState?.suspectedCondition || tState?.condition || "Emotional Distress & Mental Health Support")
          : (isNacoHIV
            ? "HIV / AIDS / STI Health Consultation"
            : (tState?.suspectedCondition || tState?.condition || tState?.symptom || "Primary Clinical Assessment"))));

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
      referral_destination: primaryReferral,
      referral_reason: primaryReason,
      secondary_referral_destination: secondaryReferral,
      secondary_referral_reason: secondaryReason,
      summary_en: summaryEn,
      summary_hi: summaryHi,
      reasoning: isPsych
        ? (hasSelfHarmAction
            ? "Active physical self-harm trauma casualty requires immediate emergency dispatch followed by mental health stabilization."
            : "Caller is experiencing emotional distress or mental health challenges. Connecting with Tele-MANAS (14416) provides 24x7 confidential crisis counselling.")
        : (tState?.referralReason || "Clinical evaluation based on reported symptoms, onset, and duration."),
      red_flags: summarizedFlags,
      recommended_facility_type: primaryReferral === "108 Ambulance"
        ? "108 Emergency Ambulance / ESIC Hospital Casualty"
        : (primaryReferral === "Psychological Counselling Department"
          ? "Psychological Counselling Department / Tele-MANAS (14416)"
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

  // 1. Direct Google Gemini Flash (3.6 / 3.5 / latest) - Primary for Triage Evaluation
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const candidateGeminiModels = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];
    for (const geminiModel of candidateGeminiModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an expert ESIC / ESIS medical triage clinical evaluator for Indian call centers in Assam. Evaluate the caller's intake details and output strict valid JSON only (no markdown, no backticks):
{
  "urgency_level": "Emergency" | "Urgent" | "Routine" | "Self-care",
  "urgency_score": 1-10,
  "confidence": "high" | "medium" | "low",
  "summary_en": "concise 1-2 sentence clinical summary in English",
  "summary_hi": "concise 1-2 sentence clinical summary in Hindi",
  "reasoning": "clinical justification for triage score",
  "red_flags": ["list of red flags if any"],
  "recommended_facility_type": "Nearest ESIC Hospital / Emergency Casualty" | "ESIC Dispensary / OPD",
  "recommended_action": "clear action step for patient",
  "call_108": true | false,
  "detected_language": "English" | "Hindi" | "Hinglish",
  "followup_questions": ["question 1", "question 2"]
}

Intake data:
${JSON.stringify(intake, null, 2)}`,
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            return normalizeTriageDecision(JSON.parse(cleaned), intake);
          }
        }
      } catch (e) {
        console.warn(`[Triage Cascade] Gemini (${geminiModel}) evaluation error:`, e.message);
      }
    }
  }

  // 2. Claude API (Direct Anthropic or Dhwani Claude ESIC Proxy) - Primary for Triage Evaluation
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
        return normalizeTriageDecision(JSON.parse(cleaned), intake);
      }
    } catch (err) {
      console.warn("[Triage Cascade] Direct Anthropic API call failed:", err.message);
    }
  }

  // Dhwani Claude ESIC Proxy
  const dhwaniKey = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY;
  if (dhwaniKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://esicdemotriage.dhwaniris.in/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": dhwaniKey,
        },
        body: JSON.stringify({
          symptom_notes: intake.symptom_notes,
          age: intake.age ? Number(intake.age) : null,
          sex: intake.sex || null,
          severity_reported: intake.severity_reported ? Number(intake.severity_reported) : 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.triage) {
          return normalizeTriageDecision(data.triage, intake);
        }
      }
    } catch (err) {
      console.warn("[Triage Cascade] Dhwani Claude Proxy failed:", err.message);
    }
  }

  // 3. Groq Cloud Multi-Key AI triage evaluation (Secondary/Fallback across 21 keys)
  try {
    const groqResult = await groqChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are an expert ESIC / ESIS medical triage clinical evaluator in India. Output strict valid JSON only with keys: urgency_level ('Emergency'|'Urgent'|'Routine'|'Self-care'), urgency_score (1-10), confidence, summary_en, summary_hi, reasoning, red_flags, recommended_facility_type, recommended_action, call_108, detected_language, followup_questions.",
        },
        {
          role: "user",
          content: JSON.stringify(intake),
        },
      ],
      candidateModels: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"],
      response_format: { type: "json_object" },
      max_tokens: 800,
      timeoutMs: 7000,
    });

    if (groqResult?.content) {
      return normalizeTriageDecision(JSON.parse(groqResult.content), intake);
    }
  } catch (groqErr) {
    console.warn("[Triage Cascade] Groq multi-key pool fallback:", groqErr.message);
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

  // 1. HIV / AIDS / Sexual Disease: NACO 1097 Helpline
  if (isNacoHIV) {
    triage.is_psychiatric = false;
    triage.call_108 = false;
    triage.referral_destination = "NACO 1097 Helpline";
    triage.referral_reason =
      "National AIDS Control Organisation (NACO) Helpline (Toll-Free 1097); 24x7 confidential counselling, STI guidance, and ART/ICTC testing center locator.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason =
      "Nearest ESIC Hospital Integrated Counselling & Testing Centre (ICTC) and Specialist OPD.";
    triage.recommended_facility_type = "NACO 1097 Helpline (HIV / AIDS / STI Toll-Free)";
    triage.recommended_action =
      "Transfer call to NACO National AIDS Helpline (Toll-Free 1097) for 24x7 confidential counselling, STI support, and ICTC/ART testing center guidance.";
    triage.call_referral_primary = "NACO 1097 Helpline";
    triage.call_referral_secondary = "ESIC Hospital";
    if (!triage.summary_en || triage.summary_en.includes("distress") || triage.summary_en.includes("psychological") || triage.summary_en.includes("Tele-MANAS")) {
      triage.summary_en = "Caller seeks consultation or guidance regarding HIV/AIDS or sexual health. Reassurance, confidential counseling (1097), and ICTC testing referral indicated.";
      triage.summary_hi = "कॉलर एचआईवी/एड्स या यौन स्वास्थ्य संबंधी मार्गदर्शन चाहता है; गोपनीय परामर्श (1097) और आईसीटीसी केंद्र रेफरल आवश्यक है।";
    }
    if (!triage.primary_complaint || triage.primary_complaint.includes("Distress") || triage.primary_complaint.includes("Mental")) {
      triage.primary_complaint = "HIV / AIDS / STI Health Consultation";
    }
    return triage;
  }

  // 1b. Non-serious case seeking doctor advice or general health advice -> 104 Medical Team
  const isAdviceSeeking = /\b(advice|doctor|consult|health advice|medical advice|phone doctor|guidance|information|kya karu|kya karein|salah|mashwara|ghar par kya karein)\b/i.test(notes);
  const isMild = (triage.urgency_level === "Routine" || triage.urgency_level === "Self-care" || (Number(triage.urgency_score) <= 4));

  if ((isAdviceSeeking || isMild) && !isPsych && !isNacoHIV && !triage.call_108 && triage.urgency_level !== "Emergency") {
    triage.is_psychiatric = false;
    triage.call_108 = false;
    triage.referral_destination = "104 Medical Team";
    triage.referral_reason = "Condition is non-serious; caller requires medical advice or tele-consultation. Transfer call to 104 Medical Team for 24x7 doctor consultation over the phone.";
    triage.secondary_referral_destination = "ESIS Dispensary";
    triage.secondary_referral_reason = "Visit nearest registered ESIS Dispensary for physical doctor checkup and free medicine dispensing during OPD hours.";
    triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
    triage.recommended_action = "Transfer call to 104 Health Helpline for tele-doctor consultation and medical guidance.";
    triage.call_referral_primary = "104 Medical Team";
    triage.call_referral_secondary = "ESIS Dispensary";
    if (!triage.summary_en || triage.summary_en.includes("distress") || triage.summary_en.includes("emergency")) {
      triage.summary_en = "Condition is non-serious and suitable for 104 Health Helpline tele-doctor consultation and general health advice.";
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
    triage.secondary_referral_destination = "Psychological Counselling Department";
    triage.secondary_referral_reason =
      "Concurrent acute psychiatric crisis; transfer to Tele-MANAS (14416) for emotional stabilization once ambulance is en route.";
    triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
    triage.recommended_action =
      "Dispatch 108 Emergency Ambulance immediately. Maintain call connection and provide compassionate reassurance.";
    return triage;
  }

  // 3. Pure Psychiatric Crisis / Depression / Suicidal Ideation: Tele-MANAS + 104 Tele-Doctor
  if (isPsych && !isPoisonOrTrauma) {
    triage.is_psychiatric = true;
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "Psychological Counselling Department";
    triage.referral_reason =
      "Transfer call immediately to Psychological Counselling Department or Toll-Free 14416 (National Tele-MANAS). Speak with calm empathy and do not disconnect.";
    triage.secondary_referral_destination = "104 Medical Team";
    triage.secondary_referral_reason =
      "104 Health Helpline Psychiatric Tele-Consultation with on-duty government medical officers.";
    triage.recommended_facility_type = "Psychological Counselling Department / Tele-MANAS (14416)";
    triage.recommended_action =
      "Transfer call immediately to Psychological Counselling Department or Toll-Free 14416 (National Tele-MANAS). Speak with calm empathy and do not disconnect.";
    if (!triage.summary_en || triage.summary_en.toLowerCase().includes("physical") || triage.summary_en.toLowerCase().includes("hospital")) {
      triage.summary_en = "Caller presents with severe emotional distress / suicidal ideation requiring urgent psychiatric counselling.";
      triage.summary_hi = "कॉलर गंभीर मानसिक तनाव/अवसाद में है, तुरंत टेली-मानस (14416) परामर्श सहायता की आवश्यकता है।";
    }
    return triage;
  }

  // 4. Physical Emergency / 108 Dispatch / Accident Casualty
  if (
    referral.includes("108") ||
    (!isPsych && /\b(heart attack|crushing chest|cardiac arrest|massive bleed|accident casualty|unconscious|severe trauma|fracture)\b/i.test(notes)) ||
    triage.call_108
  ) {
    triage.call_108 = true;
    triage.is_dual_protocol = true;
    triage.referral_destination = "108 Ambulance";
    triage.referral_reason = "Severe life-threatening emergency or trauma casualty; dispatch 108 Ambulance immediately.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason =
      "24x7 Casualty & Emergency Department at nearest ESIC Hospital for trauma resuscitation and admission.";
    triage.recommended_facility_type = "108 Emergency Ambulance / ESIC Hospital Casualty";
    triage.recommended_action = "Dispatch 108 Emergency Ambulance immediately. Instruct caller to stay calm and not exert.";
    return triage;
  }

  // 5. If Dispensary is Closed (Outside Mon-Fri 10am-3pm or Sat/Sun/Night) -> NEVER REFER TO DISPENSARY!
  if (!dispensaryStatus.isOpen) {
    if (referral.includes("dispensary") || (!referral && (triage.urgency_level === "Routine" || triage.urgency_level === "Self-care"))) {
      triage.call_108 = false;
      triage.is_dual_protocol = true;
      if (triage.urgency_level === "Urgent" || (triage.urgency_score && triage.urgency_score >= 6)) {
        triage.referral_destination = "ESIC Hospital";
        triage.referral_reason = `ESIS Dispensaries are currently closed (${dispensaryStatus.reason}). Guide caller to nearest ESIC Hospital casualty or urgent OPD today.`;
        triage.secondary_referral_destination = "104 Medical Team";
        triage.secondary_referral_reason = "104 Health Helpline (24x7) for immediate telephonic doctor advice.";
        triage.recommended_facility_type = "Nearest ESIC Hospital / Emergency Casualty";
        triage.recommended_action = "Advise patient to proceed to the nearest ESIC Hospital casualty or urgent OPD today.";
      } else {
        triage.referral_destination = "104 Medical Team";
        triage.referral_reason = `ESIS Dispensaries are currently closed (${dispensaryStatus.reason}). Connect with 104 Health Helpline for 24x7 tele-doctor consultation over the phone.`;
        triage.secondary_referral_destination = "e-Sanjeevani";
        triage.secondary_referral_reason = "Government online telemedicine portal (e-Sanjeevani) for consultation from home.";
        triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
        triage.recommended_action = "Connect with 104 Health Helpline for 24x7 tele-doctor consultation.";
      }
      return triage;
    }
  }

  // 6. 104 Medical Team / Health Helpline
  if (referral.includes("104")) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "104 Medical Team";
    triage.referral_reason = "Caller requested tele-doctor phone consultation; transfer call queue to 104 Medical Team.";
    triage.secondary_referral_destination = dispensaryStatus.isOpen ? "ESIS Dispensary" : "e-Sanjeevani";
    triage.secondary_referral_reason = dispensaryStatus.isOpen
      ? "ESIS Dispensary for physical doctor checkup and free prescription dispensing."
      : "e-Sanjeevani online doctor tele-consultation portal.";
    triage.recommended_facility_type = "104 Health Helpline (Tele-Doctor)";
    triage.recommended_action = "Transfer call to 104 Health Helpline for tele-doctor consultation.";
    return triage;
  }

  // 7. e-Sanjeevani Telemedicine
  if (referral.includes("sanjeevani")) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "e-Sanjeevani";
    triage.referral_reason = "Advise caller to use government e-Sanjeevani online doctor tele-consultation portal.";
    triage.secondary_referral_destination = "104 Medical Team";
    triage.secondary_referral_reason = "104 Health Helpline for immediate telephone-based doctor advice.";
    triage.recommended_facility_type = "e-Sanjeevani National Telemedicine Portal";
    triage.recommended_action = "Advise caller to use government e-Sanjeevani portal/app for online doctor consultation.";
    return triage;
  }

  // 8. Nearest Pharmacy / Dispensary Store
  if (referral.includes("pharmacy")) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "Nearest Pharmacy";
    triage.referral_reason = "Guide caller to nearest empanelled chemist or dispensary pharmacy for prescribed medicines.";
    triage.secondary_referral_destination = dispensaryStatus.isOpen ? "ESIS Dispensary" : "104 Medical Team";
    triage.secondary_referral_reason = dispensaryStatus.isOpen
      ? "ESIS Dispensary doctor consultation for new prescription if needed."
      : "104 Health Helpline for tele-doctor prescription review.";
    triage.recommended_facility_type = "Empanelled Pharmacy / ESIS Dispensary Store";
    triage.recommended_action = "Guide caller to nearest empanelled chemist for prescribed medications and refills.";
    return triage;
  }

  // 9. Forward to On-duty Medical Officer
  if (referral.includes("doctor")) {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "Forward to Doctor";
    triage.referral_reason = "Forward call directly to on-duty ESIC Medical Officer workstation.";
    triage.secondary_referral_destination = "ESIC Hospital";
    triage.secondary_referral_reason = "ESIC Hospital specialist emergency department.";
    triage.recommended_facility_type = "On-Duty Medical Officer Escalation";
    triage.recommended_action = "Forward call directly to on-duty ESIC Medical Officer workstation.";
    return triage;
  }

  // 10. ESIC Hospital
  if (referral.includes("hospital") || triage.urgency_level === "Urgent" || triage.urgency_level === "Emergency") {
    triage.call_108 = false;
    triage.is_dual_protocol = true;
    triage.referral_destination = "ESIC Hospital";
    triage.referral_reason = "Advise patient to proceed immediately to the nearest ESIC Hospital casualty or urgent OPD today.";
    triage.secondary_referral_destination = "104 Medical Team";
    triage.secondary_referral_reason = "104 Health Helpline tele-doctor for interim symptom guidance and first aid.";
    triage.recommended_facility_type = "Nearest ESIC Hospital / Emergency Casualty";
    triage.recommended_action = "Advise patient to proceed immediately to the nearest ESIC Hospital casualty or urgent OPD today.";
    return triage;
  }

  // 11. ESIS Dispensary (Open Hours)
  triage.call_108 = false;
  triage.is_dual_protocol = true;
  triage.referral_destination = "ESIS Dispensary";
  triage.referral_reason = "Visit nearest ESIS Dispensary during regular OPD hours for doctor consultation and routine prescription.";
  triage.secondary_referral_destination = "104 Medical Team";
  triage.secondary_referral_reason = "104 Health Helpline for telephonic doctor advice.";
  triage.recommended_facility_type = "ESIS Dispensary Primary Care";
  triage.recommended_action = "Visit nearest ESIS Dispensary during regular OPD hours for doctor consultation and routine prescription.";
  return triage;
}
