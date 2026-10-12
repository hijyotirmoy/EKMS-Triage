"use client";

import { useState, useMemo } from "react";
import {
  History,
  CalendarClock,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react";
import { UrgencyBadge } from "./UrgencyBadge";

export function getCallerIdForPhone(phone, history = []) {
  if (!phone) return "";
  const clean = String(phone).replace(/\D/g, "").slice(-10);
  if (!clean) return "";
  const match = (history || []).find((h) => {
    if (!h) return false;
    const hPhone = String(h.phone || h.phoneNumber || h.cleanPhone || "").replace(/\D/g, "").slice(-10);
    return hPhone === clean && (h.caller_id || h.beneficiaryId || h.id);
  });
  if (match) return match.caller_id || match.beneficiaryId || match.id || "";
  if (typeof window !== "undefined") {
    try {
      const reg = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
      const rMatch = reg.find((b) => (b?.cleanPhone || b?.phoneNumber || "").replace(/\D/g, "").slice(-10) === clean);
      if (rMatch) return rMatch.beneficiaryId || rMatch.id || "";
    } catch (_) {}
  }
  return "";
}

export const CallerHistorySection = ({
  form = {},
  callerHistory = [],
  currentAgent,
  activeCallerId,
  activeCaseRef,
}) => {
  // Pagination for Call History
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;

  const effectiveHistory = useMemo(() => {
    return (callerHistory || []).filter((item) => {
      if (!item) return false;
      if (activeCaseRef) {
        const itemRef = String(item.case_ref || item.caseId || item.id || "");
        if (itemRef === String(activeCaseRef)) return false;
      }
      return true;
    });
  }, [callerHistory, activeCaseRef]);

  const phoneDigits = useMemo(() => {
    return (form.phone || "").replace(/\D/g, "");
  }, [form.phone]);

  const totalPages = Math.ceil(effectiveHistory.length / HISTORY_PER_PAGE) || 1;
  const currentPage = Math.min(Math.max(1, historyPage), totalPages);
  const paginated = effectiveHistory.slice(
    (currentPage - 1) * HISTORY_PER_PAGE,
    currentPage * HISTORY_PER_PAGE
  );

  return (
    <div className="w-full rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3.5 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-foreground">
            Caller Call History
          </h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
            {effectiveHistory.length} {effectiveHistory.length === 1 ? "call" : "calls"}
          </span>
        </div>

        {phoneDigits && (
          <div className="flex items-center gap-1.5 mono text-[11px] text-muted-foreground font-semibold bg-background/80 px-2.5 py-1 rounded-md border border-border/60">
            <Phone className="h-3 w-3 text-primary shrink-0" />
            +91 {phoneDigits}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-5">
        {!effectiveHistory || effectiveHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-8 text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-bold text-foreground">No Call History Found</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {phoneDigits
                ? `No prior triage calls recorded under +91 ${phoneDigits}. Connected calls and submitted triages will appear here automatically.`
                : "Enter a phone number in the caller intake form to view previous call logs."}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="space-y-3">
              {paginated.map((item, idx) => (
                <div
                  key={item.id ? `hist_${item.id}_${idx}` : `${item.case_ref || "hist"}_${idx}`}
                  className="rounded-lg border border-border/70 bg-card p-3 sm:p-4 shadow-2xs transition-colors hover:border-primary/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          {(item.created_at || item.createdAt || item.timestamp)
                            ? new Date(item.created_at || item.createdAt || item.timestamp).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Recent call"}
                        </span>
                      </div>
                      <span className="mono text-[11px] text-primary/80 font-bold">
                        {item.case_ref ||
                          item.caseId ||
                          item.case_id ||
                          (item.caller_id && !item.caller_id.match(/^\d{6}-\d{5}$/) ? item.caller_id : "") ||
                          (item.id && String(item.id).startsWith("CA") ? item.id : "") ||
                          (activeCallerId && !activeCallerId.match(/^\d{6}-\d{5}$/) ? activeCallerId : "") ||
                          "Case"}
                      </span>
                    </div>
                    <UrgencyBadge
                      level={item.urgency_level || item.urgency || "ROUTINE"}
                      score={item.urgency_score ?? 4}
                      size="sm"
                    />
                  </div>

                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Reason for Call / Symptoms
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed font-medium">
                      {item.reason || item.summary || item.notes || item.campaign || "Inbound consultation"}
                    </p>
                  </div>

                  <div className="mt-2.5 rounded-md bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300/80 dark:border-emerald-800 p-2.5 text-xs shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                      <Navigation className="h-3 w-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span>Navigation Provided by Agent</span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200 leading-relaxed">
                      {item.navigation ||
                        item.recommended_action ||
                        item.category ||
                        "Standard consultation / triage guidance"}
                    </p>
                    {item.recommended_facility_type && (
                      <p className="mt-1 text-[11px] text-emerald-900 dark:text-emerald-300 font-bold border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1">
                        Routed Facility:{" "}
                        <span className="underline font-extrabold">
                          {item.recommended_facility_type}
                        </span>
                        {item.nearest_facility ? ` (${item.nearest_facility})` : ""}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="text-muted-foreground">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallerHistorySection;
