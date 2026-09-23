"use client";

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
} from "lucide-react";
import { toast } from "sonner";
import { urgencyStyle } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

const Empty = () => (
  <div className="panel grid-lines flex min-h-[480px] flex-col items-center justify-start p-6 pt-8 sm:p-8 sm:pt-10 text-center">
    <div className="mx-auto mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-secondary/80 border border-border/60 text-muted-foreground shadow-2xs">
      <Stethoscope className="h-6 w-6 text-primary/80" strokeWidth={1.75} />
    </div>
    <h3 className="text-base sm:text-lg font-bold text-foreground">Triage output appears here</h3>
    <p className="mt-2 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
      Fill the intake form or load a sample call. The engine returns an urgency level, red flags,
      the facility type needed and the nearest ESIC / ESIS centres.
    </p>
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
                {t.call_108 && (
                  <span
                    data-testid="triage-call-108"
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white"
                  >
                    <AlertOctagon className="h-3.5 w-3.5" /> CALL 108 NOW
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p
                className="mono text-xs text-muted-foreground"
                data-testid="triage-case-ref"
              >
                {result.case_ref}
              </p>
              <p className="mono text-[11px] text-muted-foreground/70">
                {result.latency_ms} ms · {t.confidence} confidence · {t.detected_language}
              </p>
            </div>
          </div>

          <p className="mt-4 text-base font-semibold leading-snug" data-testid="triage-summary-en">
            {t.summary_en}
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="triage-summary-hi">
            {t.summary_hi}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{s.label}</p>

          <div className="mt-5">
            <p className="eyebrow mb-2">Why this level</p>
            <p className="text-sm leading-relaxed text-foreground/90" data-testid="triage-reasoning-text">
              {t.reasoning}
            </p>
          </div>

          {result.ekms_ai_context?.triageState && (
            <div className="mt-5 rounded-md border border-emerald-500/30 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-center gap-2">
                <img src="/logo.png" alt="EKMS AI" className="h-4 w-4 object-contain" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  EKMS AI Adaptive Findings
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {result.ekms_ai_context.triageState.symptom && (
                  <span className="rounded border border-emerald-500/20 bg-background/80 px-2 py-1 font-medium text-emerald-900 dark:text-emerald-200">
                    Symptom: <strong>{result.ekms_ai_context.triageState.symptom}</strong>
                  </span>
                )}
                {result.ekms_ai_context.triageState.severity && (
                  <span className="rounded border border-blue-500/20 bg-background/80 px-2 py-1 font-medium text-blue-900 dark:text-blue-200">
                    Severity: <strong>{result.ekms_ai_context.triageState.severity}</strong>
                  </span>
                )}
                {result.ekms_ai_context.triageState.duration && (
                  <span className="rounded border border-amber-500/20 bg-background/80 px-2 py-1 font-medium text-amber-900 dark:text-amber-200">
                    Duration: <strong>{result.ekms_ai_context.triageState.duration}</strong>
                  </span>
                )}
                {result.ekms_ai_context.triageState.condition && (
                  <span className="rounded border border-purple-500/30 bg-background/80 px-2 py-1 font-bold text-purple-900 dark:text-purple-200">
                    Suspected Condition: <strong>{result.ekms_ai_context.triageState.condition}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

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

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border/60 bg-secondary/25 p-4">
              <p className="eyebrow mb-1.5">Facility type needed</p>
              <p className="text-sm font-semibold" data-testid="triage-recommended-facility">
                {t.recommended_facility_type}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-secondary/25 p-4">
              <p className="eyebrow mb-1.5">Tell the caller</p>
              <p className="text-sm" data-testid="triage-recommended-action">
                {t.recommended_action}
              </p>
            </div>
          </div>

          {t.followup_questions?.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow mb-2">Ask next</p>
              <ul className="space-y-1.5" data-testid="triage-followup-questions">
                {t.followup_questions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mono text-primary/80">{i + 1}.</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-5 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
            {result.disclaimer}
          </p>
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
                className="group rounded-md border border-border/70 bg-secondary/40 p-4 transition-colors duration-200 hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
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
