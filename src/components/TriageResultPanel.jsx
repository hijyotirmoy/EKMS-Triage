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
} from "lucide-react";
import { toast } from "sonner";
import { urgencyStyle } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

export const ACTION_DIRECTIVES = {
  CALL_108: {
    id: "CALL_108",
    title: "CALL 108 AMBULANCE IMMEDIATELY",
    category: "Emergency Dispatch",
    badge: "108 Ambulance Dispatch",
    badgeColor: "bg-rose-700 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
    icon: "🚨",
    summary:
      "Life-threatening emergency, trauma casualty, or cardiac red-flag detected. The agent must immediately trigger or direct 108 ambulance dispatch with the caller's location.",
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
    summary:
      "Symptoms require secondary hospital casualty, doctor examination today, or specialist diagnostics. Guide caller to the nearest ESIC Hospital.",
    checklist: [
      "1. Locate the nearest ESIC Hospital shown in Step 03 below.",
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
      "1. Check the nearest ESIS Dispensary listed under Step 03.",
      "2. Click 'SMS to Caller' to dispatch address and dispensary timings (8:00 AM – 2:00 PM).",
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
};

function resolveDefaultDirective(t, result) {
  // 1. Direct explicit matching from EKMS AI Context (100% synchronized with left AI chat)
  const explicitDest =
    result?.ekms_ai_context?.triageState?.referralDestination ||
    result?.ekms_ai_context?.referralDestination;

  if (explicitDest) {
    if (explicitDest === "108 Ambulance") return "CALL_108";
    if (explicitDest === "Psychological Counselling Department") return "TELE_MANAS";
    if (explicitDest === "ESIC Hospital") return "ESIC_HOSPITAL";
    if (explicitDest === "ESIS Dispensary" || explicitDest.includes("Dispensary")) return "ESIS_DISPENSARY";
    if (explicitDest === "104 Medical Team") return "TELE_104";
    if (explicitDest === "e-Sanjeevani") return "E_SANJEEVANI";
    if (explicitDest === "Nearest Pharmacy") return "NEAREST_PHARMACY";
    if (explicitDest === "Forward to Doctor") return "FORWARD_DOCTOR";
  }

  const referral = (
    explicitDest ||
    t?.recommended_facility_type ||
    ""
  ).toLowerCase();

  const isPsychiatricFlag = Boolean(
    result?.ekms_ai_context?.triageState?.isPsychiatric ||
    result?.ekms_ai_context?.isPsychiatric ||
    t?.is_psychiatric
  );

  const notes = `${result?.intake?.symptom_notes || ""} ${result?.ekms_ai_context?.triageState?.symptom || ""} ${result?.ekms_ai_context?.triageState?.condition || ""} ${t?.summary_en || ""} ${t?.reasoning || ""}`.toLowerCase();

  // 2. PSYCHIATRIC / COUNSELLING / TELE-MANAS
  if (
    isPsychiatricFlag ||
    referral.includes("psych") ||
    referral.includes("counsel") ||
    referral.includes("tele-manas") ||
    referral.includes("tele manas") ||
    referral.includes("14416") ||
    /\b(suicid|depression|depressed|udaas|hopeless|anxiety|ghabrahat|cry|crying|pareshan|die|kill myself|self-harm|self harm)\b/i.test(notes)
  ) {
    return "TELE_MANAS";
  }

  // 3. 108 AMBULANCE (Acute physical emergencies, cardiac arrests, accidents)
  if (
    referral.includes("108") ||
    t?.call_108 ||
    /\b(heart attack|crushing chest|cardiac arrest|unconscious|behosh|massive bleed|accident|casualty|zeher|poison)\b/i.test(notes)
  ) {
    return "CALL_108";
  }

  // 4. ESIC HOSPITAL (If caller requested hospital, or severe triage outcome)
  if (
    referral.includes("hospital") ||
    /\b(hospital|aspatal|hospital jaana|hospital jana|visit hospital|esic hospital|admit|bada aspatal)\b/i.test(notes)
  ) {
    return "ESIC_HOSPITAL";
  }

  // 5. 104 MEDICAL TEAM / HEALTH HELPLINE
  if (referral.includes("104") || /\b(104|phone consultation|tele doctor|phone pe doctor)\b/i.test(notes)) {
    return "TELE_104";
  }

  // 6. e-SANJEEVANI TELEMEDICINE
  if (referral.includes("sanjeevani") || /\b(e sanjeevani|esanjeevani|telemedicine|online doctor)\b/i.test(notes)) {
    return "E_SANJEEVANI";
  }

  // 7. NEAREST PHARMACY
  if (
    referral.includes("pharmacy") ||
    referral.includes("chemist") ||
    (t?.urgency_level === "Self-care" && /\b(pharmacy|chemist|dawai store|refill)\b/i.test(notes))
  ) {
    return "NEAREST_PHARMACY";
  }

  // 8. FORWARD TO MEDICAL OFFICER / ON-DUTY DOCTOR
  if (referral.includes("doctor") || referral.includes("medical officer") || /\b(forward to doctor|talk to doctor)\b/i.test(notes)) {
    return "FORWARD_DOCTOR";
  }

  // 9. Secondary care fallback
  if (
    referral.includes("casualty") ||
    t?.urgency_level === "Emergency" ||
    t?.urgency_level === "Urgent" ||
    (t?.urgency_score && t?.urgency_score >= 7) ||
    (result?.intake?.severity_reported && Number(result?.intake?.severity_reported) >= 7) ||
    /\b(fracture|deep cut|severe pain)\b/i.test(notes)
  ) {
    return "ESIC_HOSPITAL";
  }

  // 10. ESIS DISPENSARY (Routine primary care)
  return "ESIS_DISPENSARY";
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

  const defaultDirectiveId = useMemo(() => {
    return resolveDefaultDirective(t, result);
  }, [t, result]);

  const [manualDirectiveId, setManualDirectiveId] = useState(null);
  const activeDirective =
    ACTION_DIRECTIVES[manualDirectiveId || defaultDirectiveId] || ACTION_DIRECTIVES.ESIS_DISPENSARY;

  const dispatchSms = (f) => {
    navigator.clipboard?.writeText(
      `${f.name}, ${f.address}. Directions: ${f.maps_url}`
    );
    toast.success("Facility address copied — ready to SMS to the caller");
  };

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
                {!t.is_psychiatric && t.call_108 && (
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
          <p className="mt-1 text-sm text-muted-foreground" data-testid="triage-summary-hi">
            {t.summary_hi}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{s.label}</p>

          {/* Red flags present */}
          {t.red_flags?.length > 0 && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700">
                <ShieldAlert className="h-4 w-4" /> Red flags present
              </p>
              <ul className="space-y-1.5 text-sm text-red-900" data-testid="triage-red-flags-list">
                {t.red_flags.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* WHAT AGENT MUST DO NOW — Decision Directive Box (Right Below Red Flags) */}
          <div
            className={`mt-5 rounded-xl border p-4 shadow-sm transition-all ${activeDirective.cardBorder}`}
            data-testid="agent-action-box"
          >
            {/* Header Badge & Title */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activeDirective.icon}</span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-85 block">
                    WHAT AGENT MUST DO NOW · {activeDirective.category}
                  </span>
                  <h4 className="text-sm sm:text-base font-black tracking-tight">
                    {activeDirective.title}
                  </h4>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-2xs ${activeDirective.badgeColor}`}
              >
                {activeDirective.badge}
              </span>
            </div>

            {/* Directive Summary */}
            <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed">
              {activeDirective.summary}
            </p>

            {/* Agent Action Checklist */}
            <div className="mt-3 space-y-1.5 rounded-lg bg-background/90 p-3 border border-current/15 text-xs text-foreground shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Action Steps for Agent:
              </span>
              {activeDirective.checklist.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700" />
                  <span className="font-semibold leading-snug">{step}</span>
                </div>
              ))}
            </div>

            {/* Decision Switcher Buttons */}
            <div className="mt-3.5 pt-3 border-t border-current/15">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                  Decision Switcher (Guidance for other referral channels):
                </span>
                {manualDirectiveId && (
                  <button
                    type="button"
                    onClick={() => setManualDirectiveId(null)}
                    className="text-[10px] font-semibold underline opacity-80 hover:opacity-100"
                  >
                    Reset to AI Recommendation
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(ACTION_DIRECTIVES).map((dir) => {
                  const isSelected = dir.id === activeDirective.id;
                  const isAiDefault = dir.id === defaultDirectiveId;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setManualDirectiveId(dir.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                        isSelected
                          ? `${dir.badgeColor} shadow-2xs scale-[1.02]`
                          : "bg-background/90 text-foreground border border-border/80 hover:bg-secondary hover:border-foreground/30"
                      }`}
                    >
                      <span>{dir.icon}</span>
                      <span>{dir.badge}</span>
                      {isAiDefault && !isSelected && (
                        <span className="ml-0.5 text-[9px] text-amber-500 font-extrabold">(AI)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {t.recommended_action && (
            <div className="mt-5 rounded-md border border-border/60 bg-secondary/25 p-4">
              <p className="eyebrow mb-1.5">Tell the caller</p>
              <p className="text-sm font-medium text-foreground leading-relaxed" data-testid="triage-recommended-action">
                {t.recommended_action}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Step 03</p>
            <h3 className="text-lg font-bold">Nearest ESIC / ESIS facilities</h3>
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
