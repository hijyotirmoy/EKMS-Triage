"use client";

import { useState, useMemo } from "react";
import {
  AlertOctagon,
  Building2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  ShieldAlert,
  Stethoscope,
  CheckCircle2,
  PhoneCall,
  PhoneForwarded,
  ArrowRight,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { urgencyStyle } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";
import { summarizeRedFlags, getDispensaryOperatingStatus } from "../lib/triageEngine";
import { CaseHandoverForwarding } from "./CaseHandoverForwarding";
import { AiFeedbackLearningCard } from "./AiFeedbackLearningCard";
import defaultFacilities from "../data/facilities.json";
import {
  isHospital,
  isDispensary,
  isTieUp,
  isEsicHospital,
  isGovtDistrictHospital,
  getFacilityCategoryLabel,
  rankNearestFacilities,
} from "../lib/geo";

export const ACTION_DIRECTIVES = {
  NACO_1097: {
    id: "NACO_1097",
    title: "TRANSFER TO NACO 1097 HELPLINE (HIV / AIDS / STI)",
    category: "HIV, AIDS & Sexual Health Counseling",
    badge: "NACO 1097 Helpline",
    badgeColor: "bg-rose-800 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
    panelLightTint: "border-rose-300/80 bg-rose-50/50 dark:bg-rose-950/25",
    topBar: "bg-rose-800",
    icon: "🎗️",
    summary:
      "Caller is inquiring about HIV, AIDS, STI symptoms, testing, PEP, or sexual health counseling. Transfer immediately to the National AIDS Control Organisation (NACO) 24x7 Toll-Free Helpline (1097).",
    checklist: [
      "1. Speak with strict confidentiality, dignity, and non-judgmental reassurance.",
      "2. Transfer call to National AIDS Helpline (Toll-Free 1097) for 24x7 confidential counseling and ICTC/ART center locator.",
      "3. Direct to nearest ESIC Hospital ICTC / Specialist OPD if post-exposure prophylaxis (PEP) is needed within 72 hours.",
    ],
  },
  CALL_108: {
    id: "CALL_108",
    title: "CALL 108 AMBULANCE IMMEDIATELY",
    category: "Emergency Dispatch",
    badge: "108 Ambulance",
    badgeColor: "bg-rose-700 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
    panelLightTint: "border-rose-300/80 bg-rose-50/50 dark:bg-rose-950/25",
    topBar: "bg-rose-700",
    icon: "🚨",
    summary: "",
    checklist: [
      "1. Verify caller's current location, landmark, and contact phone number.",
      "2. Initiate 108 Emergency Ambulance dispatch immediately.",
      "3. Instruct patient to lie down, remain calm, and NOT exert or travel unassisted.",
    ],
  },
  TELE_MANAS: {
    id: "TELE_MANAS",
    title: "TRANSFER TO TELE-MANAS (14416)",
    category: "Mental Health Crisis Protocol",
    badge: "Tele-MANAS (14416)",
    badgeColor: "bg-purple-700 text-white font-bold",
    cardBorder: "border-purple-400 bg-purple-50 text-purple-950 shadow-xs",
    panelLightTint: "border-purple-300/80 bg-purple-50/50 dark:bg-purple-950/25",
    topBar: "bg-purple-700",
    icon: "🧠",
    summary:
      "Caller is in emotional crisis, experiencing depression, severe anxiety, or thoughts of self-harm. Transfer call to Tele-MANAS (14416) for 24x7 confidential crisis counseling.",
    checklist: [
      "1. Speak calmly with reassurance: 'You are safe, and we are connecting you to professional help.'",
      "2. Transfer call to Toll-Free 14416 (National Tele-MANAS) for 24x7 confidential counseling.",
      "3. Stay on line until safely handed over if self-harm risk is active.",
    ],
  },
  ESIC_HOSPITAL: {
    id: "ESIC_HOSPITAL",
    title: "REFER / FORWARD TO NEAREST ESIC HOSPITAL",
    category: "Secondary Care & Casualty Evaluation",
    badge: "ESIC Hospital",
    badgeColor: "bg-amber-700 text-white font-bold",
    cardBorder: "border-amber-400 bg-amber-50 text-amber-950 shadow-xs",
    panelLightTint: "border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/25",
    topBar: "bg-amber-700",
    icon: "🏥",
    summary: "",
    checklist: [
      "1. Locate the nearest ESIC Hospital shown in Facilities below.",
      "2. Click 'SMS to Caller' to send the hospital name, address, and Google Maps link.",
      "3. Instruct caller to carry their Pehchan Card and government photo ID for urgent OPD/casualty.",
    ],
  },
  ESIS_DISPENSARY: {
    id: "ESIS_DISPENSARY",
    title: "DIRECT TO NEAREST ESIS DISPENSARY",
    category: "Primary Healthcare & Routine Outpatient",
    badge: "ESIS Dispensary",
    badgeColor: "bg-emerald-700 text-white font-bold",
    cardBorder: "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs",
    panelLightTint: "border-emerald-300/80 bg-emerald-50/50 dark:bg-emerald-950/25",
    topBar: "bg-emerald-700",
    icon: "🩺",
    summary:
      "Condition is suitable for primary clinic level care. Direct the IP to their registered or nearest ESIS Dispensary for doctor consultation and free medicine dispensing.",
    checklist: [
      "1. Check the nearest ESIS Dispensary listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address and dispensary timings (10:00 AM – 3:00 PM, Mon–Fri; Closed Sat/Sun).",
      "3. Remind IP to carry their ESIC Pehchan / Insurance card for free consultations and prescribed medicines.",
    ],
  },
  TELE_104: {
    id: "TELE_104",
    title: "FORWARD TO 104 HEALTH HELPLINE",
    category: "Tele-Doctor Consultation",
    badge: "104 Health Helpline",
    badgeColor: "bg-blue-700 text-white font-bold",
    cardBorder: "border-blue-400 bg-blue-50 text-blue-950 shadow-xs",
    panelLightTint: "border-blue-300/80 bg-blue-50/50 dark:bg-blue-950/25",
    topBar: "bg-blue-700",
    icon: "📞",
    summary:
      "Caller requests direct medical advice or consultation with a government doctor over the phone. Transfer call to 104 Health Helpline.",
    checklist: [
      "1. Inform caller: 'Connecting you to 104 Health Helpline doctor now.'",
      "2. Transfer call line to 104 Health Helpline triage queue.",
      "3. Share case reference number for medical documentation.",
    ],
  },

  TIE_UP_FACILITY: {
    id: "TIE_UP_FACILITY",
    title: "REFER TO EMPANELLED TIE-UP FACILITY",
    category: "Empanelled Network Care",
    badge: "Tie-Up Facility",
    badgeColor: "bg-cyan-700 text-white font-bold",
    cardBorder: "border-cyan-400 bg-cyan-50 text-cyan-950 shadow-xs",
    panelLightTint: "border-cyan-300/80 bg-cyan-50/50 dark:bg-cyan-950/25",
    topBar: "bg-cyan-700",
    icon: "🏥",
    summary: "",
    checklist: [
      "1. Check the nearest empanelled tie-up facility listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address, phone number, and Google Maps directions.",
      "3. Remind IP to carry their ESIC Pehchan / Insurance card for cashless treatment under ESIC tie-up guidelines.",
    ],
  },
  DIST_HOSPITAL: {
    id: "DIST_HOSPITAL",
    title: "REFER TO DISTRICT HOSPITAL / PUBLIC HEALTHCARE",
    category: "Public Healthcare Outside ESIC",
    badge: "Govt District Hospital",
    badgeColor: "bg-blue-800 text-white font-bold",
    cardBorder: "border-blue-500 bg-blue-50 text-blue-950 shadow-xs",
    panelLightTint: "border-blue-300/80 bg-blue-50/50 dark:bg-blue-950/25",
    topBar: "bg-blue-800",
    icon: "🏥",
    summary:
      "Beneficiary requires public healthcare services outside ESIC network, general public specialist care, non-ESIC admissions, or child immunization.",
    checklist: [
      "1. Check the nearest Govt District Hospital listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address and Google Maps directions.",
      "3. Remind caller to carry government photo ID / Aadhaar and medical records for OPD/admissions.",
    ],
  },
};

export function mapDestinationToDirectiveId(dest) {
  if (!dest || typeof dest !== "string") return "ESIS_DISPENSARY";
  const d = dest.toLowerCase();
  if (d.includes("108") || d.includes("ambulance")) return "CALL_108";
  if (d.includes("naco") || d.includes("1097") || d.includes("hiv") || d.includes("aids") || d.includes("pep")) return "NACO_1097";
  if (d.includes("104") || d.includes("tele-doctor") || d.includes("phone doctor") || d.includes("medical team") || d.includes("health helpline") || d.includes("advice")) return "TELE_104";
  if (d.includes("manas") || d.includes("psych") || (d.includes("counsel") && !d.includes("naco") && !d.includes("hiv"))) return "TELE_MANAS";
  if (d.includes("tie") || d.includes("empanelled") || d.includes("swasti") || d.includes("ayursundra") || d.includes("dispur hospital") || d.includes("narayana") || d.includes("hayat") || d.includes("excelcare") || d.includes("down town")) return "TIE_UP_FACILITY";
  if (d.includes("district") || d.includes("dist hosp") || d.includes("public health") || d.includes("civil hospital") || d.includes("immunization")) return "DIST_HOSPITAL";
  if (d.includes("hospital") || d.includes("casualty")) return "ESIC_HOSPITAL";
  if (d.includes("dispensary") || d.includes("clinic")) return "ESIS_DISPENSARY";
  return "ESIS_DISPENSARY";
}

export function resolveDirectiveIds(t, result) {
  // Check if caller inquiry is explicitly NACO 1097 / HIV
  const intakeText = `${result?.intake?.symptom_notes || ""} ${result?.intake?.complaint || ""} ${result?.ekms_ai_context?.triageState?.condition || ""}`.toLowerCase();
  const isNacoHIV = /\b(hiv|aids|naco|1097|post.?exposure|pep\b|anti.?retroviral|art\s*center)\b/i.test(intakeText);

  // Check off-hours (between 4:00 PM and 10:00 AM)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
  const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM to 10:00 AM

  const isEmergency =
    t?.call_108 ||
    (t?.urgency_score != null && Number(t.urgency_score) >= 8) ||
    /\b(108|ambulance|severe trauma|cardiac arrest|massive bleed)\b/i.test(intakeText);

  let primaryDest =
    t?.referral_destination ||
    t?.call_referral_primary ||
    result?.ekms_ai_context?.triageState?.referralDestination ||
    result?.ekms_ai_context?.referralDestination;

  // RULE: If off-hours (after 4 PM to 10 AM) and NO emergency:
  // Refer to 104 Health Helpline FIRST!
  if (isOffHours && !isEmergency && !isNacoHIV && !t?.is_psychiatric && !/tie.?up|empanelled/i.test(primaryDest || "")) {
    primaryDest = "104 Health Helpline";
  }

  if (!primaryDest) {
    if (isNacoHIV) {
      primaryDest = "NACO 1097 Helpline";
    } else if (isEmergency) {
      primaryDest = "108 Ambulance";
    } else if (t?.is_psychiatric) {
      primaryDest = "Psychiatric Team / Tele-MANAS";
    } else if (isOffHours) {
      primaryDest = "104 Health Helpline";
    } else {
      primaryDest = "ESIS Dispensary";
    }
  }

  let secondaryDest =
    t?.call_referral_secondary ||
    t?.secondary_referral_destination ||
    (isOffHours ? "ESIC Hospital" : "104 Health Helpline");

  const primaryId = mapDestinationToDirectiveId(primaryDest);
  let secondaryId = mapDestinationToDirectiveId(secondaryDest);

  if (secondaryId === primaryId) {
    secondaryId = primaryId === "ESIC_HOSPITAL" ? "TELE_104" : "ESIC_HOSPITAL";
  }

  return {
    primaryId,
    secondaryId,
    isDual: false,
    primaryBadge: ACTION_DIRECTIVES[primaryId]?.badge || primaryDest,
    secondaryBadge: ACTION_DIRECTIVES[secondaryId]?.badge || secondaryDest,
  };
}

const Empty = () => (
  <div className="panel grid-lines flex min-h-[480px] flex-col items-center justify-start p-6 pt-8 sm:p-8 sm:pt-10 text-center">
    <div className="mx-auto mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-secondary/80 border border-border/60 text-muted-foreground shadow-2xs">
      <Stethoscope className="h-6 w-6 text-primary/80" strokeWidth={1.75} />
    </div>
    <h3 className="text-base sm:text-lg font-bold text-foreground">Triage output appears here</h3>
  </div>
);

const Loading = () => (
  <div className="space-y-5 animate-in fade-in duration-300" data-testid="triage-skeleton">
    {/* Main Outcome Card Skeleton */}
    <div className="panel overflow-hidden border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      {/* Top Shimmer Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500/40 via-primary/60 to-emerald-500/40 animate-pulse rounded-full" />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-28 rounded-full bg-primary/25 animate-pulse" />
            <div className="h-7 w-24 rounded-full bg-muted/60 animate-pulse" />
          </div>
        </div>
        <div className="space-y-1.5 text-right">
          <div className="h-3.5 w-32 rounded bg-muted/70 animate-pulse ml-auto" />
          <div className="h-3 w-24 rounded bg-muted/50 animate-pulse ml-auto" />
        </div>
      </div>

      {/* Summary Skeleton */}
      <div className="mt-5 space-y-2.5">
        <div className="h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
        <div className="h-4 w-full rounded bg-muted/50 animate-pulse" />
        <div className="h-4 w-11/12 rounded bg-muted/50 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
      </div>

      {/* Clinical Reasoning Box Skeleton */}
      <div className="mt-5 rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-primary/30 animate-pulse" />
          <div className="h-3.5 w-36 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-3.5 w-full rounded bg-muted/40 animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-muted/40 animate-pulse" />
      </div>

      {/* Red Flags Skeleton Box */}
      <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-rose-500/30 animate-pulse" />
          <div className="h-3.5 w-28 rounded bg-rose-500/20 animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-6 w-36 rounded-full bg-rose-500/15 animate-pulse" />
          <div className="h-6 w-44 rounded-full bg-rose-500/15 animate-pulse" />
        </div>
      </div>

      {/* Recommended Action Banner Skeleton */}
      <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-44 rounded bg-emerald-500/30 animate-pulse" />
          <div className="h-5 w-24 rounded-full bg-emerald-500/20 animate-pulse" />
        </div>
        <div className="h-4 w-3/4 rounded bg-emerald-500/20 animate-pulse" />
      </div>
    </div>

    {/* Nearest Facilities Card Skeleton */}
    <div className="panel border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-primary/30 animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
      </div>

      {/* 2 Facility items placeholder */}
      {[1, 2].map((i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-3.5 bg-secondary/20">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-52 rounded bg-muted/70 animate-pulse" />
            <div className="h-3 w-4/5 rounded bg-muted/50 animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
            <div className="h-7 w-20 rounded-md bg-primary/20 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TriageResultPanel = ({ result, loading, callerIntake, currentAgent }) => {
  if (loading) return <Loading />;
  if (!result) return <Empty />;

  const { triage: t, nearest_facilities: facs, resolved_location: loc } = result;
  const s = urgencyStyle(t.urgency_level);

  const directiveIds = useMemo(() => {
    return resolveDirectiveIds(t, result);
  }, [t, result]);

  const [manualDirectiveId, setManualDirectiveId] = useState(null);
  const activeDirective =
    ACTION_DIRECTIVES[manualDirectiveId || directiveIds.primaryId] || ACTION_DIRECTIVES.ESIS_DISPENSARY;
  const secondaryDirective =
    ACTION_DIRECTIVES[directiveIds.secondaryId] || ACTION_DIRECTIVES.TELE_104;

  const dispensaryStatus = useMemo(() => getDispensaryOperatingStatus(), []);
  const isWeekend = dispensaryStatus.isWeekend;

  const isFacilityRequired = [
    "ESIC_HOSPITAL",
    "ESIS_DISPENSARY",
    "TIE_UP_FACILITY",
    "DIST_HOSPITAL",
    "CALL_108",
  ].includes(activeDirective.id);

  // Dynamically organize facilities with clear categorization badges and all 4 facility types
  const dynamicFacilities = useMemo(() => {
    const effectiveFacs =
      Array.isArray(facs) && facs.length > 0
        ? facs
        : rankNearestFacilities(loc || { pincode: "781022" }, defaultFacilities, 6);

    if (!effectiveFacs || effectiveFacs.length === 0) return [];

    const getTag = (f) => {
      if (f.facility_tag) return f.facility_tag;
      return getFacilityCategoryLabel(f);
    };

    const getCategoryStyle = (f) => {
      if (isEsicHospital(f)) {
        return "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-300 font-bold";
      }
      if (isGovtDistrictHospital(f)) {
        return "bg-blue-500/15 border-blue-500/40 text-blue-900 dark:text-blue-300 font-bold";
      }
      if (isDispensary(f)) {
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-300 font-bold";
      }
      if (isTieUp(f)) {
        return "bg-cyan-500/15 border-cyan-500/40 text-cyan-900 dark:text-cyan-300 font-bold";
      }
      return "bg-secondary/80 border-border/70 text-foreground/90 font-bold";
    };

    // Tie-Up hospital positioning rule:
    // If agent selects to refer to Tie-Up (activeDirective.id === "TIE_UP_FACILITY"), Tie-Up comes to the TOP (Position 1).
    // Otherwise, User hierarchy:
    // 1. ESIC Hospital (if available within 100km, else Nearest Hospital)
    // 2. Govt District Hospital
    // 3. ESIS Dispensary (shown above tie-up even if closed)
    // 4 & 5. Next nearest open facilities within 100km
    // 6. ESIC Tie-Up Hospital (at the last position / below dispensary)
    const isTieUpSelected = activeDirective.id === "TIE_UP_FACILITY";

    let orderedFacs = [];

    if (isTieUpSelected) {
      // 1. Tie-Up selected -> Put nearest Tie-Up facility at the very top (Position 1)
      const tieUps = effectiveFacs.filter(isTieUp);
      const nonTieUps = effectiveFacs.filter((f) => !isTieUp(f));
      orderedFacs = [...tieUps, ...nonTieUps].slice(0, 6);
    } else {
      const esicHosp = effectiveFacs.find(isEsicHospital);
      const govtHosp = effectiveFacs.find(isGovtDistrictHospital);
      const disp = effectiveFacs.find(isDispensary);
      const tieUp = effectiveFacs.find(isTieUp);

      const chosen = [];
      const chosenKeys = new Set();
      const add = (f) => {
        if (!f) return;
        const key = f.id || f.name;
        if (!chosenKeys.has(key)) {
          chosen.push(f);
          chosenKeys.add(key);
        }
      };

      // 1. ESIC Hospital
      add(esicHosp);
      // 2. Govt District Hospital
      add(govtHosp);
      // 3. Dispensary (shown above tie-up even if closed!)
      add(disp);

      // 4 & 5. Other non-tie-up facilities <= 100km
      const nonTieUpsWithin100 = effectiveFacs.filter(
        (f) => !isTieUp(f) && (f.distance_km == null || f.distance_km <= 100)
      );
      for (const f of nonTieUpsWithin100) {
        if (chosen.length >= 5) break;
        add(f);
      }

      // If still fewer than 5, add other non-tie-ups
      const allNonTieUps = effectiveFacs.filter((f) => !isTieUp(f));
      for (const f of allNonTieUps) {
        if (chosen.length >= 5) break;
        add(f);
      }

      // 6. Tie-Up Hospital at the last position (below dispensary)
      if (tieUp) {
        add(tieUp);
      }

      // If still fewer than 6, fill with any remaining
      for (const f of effectiveFacs) {
        if (chosen.length >= 6) break;
        add(f);
      }

      orderedFacs = chosen.length > 0 ? chosen.slice(0, 6) : effectiveFacs.slice(0, 6);
    }

    return orderedFacs.map((f) => ({
      ...f,
      facility_tag: getTag(f),
      category_style: getCategoryStyle(f),
    }));
  }, [facs, loc, manualDirectiveId, activeDirective.id, dispensaryStatus.isOpen]);

  const dispatchSms = (f) => {
    navigator.clipboard?.writeText(
      `${f.name}, ${f.address}. Directions: ${f.maps_url}`
    );
    toast.success("Facility address copied — ready to SMS to the caller");
  };

  const allRedFlags = useMemo(() => {
    const raw = [];
    if (Array.isArray(t?.red_flags)) raw.push(...t.red_flags);
    const ctxFlags =
      result?.ekms_ai_context?.triageState?.redFlagsDetected ||
      result?.ekms_ai_context?.clinicalState?.redFlagsDetected ||
      result?.ekms_ai_context?.redFlagsDetected;
    if (Array.isArray(ctxFlags)) raw.push(...ctxFlags);

    // Look ONLY at actual caller-reported text, never circular AI summaries or bot assistant prompts
    const callerChat = Array.isArray(result?.ekms_ai_context?.chatHistory)
      ? result.ekms_ai_context.chatHistory
          .filter((m) => m.sender === "user" || m.role === "user")
          .map((m) => m.text || m.content || "")
          .join(" ")
      : "";
    const callerText = `${result?.intake?.symptom_notes || ""} ${callerChat}`.toLowerCase().trim();
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(callerText);

    return summarizeRedFlags(raw, callerText, isSafe);
  }, [t, result]);

  const primaryComplaint =
    t.primary_complaint ||
    result?.ekms_ai_context?.triageState?.suspectedCondition ||
    result?.ekms_ai_context?.triageState?.condition ||
    result?.ekms_ai_context?.triageState?.symptom ||
    (t.is_psychiatric ? "Emotional Distress / Mental Health Support" : "Primary Clinical Assessment");

  const assessedSeverity =
    t.assessed_severity ||
    (t.urgency_score >= 8 ? "High" : t.urgency_score >= 5 ? "Moderate" : "Mild");
  const durationText =
    t.duration ||
    result?.intake?.duration ||
    result?.ekms_ai_context?.triageState?.duration ||
    "Reported today";
  const severityAndDuration = assessedSeverity.includes("(")
    ? `${assessedSeverity} · ${durationText}`
    : `${assessedSeverity} (${t.urgency_score || 5}/10) · ${durationText}`;

  // USER MANDATE: Near Urgent and Primary Referral 01 MUST show the exact same referral!
  const primaryReferralDest = activeDirective.badge;

  const cleanReason = (reason) => {
    if (!reason || typeof reason !== "string") return "";
    if (reason.includes("Symptoms require secondary hospital casualty")) return "";
    return reason;
  };

  const primaryReferralReason = cleanReason(
    t.call_referral_primary_reason ||
    t.referral_reason ||
    activeDirective.summary ||
    t.recommended_action ||
    ""
  );

  const effectiveSecondaryDirective =
    (secondaryDirective.id === activeDirective.id
      ? (activeDirective.id === "ESIC_HOSPITAL" ? ACTION_DIRECTIVES.TELE_104 : ACTION_DIRECTIVES.ESIC_HOSPITAL)
      : secondaryDirective) || (activeDirective.id === "TELE_104" ? ACTION_DIRECTIVES.ESIC_HOSPITAL : ACTION_DIRECTIVES.TELE_104);

  const secondaryReferralDest = effectiveSecondaryDirective.badge;
  const secondaryReferralReason = cleanReason(
    t.call_referral_secondary_reason ||
    t.secondary_referral_reason ||
    effectiveSecondaryDirective?.summary ||
    ""
  );

  return (
    <div className="space-y-5 rise w-full max-w-full min-w-0" data-testid="triage-result">
      <div
        className={`panel overflow-hidden transition-all duration-300 ${
          activeDirective.panelLightTint || "bg-card border-border"
        }`}
      >
        <div
          className={`h-1.5 w-full transition-colors duration-300 ${
            activeDirective.topBar || s.bar
          }`}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Triage outcome</p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <UrgencyBadge level={t.urgency_level} score={t.urgency_score} />
                {activeDirective.id === "NACO_1097" ? (
                  <span
                    data-testid="triage-naco-1097"
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-800 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    🎗️ NACO 1097 HELPLINE
                  </span>
                ) : activeDirective.id === "CALL_108" || t.call_108 ? (
                  <span
                    data-testid="triage-call-108"
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    🚨 108 AMBULANCE
                  </span>
                ) : activeDirective.id === "TELE_104" ? (
                  <span
                    data-testid="triage-tele-104"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> 104 HEALTH HELPLINE
                  </span>
                ) : activeDirective.id === "TELE_MANAS" ? (
                  <span
                    data-testid="triage-tele-manas"
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> TELE-MANAS 14416
                  </span>
                ) : activeDirective.id === "ESIC_HOSPITAL" ? (
                  <span
                    data-testid="triage-esic-hospital"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> ESIC HOSPITAL
                  </span>
                ) : activeDirective.id === "TIE_UP_FACILITY" ? (
                  <span
                    data-testid="triage-tie-up"
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> TIE-UP FACILITY
                  </span>
                ) : activeDirective.id === "DIST_HOSPITAL" ? (
                  <span
                    data-testid="triage-dist-hospital"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-800 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> GOVT DISTRICT HOSPITAL
                  </span>
                ) : (
                  <span
                    data-testid="triage-esis-dispensary"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> {activeDirective.badge || "ESIS DISPENSARY"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-base font-semibold leading-snug" data-testid="triage-summary-en">
            {t.summary_en}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{s.label}</p>

          {/* Unified Clinical Assessment & Action items directly inside Triage outcome panel */}
          <div className="mt-5 space-y-4 pt-1">

            {/* 2. Clinical Assessment Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-border shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                  Chief Complaint
                </span>
                <span className="font-bold text-foreground text-sm">
                  {primaryComplaint}
                </span>
              </div>

              <div className="rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-border shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                  Assessed Severity &amp; Duration
                </span>
                <span className="font-bold text-foreground">
                  {severityAndDuration}
                </span>
              </div>

              {/* Recommended Call Referral 01 (Primary Immediate Destination) */}
              <div className="col-span-1 sm:col-span-2 rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-emerald-500/40 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400">
                    Recommended Call Referral 01 (Primary Immediate Destination)
                  </span>
                  <span className="rounded bg-emerald-700 text-white text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                    Primary
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-950 dark:text-emerald-200 text-sm">
                  <PhoneForwarded className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{primaryReferralDest}</span>
                </div>
                {primaryReferralReason && (
                  <p className="mt-1 text-xs text-foreground/80 font-medium leading-relaxed">
                    {primaryReferralReason}
                  </p>
                )}
              </div>

              {/* Recommended Call Referral 02 (Co-Occurring / Secondary Referral) */}
              {secondaryReferralDest && (
                <div className="col-span-1 sm:col-span-2 rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-blue-400/50 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-400">
                      Recommended Call Referral 02 (Co-Occurring / Secondary Referral)
                    </span>
                    <span className="rounded bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                      Secondary
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-extrabold text-blue-950 dark:text-blue-200 text-sm">
                    <PhoneForwarded className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>{secondaryReferralDest}</span>
                  </div>
                  {secondaryReferralReason && (
                    <p className="mt-1 text-xs text-foreground/80 font-medium leading-relaxed">
                      {secondaryReferralReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4. Decision Switcher Buttons (Redesigned with clean responsive grid and modern clinical controls) */}
            <div className="rounded-xl border border-current/15 bg-background/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                      Decision Switcher
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Select or switch referral destination channel
                    </span>
                  </div>
                </div>
                {manualDirectiveId && (
                  <button
                    type="button"
                    onClick={() => setManualDirectiveId(null)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/90 transition-colors bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-full cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to AI Primary</span>
                  </button>
                )}
              </div>

              {/* Clean structured responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(ACTION_DIRECTIVES).map((dir) => {
                  const isSelected = dir.id === activeDirective.id;
                  const isPrimary = dir.id === directiveIds.primaryId;
                  const isSecondary = dir.id === directiveIds.secondaryId;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setManualDirectiveId(dir.id)}
                      className={`group relative flex items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `${dir.badgeColor} ring-2 ring-offset-1 ring-current shadow-md scale-[1.01]`
                          : "bg-background/95 dark:bg-slate-800/90 text-foreground border border-border/80 hover:bg-secondary/70 hover:border-foreground/25 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0 leading-none">{dir.icon}</span>
                        <div className="min-w-0">
                          <p className="truncate tracking-tight leading-snug">{dir.badge}</p>
                          <p
                            className={`text-[10px] font-medium truncate ${
                              isSelected ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            {dir.category || "Referral Directive"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {isPrimary && (
                          <span
                            className={`rounded text-[9px] font-extrabold px-1.5 py-0.5 border ${
                              isSelected
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/40"
                            }`}
                          >
                            ⭐ Primary
                          </span>
                        )}
                        {isSecondary && !isPrimary && (
                          <span
                            className={`rounded text-[9px] font-extrabold px-1.5 py-0.5 border ${
                              isSelected
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-400/40"
                            }`}
                          >
                            ⭐ Secondary
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Point-wise Clinical Red Flags Box (AI Processed based on IP condition) */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                allRedFlags.length > 0
                  ? "border-red-300 bg-rose-50/90 dark:bg-rose-950/40"
                  : "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30"
              }`}
              data-testid="triage-red-flags-box"
            >
              <div className="mb-2 flex items-center justify-between">
                <p
                  className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${
                    allRedFlags.length > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {allRedFlags.length > 0 ? (
                    <>
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      Clinical Red Flags Detected ({allRedFlags.length} points)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Clinical Red Flags Assessment
                    </>
                  )}
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                    allRedFlags.length > 0
                      ? "bg-red-600 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {allRedFlags.length > 0 ? "High Alert" : "Stable"}
                </span>
              </div>

              {allRedFlags.length > 0 ? (
                <ul
                  className="space-y-1.5 text-xs sm:text-sm text-red-950 dark:text-red-200"
                  data-testid="triage-red-flags-list"
                >
                  {allRedFlags.map((flag, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 py-0.5 text-red-950 dark:text-red-200"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                      <span className="font-semibold leading-snug">{flag}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 py-1 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>No acute red-flag hemodynamic signs detected from caller inquiry.</span>
                </div>
              )}
            </div>

            {/* 6. Directive Guidance Summary */}
            {activeDirective.summary && (
              <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                {activeDirective.summary}
              </p>
            )}

            {/* 7. Action Steps for Agent Checklist */}
            <div className="space-y-1.5 rounded-lg bg-background/90 p-3 border border-current/15 text-xs text-foreground shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Action Steps for Agent:
              </span>
              {activeDirective.checklist.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span className="font-semibold leading-snug">{step}</span>
                </div>
              ))}
            </div>

            {/* Referral Forwarding Dispatch Button & Confirmation */}
            <CaseHandoverForwarding
              result={result}
              activeDirective={activeDirective}
              allRedFlags={allRedFlags}
              callerIntake={callerIntake}
            />

            {/* AI & Algorithmic Continuous Learning Feedback Card */}
            <AiFeedbackLearningCard
              result={result}
              callerIntake={callerIntake}
              currentAgent={currentAgent}
            />
          </div>
        </div>
      </div>

      <div className="panel p-5 sm:p-6" data-testid="triage-facilities-list">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {isFacilityRequired
                ? "Nearest Facilities Directory"
                : "Nearest Facilities to Caller"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFacilityRequired ? (
                <>
                  Prioritized for in-person visit:{" "}
                  <span className="font-bold text-foreground">
                    {activeDirective.badge}
                  </span>
                </>
              ) : (
                <>
                  Primary directive is tele-consultation (
                  <span className="font-bold text-foreground">
                    {activeDirective.badge}
                  </span>
                  ) · Nearest facilities if in-person visit is needed
                </>
              )}
            </p>
          </div>
          {loc && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs font-semibold text-foreground/80 shadow-2xs">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{loc.matched}</span>
            </div>
          )}
        </div>

        {/* Weekend Operating Notice */}
        {isWeekend && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-950 dark:text-amber-200 shadow-2xs">
            <AlertOctagon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-extrabold text-xs">
                Weekend Schedule Active ({dispensaryStatus.reason || "Saturday / Sunday"}):
              </p>
              <p className="text-[11.5px] text-amber-900 dark:text-amber-300 mt-0.5 leading-snug">
                ESIS Dispensaries operate Monday–Friday 10:00 AM – 3:00 PM (Closed Sat &amp; Sun). All 4 facility types are displayed below for immediate caller referral. For acute symptoms, direct patient to 24x7 Casualty at the nearest Hospital.
              </p>
            </div>
          </div>
        )}

        {dynamicFacilities?.length ? (
          <ul className="mt-4 space-y-3">
            {dynamicFacilities.map((f, i) => (
              <li
                key={f.id || f.name + i}
                data-testid="facility-card-item"
                className="group rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/50 p-4 transition-all duration-200 shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[10.5px] ${f.category_style || "bg-secondary/80 border-border/70 text-foreground/90 font-bold"}`}>
                        {f.facility_tag}
                      </span>
                      {f.is_exact_pincode ? (
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          🎯 Pincode Match ({f.pincode})
                        </span>
                      ) : f.is_nearby_pincode ? (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                          📍 Nearby Area ({f.pincode})
                        </span>
                      ) : null}
                      {(f.is_dispensary || isDispensary(f)) && isWeekend && (
                        <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                          Closed on Weekends (OPD Mon–Fri 10AM–3PM)
                        </span>
                      )}
                      {(f.is_dispensary || isDispensary(f)) && !isWeekend && (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                          OPD: Mon–Fri 10:00 AM – 3:00 PM
                        </span>
                      )}
                      {(f.is_hospital || isHospital(f)) && (
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                          OPD: 10:00 AM – 4:00 PM · IPD &amp; Emergency: 24x7
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{f.name}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.address}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground font-semibold">
                        {f.facility_type}
                      </span>
                      <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                        {f.district}
                      </span>
                      {f.pincode && (
                        <span className="mono text-muted-foreground/80 font-bold">{f.pincode}</span>
                      )}
                      {f.phone && (
                        <span className="mono text-primary font-bold">{f.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="mono text-lg font-bold text-primary">{f.distance_km} km</p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        data-testid="facility-send-sms-button"
                        onClick={() => dispatchSms(f)}
                        title="Copy address to SMS the caller"
                        className="rounded-lg border border-border/80 bg-background p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer shadow-2xs"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={f.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="facility-maps-link"
                        title="Open in Google Maps"
                        className="rounded-lg border border-border/80 bg-background p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer shadow-2xs"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No open facilities found near this location.</p>
        )}
      </div>
    </div>
  );
};
