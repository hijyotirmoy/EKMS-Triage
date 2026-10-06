"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  CheckCircle2,
  X,
  Edit3,
  Ambulance,
  Stethoscope,
  Copy,
  Check,
  User,
  Phone,
  Calendar,
  MapPin,
  Activity,
  Clock,
  ShieldAlert,
  Pill,
  FileText,
  AlertTriangle,
  HeartPulse,
  ClipboardCheck,
  Sparkles,
  Loader2,
  UserCheck,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { updateCaseInLocalCache, getCachedCases } from "../lib/clientCache";
import { broadcastEvent } from "../lib/broadcastSync";
import { getCallerIdForPhone } from "../lib/callerId";
import { deduplicateRedFlags, summarizeRedFlags, extractCallerReportedProblems } from "../lib/triageEngine";

export const FORWARDING_TEAMS = [
  {
    id: "108_AMBULANCE",
    name: "108 Emergency Ambulance Dispatch",
    shortName: "108 Ambulance",
    badgeColor: "bg-rose-700 text-white",
    icon: "🚨",
    isEmergency: true,
  },
  {
    id: "104_MEDICAL",
    name: "104 Health Helpline (Tele-Doctor)",
    shortName: "104 Health Helpline",
    badgeColor: "bg-blue-700 text-white",
    icon: "📞",
    isEmergency: false,
  },
  {
    id: "ESIC_HOSPITAL",
    name: "ESIC Hospital Casualty / Triage Desk",
    shortName: "ESIC Hospital",
    badgeColor: "bg-amber-700 text-white",
    icon: "🏥",
    isEmergency: false,
  },
  {
    id: "ESIS_DISPENSARY",
    name: "ESIS Dispensary Medical Officer",
    shortName: "ESIS Dispensary",
    badgeColor: "bg-emerald-700 text-white",
    icon: "🩺",
    isEmergency: false,
  },
  {
    id: "TIE_UP_FACILITY",
    name: "Empanelled Tie-Up Facility Desk",
    shortName: "Tie-Up Facility",
    badgeColor: "bg-cyan-700 text-white",
    icon: "🏥",
    isEmergency: false,
  },
  {
    id: "DIST_HOSPITAL",
    name: "Govt District Hospital / Public Health Desk",
    shortName: "District Hospital",
    badgeColor: "bg-blue-800 text-white",
    icon: "🏥",
    isEmergency: false,
  },
];

export function mapDirectiveToTeamId(directiveId, t = {}) {
  switch (directiveId) {
    case "CALL_108":
      return "108_AMBULANCE";
    case "TELE_104":
      return "104_MEDICAL";
    case "ESIC_HOSPITAL":
      return "ESIC_HOSPITAL";
    case "ESIS_DISPENSARY":
      return "ESIS_DISPENSARY";
    case "TIE_UP_FACILITY":
      return "TIE_UP_FACILITY";
    case "DIST_HOSPITAL":
      return "DIST_HOSPITAL";
    default:
      if (t?.call_108) return "108_AMBULANCE";
      return "104_MEDICAL";
  }
}

export function getTeamButtonClass(teamId) {
  switch (teamId) {
    case "ESIC_HOSPITAL":
      return "bg-amber-700 hover:bg-amber-800 ring-2 ring-amber-500/25";
    case "108_AMBULANCE":
    case "CALL_108":
      return "bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-500/25";
    case "104_MEDICAL":
    case "TELE_104":
      return "bg-blue-700 hover:bg-blue-800 ring-2 ring-blue-500/25";
    case "TIE_UP_FACILITY":
      return "bg-cyan-700 hover:bg-cyan-800 ring-2 ring-cyan-500/25";
    case "DIST_HOSPITAL":
      return "bg-blue-800 hover:bg-blue-900 ring-2 ring-blue-500/25";
    case "ESIS_DISPENSARY":
      return "bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-500/25";
    default:
      return "bg-primary hover:bg-primary/90 ring-2 ring-primary/25";
  }
}

function formatTriageDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  const valid = !isNaN(d.getTime()) ? d : new Date();
  return valid.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatHistoryDateTime(ts) {
  if (!ts) return "Recorded Prior Visit";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return String(ts);
  }
}

function cleanShortChiefComplaints(result, callerIntake, t) {
  const problems = extractCallerReportedProblems({ result, callerIntake, t });
  const firstReason = problems[0] || "Primary Clinical Assessment";
  const secondReason = problems[1] || "";
  return {
    firstReason,
    secondReason,
    allReasons: problems,
  };
}

