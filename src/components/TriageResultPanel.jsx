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

export const ACTION_DIRECTIVES = {
  NACO_1097: {
    id: "NACO_1097",
    title: "TRANSFER TO NACO 1097 HELPLINE (HIV / AIDS / STI)",
    category: "HIV, AIDS & Sexual Health Counseling",
    badge: "NACO 1097 Helpline",
    badgeColor: "bg-rose-800 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
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
    badge: "108 Ambulance Dispatch",
    badgeColor: "bg-rose-700 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
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
    title: "FORWARD TO PSYCHIATRIC TEAM / TELE-MANAS (14416)",
    category: "Mental Health Crisis Protocol",
    badge: "Psychiatric Team / Tele-MANAS",
    badgeColor: "bg-purple-700 text-white font-bold",
    cardBorder: "border-purple-400 bg-purple-50 text-purple-950 shadow-xs",
    icon: "🧠",
    summary:
      "Caller is in emotional crisis, experiencing depression, severe anxiety, or thoughts of self-harm. The agent must speak with warm empathy and transfer to mental health professionals.",
    checklist: [
      "1. Speak calmly with reassurance: 'You are safe, and we are connecting you to professional help.'",
      "2. Transfer call to Psychological Counselling Department or Toll-Free 14416 (National Tele-MANAS).",
      "3. Stay on line until safely handed over if self-harm risk is active.",
    ],
  },
  ESIC_HOSPITAL: {
    id: "ESIC_HOSPITAL",
    title: "REFER / FORWARD TO NEAREST ESIC HOSPITAL",
    category: "Secondary Care & Casualty Evaluation",
    badge: "ESIC Hospital (Casualty / OPD Today)",
    badgeColor: "bg-amber-700 text-white font-bold",
    cardBorder: "border-amber-400 bg-amber-50 text-amber-950 shadow-xs",
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
    title: "FORWARD TO 104 MEDICAL TEAM",
    category: "Tele-Doctor Consultation",
    badge: "104 Health Helpline",
    badgeColor: "bg-blue-700 text-white font-bold",
    cardBorder: "border-blue-400 bg-blue-50 text-blue-950 shadow-xs",
    icon: "📞",
    summary:
      "Caller requests direct medical advice or consultation with a government doctor over the phone. Transfer call to the 104 Medical Team.",
    checklist: [
      "1. Inform caller: 'Connecting you to the 104 government medical officer now.'",
      "2. Transfer call line to 104 Health Helpline triage queue.",
      "3. Share case reference number for medical documentation.",
    ],
  },
  E_SANJEEVANI: {
    id: "E_SANJEEVANI",
    title: "ADVISE e-SANJEEVANI TELE-CONSULTATION",
    category: "National Telemedicine Portal",
    badge: "e-Sanjeevani Online Doctor",
    badgeColor: "bg-sky-700 text-white font-bold",
    cardBorder: "border-sky-400 bg-sky-50 text-sky-950 shadow-xs",
    icon: "💻",
    summary:
      "Advise the patient to consult government specialist doctors online from home without visiting a crowded hospital facility.",
    checklist: [
      "1. Guide caller to visit esanjeevani.in or install the free 'eSanjeevani' mobile app.",
      "2. Explain that audio/video consultation with government doctors is completely free.",
      "3. Advise visiting physical dispensary or hospital if symptoms worsen.",
    ],
  },
  NEAREST_PHARMACY: {
    id: "NEAREST_PHARMACY",
    title: "ADVISE NEAREST PHARMACY / DISPENSARY STORE",
    category: "Prescription Refill & OTC Supply",
    badge: "Empanelled Pharmacy / Chemist",
    badgeColor: "bg-teal-700 text-white font-bold",
    cardBorder: "border-teal-400 bg-teal-50 text-teal-950 shadow-xs",
    icon: "💊",
    summary:
      "Guide caller to the nearest registered dispensary store or empanelled chemist for free prescription medicines, ORS, or first-aid supplies.",
    checklist: [
      "1. Confirm patient has a valid doctor prescription or Pehchan card.",
      "2. Provide address of nearest empanelled chemist or dispensary pharmacy.",
      "3. Advise patient on prescribed dosage adherence.",
    ],
  },
  FORWARD_DOCTOR: {
    id: "FORWARD_DOCTOR",
    title: "FORWARD CALL TO ON-DUTY MEDICAL OFFICER",
    category: "Direct Physician Escalation",
    badge: "Medical Officer Escalation",
    badgeColor: "bg-indigo-700 text-white font-bold",
    cardBorder: "border-indigo-400 bg-indigo-50 text-indigo-950 shadow-xs",
    icon: "👨‍⚕️",
    summary:
      "Complex clinical scenario requiring direct clinical evaluation. Escalate caller to the on-duty Medical Officer workstation.",
    checklist: [
      "1. Inform caller: 'Connecting you to our on-duty Medical Officer for clinical review.'",
      "2. Transfer line to on-duty medical doctor desk.",
      "3. Summarize primary symptoms, severity score, and reported duration.",
    ],
  },
  TIE_UP_FACILITY: {
    id: "TIE_UP_FACILITY",
    title: "REFER TO EMPANELLED TIE-UP FACILITY",
    category: "Empanelled Network Care",
    badge: "Tie-Up Facility",
    badgeColor: "bg-cyan-700 text-white font-bold",
    cardBorder: "border-cyan-400 bg-cyan-50 text-cyan-950 shadow-xs",
    icon: "🏥",
    summary: "",
    checklist: [
      "1. Check the nearest empanelled tie-up facility listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address, phone number, and Google Maps directions.",
      "3. Remind IP to carry their ESIC Pehchan / Insurance card for cashless treatment under ESIC tie-up guidelines.",
    ],
  },
};

