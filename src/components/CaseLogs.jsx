"use client";

import { useEffect, useState } from "react";
import { Search, Inbox, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

const PAGE_SIZE = 50;

export const CaseLogs = ({ refreshKey }) => {
  const [cases, setCases] = useState([]);
  const [urgency, setUrgency] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [urgency, q]);

  useEffect(() => {
    api
      .get("/cases", { params: { urgency, q: q || undefined } })
      .then(({ data }) => setCases(data))
      .catch(() => setCases([]));
  }, [urgency, q, refreshKey]);

  const handleConfirmDelete = async () => {
    if (!caseToDelete?.case_ref) return;
    setIsDeleting(true);
    try {
      await api.delete(`/cases/${caseToDelete.case_ref}`);
      setCases((prev) => prev.filter((c) => c.case_ref !== caseToDelete.case_ref));
      toast.success(`Case ${caseToDelete.case_ref} deleted successfully`);
      setCaseToDelete(null);
    } catch (err) {
      console.error("Failed to delete case:", err);
      toast.error("Failed to delete case. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(cases.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedCases = cases.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2 className="text-xl font-bold sm:text-2xl">Case logs</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              data-testid="case-log-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, notes"
              className={`${inputCls} pl-8`}
            />
          </div>
          <select
            data-testid="case-log-filter-urgency"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className={inputCls}
          >
            <option value="all">All urgencies</option>
            <option value="Emergency">Emergency</option>
            <option value="Urgent">Urgent</option>
            <option value="Routine">Routine</option>
            <option value="Self-care">Self-care</option>
          </select>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No cases logged yet.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm" data-testid="case-log-table">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Case</th>
                <th className="py-2 pr-3 font-semibold">Caller</th>
                <th className="py-2 pr-3 font-semibold">Complaint</th>
                <th className="py-2 pr-3 font-semibold">Urgency</th>
                <th className="py-2 pr-3 font-semibold">Navigation</th>
                <th className="py-2 pr-3 font-semibold">Nearest</th>
                <th className="py-2 pr-3 font-semibold">Time</th>
                <th className="py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCases.map((c) => (
                <tr
                  key={c.case_ref}
                  data-testid="case-log-row"
                  onClick={() => setOpen(open === c.case_ref ? null : c.case_ref)}
                  className="cursor-pointer border-b border-border/40 transition-colors duration-200 hover:bg-secondary/30"
                >
                  <td className="mono py-3 pr-3 text-xs text-primary/90">{c.case_ref}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-foreground">{c.intake?.caller_name || "—"}</p>
                      {(c.intake?.age || c.intake?.sex) && (
                        <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                          {[c.intake?.age ? `${c.intake.age}y` : null, c.intake?.sex].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="mono text-[11px] text-muted-foreground">{c.intake?.phone || "—"}</p>
                  </td>
                  <td className="max-w-[280px] py-3 pr-3">
                    <p className={open === c.case_ref ? "text-foreground font-medium text-xs leading-relaxed" : "truncate text-muted-foreground"}>
                      {open === c.case_ref ? c.intake?.symptom_notes : c.triage?.summary_en}
                    </p>
                    {open === c.case_ref && c.triage?.reasoning && (
                      <div className="mt-2 text-xs leading-relaxed text-foreground/80 border-t border-border/40 pt-1.5">
                        <p>{c.triage?.reasoning}</p>
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <UrgencyBadge
                      level={c.triage?.urgency_level}
                      size="sm"
                      testId="case-log-urgency-badge"
                    />
                  </td>
                  <td className="max-w-[280px] py-3 pr-3 text-xs leading-snug">
                    <p
                      className="line-clamp-2 text-foreground/90 font-medium"
                      title={c.triage?.recommended_action || c.triage?.recommended_facility_type}
                    >
                      {c.triage?.recommended_action || c.triage?.recommended_facility_type || "—"}
                    </p>
                    {c.triage?.recommended_facility_type && c.triage?.recommended_action && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                        {c.triage.recommended_facility_type}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {c.nearest_facilities?.[0]
                      ? `${c.nearest_facilities[0].name} · ${c.nearest_facilities[0].distance_km} km`
                      : "—"}
                  </td>
                  <td className="mono py-3 pr-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      data-testid={`delete-case-${c.case_ref}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCaseToDelete(c);
                      }}
                      title={`Delete case ${c.case_ref}`}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50/60 p-2 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 active:scale-95 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60"
                      aria-label={`Delete case ${c.case_ref}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls after 50 cases */}
          {cases.length > PAGE_SIZE && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(startIndex + PAGE_SIZE, cases.length)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{cases.length}</span> cases
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>

                <span className="font-mono text-xs text-muted-foreground px-1">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modern Confirmation Modal for Delete */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => {
              if (!isDeleting) setCaseToDelete(null);
            }}
          />

          {/* Modal Dialog Card */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close icon button */}
            <button
              type="button"
              onClick={() => {
                if (!isDeleting) setCaseToDelete(null);
              }}
              disabled={isDeleting}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Danger Warning Icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="mt-4 text-center">
              <h3 className="text-lg font-bold text-foreground">
                Delete Case?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Are you sure you want to permanently delete case{" "}
                <span className="font-mono font-semibold text-foreground">
                  {caseToDelete.case_ref}
                </span>
                {caseToDelete.intake?.caller_name ? (
                  <>
                    {" "}
                    for{" "}
                    <span className="font-semibold text-foreground">
                      {caseToDelete.intake.caller_name}
                    </span>
                  </>
                ) : null}
                ? This action cannot be undone.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                disabled={isDeleting}
                className="w-1/2 rounded-xl border border-border/80 bg-secondary/50 py-2.5 text-xs font-semibold text-foreground transition hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Case</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
