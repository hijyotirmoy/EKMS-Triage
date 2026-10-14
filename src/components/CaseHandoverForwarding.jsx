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
  CalendarCheck,
  CalendarPlus,
  Building2,
  Printer,
  QrCode,
  ChevronDown,
  Navigation,
  Trash2,
  ShieldCheck,
  History,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, normalizeUrgency } from "../lib/api";
import { updateCaseInLocalCache, getCachedCases, getCachedCrmCallHistory } from "../lib/clientCache";
import { broadcastEvent } from "../lib/broadcastSync";
import { getCallerIdForPhone } from "../lib/callerId";
import { deduplicateRedFlags, summarizeRedFlags, extractCallerReportedProblems } from "../lib/triageEngine";
import assamPincodesData from "../data/assam_pincodes.json";
import {
  isDispensary,
  isEsicHospital,
  isGovtDistrictHospital,
  isTieUp,
  resolveCallerLocation,
  calculateRoadDistanceKm,
} from "../lib/geo";

const formatApproxKm = (dist) => {
  if (dist == null || isNaN(dist)) return null;
  const num = Number(dist);
  return num < 10 ? num.toFixed(1) : Math.round(num);
};

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

export const ALL_OPD_TIME_SLOTS = [
  "09:30 AM - 10:00 AM",
  "10:00 AM - 10:30 AM",
  "10:30 AM - 11:00 AM",
  "11:00 AM - 11:30 AM",
  "11:30 AM - 12:00 PM",
  "02:00 PM - 02:30 PM",
  "02:30 PM - 03:00 PM",
  "03:00 PM - 03:30 PM",
  "03:30 PM - 04:00 PM",
  "04:00 PM - 04:30 PM",
  "04:30 PM - 05:00 PM",
  "05:00 PM - 05:30 PM",
];

export function getSlotStartDecimalHour(slotStr) {
  try {
    const startPart = slotStr.split("-")[0].trim();
    const [time, meridiem] = startPart.split(" ");
    let [hours, mins] = time.split(":").map(Number);
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours + (mins || 0) / 60;
  } catch (e) {
    return 0;
  }
}