export function mapDestinationToDirectiveId(dest) {
  if (!dest || typeof dest !== "string") return "ESIS_DISPENSARY";
  const d = dest.toLowerCase();
  if (d.includes("108") || d.includes("ambulance")) return "CALL_108";
  if (d.includes("manas") || d.includes("psych") || d.includes("counsel")) return "TELE_MANAS";
  if (d.includes("naco") || d.includes("1097")) return "NACO_1097";
  if (d.includes("tie") || d.includes("empanelled")) return "TIE_UP_FACILITY";
  if (d.includes("hospital") || d.includes("casualty")) return "ESIC_HOSPITAL";
  if (d.includes("104") || d.includes("tele-doctor") || d.includes("phone doctor") || d.includes("medical team")) return "TELE_104";
  if (d.includes("sanjeevani") || d.includes("telemedicine")) return "E_SANJEEVANI";
  if (d.includes("pharmacy") || d.includes("chemist")) return "NEAREST_PHARMACY";
  if (d.includes("forward to doctor") || d.includes("medical officer")) return "FORWARD_DOCTOR";
  if (d.includes("dispensary") || d.includes("clinic")) return "ESIS_DISPENSARY";
  return "ESIS_DISPENSARY";
}

export function resolveDirectiveIds(t, result) {
  const primaryDest =
    t?.call_referral_primary ||
    t?.referral_destination ||
    result?.ekms_ai_context?.triageState?.referralDestination ||
    result?.ekms_ai_context?.referralDestination ||
    "ESIS Dispensary";

  const secondaryDest =
    t?.call_referral_secondary ||
    t?.secondary_referral_destination ||
    "104 Medical Team";

  const primaryId = mapDestinationToDirectiveId(primaryDest);
  let secondaryId = mapDestinationToDirectiveId(secondaryDest);

  if (secondaryId === primaryId) {
    secondaryId = primaryId === "ESIC_HOSPITAL" ? "TELE_104" : "ESIC_HOSPITAL";
  }

  return {
    primaryId,
    secondaryId,
    isDual: false, // Dual protocol notification banner box removed completely per user request
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

export const TriageResultPanel = ({ result, loading }) => {
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

    // Look ONLY at actual caller-reported text, never circular AI summaries
    const callerText = `${result?.intake?.symptom_notes || ""} ${result?.ekms_ai_context?.triageState?.condition || ""}`.toLowerCase();
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm)\b/i.test(callerText);

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

  const primaryReferralDest =
    t.call_referral_primary ||
    t.referral_destination ||
    ACTION_DIRECTIVES[directiveIds.primaryId]?.badge ||
    t.recommended_facility_type ||
    "ESIS Dispensary";
  const cleanReason = (reason) => {
    if (!reason || typeof reason !== "string") return "";
    if (reason.includes("Symptoms require secondary hospital casualty")) return "";
    return reason;
  };

  const primaryReferralReason = cleanReason(
    t.referral_reason ||
    ACTION_DIRECTIVES[directiveIds.primaryId]?.summary ||
    t.recommended_action ||
    ""
  );

  const secondaryReferralDest =
    t.call_referral_secondary ||
    t.secondary_referral_destination ||
    secondaryDirective?.badge ||
    (directiveIds.primaryId === "CALL_108"
      ? "ESIC Hospital"
      : "104 Medical Team");
  const secondaryReferralReason = cleanReason(
    t.secondary_referral_reason ||
    secondaryDirective?.summary ||
    ""
  );

  return (
    <div className="space-y-5 rise" data-testid="triage-result">
      <div className="panel overflow-hidden">
        <div className={`h-1 w-full ${s.bar}`} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Triage outcome</p>
              <div className="mt-2 flex items-center gap-3">
                <UrgencyBadge level={t.urgency_level} score={t.urgency_score} />
                {t.is_psychiatric && (
                  <span
                    data-testid="triage-tele-manas"
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> TELE-MANAS 14416
                  </span>
                )}
                {t.call_108 && (
                  <span
                    data-testid="triage-call-108"
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <AlertOctagon className="h-3.5 w-3.5" /> CALL 108 NOW
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-base font-semibold leading-snug" data-testid="triage-summary-en">
            {t.summary_en}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{s.label}</p>

          {/* UNIFIED Call Triage, Referral & Directive Decision Summary Card */}
          <div
            className={`mt-5 w-full rounded-xl border p-4 sm:p-5 shadow-sm transition-all space-y-4 ${
              activeDirective.cardBorder ||
              "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/25 text-foreground"
            }`}
            data-testid="agent-action-box"
          >
            {/* 1. Header: Call Triage & Action Decision Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl shrink-0">
                  {activeDirective.icon || <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-85 block">
                    Call Triage &amp; Action Directive · {activeDirective.category}
                  </span>
                  <h4 className="text-sm sm:text-base font-black tracking-tight">
                    {activeDirective.title}
                  </h4>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Assessed
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-2xs ${activeDirective.badgeColor}`}
                >
                  {activeDirective.badge}
                </span>
              </div>
            </div>

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

            {/* 4. Decision Switcher Buttons (Placed directly above Red Flags with upgraded modern UI/UX) */}
            <div className="rounded-xl border border-current/15 bg-background/70 dark:bg-slate-900/70 backdrop-blur-xs p-3.5 shadow-2xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary opacity-80" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Decision Switcher
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                    (Guidance for referral channels)
                  </span>
                </div>
                {manualDirectiveId && (
                  <button
                    type="button"
                    onClick={() => setManualDirectiveId(null)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Primary AI Recommendation</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.values(ACTION_DIRECTIVES).map((dir) => {
                  const isSelected = dir.id === activeDirective.id;
                  const isPrimary = dir.id === directiveIds.primaryId;
                  const isSecondary = dir.id === directiveIds.secondaryId;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setManualDirectiveId(dir.id)}
                      className={`group relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `${dir.badgeColor} ring-2 ring-offset-1 ring-primary/40 shadow-sm scale-[1.02]`
                          : "bg-background/95 dark:bg-slate-800 text-foreground border border-border/80 hover:bg-secondary/80 hover:border-foreground/25 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="text-sm shrink-0 leading-none">{dir.icon}</span>
                      <span className="tracking-tight">{dir.badge}</span>
                      {isPrimary && !isSelected && (
                        <span className="ml-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 border border-amber-400/40">
                          ⭐ Primary
                        </span>
                      )}
                      {isSecondary && !isSelected && (
                        <span className="ml-1 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[9px] font-extrabold px-1.5 py-0.5 border border-blue-400/40">
                          ⭐ Secondary
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Red Flags Present (Housed cleanly inside the assessment card) */}
            {allRedFlags.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-rose-50/90 dark:bg-rose-950/40 p-3 shadow-2xs">
                <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  <ShieldAlert className="h-4 w-4 text-red-600" /> Red flags present
                </p>
                <ul className="space-y-1 text-xs sm:text-sm text-red-900 dark:text-red-200 font-medium" data-testid="triage-red-flags-list">
                  {allRedFlags.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="font-semibold">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
          </div>
        </div>
      </div>

      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Facilities</h3>
          </div>
          {loc && (
            <span className="mono rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground">
              <MapPin className="mr-1 inline h-3 w-3" />
              {loc.matched} · {loc.method}
            </span>
          )}
        </div>

        {facs?.length ? (
          <ul className="mt-4 space-y-3">
            {facs.map((f, i) => (
              <li
                key={f.id || i}
                data-testid="facility-card-item"
                className={`group rounded-md border p-4 transition-all duration-200 ${
                  i === 0
                    ? "border-primary/60 bg-primary/5 shadow-xs"
                    : "border-border/70 bg-secondary/40 hover:border-primary/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {i === 0 && (
                        <span className="rounded-full bg-primary/15 border border-primary/40 px-2 py-0.5 text-[10px] font-bold text-primary">
                          ⭐ Recommended Facility
                        </span>
                      )}
                      {f.is_exact_pincode && (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          🎯 Pincode Match ({f.pincode})
                        </span>
                      )}
                      {f.facility_category_label && (
                        <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {f.facility_category_label}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Building2 className="h-4 w-4 shrink-0 text-primary/80" />
                      <span className="truncate">{f.name}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.address}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                        {f.facility_type}
                      </span>
                      <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                        {f.district}
                      </span>
                      {f.pincode && (
                        <span className="mono text-muted-foreground/80">{f.pincode}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="mono text-lg font-semibold text-primary">{f.distance_km} km</p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        data-testid="facility-send-sms-button"
                        onClick={() => dispatchSms(f)}
                        title="Copy address to SMS the caller"
                        className="rounded border border-border/70 p-1.5 text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={f.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="facility-maps-link"
                        title="Open in Google Maps"
                        className="rounded border border-border/70 p-1.5 text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
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
          <p className="mt-4 text-sm text-muted-foreground">No facilities found near this location.</p>
        )}
      </div>
    </div>
  );
};
