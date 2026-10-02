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
} from "lucide-react";
import { toast } from "sonner";

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

function cleanShortChiefComplaints(result, callerIntake, t) {
  const mainComplaint =
    callerIntake?.complaint ||
    result?.intake?.complaint ||
    t?.primary_complaint ||
    result?.ekms_ai_context?.triageState?.suspectedCondition ||
    result?.ekms_ai_context?.triageState?.condition ||
    result?.ekms_ai_context?.condition ||
    "";

  let raw = `${mainComplaint || callerIntake?.symptom_notes || result?.intake?.symptom_notes || ""}`.trim();

  // Strip boilerplate text
  let cleaned = raw
    .replace(/\[\s*clinical findings:?\s*/gi, "")
    .replace(/reported symptoms:?\s*/gi, "")
    .replace(/caller reports?\s*/gi, "")
    .replace(/patient reports?\s*/gi, "")
    .replace(/patient presents with\s*/gi, "")
    .replace(/no associated symptoms[\s\S]*/gi, "")
    .replace(/no fever[\s\S]*/gi, "")
    .replace(/condition appears[\s\S]*/gi, "")
    .replace(/suitable for standard[\s\S]*/gi, "")
    .replace(/\[|\]/g, "")
    .trim();

  // Protect anything inside parentheses (...) from being split!
  // e.g. "Headache (Constant Pressure, Forehead)" must stay intact as a single complaint
  const hasUnclosedParen = (s) => (s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length;

  // Split only on explicit newlines, semicolons, or bullet marks
  let parts = cleaned
    .split(/\n|;|^•\s*/m)
    .map((s) => s.trim().replace(/^•\s*/, ""))
    .filter((s) => s.length > 2);

  // If still 1 part and has NO parentheses, check for two distinct comma/and-separated complaints
  if (parts.length === 1 && !cleaned.includes("(") && !cleaned.includes(")")) {
    const commaParts = cleaned
      .split(/,\s+|\band\b/i)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 2 &&
          !/^(for|since|the|past|days?|hours?|weeks?|reported|stable|findings)$/i.test(s)
      );
    if (commaParts.length >= 2) {
      parts = commaParts;
    }
  }

  // If any part has unclosed parentheses, treat whole string as single unified complaint
  if (hasUnclosedParen(parts[0]) || (parts[1] && hasUnclosedParen(parts[1]))) {
    return {
      firstReason: cleaned,
      secondReason: "",
    };
  }

  if (parts.length >= 2) {
    return {
      firstReason: parts[0],
      secondReason: parts[1],
    };
  } else if (parts.length === 1) {
    return {
      firstReason: parts[0],
      secondReason: "",
    };
  }

  return {
    firstReason: mainComplaint || "Health Symptom Assessment",
    secondReason: "",
  };
}

function extractClinicalDetails(result, callerIntake, t, allRedFlags) {
  const allText = `${callerIntake?.symptom_notes || ""} ${result?.intake?.symptom_notes || ""} ${result?.ekms_ai_context?.triageState?.condition || ""} ${result?.triage?.summary_en || ""} ${result?.triage?.reasoning || ""}`.toLowerCase();

  // 1. Duration / Onset
  let duration = result?.ekms_ai_context?.duration || result?.ekms_ai_context?.triageState?.duration || "";
  if (!duration) {
    const durMatch = allText.match(/\b(since\s+[\w\s]+|\d+\s*(?:days?|hours?|weeks?|months?|dino?|ghante?)|aaj\s*se|kal\s*se|today|yesterday|morning|subah\s*se|raat\s*se)\b/i);
    if (durMatch) duration = durMatch[0];
  }
  if (!duration) duration = "";

  // 2. Clinical Red Flags (Directly from outcome page)
  let redFlags = [];
  if (Array.isArray(allRedFlags) && allRedFlags.length > 0) {
    redFlags = [...allRedFlags];
  } else if (Array.isArray(t?.red_flags) && t.red_flags.length > 0) {
    redFlags = [...t.red_flags];
  } else if (Array.isArray(result?.ekms_ai_context?.triageState?.redFlagsDetected)) {
    redFlags = [...result.ekms_ai_context.triageState.redFlagsDetected];
  }

  // 3. Short clean chief complaint
  const { firstReason, secondReason } = cleanShortChiefComplaints(result, callerIntake, t);
  const primaryLower = (firstReason || "").toLowerCase();

  // 4. Associated Symptoms: Keep separate from Red Flags and separate from Chief Complaint
  let associated = "";
  const ctxAssociated = result?.ekms_ai_context?.triageState?.associated;
  if (Array.isArray(ctxAssociated) && ctxAssociated.length > 0) {
    const filtered = ctxAssociated.filter(
      (a) =>
        !redFlags.some((rf) => rf.toLowerCase().includes(a.toLowerCase())) &&
        !primaryLower.includes(a.toLowerCase())
    );
    associated = (filtered.length > 0 ? filtered : []).join(", ");
  }
  if (!associated) {
    const potentialSecondary = [
      "inability to retain fluids",
      "cannot keep fluids down",
      "nausea",
      "vomiting",
      "weakness",
      "dizziness",
      "body ache",
      "fever",
      "headache",
      "sweating",
      "chills",
    ];
    for (const sym of potentialSecondary) {
      if (
        !primaryLower.includes(sym) &&
        !redFlags.some((rf) => rf.toLowerCase().includes(sym)) &&
        allText.includes(sym)
      ) {
        associated = sym.charAt(0).toUpperCase() + sym.slice(1);
        break;
      }
    }
  }

  // 4. Allergy: Keep blank if not reported by caller
  let allergy = "";
  const callerAllergyWords = `${callerIntake?.symptom_notes || ""} ${result?.intake?.symptom_notes || ""} ${result?.caller_spoken_text || ""}`.toLowerCase();
  const allergyMatch = callerAllergyWords.match(/\ballerg(?:y|ic)\s*(?:to|from)?\s*([a-zA-Z\s]+)/i);
  if (allergyMatch) allergy = cleanField(allergyMatch[0]);

  // 5. Medication: ONLY if caller explicitly reported taking/using a medicine
  let medication = "";
  const callerWords = `${callerIntake?.symptom_notes || ""} ${callerIntake?.complaint || ""} ${result?.intake?.symptom_notes || ""} ${result?.intake?.complaint || ""} ${result?.caller_spoken_text || ""}`.toLowerCase();
  const takingMedMatch = callerWords.match(/\b(?:taking|take|taken|on\s+meds?|on\s+medication|dawai\s+le|medicine\s+le)\s+([a-zA-Z0-9\s]{2,25})/i);
  const directMedsMatch = callerWords.match(/\b(insulin|paracetamol|metformin|amlodipine|pantoprazole|aspirin|inhaler|cetirizine|atorvastatin|crocin|dolo)\b/i);

  if (takingMedMatch && takingMedMatch[0]) {
    medication = cleanField(takingMedMatch[0]);
  } else if (directMedsMatch && directMedsMatch[0]) {
    medication = cleanField(directMedsMatch[0]);
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
    allergy: cleanField(allergy),
    medication: cleanField(medication),
    diagnosticTests: diagnosticTests,
    firstReason: cleanField(firstReason),
    secondReason: cleanField(secondReason),
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
    trimmed.toLowerCase() === "none" ||
    trimmed.toLowerCase() === "nil" ||
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

  const triageTimestamp = useMemo(() => {
    return formatTriageDate(result?.created_at || result?.timestamp || result?.intake?.timestamp);
  }, [result]);

  const targetTeamId = useMemo(() => {
    return mapDirectiveToTeamId(activeDirective?.id, t);
  }, [activeDirective?.id, t]);

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

  // Clean Document State (No heavy container boxes, editable inline)
  const [editData, setEditData] = useState({
    callerName: intakeData.callerName,
    phone: intakeData.phone,
    age: intakeData.age,
    sex: intakeData.sex,
    landmark: intakeData.landmark,

    firstReason: extractedDetails.firstReason,
    secondReason: extractedDetails.secondReason,
    redFlags: extractedDetails.redFlags || [],
    hpiDuration: extractedDetails.duration,
    associatedSymptoms: extractedDetails.associated,
    allergies: extractedDetails.allergy,
    medications: extractedDetails.medication,

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
      redFlags: refreshed.redFlags || [],
      hpiDuration: refreshed.duration,
      associatedSymptoms: refreshed.associated,
      allergies: refreshed.allergy,
      medications: refreshed.medication,

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
    const chiefComplaintText = data.secondReason
      ? `  • ${data.firstReason}\n  • ${data.secondReason}`
      : `  • ${data.firstReason}`;

    const redFlagsText = Array.isArray(data.redFlags) && data.redFlags.length > 0
      ? data.redFlags.map((f) => `  • ${f}`).join("\n")
      : "  • None reported";

    const formattedPhone = data.phone
      ? (data.phone.startsWith("+91") ? data.phone : `+91 ${data.phone}`)
      : "";

    return `1. Caller Details                                         Case ID: ${caseRef}
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
• Any allergy: ${data.allergies || ""}
• Any medication: ${data.medications || ""}

( from 3 to 6 will be find out by the doctor )

3. Diagnoses By the Doctor
• Primary Diagnosis: ${data.primaryDiagnosis || ""}
• Secondary Diagnoses: ${data.secondaryDiagnosis || ""}

4. Results & Procedures
• Diagnostic Tests Performed: ${data.diagnosticTests || ""}
• Key Findings: ${data.keyFindings || ""}
• Procedures Completed: ${data.proceduresCompleted || ""}

5. Treatment Plan & Medications
• New Medications: ${data.newMedications || ""}
• Changes to Existing Medications: ${data.changesToMedications || ""}
• Care Instructions & Lifestyle Modifications: ${data.careInstructions || ""}

6. Follow-Up & Continuity of Care
• Scheduled Appointments: ${data.scheduledAppointments || ""}
• Referrals: ${data.referrals || ""}
• Warning Signs / Emergency Instructions: ${data.warningSigns || ""}`;
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

      setSentStatus({
        teamName: selectedTeam.name,
        shortName: selectedTeam.shortName,
        dispatchId,
        timestamp,
        location: editData.landmark,
      });

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
            className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer ${getTeamButtonClass(
              selectedTeam.id
            )}`}
          >
            <Send className="h-4 w-4" />
            <span>Send clinical summary to {selectedTeam.shortName}</span>
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
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-xs sm:text-sm font-bold text-foreground bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 px-2.5 py-1 rounded-md">
                    Case ID: <span className="font-mono text-blue-700 dark:text-blue-400">{caseRef}</span>
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
                      <span className="font-bold shrink-0 text-foreground">• Any allergy:</span>
                      <input
                        type="text"
                        value={editData.allergies}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, allergies: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>

                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Any medication:</span>
                      <input
                        type="text"
                        value={editData.medications}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, medications: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium rounded transition"
                        placeholder=""
                      />
                    </li>
                  </ul>
                </div>

                {/* NOTICE BANNER */}
                <div className="py-2.5 px-3 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-semibold text-center italic border border-purple-200/60 dark:border-purple-900/40 text-xs sm:text-sm">
                  ( from 3 to 6 will be find out by the doctor )
                </div>

                {/* 3. DIAGNOSES BY THE DOCTOR */}
                <div className="space-y-2">
                  <div className="pb-1 border-b border-purple-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-purple-700 dark:text-purple-400 tracking-tight">
                      3. Diagnoses By the Doctor
                    </h3>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Primary Diagnosis:</span>
                      <input
                        type="text"
                        value={editData.primaryDiagnosis}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, primaryDiagnosis: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Secondary Diagnoses:</span>
                      <input
                        type="text"
                        value={editData.secondaryDiagnosis}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, secondaryDiagnosis: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                  </ul>
                </div>

                {/* 4. RESULTS & PROCEDURES */}
                <div className="space-y-2">
                  <div className="pb-1 border-b border-sky-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-sky-700 dark:text-sky-400 tracking-tight">
                      4. Results &amp; Procedures
                    </h3>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Diagnostic Tests Performed:</span>
                      <input
                        type="text"
                        value={editData.diagnosticTests}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, diagnosticTests: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Key Findings:</span>
                      <input
                        type="text"
                        value={editData.keyFindings}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, keyFindings: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Procedures Completed:</span>
                      <input
                        type="text"
                        value={editData.proceduresCompleted}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, proceduresCompleted: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                  </ul>
                </div>

                {/* 5. TREATMENT PLAN & MEDICATIONS */}
                <div className="space-y-2">
                  <div className="pb-1 border-b border-amber-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 tracking-tight">
                      5. Treatment Plan &amp; Medications
                    </h3>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• New Medications:</span>
                      <input
                        type="text"
                        value={editData.newMedications}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, newMedications: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Changes to Existing Medications:</span>
                      <input
                        type="text"
                        value={editData.changesToMedications}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, changesToMedications: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Care Instructions &amp; Lifestyle Modifications:</span>
                      <input
                        type="text"
                        value={editData.careInstructions}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, careInstructions: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                  </ul>
                </div>

                {/* 6. FOLLOW-UP & CONTINUITY OF CARE */}
                <div className="space-y-2">
                  <div className="pb-1 border-b border-teal-500/25">
                    <h3 className="text-base sm:text-lg font-bold text-teal-700 dark:text-teal-400 tracking-tight">
                      6. Follow-Up &amp; Continuity of Care
                    </h3>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Scheduled Appointments:</span>
                      <input
                        type="text"
                        value={editData.scheduledAppointments}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, scheduledAppointments: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Referrals:</span>
                      <input
                        type="text"
                        value={editData.referrals}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, referrals: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                    <li className="flex items-baseline gap-2">
                      <span className="font-bold shrink-0 text-foreground">• Warning Signs / Emergency Instructions:</span>
                      <input
                        type="text"
                        value={editData.warningSigns}
                        onChange={(e) =>
                          setEditData((d) => ({ ...d, warningSigns: e.target.value }))
                        }
                        className="w-full bg-transparent hover:bg-muted/30 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 px-1.5 py-0.5 outline-none font-medium text-foreground rounded transition"
                      />
                    </li>
                  </ul>
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
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {isSending
                      ? "Transmitting..."
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