export function getSlotStatus(slotStr, dateStr) {
  if (!dateStr) return { isPast: false, isBooked: false, isAvailable: true };

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  // 1. Past Day Check: Cannot book past day visit
  if (dateStr < todayStr) {
    return { isPast: true, isBooked: false, isAvailable: false, reason: "Past Day" };
  }

  // 2. Past Hour Check: Cannot book past hour booking on today
  if (dateStr === todayStr) {
    const currentDecimalHour = now.getHours() + now.getMinutes() / 60;
    const slotHour = getSlotStartDecimalHour(slotStr);
    if (slotHour <= currentDecimalHour) {
      return { isPast: true, isBooked: false, isAvailable: false, reason: "Past Hour" };
    }
  }

  // 3. Randomly make some slots booked in each day just for testing
  let hash = 0;
  const key = `${dateStr}_${slotStr}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 37 + key.charCodeAt(i)) % 10007;
  }
  // Roughly 25-30% of future slots marked as Booked for test simulation
  if (hash % 3 === 0) {
    return { isPast: false, isBooked: true, isAvailable: false, reason: "Booked" };
  }

  return { isPast: false, isBooked: false, isAvailable: true };
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
  const primaryComplaint =
    [cleanField(firstReason), cleanField(secondReason)].filter(Boolean).join(", ") ||
    result?.triage?.primary_complaint ||
    result?.triage?.chief_complaint ||
    callerIntake?.symptom_notes ||
    result?.intake?.symptom_notes ||
    "";

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
    primaryComplaint: primaryComplaint,
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
  caseRef: propCaseRef,
  activeDirective,
  allRedFlags = [],
  callerIntake = null,
  callerHistory = [],
  onForwardSuccess,
  onAppointmentBooked,
  onAppointmentCancelled,
  externalTrigger = null,
  dynamicFacilities = null,
  effectiveLoc = null,
  searchPincode = "",
  isFreshTriage = false,
  isCrmPage = null,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentStatus, setSentStatus] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  // Appointment Booking States
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [showTokenSuccess, setShowTokenSuccess] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const dayAfterTomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Form states for booking - defaults to today and first available valid future slot
  const [apptDate, setApptDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [apptTimeSlot, setApptTimeSlot] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const tStr = `${y}-${m}-${d}`;
    const firstAvail = ALL_OPD_TIME_SLOTS.find(
      (s) => getSlotStatus(s, tStr).isAvailable
    );
    return firstAvail || "";
  });

  // Slot availability verification for the chosen date
  const availableSlotsOnDate = useMemo(() => {
    return ALL_OPD_TIME_SLOTS.filter((s) => getSlotStatus(s, apptDate).isAvailable);
  }, [apptDate]);

  const hasAvailableSlots = availableSlotsOnDate.length > 0;
  const isCurrentSlotValid = Boolean(apptTimeSlot && getSlotStatus(apptTimeSlot, apptDate).isAvailable);
  const canConfirmBooking = hasAvailableSlots && isCurrentSlotValid && !isBookingSubmitting;

  const [apptDepartment, setApptDepartment] = useState("General Medicine / Primary Care OPD");
  const [apptDoctor, setApptDoctor] = useState("Dr. A. K. Sharma, MBBS (Medical Officer)");
  const [apptType, setApptType] = useState("Regular OPD Consultation");
  const [apptNotes, setApptNotes] = useState("");
  const [sendSmsNotification, setSendSmsNotification] = useState(true);
  const [bringDocsChecked, setBringDocsChecked] = useState(true);

  // Auto-select first available valid slot when date changes, or clear slot if none available
  useEffect(() => {
    const status = apptTimeSlot ? getSlotStatus(apptTimeSlot, apptDate) : null;
    if (!status || !status.isAvailable) {
      const firstAvail = ALL_OPD_TIME_SLOTS.find(
        (s) => getSlotStatus(s, apptDate).isAvailable
      );
      setApptTimeSlot(firstAvail || "");
    }
  }, [apptDate, appointmentModalOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (confirmCancelOpen) {
          setConfirmCancelOpen(false);
        } else if (appointmentModalOpen) {
          setAppointmentModalOpen(false);
        } else if (modalOpen) {
          setModalOpen(false);
        }
      }
    };
    if (modalOpen || appointmentModalOpen || confirmCancelOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, appointmentModalOpen, confirmCancelOpen]);

  const t = result?.triage || {};
  const caseRef = propCaseRef || result?.case_ref || result?.case_id || result?.id || "CA0001AB01";
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
      const refId = result.reference_no || result.dispatch_id;
      setSentStatus({
        teamName: result.forwarded_to || "ESIS Dispensary",
        shortName: result.forwarded_short_name || (result.forwarded_to?.includes("Dispensary") ? "ESIS Dispensary" : "Facility"),
        dispatchId: refId || `DISP-${String(caseTarget || "SENT").slice(-6)}`,
        referenceNo: refId,
        timestamp: result.forwarded_at ? formatTriageDate(result.forwarded_at) : "Recently",
        location: result.intake?.landmark || "",
      });
      return;
    }

    if (typeof window !== "undefined" && caseTarget && !(isFreshTriage || result?.is_fresh_triage)) {
      try {
        const stored =
          sessionStorage.getItem(`ekms_forwarded_${caseTarget}`) ||
          localStorage.getItem(`ekms_forwarded_${caseTarget}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.is_forwarded && (parsed.case_ref === caseTarget || parsed.dispatch_id || parsed.reference_no)) {
            const refId = parsed.reference_no || parsed.dispatch_id;
            setSentStatus({
              teamName: parsed.forwarded_to || "ESIS Dispensary",
              shortName: parsed.forwarded_short_name || "Facility",
              dispatchId: refId || `DISP-${String(caseTarget || "SENT").slice(-6)}`,
              referenceNo: refId,
              timestamp: parsed.forwarded_at ? formatTriageDate(parsed.forwarded_at) : "Recently",
              location: "",
            });
            return;
          }
        }

        const cached = getCachedCases().find((c) => String(c.case_ref) === String(caseTarget) || String(c.id) === String(caseTarget));
        if (cached && (cached.is_forwarded || cached.forwarded_at || cached.status === "forwarded")) {
          const refId = cached.reference_no || cached.dispatch_id;
          setSentStatus({
            teamName: cached.forwarded_to || "ESIS Dispensary",
            shortName: cached.forwarded_short_name || "Facility",
            dispatchId: refId || `DISP-${String(caseTarget).slice(-6)}`,
            referenceNo: refId,
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

  // Detect if running in CRM page context
  const isCrmMode = useMemo(() => {
    if (isCrmPage !== undefined && isCrmPage !== null) return Boolean(isCrmPage);
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p.includes("/beneficiary") || p.includes("/crm")) return true;
    }
    return Boolean(result?.source === "crm" || result?.isCrmCall || callerIntake?.source === "crm");
  }, [isCrmPage, result, callerIntake]);

  // Helper: check if record is from CRM
  const isCrmRecord = (item) => {
    if (item.source === "crm" || item.isCrmCall) return true;
    if (item.campaign || item.callType || item.subCategory || item.category) return true;
    const ref = String(item.case_ref || item.caseId || "");
    if (ref && !ref.startsWith("CAS-") && !ref.startsWith("TRG-") && !ref.startsWith("TRIAGE-") && !ref.startsWith("EKMS-")) {
      return true;
    }
    return false;
  };

  // 1. Gather 104 Helpline Triage Cases
  const helplineCases = useMemo(() => {
    const rawTarget = String(intakeData.phone || "").replace(/\D/g, "");
    const target10 = rawTarget.length >= 10 ? rawTarget.slice(-10) : "";
    let list = [];

    try {
      const cached = getCachedCases() || [];
      if (target10) {
        list = cached
          .filter((c) => {
            const rawCp = String(c.intake?.phone || c.phone || "").replace(/\D/g, "");
            const cp10 = rawCp.length >= 10 ? rawCp.slice(-10) : "";
            return cp10 === target10;
          })
          .map((c) => ({
            id: c.id || c.case_ref,
            case_ref: c.case_ref || "",
            caller_id: c.caller_id || c.intake?.caller_id || "",
            created_at: c.created_at || c.timestamp || "",
            chief_complaint: c.triage?.primary_complaint || c.intake?.symptom_notes || c.triage?.chief_complaint || c.triage?.summary_en || "",
            red_flags: Array.isArray(c.triage?.red_flags) && c.triage.red_flags.length > 0
              ? c.triage.red_flags
              : (c.ekms_ai_context?.triageState?.redFlagsDetected || []),
            source: "helpline",
            sourceLabel: "104 Helpline Triage",
            urgency_level: normalizeUrgency(c.triage?.urgency_level) || "Mild",
            urgency_score: c.triage?.urgency_score || 0,
            recommended_action: c.triage?.recommended_action || "",
          }));
      }
    } catch (_) {}

    if (Array.isArray(callerHistory)) {
      callerHistory.forEach((h) => {
        if (!isCrmRecord(h)) {
          if (!list.some((existing) => existing.case_ref && existing.case_ref === h.case_ref)) {
            list.push({
              id: h.id || h.case_ref,
              case_ref: h.case_ref || "",
              caller_id: h.caller_id || "",
              created_at: h.created_at || h.createdAt || "",
              chief_complaint: h.chief_complaint || h.reason || h.summary || "",
              red_flags: h.red_flags || [],
              source: "helpline",
              sourceLabel: "104 Helpline Triage",
              urgency_level: normalizeUrgency(h.urgency_level) || "Mild",
              urgency_score: h.urgency_score || 0,
              recommended_action: h.recommended_action || h.navigation || "",
            });
          }
        }
      });
    }

    const currentCaseRef = result?.case_ref || result?.case_id || "";
    return list
      .filter((item) => !currentCaseRef || item.case_ref !== currentCaseRef)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [intakeData.phone, callerHistory, result]);

  // 2. Gather CRM Call Logs
  const crmCallLogs = useMemo(() => {
    const rawTarget = String(intakeData.phone || "").replace(/\D/g, "");
    const target10 = rawTarget.length >= 10 ? rawTarget.slice(-10) : "";
    let list = [];

    try {
      const raw = localStorage.getItem("crm_all_call_logs");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && target10) {
          list = parsed
            .filter((c) => {
              const cPh = String(c.phoneNumber || c.cleanPhone || "").replace(/\D/g, "");
              const c10 = cPh.length >= 10 ? cPh.slice(-10) : "";
              return c10 === target10;
            })
            .map((c) => ({
              id: c.id,
              case_ref: c.caseId || c.case_ref || "",
              caller_id: c.beneficiaryId || c.caller_id || "",
              created_at: c.createdAt || c.timestamp || c.date || "",
              chief_complaint: c.notes || c.summary || c.campaign || "Inbound consultation",
              red_flags: [],
              source: "crm",
              sourceLabel: "CRM Call Log",
              callType: c.callType || c.type || "Call",
              category: c.category || "",
              subCategory: c.subCategory || "",
              campaign: c.campaign || "",
              duration: c.duration || "",
              agent: c.agent || "",
              status: c.status || "Connected",
            }));
        }
      }
    } catch (_) {}

    if (Array.isArray(callerHistory)) {
      callerHistory.forEach((h) => {
        if (isCrmRecord(h)) {
          if (!list.some((existing) => existing.id === h.id || (existing.case_ref && existing.case_ref === (h.case_ref || h.caseId)))) {
            list.push({
              id: h.id,
              case_ref: h.caseId || h.case_ref || "",
              caller_id: h.caller_id || h.beneficiaryId || "",
              created_at: h.created_at || h.createdAt || h.timestamp || "",
              chief_complaint: h.chief_complaint || h.notes || h.summary || "Inbound consultation",
              red_flags: h.red_flags || [],
              source: "crm",
              sourceLabel: "CRM Call Log",
              callType: h.callType || "Call",
              category: h.category || "",
              subCategory: h.subCategory || "",
              campaign: h.campaign || "",
              duration: h.duration || "",
              agent: h.agent || "",
              status: h.status || "Connected",
            });
          }
        }
      });
    }

    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [intakeData.phone, callerHistory]);

  // Strictly separated call history per page:
  // If in CRM mode -> ONLY show CRM call logs
  // If in Home page mode -> ONLY show 104 helpline / triage cases
  const displayedCallHistory = useMemo(() => {
    return isCrmMode ? crmCallLogs : helplineCases;
  }, [isCrmMode, crmCallLogs, helplineCases]);

  // Legacy pastHistoryList alias to keep all existing helpers valid
  const pastHistoryList = displayedCallHistory;

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

  const handleOpenModal = (overrideFacility = null) => {
    if (overrideFacility) {
      setSelectedFacility(overrideFacility);
    }
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
    if (isCrmMode) {
      if (crmCallLogs.length > 0) {
        historySection += crmCallLogs
          .map((item, idx) => {
            const timeStr = formatHistoryDateTime(item.created_at);
            const comp = item.chief_complaint || "Inbound consultation";
            return `• Past Call ${idx + 1} (${timeStr}):\n  Notes: ${comp}\n  Type: ${item.callType || "Call"}${item.category ? ` | ${item.category}` : ""}${item.agent ? ` (Agent: ${item.agent})` : ""}`;
          })
          .join("\n\n");
      } else {
        historySection += "• No previous consultation history recorded for this caller.";
      }
    } else {
      if (helplineCases.length > 0) {
        historySection += helplineCases
          .map((item, idx) => {
            const timeStr = formatHistoryDateTime(item.created_at);
            const comp = item.chief_complaint || "None recorded";
            let rfStr = "None reported";
            if (Array.isArray(item.red_flags) && item.red_flags.length > 0) {
              rfStr = item.red_flags.join("; ");
            } else if (typeof item.red_flags === "string" && item.red_flags.trim()) {
              rfStr = item.red_flags;
            }
            return `• Past Helpline Triage ${idx + 1} (${timeStr}):\n  Chief Complaint: ${comp}\n  Clinical Red Flags: ${rfStr}`;
          })
          .join("\n\n");
      } else {
        historySection += "• No previous consultation history recorded for this caller.";
      }
    }

    const targetFacilityClause = isBookable && (selectedFacility?.name || facilityDisplayName)
      ? `\n• Target Referral Facility: ${selectedFacility?.name || facilityDisplayName}${selectedFacility?.distance_km != null ? ` (Approx ${formatApproxKm(selectedFacility.distance_km)} KM away)` : ""}`
      : "";

    const activeRefNo = getUnifiedReferenceCode();
    return `1. Caller Details                                         Caller ID: ${activeCallerId}
• Reference No: ${activeRefNo}
• Name: ${data.callerName || ""}
• Phone Number: ${formattedPhone}
• Age: ${data.age ? data.age : ""}
• Gender: ${data.sex || ""}
• Case Date: ${triageTimestamp}
• Address: ${data.landmark || ""}${targetFacilityClause}

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

  const getFacilityPrefixSuffix = (teamId, facility, nameStr = "") => {
    const rawName = (facility?.name || nameStr || "").toLowerCase();
    const type = (facility?.facility_type || "").toLowerCase();

    // 1. 108 Ambulance Dispatch -> AMBU-00001-108A
    if (teamId === "108_AMBULANCE" || rawName.includes("108") || rawName.includes("ambulance")) {
      return { prefix: "AMBU", suffix: "108A" };
    }

    // 2. 104 Health Helpline -> HEHE-00001-104H
    if (teamId === "104_MEDICAL" || teamId === "TELE_104" || rawName.includes("104") || rawName.includes("helpline")) {
      return { prefix: "HEHE", suffix: "104H" };
    }

    // 3. Empanelled Tie-Up Facility -> TIUP-00001-HOSP
    if (
      teamId === "TIE_UP_FACILITY" ||
      isTieUp(facility) ||
      rawName.includes("tie-up") ||
      rawName.includes("tie up") ||
      rawName.includes("empanelled")
    ) {
      return { prefix: "TIUP", suffix: "HOSP" };
    }

    // 4. ESIS Dispensary -> ESIC-00001-DISP
    if (
      teamId === "ESIS_DISPENSARY" ||
      isDispensary(facility) ||
      rawName.includes("dispensary") ||
      rawName.includes("esis")
    ) {
      return { prefix: "ESIC", suffix: "DISP" };
    }

    // 5. ESIC Hospital -> ESIC-00001-HOSP
    if (
      teamId === "ESIC_HOSPITAL" ||
      isEsicHospital(facility) ||
      (rawName.includes("esic") && (rawName.includes("hospital") || type.includes("hospital")))
    ) {
      return { prefix: "ESIC", suffix: "HOSP" };
    }

    // 6. Govt District Hospital -> GOVT-00001-HOSP
    if (
      teamId === "DIST_HOSPITAL" ||
      isGovtDistrictHospital(facility) ||
      rawName.includes("district hospital") ||
      rawName.includes("civil hospital") ||
      rawName.includes("govt") ||
      rawName.includes("medical college")
    ) {
      return { prefix: "GOVT", suffix: "HOSP" };
    }

    if (teamId === "ESIS_DISPENSARY") return { prefix: "ESIC", suffix: "DISP" };
    if (teamId === "ESIC_HOSPITAL") return { prefix: "ESIC", suffix: "HOSP" };
    if (teamId === "DIST_HOSPITAL") return { prefix: "GOVT", suffix: "HOSP" };
    if (teamId === "TIE_UP_FACILITY") return { prefix: "TIUP", suffix: "HOSP" };

    return { prefix: "ESIC", suffix: "DISP" };
  };

  const getCaseNumericSeq = () => {
    const existing =
      bookedAppointment?.referenceNo ||
      bookedAppointment?.tokenNo ||
      sentStatus?.referenceNo ||
      sentStatus?.dispatchId ||
      result?.reference_no ||
      result?.dispatch_id ||
      result?.booked_appointment?.referenceNo ||
      result?.booked_appointment?.tokenNo;

    if (existing) {
      const match = String(existing).match(/^[A-Z]{4}-(\d{5})-[A-Z0-9]{4,5}$/i);
      if (match) return match[1];
      const matchAny5 = String(existing).match(/\b(\d{5})\b/);
      if (matchAny5) return matchAny5[1];
    }

    const targetRef = caseRef || propCaseRef || result?.case_ref || "";
    if (targetRef) {
      const caMatch = String(targetRef).match(/^CA(\d{4})/i);
      if (caMatch) {
        const n = parseInt(caMatch[1], 10);
        return String(n).padStart(5, "0");
      }
      const digitsMatch = String(targetRef).match(/\d+/);
      if (digitsMatch) {
        const n = parseInt(digitsMatch[0], 10);
        return String(n).padStart(5, "0");
      }
    }

    return "00001";
  };

  const getUnifiedReferenceCode = (targetTeamId, targetFacility, targetFacilityName) => {
    const existingCode =
      bookedAppointment?.referenceNo ||
      bookedAppointment?.tokenNo ||
      sentStatus?.referenceNo ||
      sentStatus?.dispatchId ||
      result?.reference_no ||
      result?.dispatch_id;

    if (existingCode && /^[A-Z]{4}-\d{5}-[A-Z0-9]{4,5}$/i.test(String(existingCode).trim())) {
      return String(existingCode).trim().toUpperCase();
    }

    const team = targetTeamId || selectedTeam?.id;
    const fac = targetFacility || selectedFacility;
    const facName = targetFacilityName || fac?.name || facilityDisplayName;
    const { prefix, suffix } = getFacilityPrefixSuffix(team, fac, facName);
    const seq = getCaseNumericSeq();
    return `${prefix}-${seq}-${suffix}`;
  };

  const handleConfirmSend = () => {
    if (bookedAppointment) {
      const bookedFacClean = (bookedAppointment.facilityName || "").toLowerCase().trim();
      const targetFacClean = isBookable
        ? (selectedFacility?.name || facilityDisplayName || "").toLowerCase().trim()
        : (selectedTeam.teamName || selectedTeam.name || "").toLowerCase().trim();
      const isSame =
        bookedFacClean === targetFacClean ||
        bookedFacClean.includes(targetFacClean) ||
        targetFacClean.includes(bookedFacClean);
      if (!isSame || isTarget108 || selectedTeam.id === "104_MEDICAL" || selectedTeam.id === "TELE_104") {
        toast.error(
          `An OPD appointment is already booked at ${bookedAppointment.facilityName}. Clinical summary can only be forwarded to ${bookedAppointment.facilityName}. Both referral and appointment must be for the same facility.`
        );
        return;
      }
    }

    if (isBookable && !selectedFacility && availableFacilities.length > 0) {
      toast.error("Please select a target facility from the dropdown before sending the clinical summary.");
      return;
    }

    setIsSending(true);

    const resolvedFacilityName = isBookable ? (selectedFacility?.name || facilityDisplayName) : selectedTeam.name;
    const unifiedReferenceNo = getUnifiedReferenceCode(selectedTeam.id, selectedFacility, resolvedFacilityName);
    const dispatchId = unifiedReferenceNo;
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
        directiveId: activeDirective?.id,
        targetTeamId: selectedTeam.id,
        teamName: resolvedFacilityName,
        shortName: isBookable ? (selectedFacility?.name || selectedTeam.shortName) : selectedTeam.shortName,
        teamShortName: selectedTeam.shortName,
        dispatchId: unifiedReferenceNo,
        referenceNo: unifiedReferenceNo,
        timestamp,
        location: editData.landmark,
        facilityId: selectedFacility?.id || null,
        facilityName: resolvedFacilityName,
        facilityDistanceKm: selectedFacility?.distance_km ?? null,
      };
      setSentStatus(statusData);
      onForwardSuccess?.(statusData);

      const forwardPayload = {
        case_ref: caseRef,
        is_forwarded: true,
        forwarded_at: new Date().toISOString(),
        dispatch_id: unifiedReferenceNo,
        reference_no: unifiedReferenceNo,
        directive_id: activeDirective?.id,
        forwarded_directive_id: activeDirective?.id,
        target_team_id: selectedTeam.id,
        forwarded_team_id: selectedTeam.id,
        forwarded_to: resolvedFacilityName,
        forwarded_short_name: selectedTeam.shortName,
        forwarded_facility_name: isBookable ? resolvedFacilityName : null,
        status: "forwarded",
        dispatch_info: statusData,
        triage: {
          ...(result?.triage || {}),
          forwarded_to: resolvedFacilityName,
          call_referral_primary: isBookable ? resolvedFacilityName : selectedTeam.shortName,
          referral_destination: isBookable ? resolvedFacilityName : selectedTeam.shortName,
        },
      };

      if (bookedAppointment && (bookedAppointment.referenceNo !== unifiedReferenceNo || bookedAppointment.tokenNo !== unifiedReferenceNo)) {
        const alignedBooking = {
          ...bookedAppointment,
          tokenNo: unifiedReferenceNo,
          referenceNo: unifiedReferenceNo,
        };
        setBookedAppointment(alignedBooking);
        try {
          localStorage.setItem(`ekms_appt_${caseRef}`, JSON.stringify(alignedBooking));
        } catch (e) {}
        broadcastEvent("CASE_APPOINTMENT_BOOKED", {
          case_ref: caseRef,
          appointment: alignedBooking,
        });
      }

      if (result) {
        result.is_forwarded = true;
        result.forwarded_at = forwardPayload.forwarded_at;
        result.dispatch_id = unifiedReferenceNo;
        result.reference_no = unifiedReferenceNo;
        result.forwarded_directive_id = activeDirective?.id;
        result.forwarded_team_id = selectedTeam.id;
        result.forwarded_to = resolvedFacilityName;
        result.forwarded_short_name = selectedTeam.shortName;
        result.forwarded_facility_name = isBookable ? resolvedFacilityName : null;
        result.status = "forwarded";
        result.dispatch_info = statusData;
        if (result.triage) {
          result.triage.forwarded_to = resolvedFacilityName;
          result.triage.call_referral_primary = isBookable ? resolvedFacilityName : selectedTeam.shortName;
          result.triage.referral_destination = isBookable ? resolvedFacilityName : selectedTeam.shortName;
        }
      }

      const targets = Array.from(
        new Set(
          [
            caseRef,
            propCaseRef,
            result?.case_ref,
            result?.case_id,
            result?.id,
            editData?.caseRef,
          ].filter(Boolean).map((k) => String(k).trim())
        )
      );

      targets.forEach((targetKey) => {
        const upper = targetKey.toUpperCase();
        try {
          sessionStorage.setItem(`ekms_forwarded_${targetKey}`, JSON.stringify(forwardPayload));
          localStorage.setItem(`ekms_forwarded_${targetKey}`, JSON.stringify(forwardPayload));
          if (upper !== targetKey) {
            sessionStorage.setItem(`ekms_forwarded_${upper}`, JSON.stringify(forwardPayload));
            localStorage.setItem(`ekms_forwarded_${upper}`, JSON.stringify(forwardPayload));
          }
        } catch (e) {}
        updateCaseInLocalCache(targetKey, forwardPayload);
      });

      const primaryTarget = caseRef || targets[0];
      if (primaryTarget) {
        broadcastEvent("CASE_FORWARDED", {
          case_ref: primaryTarget,
          id: result?.id,
          all_targets: targets,
          ...forwardPayload,
        });
        try {
          api.patch("/cases", { case_ref: primaryTarget, updates: forwardPayload }).catch(() => {});
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

  const isForwardedToTeleOrAmbulance = Boolean(
    sentStatus &&
    (
      (sentStatus.teamName && (sentStatus.teamName.includes("104") || sentStatus.teamName.includes("108"))) ||
      (sentStatus.shortName && (sentStatus.shortName.includes("104") || sentStatus.shortName.includes("108"))) ||
      (sentStatus.directiveId && (sentStatus.directiveId.includes("104") || sentStatus.directiveId.includes("108"))) ||
      (sentStatus.targetTeamId && (sentStatus.targetTeamId.includes("104") || sentStatus.targetTeamId.includes("108")))
    )
  );

  // Destination bookability check:
  // Clickable ONLY when forward option is dispensary, hospital, tie up hospital
  // In case of ambulance (108) and 104, or when already forwarded to 104/108, button is NOT clickable
  const isBookable =
    !isForwardedToTeleOrAmbulance &&
    [
      "ESIS_DISPENSARY",
      "ESIC_HOSPITAL",
      "TIE_UP_FACILITY",
      "DIST_HOSPITAL",
    ].includes(selectedTeam.id);

  // 1. Resolve caller location to compute road distances
  const callerLoc = useMemo(() => {
    if (
      effectiveLoc &&
      effectiveLoc.latitude != null &&
      effectiveLoc.longitude != null &&
      !effectiveLoc.isNoLocation
    ) {
      return effectiveLoc;
    }
    if (
      result?.resolved_location &&
      result.resolved_location.latitude != null &&
      result.resolved_location.longitude != null
    ) {
      return result.resolved_location;
    }
    const pin =
      (searchPincode && /^\d{6}$/.test(String(searchPincode).trim()) && String(searchPincode).trim()) ||
      (callerIntake?.pincode && /^\d{6}$/.test(String(callerIntake.pincode).trim()) && String(callerIntake.pincode).trim()) ||
      (result?.intake?.pincode && /^\d{6}$/.test(String(result.intake.pincode).trim()) && String(result.intake.pincode).trim()) ||
      null;

    if (pin && assamPincodesData && assamPincodesData[pin]) {
      const p = assamPincodesData[pin];
      if (p.lat != null && p.lng != null) {
        return {
          latitude: Number(p.lat),
          longitude: Number(p.lng),
          pincode: pin,
          district: p.district || null,
        };
      }
    }

    const intake = {
      ...(result?.intake || {}),
      ...(callerIntake || {}),
    };
    if (pin) intake.pincode = pin;
    const activeFacilities = Array.isArray(dynamicFacilities) && dynamicFacilities.length > 0
      ? dynamicFacilities
      : (Array.isArray(result?.nearest_facilities) ? result.nearest_facilities : []);
    return resolveCallerLocation(intake, activeFacilities);
  }, [effectiveLoc, result?.resolved_location, result?.intake, callerIntake, searchPincode, dynamicFacilities]);

  // 2. Build full facility list with road distances
  const allRankedFacilities = useMemo(() => {
    // Collect pre-calculated distances from dynamicFacilities (matches facility cards 100%)
    const dynamicMap = new Map();
    if (Array.isArray(dynamicFacilities)) {
      dynamicFacilities.forEach((f) => {
        const key = (f.name || f.id || "").toLowerCase().trim();
        if (key) dynamicMap.set(key, f);
      });
    }

    const existingNearest = Array.isArray(result?.nearest_facilities) ? result.nearest_facilities : [];
    existingNearest.forEach((f) => {
      const key = (f.name || f.id || "").toLowerCase().trim();
      if (key && !dynamicMap.has(key)) dynamicMap.set(key, f);
    });

    const baseFacilities = Array.isArray(dynamicFacilities) && dynamicFacilities.length > 0
      ? dynamicFacilities
      : (Array.isArray(result?.nearest_facilities) ? result.nearest_facilities : []);

    return baseFacilities.map((f) => {
      const key = (f.name || f.id || "").toLowerCase().trim();
      const existing = dynamicMap.get(key);
      if (existing && existing.distance_km != null) {
        return { ...f, ...existing };
      }

      let dist = existing?.distance_km ?? null;
      if (
        dist == null &&
        callerLoc?.latitude != null &&
        callerLoc?.longitude != null &&
        f.latitude != null &&
        f.longitude != null
      ) {
        const d = calculateRoadDistanceKm(
          Number(callerLoc.latitude),
          Number(callerLoc.longitude),
          Number(f.latitude),
          Number(f.longitude)
        );
        if (d != null) {
          dist = d <= 0.2 ? 0.5 : Math.round(d * 10) / 10;
        }
      }

      return {
        ...f,
        ...(existing || {}),
        distance_km: dist,
      };
    });
  }, [dynamicFacilities, result?.nearest_facilities, callerLoc]);

  // 3. Filter and sort facilities for the active forward category (arranged in ascending distance order)
  const availableFacilities = useMemo(() => {
    if (!isBookable) return [];

    let list = [];
    switch (selectedTeam.id) {
      case "ESIS_DISPENSARY":
        list = allRankedFacilities.filter(
          (f) => isDispensary(f) || (f.facility_type || "").toLowerCase().includes("dispensary")
        );
        break;
      case "DIST_HOSPITAL":
        list = allRankedFacilities.filter(
          (f) =>
            isGovtDistrictHospital(f) ||
            (f.facility_type || "").toLowerCase().includes("district hospital") ||
            (f.facility_type || "").toLowerCase().includes("civil hospital")
        );
        break;
      case "ESIC_HOSPITAL":
        list = allRankedFacilities.filter(
          (f) =>
            isEsicHospital(f) ||
            (f.name || "").toLowerCase().includes("esic hospital") ||
            (f.facility_type || "").toLowerCase() === "esic hospital"
        );
        break;
      case "TIE_UP_FACILITY":
        list = allRankedFacilities.filter(
          (f) =>
            isTieUp(f) ||
            (f.facility_type || "").toLowerCase().includes("tie") ||
            (f.scheme || "").toLowerCase().includes("tie")
        );
        break;
      default:
        list = allRankedFacilities;
    }

    // Sort strictly in ascending order of distance (nearest facility first)
    return list.sort((a, b) => {
      const da = a.distance_km != null ? Number(a.distance_km) : 9999;
      const db = b.distance_km != null ? Number(b.distance_km) : 9999;
      return da - db;
    });
  }, [allRankedFacilities, selectedTeam.id, isBookable]);

  // 4. Locked Facility Resolution (Enforce: Referral and Appointment MUST be for the exact same facility)
  const lockedForwardFacilityName = useMemo(() => {
    if (!sentStatus) return null;
    const name = sentStatus.facilityName || sentStatus.teamName || sentStatus.shortName;
    if (!name) return null;
    if (name.includes("104") || name.includes("108")) return null;
    return name;
  }, [sentStatus]);

  const lockedBookedFacilityName = useMemo(() => {
    if (!bookedAppointment?.facilityName) return null;
    return bookedAppointment.facilityName;
  }, [bookedAppointment?.facilityName]);

  const lockedFacilityObj = useMemo(() => {
    const target = lockedForwardFacilityName || lockedBookedFacilityName;
    if (!target) return null;
    const clean = target.toLowerCase().trim();
    return (
      allRankedFacilities.find((f) => {
        const fn = (f.name || "").toLowerCase().trim();
        return fn === clean || clean.includes(fn) || fn.includes(clean);
      }) || {
        name: target,
        facility_type: target.includes("Dispensary")
          ? "Dispensary"
          : target.includes("ESIC")
          ? "ESIC Hospital"
          : target.includes("Tie")
          ? "Tie-Up Hospital"
          : "District Hospital",
        distance_km: null,
      }
    );
  }, [lockedForwardFacilityName, lockedBookedFacilityName, allRankedFacilities]);

  // 5. Agent selected facility state (persisted across modals)
  const [selectedFacility, setSelectedFacility] = useState(null);

  // Auto-synchronize: if already forwarded, selectedFacility is strictly locked to the forwarded facility
  useEffect(() => {
    if (lockedForwardFacilityName) {
      if (selectedFacility?.name !== lockedForwardFacilityName) {
        setSelectedFacility(lockedFacilityObj || { name: lockedForwardFacilityName });
      }
      // Reconcile any existing mismatch in bookedAppointment
      if (bookedAppointment && bookedAppointment.facilityName !== lockedForwardFacilityName) {
        const aligned = {
          ...bookedAppointment,
          facilityName: lockedForwardFacilityName,
          facilityShortName: lockedForwardFacilityName,
        };
        setBookedAppointment(aligned);
        try {
          localStorage.setItem(`ekms_appt_${caseRef}`, JSON.stringify(aligned));
        } catch (e) {}
        broadcastEvent("CASE_APPOINTMENT_BOOKED", {
          case_ref: caseRef,
          appointment: aligned,
        });
      }
      return;
    }

    if (lockedBookedFacilityName) {
      if (selectedFacility?.name !== lockedBookedFacilityName) {
        setSelectedFacility(lockedFacilityObj || { name: lockedBookedFacilityName });
      }
      return;
    }

    // Otherwise, pre-select nearest facility in current directive category
    if (isBookable && availableFacilities.length > 0) {
      const exists = availableFacilities.some(
        (f) => (selectedFacility?.id && f.id === selectedFacility.id) || f.name === selectedFacility?.name
      );
      if (!exists) {
        setSelectedFacility(availableFacilities[0]);
      }
    }
  }, [
    lockedForwardFacilityName,
    lockedBookedFacilityName,
    lockedFacilityObj,
    availableFacilities,
    isBookable,
    selectedFacility,
    bookedAppointment,
    caseRef,
  ]);

  const facilityDisplayName = useMemo(() => {
    if (lockedForwardFacilityName) {
      return lockedForwardFacilityName;
    }
    if (lockedBookedFacilityName) {
      return lockedBookedFacilityName;
    }
    if (isBookable && selectedFacility?.name) {
      return selectedFacility.name;
    }
    if (isBookable && availableFacilities.length > 0) {
      return availableFacilities[0].name;
    }
    switch (selectedTeam.id) {
      case "108_AMBULANCE":
        return "108 Emergency Ambulance Dispatch";
      case "104_MEDICAL":
        return "104 Health Helpline / Tele-Doctor";
      default:
        return selectedTeam.name;
    }
  }, [
    lockedForwardFacilityName,
    lockedBookedFacilityName,
    isBookable,
    selectedFacility,
    availableFacilities,
    selectedTeam,
  ]);

  const activeBookingFacility = useMemo(() => {
    if (lockedForwardFacilityName) {
      return lockedFacilityObj || { name: lockedForwardFacilityName };
    }
    if (lockedBookedFacilityName) {
      return lockedFacilityObj || { name: lockedBookedFacilityName };
    }
    if (isBookable && selectedFacility) {
      return selectedFacility;
    }
    if (isBookable && availableFacilities.length > 0) {
      return availableFacilities[0];
    }
    return null;
  }, [
    lockedForwardFacilityName,
    lockedBookedFacilityName,
    lockedFacilityObj,
    isBookable,
    selectedFacility,
    availableFacilities,
  ]);

  const isDispensaryBooking = useMemo(() => {
    if (selectedTeam?.id === "ESIS_DISPENSARY") return true;
    if (!activeBookingFacility) {
      return String(facilityDisplayName || "").toLowerCase().includes("dispensary");
    }
    const facType = String(activeBookingFacility.facility_type || "").toLowerCase();
    const facName = String(activeBookingFacility.name || facilityDisplayName || "").toLowerCase();
    return isDispensary(activeBookingFacility) || facType.includes("dispensary") || facName.includes("dispensary");
  }, [selectedTeam, activeBookingFacility, facilityDisplayName]);

  // When dispensary is selected, strictly enforce "General Medicine / Primary Care OPD" only
  useEffect(() => {
    if (isDispensaryBooking && apptDepartment !== "General Medicine / Primary Care OPD") {
      setApptDepartment("General Medicine / Primary Care OPD");
    }
  }, [isDispensaryBooking, apptDepartment]);

  // Restore booked appointment if previously saved for this case
  useEffect(() => {
    if (typeof window !== "undefined" && caseRef && !(isFreshTriage || result?.is_fresh_triage)) {
      try {
        const saved = localStorage.getItem(`ekms_appt_${caseRef}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // If summary was forwarded, force the booked appointment to match the forwarded facility
          if (lockedForwardFacilityName && parsed.facilityName !== lockedForwardFacilityName) {
            parsed.facilityName = lockedForwardFacilityName;
            parsed.facilityShortName = lockedForwardFacilityName;
            localStorage.setItem(`ekms_appt_${caseRef}`, JSON.stringify(parsed));
          }
          if (!parsed.referenceNo && parsed.tokenNo) {
            parsed.referenceNo = parsed.tokenNo;
          }
          setBookedAppointment(parsed);
          setShowTokenSuccess(true);
        }
      } catch (e) {}
    }
  }, [caseRef, lockedForwardFacilityName]);

  // Keep appointment in lockstep with the selected referral facility
  useEffect(() => {
    const targetFac = lockedForwardFacilityName || selectedFacility?.name || facilityDisplayName;
    if (
      bookedAppointment &&
      isBookable &&
      targetFac &&
      bookedAppointment.facilityName !== targetFac
    ) {
      const updated = {
        ...bookedAppointment,
        facilityName: targetFac,
        facilityShortName: targetFac,
      };
      setBookedAppointment(updated);
      try {
        localStorage.setItem(`ekms_appt_${caseRef}`, JSON.stringify(updated));
      } catch (e) {}
      broadcastEvent("CASE_APPOINTMENT_BOOKED", {
        case_ref: caseRef,
        appointment: updated,
      });
    }
  }, [
    selectedTeam.id,
    isBookable,
    selectedFacility,
    facilityDisplayName,
    bookedAppointment,
    caseRef,
    lockedForwardFacilityName,
  ]);

  // Handle external trigger from facility cards or large map view
  useEffect(() => {
    if (!externalTrigger || !externalTrigger.facility || !externalTrigger.timestamp) return;
    const { type, facility } = externalTrigger;
    if (facility) {
      setSelectedFacility(facility);
    }
    if (type === "forward") {
      handleOpenModal(facility);
    } else if (type === "book") {
      if (facility) {
        setSelectedFacility(facility);
      }
      if (bookedAppointment) {
        setShowTokenSuccess(true);
      } else {
        setShowTokenSuccess(false);
      }
      setAppointmentModalOpen(true);
    }
  }, [externalTrigger]);

  const handleOpenAppointmentModal = () => {
    if (isForwardedToTeleOrAmbulance) {
      toast.warning(
        `Appointment booking is not available. Case is already forwarded to ${sentStatus.shortName || sentStatus.teamName}. Telephonic and emergency helpline dispatches cannot book OPD appointments.`
      );
      return;
    }
    if (!isBookable) {
      toast.warning(
        `Appointment booking is not available for ${selectedTeam.shortName}. Both referral and appointment must be in a medical facility (ESIS Dispensary, ESIC Hospital, Tie-Up, or District Hospital).`
      );
      return;
    }
    if (bookedAppointment) {
      setShowTokenSuccess(true);
    } else {
      setShowTokenSuccess(false);
    }
    setAppointmentModalOpen(true);
  };

  const handleConfirmBooking = (e) => {
    e?.preventDefault();
    if (isForwardedToTeleOrAmbulance) {
      toast.error(
        `Cannot book appointment. Clinical summary is already forwarded to ${sentStatus.shortName || sentStatus.teamName}. Both referral and appointment must be for the same facility.`
      );
      return;
    }
    if (sentStatus) {
      const fwdName = sentStatus.facilityName || sentStatus.teamName || sentStatus.shortName;
      if (fwdName) {
        const fwdClean = fwdName.toLowerCase().trim();
        const bookTargetClean = (selectedFacility?.name || facilityDisplayName || "").toLowerCase().trim();
        const isSame =
          fwdClean === bookTargetClean ||
          fwdClean.includes(bookTargetClean) ||
          bookTargetClean.includes(fwdClean);
        if (!isSame) {
          toast.error(
            `Cannot book at ${selectedFacility?.name || facilityDisplayName}. Clinical summary is already forwarded to ${fwdName}. Both referral and appointment must be for the same facility.`
          );
          return;
        }
      }
    }
    if (!isBookable) {
      toast.error(
        `Referral and appointment must be in the same facility. Cannot book appointment for ${selectedTeam.shortName}.`
      );
      return;
    }
    if (isBookable && !selectedFacility && availableFacilities.length > 0) {
      toast.error("Please select a target facility from the dropdown before confirming appointment.");
      return;
    }
    if (!hasAvailableSlots) {
      toast.error("No consultation slots are available for this date. Please select Tomorrow or another upcoming date.");
      return;
    }
    if (!apptTimeSlot || !getSlotStatus(apptTimeSlot, apptDate).isAvailable) {
      toast.error("Please select a valid and available time slot before confirming appointment.");
      return;
    }
    setIsBookingSubmitting(true);
    setTimeout(() => {
      const resolvedFacilityName = selectedFacility?.name || facilityDisplayName;
      const unifiedReferenceNo = getUnifiedReferenceCode(selectedTeam.id, selectedFacility, resolvedFacilityName);
      const tokenNo = unifiedReferenceNo;
      const resolvedChiefComplaint =
        extractedDetails.primaryComplaint ||
        extractedDetails.firstReason ||
        "Fever with chills and shivering in diabetic patient";
      const resolvedRedFlags = extractedDetails.redFlags || [];

      const newBooking = {
        tokenNo: unifiedReferenceNo,
        referenceNo: unifiedReferenceNo,
        facilityName: resolvedFacilityName,
        facilityTeamId: selectedTeam.id,
        facilityShortName: selectedTeam.shortName,
        facilityDistanceKm: selectedFacility?.distance_km ?? null,
        facilityDistrict: selectedFacility?.district ?? "",
        department: isDispensaryBooking ? "General Medicine / Primary Care OPD" : apptDepartment,
        doctor: apptDoctor,
        date: apptDate,
        timeSlot: apptTimeSlot,
        appointmentType: apptType,
        patientName: intakeData.callerName || "Jyotimoy Choudhury",
        patientPhone: intakeData.phone || "6002283107",
        patientAge: intakeData.age || "38",
        patientSex: intakeData.sex || "Male",
        patientAddress: intakeData.landmark || "Kamrup Metro, Dispur (PIN: 781006)",
        chiefComplaint: resolvedChiefComplaint,
        redFlags: resolvedRedFlags,
        agentNotes: apptNotes ? apptNotes.trim() : "",
        bookedAt: new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      };

      setBookedAppointment(newBooking);
      if (sentStatus && (sentStatus.dispatchId !== unifiedReferenceNo || sentStatus.referenceNo !== unifiedReferenceNo)) {
        const alignedStatus = {
          ...sentStatus,
          dispatchId: unifiedReferenceNo,
          referenceNo: unifiedReferenceNo,
        };
        setSentStatus(alignedStatus);
      }
      setShowTokenSuccess(true);
      setIsBookingSubmitting(false);

      try {
        localStorage.setItem(`ekms_appt_${caseRef}`, JSON.stringify(newBooking));
        if (result) {
          result.booked_appointment = newBooking;
          result.reference_no = unifiedReferenceNo;
          result.dispatch_id = unifiedReferenceNo;
        }
      } catch (e) {}

      broadcastEvent("CASE_APPOINTMENT_BOOKED", {
        case_ref: caseRef,
        appointment: newBooking,
      });

      onAppointmentBooked?.(newBooking);

      toast.success(
        `OPD Appointment booked! Reference No: ${unifiedReferenceNo} generated and SMS dispatched to +91 ${newBooking.patientPhone}.`
      );
    }, 500);
  };

  const handleCancelBooking = (e) => {
    e?.stopPropagation?.();
    const caseTarget = caseRef || result?.case_ref || result?.case_id || result?.id;
    if (typeof window !== "undefined" && caseTarget) {
      try {
        localStorage.removeItem(`ekms_appt_${caseTarget}`);
        sessionStorage.removeItem(`ekms_appt_${caseTarget}`);
      } catch (err) {}
    }
    if (result && result.booked_appointment) {
      delete result.booked_appointment;
    }
    setBookedAppointment(null);
    setShowTokenSuccess(false);

    broadcastEvent("CASE_APPOINTMENT_CANCELLED", {
      case_ref: caseTarget,
      timestamp: new Date().toISOString(),
    });

    onAppointmentCancelled?.(caseTarget);
    toast.success("Appointment booking cancelled successfully.");
  };

  const handlePrintTokenSlip = () => {
    if (!bookedAppointment || typeof window === "undefined") return;

    const redFlagsHtml =
      bookedAppointment.redFlags && bookedAppointment.redFlags.length > 0
        ? bookedAppointment.redFlags
            .map((flag) => {
              const text =
                typeof flag === "string"
                  ? flag
                  : flag.label || flag.name || String(flag);
              return `<span style="display:inline-block;background:#ffe4e6;color:#9f1239;border:1px solid #f43f5e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;margin:2px 4px 2px 0;">• ${text}</span>`;
            })
            .join("")
        : "";

    const notesHtml = bookedAppointment.agentNotes
      ? `<div style="margin-top:10px;padding:8px 12px;background:#f8fafc;border-left:4px solid #ea580c;border-radius:4px;">
          <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Agent Visit Notes / Instructions:</div>
          <div style="font-size:11.5px;color:#0f172a;margin-top:3px;font-style:italic;">${bookedAppointment.agentNotes}</div>
         </div>`
      : "";

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OPD Token Receipt - ${bookedAppointment.referenceNo || bookedAppointment.tokenNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      line-height: 1.35;
      font-size: 12px;
    }
    .slip-container {
      max-width: 650px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 20px 24px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .facility-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }
    .facility-sub {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
    .token-box {
      text-align: center;
      background: #ecfdf5;
      border: 2px solid #10b981;
      border-radius: 10px;
      padding: 12px 18px;
      margin-bottom: 14px;
    }
    .token-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #047857;
    }
    .token-number {
      font-size: 28px;
      font-weight: 900;
      font-family: monospace;
      color: #064e3b;
      margin: 2px 0;
    }
    .token-sub {
      font-size: 11px;
      color: #047857;
      font-weight: 600;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .info-cell .label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .info-cell .value {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }
    .clinical-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .clinical-box .label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .clinical-box .value {
      font-size: 11.5px;
      color: #0f172a;
      line-height: 1.4;
    }
    .notice-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 10.5px;
      color: #166534;
      font-weight: 500;
      line-height: 1.4;
    }
    .footer-note {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header">
      <div>
        <div class="facility-title">${bookedAppointment.facilityName}</div>
        <div class="facility-sub">Emergency Knowledge Management System (EKMS) • Outpatient Token Slip</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10.5px; font-weight: 700; background: #ffedd5; color: #c2410c; padding: 3px 8px; border-radius: 6px; border: 1px solid #fdba74;">
          ${bookedAppointment.appointmentType}
        </div>
        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 3px;">
          Booked: ${bookedAppointment.bookedAt}
        </div>
      </div>
    </div>

    <div class="token-box">
      <div class="token-label">OPD Consultation • Reference No</div>
      <div class="token-number">${bookedAppointment.referenceNo || bookedAppointment.tokenNo}</div>
      <div class="token-sub">Report to OPD Registration Counter / Gate No. 2 with this slip</div>
    </div>

    <div class="info-grid">
      <div class="info-cell">
        <div class="label">Patient Name</div>
        <div class="value">${bookedAppointment.patientName} (${bookedAppointment.patientAge} Y / ${bookedAppointment.patientSex})</div>
      </div>
      <div class="info-cell">
        <div class="label">Contact Mobile</div>
        <div class="value">+91 ${bookedAppointment.patientPhone}</div>
      </div>
      <div class="info-cell">
        <div class="label">Consultation Date &amp; Time Slot</div>
        <div class="value" style="color: #ea580c;">${bookedAppointment.date} &nbsp;(${bookedAppointment.timeSlot})</div>
      </div>
      <div class="info-cell" style="grid-column: span 2;">
        <div class="label">OPD Department / Clinic</div>
        <div class="value">${bookedAppointment.department}</div>
      </div>
      ${
        bookedAppointment.patientAddress
          ? `<div class="info-cell" style="grid-column: span 2;">
              <div class="label">Caller Location / Address</div>
              <div class="value" style="font-size: 11px; font-weight: 600; color: #475569;">${bookedAppointment.patientAddress}</div>
            </div>`
          : ""
      }
    </div>

    <div class="clinical-box">
      <div class="label">Chief Clinical Reason for Visit</div>
      <div class="value">${bookedAppointment.chiefComplaint}</div>
      ${
        bookedAppointment.redFlags && bookedAppointment.redFlags.length > 0
          ? `<div style="margin-top: 8px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #e11d48; margin-bottom: 3px;">
                Clinical Red Flags (Attention Medical Officer):
              </div>
              <div>${redFlagsHtml}</div>
            </div>`
          : ""
      }
      ${notesHtml}
    </div>

    <div class="notice-box">
      ✓ SMS confirmation with token details dispatched to <strong>+91 ${bookedAppointment.patientPhone}</strong>.<br />
      • Please arrive 15 minutes prior to your allocated slot.<br />
      • Carry your ESIC Pehchan / Insurance card and prior medical records.
    </div>

    <div class="footer-note">
      <span>Authorized by National Health Mission / ESIC Health Services</span>
      <span>Printed on: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  </div>
</body>
</html>`;

    let iframe = document.getElementById("ekms-token-print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "ekms-token-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow || iframe.contentDocument;
    const targetDoc = doc.document || doc;
    targetDoc.open();
    targetDoc.write(printHtml);
    targetDoc.close();

    setTimeout(() => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch (e) {
        console.error("Iframe print error, falling back to window.print():", e);
        window.print();
      }
    }, 250);
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
                  Reference No: {sentStatus.referenceNo || sentStatus.dispatchId} {sentStatus.location ? `· Location: ${sentStatus.location}` : ""}
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

        {/* Booked Appointment Confirmation Banner */}
        {bookedAppointment && (
          <div className="rounded-xl border border-orange-500/60 bg-orange-50 dark:bg-orange-950/40 p-3 sm:p-3.5 text-xs font-bold text-orange-950 dark:text-orange-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CalendarCheck className="h-5 w-5 text-orange-700 dark:text-orange-400 shrink-0" />
              <div>
                <p className="font-extrabold text-orange-950 dark:text-orange-100 text-xs sm:text-sm">
                  OPD Appointment Confirmed · Reference No: {bookedAppointment.referenceNo || bookedAppointment.tokenNo}
                </p>
                <p className="text-[11px] font-mono text-orange-800 dark:text-orange-300">
                  {bookedAppointment.facilityName} · {bookedAppointment.date} at {bookedAppointment.timeSlot} ({bookedAppointment.department})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAppointmentModal}
                className="flex items-center gap-1.5 rounded-lg border border-orange-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-orange-900 dark:text-orange-200 transition hover:bg-orange-100/80 shadow-2xs cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" /> View / Print Token Slip
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                title="Cancel booked appointment"
                className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Section: Title above the two buttons */}
        <div className="space-y-2 pt-1">
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            Send Clinical summary and Book an appointment
          </p>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* 1. Send Clinical Summary Button (no facility mentioned) */}
            <button
              type="button"
              onClick={handleOpenModal}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer ${
                sentStatus
                  ? "border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/40 shadow-emerald-600/25"
                  : getTeamButtonClass(selectedTeam.id)
              }`}
            >
              {sentStatus ? (
                <>
                  <Check className="h-4 w-4 shrink-0 text-white" />
                  <span>Forwarded</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 shrink-0" />
                  <span>Send clinical summary</span>
                </>
              )}
            </button>

            {/* 2. Book Appointment Button */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <button
                type="button"
                disabled={!isBookable}
                onClick={handleOpenAppointmentModal}
                title={
                  isForwardedToTeleOrAmbulance
                    ? `Booking not available: Case already forwarded to ${sentStatus?.shortName || sentStatus?.teamName}`
                    : isBookable
                    ? "Book appointment"
                    : "Appointment booking not applicable for emergency ambulance or helpline dispatch"
                }
                className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-md active:scale-98 ${
                  isBookable
                    ? bookedAppointment
                      ? "border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/40 shadow-emerald-600/25 cursor-pointer"
                      : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-500/25 ring-2 ring-orange-500/30 cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60 shadow-none"
                }`}
              >
                {bookedAppointment ? (
                  <>
                    <CalendarCheck className="h-4 w-4 shrink-0 text-white" />
                    <span>Booked</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-4 w-4 shrink-0" />
                    <span>Book appointment</span>
                  </>
                )}
                {!isBookable && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    Disabled
                  </span>
                )}
              </button>
            </div>
          </div>
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

                {/* Target Facility Selection (Locked if appointment already booked, else Proximity Dropdown) */}
                {lockedBookedFacilityName ? (
                  <div className="rounded-2xl border-2 border-orange-500/50 bg-orange-50/80 dark:bg-orange-950/30 p-4 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-orange-600" />
                        <span>🔒 Facility Locked to Booked Appointment</span>
                      </label>
                      <span className="text-[10.5px] font-bold text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/60 px-2.5 py-0.5 rounded-full border border-orange-400/40">
                        Reference No: {bookedAppointment?.referenceNo || bookedAppointment?.tokenNo}
                      </span>
                    </div>

                    <div className="rounded-xl border border-orange-300 dark:border-orange-800 bg-card p-3 text-xs sm:text-sm font-bold text-foreground flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-orange-600 shrink-0" />
                        <span className="truncate">{lockedBookedFacilityName}</span>
                      </div>
                      {lockedFacilityObj?.distance_km != null && Number(lockedFacilityObj.distance_km) > 0 && (
                        <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 shrink-0">
                          Approx {formatApproxKm(lockedFacilityObj.distance_km)} KM
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed font-medium">
                      ✓ Clinical summary can <strong>only</strong> be forwarded to <strong>{lockedBookedFacilityName}</strong> because an OPD appointment has already been booked there. Referral and appointment must be at the same facility.
                    </p>
                  </div>
                ) : isBookable ? (
                  <div className="rounded-2xl border-2 border-blue-500/35 bg-blue-50/60 dark:bg-blue-950/25 p-4 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span>Select Target {selectedTeam.shortName} (Arranged by Proximity)</span>
                      </label>
                      <span className="text-[10.5px] font-bold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                        {availableFacilities.length} available · Nearest first
                      </span>
                    </div>

                    <div className="relative">
                      <select
                        value={selectedFacility?.id || selectedFacility?.name || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = availableFacilities.find(
                            (f) => String(f.id) === val || f.name === val
                          );
                          if (found) setSelectedFacility(found);
                        }}
                        className="w-full rounded-xl border-2 border-blue-400/60 dark:border-blue-700 bg-card p-3 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs cursor-pointer appearance-none pr-10"
                      >
                        {availableFacilities.map((f, idx) => {
                          const hasDist = f.distance_km != null && Number(f.distance_km) > 0;
                          const distStr = hasDist ? `Approx ${formatApproxKm(f.distance_km)} KM` : "";
                          const distBadge = distStr ? (idx === 0 ? `[★ ${distStr} (Nearest)] ` : `[${distStr}] `) : "";
                          const area = f.district && !/^(NA|N\/A|0|null|undefined|-+)$/i.test(String(f.district).trim()) ? `(${f.district})` : "";
                          return (
                            <option key={f.id || f.name || idx} value={f.id || f.name}>
                              {distBadge}{f.name} {area}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-blue-600 dark:text-blue-400">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>

                    {selectedFacility && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                        <div className="flex items-center gap-2">
                          {selectedFacility.distance_km != null && Number(selectedFacility.distance_km) > 0 && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/30 text-[11px]">
                              <Navigation className="h-3 w-3" />
                              Approx {formatApproxKm(selectedFacility.distance_km)} KM road distance
                            </span>
                          )}
                          {selectedFacility.district && (
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground text-[11.5px]">
                              <MapPin className="h-3.5 w-3.5 text-blue-600" />
                              {selectedFacility.district} {selectedFacility.pincode ? `• PIN: ${selectedFacility.pincode}` : ""}
                            </span>
                          )}
                        </div>
                        {selectedFacility.address && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                            {selectedFacility.address}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

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
                <div className="space-y-3.5 pt-1">
                  <div className="pb-2 border-b border-indigo-500/25 flex flex-wrap items-center justify-between gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">
                      3. Past History of the Caller
                    </h3>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900/60 shadow-2xs text-indigo-700 dark:text-indigo-300">
                      <History className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Recorded Calls</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 font-extrabold ml-1">
                        {displayedCallHistory.length}
                      </span>
                    </div>
                  </div>

                  {/* CALL HISTORY */}
                  <div className="space-y-3">
                      {displayedCallHistory.length > 0 ? (
                        <div className="space-y-3">
                          {displayedCallHistory.map((item, idx) => {
                            return (
                              <div
                                key={item.id ? `call_${item.id}_${idx}` : `hist_${idx}`}
                                className={`rounded-xl border p-3 sm:p-4 space-y-2.5 shadow-2xs transition ${
                                  isCrmMode
                                    ? "border-purple-200/70 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20"
                                    : "border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20"
                                }`}
                              >
                                <div
                                  className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 ${
                                    isCrmMode
                                      ? "border-purple-200/50 dark:border-purple-900/40"
                                      : "border-indigo-200/50 dark:border-indigo-900/40"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-xs sm:text-sm text-foreground">
                                      Past History {idx + 1}
                                    </span>

                                    {(item.case_ref || item.caller_id || activeCallerId) && (
                                      <span className="font-mono text-[11px] text-primary font-bold">
                                        ({item.case_ref || item.caller_id || activeCallerId})
                                      </span>
                                    )}

                                    {!isCrmMode && item.urgency_level && (() => {
                                      const norm = normalizeUrgency(item.urgency_level);
                                      return (
                                        <span
                                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                            norm === "Severe"
                                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                                              : norm === "Moderate"
                                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                          }`}
                                        >
                                          {norm}
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                                    <span>{formatHistoryDateTime(item.created_at)}</span>
                                  </div>
                                </div>

                                {isCrmMode ? (
                                  <>
                                    {/* CRM Metadata Row */}
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-medium pb-0.5">
                                      {item.callType && (
                                        <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-bold text-foreground">
                                          {item.callType}
                                        </span>
                                      )}
                                      {item.category && (
                                        <span>
                                          Category: <strong className="text-foreground">{item.category}</strong>
                                        </span>
                                      )}
                                      {item.subCategory && (
                                        <span>• {item.subCategory}</span>
                                      )}
                                      {item.agent && (
                                        <span>
                                          • Agent: <strong className="text-foreground">{item.agent}</strong>
                                        </span>
                                      )}
                                      {item.duration && (
                                        <span>• Duration: {item.duration}</span>
                                      )}
                                    </div>

                                    {/* CRM Notes */}
                                    <div className="space-y-1">
                                      <span className="font-bold text-xs sm:text-sm text-foreground block">
                                        • Consultation Notes / Reason:
                                      </span>
                                      <p className="text-xs sm:text-sm font-medium text-foreground/90 pl-3 leading-relaxed">
                                        {item.chief_complaint || "Inbound consultation recorded"}
                                      </p>
                                    </div>
                                  </>
                                ) : (
                                  <>
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

                                    {item.recommended_action && (
                                      <div className="rounded-lg bg-indigo-100/60 dark:bg-indigo-900/30 p-2 text-xs text-indigo-950 dark:text-indigo-200 font-medium">
                                        <span className="font-bold">Navigation / Action:</span> {item.recommended_action}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-xs sm:text-sm text-muted-foreground flex items-center gap-2.5">
                          <Info className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                          <span>
                            {isCrmMode
                              ? "No previous CRM call history recorded for this caller."
                              : "No previous consultation history recorded for this caller (First recorded visit)."}
                          </span>
                        </div>
                      )}
                    </div>
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
                      ? `Re-send / Update to ${isBookable ? (selectedFacility?.name || facilityDisplayName) : selectedTeam.shortName}`
                      : `Confirm & Send to ${isBookable ? (selectedFacility?.name || facilityDisplayName) : selectedTeam.shortName}`}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* OPD Facility Appointment Booking Modal Window */}
      {appointmentModalOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAppointmentModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="border-b border-border/80 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600/15 text-orange-600 dark:text-orange-400 shrink-0">
                    <CalendarCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate flex items-center gap-2">
                      <span>Book OPD Facility Appointment</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-500/30">
                        {selectedTeam.shortName}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {bookedAppointment && (
                    <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-500/30">
                      Reference No: {bookedAppointment.referenceNo || bookedAppointment.tokenNo}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAppointmentModalOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
                {showTokenSuccess && bookedAppointment ? (
                  /* --- BOOKING CONFIRMED SUCCESS / TOKEN SLIP VIEW --- */
                  <div id="opd-token-receipt-print" className="space-y-4">
                    <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 sm:p-5 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                          Official Appointment Confirmed
                        </span>
                        <h4 className="text-2xl font-black font-mono text-emerald-950 dark:text-emerald-100 tracking-tight mt-0.5">
                          {bookedAppointment.referenceNo || bookedAppointment.tokenNo}
                        </h4>
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                          OPD Consultation Reference No allocated at {bookedAppointment.facilityName}
                        </p>
                      </div>
                    </div>

                    {/* Official Token Slip Card */}
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3 shadow-2xs font-sans">
                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-orange-600" />
                          <span className="font-bold text-foreground text-xs sm:text-sm">
                            {bookedAppointment.facilityName}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded">
                          {bookedAppointment.appointmentType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                            Date &amp; Time Slot
                          </span>
                          <span className="font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-orange-600" />
                            {bookedAppointment.date} ({bookedAppointment.timeSlot})
                          </span>
                        </div>

                        <div>
                          <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                            OPD Department
                          </span>
                          <span className="font-bold text-foreground block mt-0.5">
                            {bookedAppointment.department}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                            Patient Name
                          </span>
                          <span className="font-bold text-foreground block mt-0.5">
                            {bookedAppointment.patientName} ({bookedAppointment.patientAge}y / {bookedAppointment.patientSex})
                          </span>
                        </div>

                        <div>
                          <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                            Contact Phone
                          </span>
                          <span className="font-mono font-bold text-foreground block mt-0.5">
                            +91 {bookedAppointment.patientPhone}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-border pt-2.5 space-y-2 text-xs">
                        <div>
                          <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                            Chief Clinical Complaint:
                          </span>
                          <p className="text-foreground mt-0.5 font-medium leading-relaxed bg-card p-2 rounded-lg border border-border/60">
                            {bookedAppointment.chiefComplaint}
                          </p>
                        </div>

                        {bookedAppointment.redFlags && bookedAppointment.redFlags.length > 0 && (
                          <div>
                            <span className="text-[10.5px] uppercase font-bold text-rose-600 dark:text-rose-400 block">
                              Clinical Red Flags:
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {bookedAppointment.redFlags.map((flag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[10.5px] font-bold text-rose-800 dark:text-rose-200"
                                >
                                  • {typeof flag === "string" ? flag : flag.label || flag.name || String(flag)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {bookedAppointment.agentNotes && (
                          <div>
                            <span className="text-[10.5px] uppercase font-bold text-muted-foreground block">
                              Agent Visit Notes / Doctor Instructions:
                            </span>
                            <p className="text-foreground mt-0.5 font-medium leading-relaxed bg-card p-2 rounded-lg border border-border/60 italic">
                              {bookedAppointment.agentNotes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 p-2.5 flex items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-300">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          SMS Notification dispatched to <strong>+91 {bookedAppointment.patientPhone}</strong> with token pass and reporting gate details.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- APPOINTMENT BOOKING FORM --- */
                  <form onSubmit={handleConfirmBooking} className="space-y-4">
                    {/* Patient & Facility Summary Card */}
                    <div className="rounded-xl border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-white font-bold text-sm shrink-0">
                          {(intakeData.callerName || "IP")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-2">
                            <span>{intakeData.callerName || "Jyotimoy Choudhury"}</span>
                            <span className="text-[10.5px] text-muted-foreground font-normal">
                              ({intakeData.age || "38"}y / {intakeData.sex || "Male"})
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-foreground font-bold">
                              +91 {intakeData.phone || "6002283107"}
                            </span>
                            <span>•</span>
                            <span>{facilityDisplayName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/80 px-2 py-0.5 rounded-full border border-orange-500/30">
                          {selectedTeam.shortName}
                        </span>
                      </div>
                    </div>

                    {/* Target Booking Facility Selection (Locked if clinical summary already forwarded, else Proximity Dropdown) */}
                    {lockedForwardFacilityName ? (
                      <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>🔒 Facility Locked to Clinical Summary Dispatch</span>
                          </label>
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                            Referral Match Enforced
                          </span>
                        </div>

                        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-card p-3 text-xs sm:text-sm font-bold text-foreground flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{lockedForwardFacilityName}</span>
                          </div>
                          {lockedFacilityObj?.distance_km != null && Number(lockedFacilityObj.distance_km) > 0 && (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                              Approx {formatApproxKm(lockedFacilityObj.distance_km)} KM
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                          ✓ Appointment can <strong>only</strong> be booked at <strong>{lockedForwardFacilityName}</strong> because the caller&apos;s clinical summary has already been transmitted there. Both referral and appointment must be at the same facility.
                        </p>
                      </div>
                    ) : isBookable ? (
                      <div className="rounded-2xl border-2 border-orange-500/35 bg-orange-50/60 dark:bg-orange-950/25 p-3.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-[11px] font-black uppercase tracking-wider text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-orange-600" />
                            <span>Select Booking Facility (Arranged by Proximity)</span>
                          </label>
                          <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded-full border border-orange-400/30">
                            {availableFacilities.length} available · Nearest first
                          </span>
                        </div>

                        <div className="relative">
                          <select
                            value={selectedFacility?.id || selectedFacility?.name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const found = availableFacilities.find(
                                (f) => String(f.id) === val || f.name === val
                              );
                              if (found) setSelectedFacility(found);
                            }}
                            className="w-full rounded-xl border-2 border-orange-400/60 dark:border-orange-800 bg-card p-2.5 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs cursor-pointer appearance-none pr-10"
                          >
                            {availableFacilities.map((f, idx) => {
                              const hasDist = f.distance_km != null && Number(f.distance_km) > 0;
                              const distStr = hasDist ? `Approx ${formatApproxKm(f.distance_km)} KM` : "";
                              const distBadge = distStr ? (idx === 0 ? `[★ ${distStr} (Nearest)] ` : `[${distStr}] `) : "";
                              const area = f.district && !/^(NA|N\/A|0|null|undefined|-+)$/i.test(String(f.district).trim()) ? `(${f.district})` : "";
                              return (
                                <option key={f.id || f.name || idx} value={f.id || f.name}>
                                  {distBadge}{f.name} {area}
                                </option>
                              );
                            })}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-orange-600">
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>

                        {selectedFacility && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                            <div className="flex items-center gap-2">
                              {selectedFacility.distance_km != null && Number(selectedFacility.distance_km) > 0 && (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30 text-[10.5px]">
                                  <Navigation className="h-3 w-3" />
                                  Approx {formatApproxKm(selectedFacility.distance_km)} KM road distance
                                </span>
                              )}
                              {selectedFacility.district && (
                                <span className="inline-flex items-center gap-1 font-semibold text-foreground text-[10.5px]">
                                  <MapPin className="h-3 w-3 text-orange-600" />
                                  {selectedFacility.district} {selectedFacility.pincode ? `• PIN: ${selectedFacility.pincode}` : ""}
                                </span>
                              )}
                            </div>
                            {selectedFacility.address && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                                {selectedFacility.address}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Department */}
                    <div>
                      <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
                        OPD Department / Clinic
                      </label>
                      <select
                        value={isDispensaryBooking ? "General Medicine / Primary Care OPD" : apptDepartment}
                        onChange={(e) => setApptDepartment(e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 transition cursor-pointer"
                      >
                        <option value="General Medicine / Primary Care OPD">General Medicine / Primary Care OPD</option>
                        {!isDispensaryBooking && (
                          <>
                            <option value="Diabetic & NCD Clinic">Diabetic & NCD Clinic</option>
                            <option value="Pediatrics & Child Health">Pediatrics & Child Health</option>
                            <option value="Emergency Casualty & Observation">Emergency Casualty & Observation</option>
                            <option value="Dental OPD">Dental OPD</option>
                            <option value="Orthopedics & Physical Medicine">Orthopedics & Physical Medicine</option>
                            <option value="Obstetrics & Gynecology (OBG)">Obstetrics & Gynecology (OBG)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Date Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                          Consultation Date
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setApptDate(todayStr)}
                            className={`text-[10.5px] px-2.5 py-0.5 rounded font-semibold transition cursor-pointer border ${
                              apptDate === todayStr
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-secondary hover:bg-secondary/80 text-foreground border-border/80"
                            }`}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => setApptDate(tomorrowStr)}
                            className={`text-[10.5px] px-2.5 py-0.5 rounded font-semibold transition cursor-pointer border ${
                              apptDate === tomorrowStr
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300/50"
                            }`}
                          >
                            Tomorrow
                          </button>
                          <button
                            type="button"
                            onClick={() => setApptDate(dayAfterTomorrowStr)}
                            className={`text-[10.5px] px-2.5 py-0.5 rounded font-semibold transition cursor-pointer border ${
                              apptDate === dayAfterTomorrowStr
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-secondary hover:bg-secondary/80 text-foreground border-border/80"
                            }`}
                          >
                            +2 Days
                          </button>
                        </div>
                      </div>
                      <input
                        type="date"
                        min={todayStr}
                        value={apptDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val < todayStr) {
                            toast.warning("Cannot book appointments for past dates");
                            setApptDate(todayStr);
                          } else {
                            setApptDate(val);
                          }
                        }}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 transition cursor-pointer"
                      />
                    </div>

                    {/* Time Slot Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                          Select Available Time Slot
                        </label>
                        {/* Legend */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Available
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Booked
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" /> Past Hour
                          </span>
                        </div>
                      </div>

                      {!hasAvailableSlots && (
                        <div className="mb-2.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                          <div className="space-y-0.5">
                            <p className="font-bold">
                              No OPD time slots available for {apptDate === todayStr ? "Today" : apptDate}
                            </p>
                            <p className="text-[11px] leading-relaxed">
                              All consultation slots for this date have either passed or are fully booked. Please select <strong>Tomorrow</strong> or another date to book an appointment.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ALL_OPD_TIME_SLOTS.map((slot) => {
                          const status = getSlotStatus(slot, apptDate);
                          const isSelected = apptTimeSlot === slot && status.isAvailable;

                          // 1. Past Hour / Past Day slot (Cannot book past hour or past day)
                          if (status.isPast) {
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled
                                title={`Past hour (${slot.split(" - ")[0]}) — Cannot book past time slot`}
                                className="rounded-xl py-2 px-2 text-[10.5px] font-semibold transition text-center border bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-55 flex flex-col items-center justify-center gap-0.5 select-none"
                              >
                                <span className="line-through">{slot.split(" - ")[0]}</span>
                                <span className="text-[9px] uppercase font-bold text-slate-400">Past</span>
                              </button>
                            );
                          }

                          // 2. Randomly booked slot for testing simulation
                          if (status.isBooked) {
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled
                                title={`Slot ${slot} is already booked for ${apptDate}`}
                                className="rounded-xl py-2 px-2 text-[10.5px] font-semibold transition text-center border bg-rose-50/70 dark:bg-rose-950/20 text-rose-500/80 dark:text-rose-400/80 border-rose-200/60 dark:border-rose-900/40 cursor-not-allowed opacity-75 flex flex-col items-center justify-center gap-0.5 select-none"
                              >
                                <span>{slot.split(" - ")[0]}</span>
                                <span className="text-[9px] uppercase font-extrabold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.2 rounded">
                                  Booked
                                </span>
                              </button>
                            );
                          }

                          // 3. Available Future Slot
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setApptTimeSlot(slot)}
                              className={`rounded-xl py-2 px-2 text-[11px] font-bold transition text-center cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/30 ring-2 ring-orange-500/40"
                                  : "bg-secondary/40 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-950/30 border-border/80 text-foreground"
                              }`}
                            >
                              <span>{slot}</span>
                              <span
                                className={`text-[9px] font-semibold ${
                                  isSelected ? "text-orange-100" : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                Available
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Appointment Type */}
                    <div>
                      <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1.5">
                        Consultation Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          "Regular OPD Consultation",
                          "Follow-Up Review",
                          "Medicine Refill / Lab",
                        ].map((type) => {
                          const isSelected = apptType === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setApptType(type)}
                              className={`rounded-xl py-1.5 px-2 text-[11px] font-bold transition text-center cursor-pointer border ${
                                isSelected
                                  ? "bg-amber-700 text-white border-amber-700 shadow-2xs"
                                  : "bg-secondary/40 hover:bg-secondary border-border/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chief Clinical Reason for Visit (Pre-filled from Triage) Area */}
                    <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-orange-600" />
                          Chief Clinical Reason for Visit (Pre-filled from Triage)
                        </label>
                        <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border/60">
                          AI Triage Verified
                        </span>
                      </div>

                      {/* 1. Chief Complaint */}
                      <div className="rounded-lg border border-border/60 bg-card p-2.5 space-y-1">
                        <span className="text-[10.5px] font-extrabold uppercase text-muted-foreground block tracking-wider">
                          Chief Complaint:
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-relaxed">
                          {extractedDetails.primaryComplaint ||
                            extractedDetails.firstReason ||
                            t?.primary_complaint ||
                            t?.chief_complaint ||
                            callerIntake?.symptom_notes ||
                            "Acute clinical symptoms requiring physician consultation"}
                        </p>
                      </div>

                      {/* 2. Clinical Red Flags */}
                      <div className="rounded-lg border border-rose-300/60 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="text-[10.5px] font-extrabold uppercase text-rose-900 dark:text-rose-300 tracking-wider">
                            Clinical Red Flags:
                          </span>
                        </div>
                        {extractedDetails.redFlags && extractedDetails.redFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {extractedDetails.redFlags.map((flag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-200"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
                                {typeof flag === "string" ? flag : flag.label || flag.name || String(flag)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">
                            No acute red flags detected during intake.
                          </p>
                        )}
                      </div>

                      {/* 3. One box for Agent to write */}
                      <div>
                        <label className="block text-[10.5px] font-extrabold text-foreground uppercase tracking-wider mb-1">
                          Agent Visit Notes / Doctor Instructions:
                        </label>
                        <textarea
                          rows={2}
                          value={apptNotes}
                          onChange={(e) => setApptNotes(e.target.value)}
                          placeholder="Write agent observations, specific patient requests, or instructions for the duty Medical Officer..."
                          className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 transition resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                        <input
                          type="checkbox"
                          checked={sendSmsNotification}
                          onChange={(e) => setSendSmsNotification(e.target.checked)}
                          className="rounded border-border text-orange-600 focus:ring-orange-500 h-4 w-4"
                        />
                        <span>Send SMS Token Confirmation &amp; Google Map navigation to caller mobile</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                        <input
                          type="checkbox"
                          checked={bringDocsChecked}
                          onChange={(e) => setBringDocsChecked(e.target.checked)}
                          className="rounded border-border text-orange-600 focus:ring-orange-500 h-4 w-4"
                        />
                        <span>Instruct patient to carry ESIC Pehchan / Insurance card &amp; prior prescriptions</span>
                      </label>
                    </div>
                  </form>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/80 bg-secondary/30 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
                {showTokenSuccess && bookedAppointment ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTokenSuccess(false)}
                        className="rounded-xl border border-border/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                      >
                        Book Another / Modify
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleCancelBooking();
                          setAppointmentModalOpen(false);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Cancel Booking
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrintTokenSlip}
                        className="flex items-center gap-1.5 rounded-xl border border-orange-500 bg-orange-50 dark:bg-orange-950/40 px-3.5 py-2 text-xs font-bold text-orange-900 dark:text-orange-200 hover:bg-orange-100 transition cursor-pointer"
                      >
                        <Printer className="h-4 w-4" /> Print Token Slip
                      </button>

                      <button
                        type="button"
                        onClick={() => setAppointmentModalOpen(false)}
                        className="rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:from-orange-700 hover:to-amber-700 transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAppointmentModalOpen(false)}
                      className="rounded-xl border border-border/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={!canConfirmBooking}
                      onClick={handleConfirmBooking}
                      title={
                        !hasAvailableSlots
                          ? "No available slots on this date. Please select Tomorrow or a future date."
                          : !apptTimeSlot
                          ? "Please select a time slot first"
                          : !isCurrentSlotValid
                          ? "Selected slot is not available"
                          : "Confirm & Book Appointment"
                      }
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-md active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      {isBookingSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Generating Token...</span>
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="h-4 w-4" />
                          <span>Confirm &amp; Book Appointment</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal for Cancelling Booking */}
      {confirmCancelOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmCancelOpen(false);
            }}
          >
            <div
              className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 p-5 sm:p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground">
                    Cancel Appointment Booking?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to cancel this booked OPD consultation? This will release the allocated slot for other patients.
                  </p>
                </div>
              </div>

              {/* Appointment summary details */}
              {bookedAppointment && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between font-mono font-bold text-rose-900 dark:text-rose-200">
                    <span>Reference No: {bookedAppointment.referenceNo || bookedAppointment.tokenNo}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Cancellation
                    </span>
                  </div>
                  <div className="space-y-1 text-foreground">
                    <p className="font-semibold text-xs sm:text-sm">
                      {bookedAppointment.facilityName}
                    </p>
                    <p className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span>{bookedAppointment.date} at {bookedAppointment.timeSlot}</span>
                    </p>
                    <p className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span>{bookedAppointment.department}</span>
                    </p>
                    <p className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                      <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span>Caller: {bookedAppointment.patientName} (+91 {bookedAppointment.patientPhone})</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setConfirmCancelOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCancelBooking();
                    setConfirmCancelOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Yes, Cancel Booking</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