function extractClinicalDetails(result, callerIntake, t, allRedFlags) {
  const chatMsgs = result?.ekms_ai_context?.chatHistory || [];
  const callerUtterances = Array.isArray(chatMsgs)
    ? chatMsgs
        .filter((m) => m.sender === "user" || m.role === "user")
        .map((m) => m.text || "")
        .join(". ")
    : "";
  const allCallerText = `${callerIntake?.symptom_notes || ""} ${result?.intake?.symptom_notes || ""} ${callerUtterances} ${result?.caller_spoken_text || ""}`.trim();
  const allText = `${allCallerText} ${result?.ekms_ai_context?.triageState?.condition || ""} ${result?.triage?.summary_en || ""} ${result?.triage?.reasoning || ""}`.toLowerCase();

  // 1. Duration / Onset
  let duration = result?.ekms_ai_context?.duration || result?.ekms_ai_context?.triageState?.duration || "";
  if (!duration || /\b(fall|fell|falling|accident|injury|trauma|pain|chot|gir gaya|impact)\b/i.test(duration)) {
    const durMatch = allText.match(/\b(since\s+[\w\s]+|\d+\s*(?:days?|hours?|weeks?|months?|dino?|ghante?)|aaj\s*se|kal\s*se|today|yesterday|morning|subah\s*se|raat\s*se)\b/i);
    if (durMatch) duration = durMatch[0];
    else duration = "Reported today";
  }

  // 2. Clinical Red Flags: Strictly use the verified and deduplicated allRedFlags
  let redFlags = [];
  if (Array.isArray(allRedFlags) && allRedFlags.length > 0) {
    redFlags = deduplicateRedFlags(allRedFlags);
  } else {
    const rawFlags = [];
    if (Array.isArray(t?.red_flags)) rawFlags.push(...t.red_flags);
    if (Array.isArray(result?.ekms_ai_context?.triageState?.redFlagsDetected)) {
      rawFlags.push(...result.ekms_ai_context.triageState.redFlagsDetected);
    }
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(allText);
    redFlags = deduplicateRedFlags(summarizeRedFlags(rawFlags, allText, isSafe));
  }

  // 3. Short clean chief complaint
  const { firstReason, secondReason, allReasons } = cleanShortChiefComplaints(result, callerIntake, t);
  const primaryLower = (firstReason || "").toLowerCase();

  // 4. Associated Symptoms: Keep separate from Red Flags and separate from Chief Complaint
  let associated = "";
  const ctxAssociated = result?.ekms_ai_context?.triageState?.associated;
  const isSyntheticMeta = (s) =>
    !s || typeof s !== "string" ||
    /\b(presentation|severity|reported|rapidly spreading|urgent|evaluation|protocol|clinical|assessment|dispatch|triage|guided|destination|requiring|care|manageable|emergency|high risk|ambulance|casualty|disposition|red flag|risk|syndrome|support)\b/i.test(s);

  if (Array.isArray(ctxAssociated) && ctxAssociated.length > 0) {
    const filtered = ctxAssociated.filter(
      (a) =>
        !isSyntheticMeta(a) &&
        !redFlags.some((rf) => rf.toLowerCase().includes(a.toLowerCase())) &&
        !primaryLower.includes(a.toLowerCase())
    );
    // USER MANDATE: "and in associated symptoms show the primary symptoms only dont need to show all or so many"
    associated = (filtered.length > 0 ? filtered.slice(0, 2) : []).join(", ");
  }
  if (!associated) {
    const potentialSecondary = [
      { regex: /\b(swelling|sujan)\b/i, label: "Local Swelling" },
      { regex: /\b(inability to retain fluids|cannot keep fluids down)\b/i, label: "Inability to retain fluids" },
      { regex: /\b(vomit|ulti)\b/i, label: "Vomiting" },
      { regex: /\b(nausea|ji machlana)\b/i, label: "Nausea" },
      { regex: /\b(weakness|kamzori)\b/i, label: "Weakness" },
      { regex: /\b(dizziness|chakkar)\b/i, label: "Dizziness" },
      { regex: /\b(body ache|badan dard)\b/i, label: "Body Ache" },
      { regex: /\b(fever|bukhar)\b/i, label: "Fever" },
      { regex: /\b(headache|sar dard|sir dard)\b/i, label: "Headache" },
      { regex: /\b(sweating|pasina)\b/i, label: "Sweating" },
      { regex: /\b(chills|kapkapi)\b/i, label: "Chills" },
    ];
    for (const item of potentialSecondary) {
      if (
        !primaryLower.includes(item.label.toLowerCase()) &&
        !redFlags.some((rf) => rf.toLowerCase().includes(item.label.toLowerCase())) &&
        item.regex.test(allText)
      ) {
        associated = item.label;
        break;
      }
    }
  }

  // 4. Comorbidity: Professional extraction from chat, intake notes, and triage context
  let comorbidity =
    result?.ekms_ai_context?.triageState?.comorbidity ||
    result?.ekms_ai_context?.triageState?.comorbidities ||
    result?.ekms_ai_context?.comorbidity ||
    result?.ekms_ai_context?.comorbidities ||
    result?.triage?.comorbidity ||
    result?.triage?.comorbidities ||
    "";

  if (!comorbidity || /^(none|nil|none reported|no pre)/i.test(comorbidity.trim())) {
    if (
      /\b(no\s+(?:known\s+)?comorbidit(?:y|ies)|no\s+(?:pre-existing|chronic|prior)\s+(?:condition|illness|disease|history)|koi\s+purani\s+bimari\s+nahi|koi\s+bimari\s+nahi|no\s+bp\s+sugar|na\s+sugar\s+na\s+bp|none|nil|negative)\b/i.test(
        allText
      )
    ) {
      comorbidity = "";
    } else {
      const condList = [];
      if (/\b(diabet(?:es|ic)|sugar|madhumeh|high blood sugar)\b/i.test(allText)) {
        condList.push("Diabetes / High Blood Sugar");
      }
      if (/\b(hypertension|high\s*bp|blood\s*pressure|uchh\s*raktchap)\b/i.test(allText)) {
        condList.push("Hypertension / High BP");
      }
      if (/\b(asthma|damah|dama\b|wheezing|copd)\b/i.test(allText)) {
        condList.push("Bronchial Asthma / Respiratory condition");
      }
      if (/\b(heart\s*disease|cardiac|cad\b|dil\s*ki\s*bimari|angina|stent|bypass)\b/i.test(allText)) {
        condList.push("Cardiovascular / Heart Disease");
      }
      if (/\b(kidney\s*disease|renal|ckd\b|dialysis|kidney\s*problem|gurde)\b/i.test(allText)) {
        condList.push("Chronic Kidney Disease / Renal illness");
      }
      if (/\b(thyroid|hypothyroid|hyperthyroid)\b/i.test(allText)) {
        condList.push("Thyroid disorder");
      }

      if (condList.length > 0) {
        comorbidity = condList.join("; ");
      } else {
        comorbidity = "";
      }
    }
  }

  if (!comorbidity || /^(none|nil|none reported|no pre)/i.test(comorbidity.trim())) {
    comorbidity = "";
  }

  // 5. Medication: Professional extraction from chat, intake notes, and triage context
  let medication =
    result?.ekms_ai_context?.triageState?.medications ||
    result?.ekms_ai_context?.triageState?.medication ||
    result?.ekms_ai_context?.medications ||
    result?.ekms_ai_context?.medication ||
    result?.triage?.medications ||
    result?.triage?.medication ||
    "";

  if (!medication || medication.toLowerCase() === "none" || medication.toLowerCase() === "nil" || medication.toLowerCase() === "none reported") {
    if (/\b(no\s+medicin(?:e|es)|no\s+medication|haven'?t\s+taken|not\s+taken|kuch\s+nahi\s+liya|koi\s+dawa\s+nahi|dawai\s+nahi|dawa\s+nahi|none|nil)\b/i.test(allText)) {
      medication = "";
    } else {
      const medsFound = [];
      if (/\b(ondansetron|vomikind|domperidone|emset)\b/i.test(allText)) {
        medsFound.push("Tab. Ondansetron");
      }
      if (/\b(ors|electral|electrolyte)\b/i.test(allText)) {
        medsFound.push("ORS");
      }
      if (/\b(paracetamol|dolo|crocin|calpol|pcm)\b/i.test(allText)) {
        medsFound.push("Tab. Paracetamol");
      }
      if (/\b(combiflam|ibuprofen|diclofenac|aceclofenac|painkiller)\b/i.test(allText)) {
        medsFound.push("Combiflam / Diclofenac (Painkiller)");
      }
      if (/\b(cetirizine|avil|allegra|levocet|montair)\b/i.test(allText)) {
        medsFound.push("Cetirizine / Avil");
      }
      if (/\b(pantoprazole|pantocid|pan\s*40|omeprazole|omez|antacid|gelusil|digene)\b/i.test(allText)) {
        medsFound.push("Pantoprazole / Antacid");
      }
      if (/\b(inhaler|puff|asthalin|budecort|foracort)\b/i.test(allText)) {
        medsFound.push("Inhaler (Asthalin)");
      }
      if (/\b(sorbitrate|aspirin|ecospirin)\b/i.test(allText)) {
        medsFound.push("Aspirin / Sorbitrate");
      }
      if (/\b(insulin|metformin|glycomet)\b/i.test(allText)) {
        medsFound.push("Insulin / Metformin");
      }
      if (/\b(telmisartan|amlodipine|atenolol|bp\s+medicine|bp\s+dawai)\b/i.test(allText)) {
        medsFound.push("BP medicine (Telmisartan / Amlodipine)");
      }

      if (medsFound.length > 0) {
        medication = medsFound.join("; ");
      } else {
        const takingMedMatch = allText.match(/\b(?:taking|take|taken|on\s+meds?|on\s+medication|dawai\s+le|medicine\s+le)\s+([a-zA-Z0-9\s]{2,25})/i);
        if (takingMedMatch && takingMedMatch[1]) {
          const rawMed = takingMedMatch[1].trim();
          if (rawMed.length > 2 && !/^(no|none|nahi|nil)/i.test(rawMed)) {
            medication = rawMed;
          }
        }
      }
    }
  }

  // USER MANDATE: If no medication taken or no answer, leave the place blank
  if (!medication || /^(none|nil|no prior|none reported)/i.test(medication.trim())) {
    medication = "";
  } else {
    medication = medication.replace(/^medications?\s*(?:taken)?[:\s]*/i, "");
  }

  // 6. Diagnostic tests / Vitals (BP, Sugar, Temp, SpO2)
  const vitals = [];
  const bpMatch = allText.match(/\b(?:bp|blood pressure)[:\s]*(\d{2,3}\s*\/\s*\d{2,3})/i);
  if (bpMatch) vitals.push(`BP: ${bpMatch[1]} mmHg`);

  const sugarMatch = allText.match(/\b(?:sugar|glucose|rbs|fbs)[:\s]*(\d{2,3}\s*(?:mg\/dl)?)/i);
  if (sugarMatch) vitals.push(`Sugar: ${sugarMatch[1]}`);

  const tempMatch = allText.match(/\b(?:temp|temperature|fever)[:\s]*(\d{2,3}(?:\.\d)?\s*(?:°?[fc]|degrees?)?)/i);
  if (tempMatch) vitals.push(`Temp: ${tempMatch[1]}`);

  const spo2Match = allText.match(/\b(?:spo2|oxygen|o2)[:\s]*(\d{2,3}\s*%?)/i);
  if (spo2Match) vitals.push(`SpO2: ${spo2Match[1]}`);

  const diagnosticTests = vitals.length > 0 ? vitals.join(" · ") : "";

  // 7. Chief complaints already extracted above

  return {
    duration: cleanField(duration),
    associated: cleanField(associated),
    comorbidity: cleanField(comorbidity) || "",
    medication: cleanField(medication) || "",
    diagnosticTests: diagnosticTests,
    firstReason: cleanField(firstReason),
    secondReason: cleanField(secondReason),
    allReasons: (Array.isArray(allReasons) && allReasons.length > 0) ? allReasons : [cleanField(firstReason), cleanField(secondReason)].filter(Boolean),
    redFlags: redFlags,
  };
}

function cleanField(val) {
  if (!val) return "";
  const trimmed = String(val).trim();
  if (
    trimmed === "-" ||
    trimmed === "--" ||
    trimmed === "---" ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed === "..." ||
    trimmed === "," ||
    trimmed === ";" ||
    trimmed.toLowerCase() === "n/a" ||
    trimmed.toLowerCase() === "na" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "unknown" ||
    trimmed.toLowerCase() === "need to be find" ||
    trimmed.toLowerCase() === "need to identify"
  ) {
    return "";
  }
  return trimmed;
}

function cleanPhone(val) {
  const cleaned = cleanField(val);
  if (!cleaned) return "";
  const digits = cleaned.replace(/^\+91\s*/, "").replace(/[^\d]/g, "");
  if (!digits || digits.length < 5) return "";
  return digits;
}

export function CaseHandoverForwarding({
  result,
  activeDirective,
  allRedFlags = [],
  callerIntake = null,
  callerHistory = [],
  onForwardSuccess,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentStatus, setSentStatus] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && modalOpen) {
        setModalOpen(false);
      }
    };
    if (modalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const t = result?.triage || {};
  const caseRef = result?.case_ref || result?.case_id || "CA0001AB01";
  const activeCallerId = useMemo(() => {
    return (
      result?.caller_id ||
      result?.intake?.caller_id ||
      (result?.intake?.phone ? getCallerIdForPhone(result.intake.phone) : caseRef)
    );
  }, [result, caseRef]);

  const triageTimestamp = useMemo(() => {
    return formatTriageDate(result?.created_at || result?.timestamp || result?.intake?.timestamp);
  }, [result]);

  const targetTeamId = useMemo(() => {
    return mapDirectiveToTeamId(activeDirective?.id, t);
  }, [activeDirective?.id, t]);

  useEffect(() => {
    const caseTarget = caseRef || result?.case_ref || result?.case_id || result?.id;

    if (result?.is_forwarded || result?.forwarded_at || result?.dispatch_id) {
      setSentStatus({
        teamName: result.forwarded_to || "ESIS Dispensary",
        shortName: result.forwarded_short_name || (result.forwarded_to?.includes("Dispensary") ? "ESIS Dispensary" : "Facility"),
        dispatchId: result.dispatch_id || `DISP-${String(caseTarget || "SENT").slice(-6)}`,
        timestamp: result.forwarded_at ? formatTriageDate(result.forwarded_at) : "Recently",
        location: result.intake?.landmark || "",
      });
      return;
    }

    if (typeof window !== "undefined" && caseTarget) {
      try {
        const stored =
          sessionStorage.getItem(`ekms_forwarded_${caseTarget}`) ||
          localStorage.getItem(`ekms_forwarded_${caseTarget}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.is_forwarded && (parsed.case_ref === caseTarget || parsed.dispatch_id)) {
            setSentStatus({
              teamName: parsed.forwarded_to || "ESIS Dispensary",
              shortName: parsed.forwarded_short_name || "Facility",
              dispatchId: parsed.dispatch_id || `DISP-${String(caseTarget || "SENT").slice(-6)}`,
              timestamp: parsed.forwarded_at ? formatTriageDate(parsed.forwarded_at) : "Recently",
              location: "",
            });
            return;
          }
        }

        const cached = getCachedCases().find((c) => String(c.case_ref) === String(caseTarget) || String(c.id) === String(caseTarget));
        if (cached && (cached.is_forwarded || cached.forwarded_at || cached.status === "forwarded")) {
          setSentStatus({
            teamName: cached.forwarded_to || "ESIS Dispensary",
            shortName: cached.forwarded_short_name || "Facility",
            dispatchId: cached.dispatch_id || `DISP-${String(caseTarget).slice(-6)}`,
            timestamp: cached.forwarded_at ? formatTriageDate(cached.forwarded_at) : "Recently",
            location: cached.intake?.landmark || "",
          });
          return;
        }
      } catch (e) {}
    }

    setSentStatus(null);
  }, [result, caseRef]);

  const selectedTeam =
    FORWARDING_TEAMS.find((team) => team.id === targetTeamId) ||
    FORWARDING_TEAMS[0];

  const isTarget108 = selectedTeam.id === "108_AMBULANCE";

  const intakeData = useMemo(() => {
    const src = callerIntake || result?.intake || {};
    const name = cleanField(src.caller_name || result?.intake?.caller_name);
    const phone = cleanPhone(src.phone || result?.intake?.phone);
    const rawAge = src.age != null && src.age !== "" ? src.age : result?.intake?.age;
    const age = cleanField(rawAge);
    const sex = cleanField(src.sex || result?.intake?.sex);

    const landmark = cleanField(src.landmark || result?.intake?.landmark);
    const city = cleanField(src.city || result?.intake?.city);
    const district = cleanField(src.district || result?.intake?.district);
    const pincode = cleanField(src.pincode || result?.intake?.pincode);

    const locParts = [];
    if (landmark) locParts.push(landmark);
    if (city) locParts.push(city);
    if (district && district.toLowerCase() !== city.toLowerCase()) locParts.push(district);
    if (pincode) locParts.push(`PIN: ${pincode}`);

    const formattedLocation = locParts.join(", ");

    return {
      callerName: name,
      phone,
      age,
      sex,
      landmark: formattedLocation,
    };
  }, [callerIntake, result]);

  const extractedDetails = useMemo(() => {
    return extractClinicalDetails(result, callerIntake, t, allRedFlags);
  }, [result, callerIntake, t, allRedFlags]);

  const pastHistoryList = useMemo(() => {
    let list = [];
    if (Array.isArray(callerHistory) && callerHistory.length > 0) {
      list = callerHistory.map((item) => ({
        case_ref: item.case_ref || "",
        created_at: item.created_at || "",
        chief_complaint: item.chief_complaint || item.reason || item.summary || "",
        red_flags: item.red_flags || [],
      }));
    } else if (intakeData.phone) {
      const cached = getCachedCases();
      const rawTarget = String(intakeData.phone || "").replace(/\D/g, "");
      const target10 = rawTarget.length >= 10 ? rawTarget.slice(-10) : "";
      if (target10.length === 10) {
        list = cached
          .filter((c) => {
            const rawCp = String(c.intake?.phone || "").replace(/\D/g, "");
            const cp10 = rawCp.length >= 10 ? rawCp.slice(-10) : "";
            return cp10.length === 10 && cp10 === target10;
          })
          .map((c) => ({
            case_ref: c.case_ref || "",
            created_at: c.created_at || c.timestamp || "",
            chief_complaint: c.triage?.primary_complaint || c.intake?.symptom_notes || c.triage?.chief_complaint || c.triage?.summary_en || "",
            red_flags: Array.isArray(c.triage?.red_flags) && c.triage.red_flags.length > 0
              ? c.triage.red_flags
              : (c.ekms_ai_context?.triageState?.redFlagsDetected || []),
          }));
      }
    }

    const currentCaseRef = result?.case_ref || result?.case_id || "";
    const filtered = list.filter((item) => {
      if (currentCaseRef && item.case_ref && item.case_ref === currentCaseRef) return false;
      return true;
    });

    return filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [callerHistory, intakeData.phone, result]);

  // Clean Document State (No heavy container boxes, editable inline)
  const [editData, setEditData] = useState({
    callerName: intakeData.callerName,
    phone: intakeData.phone,
    age: intakeData.age,
    sex: intakeData.sex,
    landmark: intakeData.landmark,

    firstReason: extractedDetails.firstReason,
    secondReason: extractedDetails.secondReason,
    allReasons: extractedDetails.allReasons || [extractedDetails.firstReason, extractedDetails.secondReason].filter(Boolean),
    redFlags: extractedDetails.redFlags || [],
    hpiDuration: extractedDetails.duration,
    associatedSymptoms: extractedDetails.associated,
    comorbidity: (extractedDetails.comorbidity && !/^(none|nil|no pre|none reported)/i.test(extractedDetails.comorbidity.trim())) ? extractedDetails.comorbidity : "",
    medications: (extractedDetails.medication && !/^(none|nil|no prior|none reported)/i.test(extractedDetails.medication.trim())) ? extractedDetails.medication.replace(/^medications?\s*(?:taken)?[:\s]*/i, "") : "",

    primaryDiagnosis: "",
    secondaryDiagnosis: "",

    diagnosticTests: extractedDetails.diagnosticTests || "",
    keyFindings: "",
    proceduresCompleted: "",

    newMedications: "",
    changesToMedications: "",
    careInstructions: "",

    scheduledAppointments: "",
    referrals: "",
    warningSigns: "",
  });

  const handleOpenModal = () => {
    const refreshed = extractClinicalDetails(result, callerIntake, t, allRedFlags);
    setEditData({
      callerName: intakeData.callerName,
      phone: intakeData.phone,
      age: intakeData.age,
      sex: intakeData.sex,
      landmark: intakeData.landmark,

      firstReason: refreshed.firstReason,
      secondReason: refreshed.secondReason,
      allReasons: refreshed.allReasons || [refreshed.firstReason, refreshed.secondReason].filter(Boolean),
      redFlags: refreshed.redFlags || [],
      hpiDuration: refreshed.duration,
      associatedSymptoms: refreshed.associated,
      comorbidity: (refreshed.comorbidity && !/^(none|nil|no pre|none reported)/i.test(refreshed.comorbidity.trim())) ? refreshed.comorbidity : "",
      medications: (refreshed.medication && !/^(none|nil|no prior|none reported)/i.test(refreshed.medication.trim())) ? refreshed.medication.replace(/^medications?\s*(?:taken)?[:\s]*/i, "") : "",

      primaryDiagnosis: "",
      secondaryDiagnosis: "",

      diagnosticTests: refreshed.diagnosticTests || "",
      keyFindings: "",
      proceduresCompleted: "",

      newMedications: "",
      changesToMedications: "",
      careInstructions: "",

      scheduledAppointments: "",
      referrals: "",
      warningSigns: "",
    });
    setModalOpen(true);
  };

  const buildDossierText = (data) => {
    const chiefComplaintText = (Array.isArray(data.allReasons) && data.allReasons.length > 0)
      ? data.allReasons.map((r) => `  • ${r}`).join("\n")
      : (data.secondReason
          ? `  • ${data.firstReason}\n  • ${data.secondReason}`
          : `  • ${data.firstReason}`);

    const redFlagsText = Array.isArray(data.redFlags) && data.redFlags.length > 0
      ? data.redFlags.map((f) => `  • ${f}`).join("\n")
      : "  • None reported";

    const formattedPhone = data.phone
      ? (data.phone.startsWith("+91") ? data.phone : `+91 ${data.phone}`)
      : "";

    let historySection = "3. Past History of the Caller\n";
    if (pastHistoryList.length > 0) {
      historySection += pastHistoryList
        .map((item, idx) => {
          const timeStr = formatHistoryDateTime(item.created_at);
          const comp = item.chief_complaint || "None recorded";
          let rfStr = "None reported";
          if (Array.isArray(item.red_flags) && item.red_flags.length > 0) {
            rfStr = item.red_flags.join("; ");
          } else if (typeof item.red_flags === "string" && item.red_flags.trim()) {
            rfStr = item.red_flags;
          }
          return `Past History ${idx + 1} (${timeStr}):\n• Chief Complaint: ${comp}\n• Clinical Red Flags: ${rfStr}`;
        })
        .join("\n\n");
    } else {
      historySection += "• No previous consultation history recorded for this caller.";
    }

    return `1. Caller Details                                         Caller ID: ${activeCallerId}
• Name: ${data.callerName || ""}
• Phone Number: ${formattedPhone}
• Age: ${data.age ? data.age : ""}
• Gender: ${data.sex || ""}
• Case Date: ${triageTimestamp}
• Address: ${data.landmark || ""}

2. Clinical Overview
• Chief Complaint:
${chiefComplaintText}
• Clinical Red Flags:
${redFlagsText}
• History of Present Illness(from how long it happening): ${data.hpiDuration || ""}
• Associated Symptoms: ${data.associatedSymptoms || ""}
• Comorbidity: ${(!data.comorbidity || /^(none|nil|no pre|none reported)/i.test(data.comorbidity.trim())) ? "" : data.comorbidity}
• Any medication: ${(data.medications || "").replace(/^medications?\s*(?:taken)?[:\s]*/i, "")}

${historySection}`;
  };

  const handleConfirmSend = () => {
    setIsSending(true);

    const dispatchId = `DISP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dispatchDossier = buildDossierText(editData);

    setTimeout(() => {
      try {
        navigator.clipboard?.writeText?.(dispatchDossier);
      } catch (e) { }

      const statusData = {
        teamName: selectedTeam.name,
        shortName: selectedTeam.shortName,
        dispatchId,
        timestamp,
        location: editData.landmark,
      };
      setSentStatus(statusData);
      onForwardSuccess?.(statusData);

      const forwardPayload = {
        is_forwarded: true,
        forwarded_at: new Date().toISOString(),
        dispatch_id: dispatchId,
        forwarded_to: selectedTeam.name,
        forwarded_short_name: selectedTeam.shortName,
        status: "forwarded",
      };

      if (result) {
        result.is_forwarded = true;
        result.forwarded_at = forwardPayload.forwarded_at;
        result.dispatch_id = dispatchId;
        result.forwarded_to = selectedTeam.name;
        result.forwarded_short_name = selectedTeam.shortName;
        result.status = "forwarded";
        result.dispatch_info = statusData;
      }

      const caseTarget = caseRef || result?.case_ref || result?.id;
      if (caseTarget) {
        updateCaseInLocalCache(caseTarget, forwardPayload);
        try {
          sessionStorage.setItem(`ekms_forwarded_${caseTarget}`, JSON.stringify(forwardPayload));
          localStorage.setItem(`ekms_forwarded_${caseTarget}`, JSON.stringify(forwardPayload));
        } catch (e) {}
        broadcastEvent("CASE_FORWARDED", { case_ref: caseTarget, ...forwardPayload });
        try {
          api.patch("/cases", { case_ref: caseTarget, updates: forwardPayload }).catch(() => {});
        } catch (e) {}
      }

      try {
        sessionStorage.setItem("ekms_active_case_forwarded", JSON.stringify(forwardPayload));
        localStorage.setItem("ekms_active_case_forwarded", JSON.stringify(forwardPayload));
      } catch (e) {}

      setIsSending(false);
      setModalOpen(false);
      toast.success(
        `Clinical summary sent to ${selectedTeam.shortName}! (Ref: ${dispatchId})`
      );
    }, 600);
  };

  const handleCopyDossier = () => {
    const text = buildDossierText(editData);
    try {
      navigator.clipboard?.writeText?.(text);
      setCopiedDossier(true);
      toast.success("Clinical summary copied to clipboard!");
      setTimeout(() => setCopiedDossier(false), 2000);
    } catch (e) {
      toast.error("Failed to copy summary to clipboard");
    }
  };

  const handleAutoResize = (e) => {
    if (e?.target) {
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
  };

  return (
    <>
      {/* Referral Forwarding Dispatch & Confirmation */}
      <div className="pt-3 border-t border-current/15 space-y-3">
        {sentStatus && (
          <div className="rounded-xl border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 sm:p-3.5 text-xs font-bold text-emerald-950 dark:text-emerald-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-extrabold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                  Clinical summary sent to {sentStatus.shortName} at {sentStatus.timestamp}
                </p>
                <p className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                  Handover Ref: {sentStatus.dispatchId} {sentStatus.location ? `· Location: ${sentStatus.location}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 transition hover:bg-emerald-100/80 shadow-2xs cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" /> Update / Re-send
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-medium hidden sm:block">
            Transmit verified clinical summary, caller address &amp; findings.
          </p>

          <button
            type="button"
            onClick={handleOpenModal}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer ${
              sentStatus
                ? "bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-500/40"
                : getTeamButtonClass(selectedTeam.id)
            }`}
          >
            {sentStatus ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
                <span>✓ Forwarded to {sentStatus.shortName} (Click to re-send)</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 shrink-0" />
                <span>Send clinical summary to {selectedTeam.shortName}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clean Document Window Modal */}
      {modalOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-3xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="border-b border-border/80 bg-secondary/30 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-sm sm:text-base font-bold text-foreground truncate">
                    Verify &amp; send clinical summary
                  </span>
                  {sentStatus && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/60 shadow-2xs shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Forwarded
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-xs sm:text-sm font-bold text-foreground bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 px-2.5 py-1 rounded-md">
                    Caller ID: <span className="font-mono text-purple-700 dark:text-purple-400">{activeCallerId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Clean Document Content Area (Clean flowing document with delicate colors) */}
              <div className="p-6 sm:p-8 overflow-y-auto font-sans text-sm leading-relaxed text-foreground space-y-6 select-text">

                {/* 108 Alert if ambulance */}
                {isTarget108 && (
                  <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-950 dark:text-rose-200 font-semibold space-y-1 shadow-2xs">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                      <Ambulance className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 animate-pulse" />
                      <span className="uppercase tracking-wider font-extrabold text-[11px]">
                        108 Ambulance Dispatch Alert
                      </span>
                    </div>
                    <p className="text-rose-900 dark:text-rose-200 leading-relaxed text-xs pl-6">
                      Verify exact caller house number, street, or landmark so the ambulance crew can navigate immediately without delay.
                    </p>
                  </div>
                )}

                {/* 1. CALLER DETAILS */}
                <div className="space-y-2.5">
                  <div className="pb-1 border-b border-blue-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400 tracking-tight">
                      1. Caller Details
                    </h3>
                  </div>

                  <ul className="space-y-2 pl-1">
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Name:</span>
                      <input
                        type="text"
                        value={editData.callerName}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, callerName: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Phone Number:</span>
                      <input
                        type="text"
                        value={editData.phone ? (editData.phone.startsWith("+91") ? editData.phone : `+91 ${editData.phone}`) : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^\+91\s*/, "").trim();
                          setEditData((d) => ({ ...d, phone: raw }));
                        }}
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium font-mono rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Age:</span>
                      <input
                        type="text"
                        value={editData.age}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, age: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Gender:</span>
                      <input
                        type="text"
                        value={editData.sex}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, sex: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Case Date:</span>
                      <span className="px-1.5 py-0.5 font-medium text-foreground">
                        {triageTimestamp}
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0 mt-0.5 text-foreground">• Address:</span>
                      <textarea
                        rows={1}
                        value={editData.landmark}
                        onChange={(e) => {
                          setEditData((d) => ({ ...d, landmark: e.target.value }));
                          handleAutoResize(e);
                        }}
                        onFocus={handleAutoResize}
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition resize-none overflow-hidden leading-relaxed"
                        placeholder=""
                      />
                    </li>
                  </ul>
                </div>

                {/* 2. CLINICAL OVERVIEW */}
                <div className="space-y-2.5">
                  <div className="pb-1 border-b border-emerald-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                      2. Clinical Overview
                    </h3>
                  </div>

                  <ul className="space-y-2 pl-1">
                    <li className="space-y-1.5">
                      <span className="font-bold block text-foreground">• Chief Complaint:</span>
                      <div className="pl-5 space-y-1.5">
                        {Array.isArray(editData.allReasons) && editData.allReasons.length > 0 ? (
                          editData.allReasons.map((reason, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-2xs"
                            >
                              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 ring-2 ring-emerald-500/20" />
                              <input
                                type="text"
                                value={reason}
                                onChange={(e) => {
                                  const updated = [...editData.allReasons];
                                  updated[idx] = e.target.value;
                                  setEditData((d) => ({
                                    ...d,
                                    allReasons: updated,
                                    firstReason: updated[0] || "",
                                    secondReason: updated[1] || "",
                                  }));
                                }}
                                className="w-full bg-transparent outline-none font-semibold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm"
                                placeholder={idx === 0 ? "Primary Complaint" : `Additional Complaint ${idx + 1}`}
                              />
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 ring-2 ring-emerald-500/20" />
                              <input
                                type="text"
                                value={editData.firstReason}
                                onChange={(e) =>
                                  setEditData((d) => ({ ...d, firstReason: e.target.value }))
                                }
                                className="w-full bg-transparent outline-none font-semibold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm"
                                placeholder="Primary Complaint"
                              />
                            </div>
                            {editData.secondReason !== undefined && editData.secondReason !== "" && (
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-2xs">
                                <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 ring-2 ring-emerald-500/20" />
                                <input
                                  type="text"
                                  value={editData.secondReason}
                                  onChange={(e) =>
                                    setEditData((d) => ({ ...d, secondReason: e.target.value }))
                                  }
                                  className="w-full bg-transparent outline-none font-semibold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm"
                                  placeholder="Secondary Complaint"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </li>

                    {/* Clinical Red Flags point directly under Chief Complaint */}
                    <li className="space-y-1.5">
                      <span className="font-bold block text-rose-700 dark:text-rose-400">• Clinical Red Flags:</span>
                      <div className="pl-5 space-y-1.5">
                        {Array.isArray(editData.redFlags) && editData.redFlags.length > 0 ? (
                          editData.redFlags.map((flag, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/50 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 transition shadow-2xs"
                            >
                              <span className="h-2 w-2 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0 ring-2 ring-rose-500/20" />
                              <input
                                type="text"
                                value={flag}
                                onChange={(e) => {
                                  const updated = [...editData.redFlags];
                                  updated[idx] = e.target.value;
                                  setEditData((d) => ({ ...d, redFlags: updated }));
                                }}
                                className="w-full bg-transparent outline-none font-semibold text-rose-950 dark:text-rose-100 text-xs sm:text-sm"
                                placeholder="Clinical Red Flag"
                              />
                            </div>
                          ))
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>None reported (No acute hemodynamic danger signs)</span>
                          </div>
                        )}
                      </div>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0 mt-0.5 text-foreground">• History of Present Illness(from how long it happening):</span>
                      <textarea
                        rows={1}
                        value={editData.hpiDuration}
                        onChange={(e) => {
                          setEditData((d) => ({ ...d, hpiDuration: e.target.value }));
                          handleAutoResize(e);
                        }}
                        onFocus={handleAutoResize}
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition resize-none overflow-hidden"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0 mt-0.5 text-foreground">• Associated Symptoms:</span>
                      <textarea
                        rows={1}
                        value={editData.associatedSymptoms}
                        onChange={(e) => {
                          setEditData((d) => ({ ...d, associatedSymptoms: e.target.value }));
                          handleAutoResize(e);
                        }}
                        onFocus={handleAutoResize}
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition resize-none overflow-hidden"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Comorbidity:</span>
                      <input
                        type="text"
                        value={editData.comorbidity || ""}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, comorbidity: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Any medication:</span>
                      <input
                        type="text"
                        value={(editData.medications || "").replace(/^medications?\s*(?:taken)?[:\s]*/i, "")}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, medications: e.target.value.replace(/^medications?\s*(?:taken)?[:\s]*/i, "") }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>
                  </ul>
                </div>

                {/* 3. PAST HISTORY OF THE CALLER */}
                <div className="space-y-3 pt-1">
                  <div className="pb-1.5 border-b border-indigo-500/25 flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">
                      3. Past History of the Caller
                    </h3>
                    {pastHistoryList.length > 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                        {pastHistoryList.length} prior {pastHistoryList.length === 1 ? "call" : "calls"}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        First-time Caller
                      </span>
                    )}
                  </div>

                  {pastHistoryList.length > 0 ? (
                    <div className="space-y-3">
                      {pastHistoryList.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 p-3 sm:p-4 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/50 dark:border-indigo-900/40 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                                Past History {idx + 1}
                              </span>
                              {(item.caller_id || activeCallerId || item.case_ref) && (
                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                                  ({item.caller_id || activeCallerId || item.case_ref})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>{formatHistoryDateTime(item.created_at)}</span>
                            </div>
                          </div>

                          {/* Chief Complaint */}
                          <div className="space-y-1">
                            <span className="font-bold text-xs sm:text-sm text-foreground block">
                              • Chief Complaint:
                            </span>
                            <p className="text-xs sm:text-sm font-medium text-foreground/90 pl-3 leading-relaxed">
                              {item.chief_complaint || "No chief complaint recorded"}
                            </p>
                          </div>

                          {/* Clinical Red Flags */}
                          <div className="space-y-1">
                            <span className="font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-400 block">
                              • Clinical Red Flags:
                            </span>
                            <div className="pl-3">
                              {Array.isArray(item.red_flags) && item.red_flags.length > 0 ? (
                                <ul className="space-y-1">
                                  {item.red_flags.map((rf, rIdx) => (
                                    <li
                                      key={rIdx}
                                      className="text-xs sm:text-sm text-rose-950 dark:text-rose-200 font-semibold flex items-center gap-2"
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                                      <span>{rf}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : typeof item.red_flags === "string" && item.red_flags.trim().length > 0 ? (
                                <p className="text-xs sm:text-sm text-rose-950 dark:text-rose-200 font-semibold">
                                  {item.red_flags}
                                </p>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>None reported</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-xs sm:text-sm text-muted-foreground flex items-center gap-2.5">
                      <Info className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                      <span>No previous consultation history recorded for this caller (First recorded visit).</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/80 bg-secondary/30 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleConfirmSend}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${getTeamButtonClass(
                    selectedTeam.id
                  )}`}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : sentStatus ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {isSending
                      ? "Transmitting..."
                      : sentStatus
                      ? `Re-send / Update to ${selectedTeam.shortName}`
                      : `Confirm & Send to ${selectedTeam.shortName}`}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
