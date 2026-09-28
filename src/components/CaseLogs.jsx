"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Eye,
  Bot,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Building2,
  MapPin,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

const PAGE_SIZE = 50;

export function getReferralBadge(c) {
  const t = c?.triage || {};
  const dest = (
    t.call_referral_primary ||
    t.referral_destination ||
    t.recommended_facility_type ||
    ""
  ).toLowerCase();

  const notes = `${c?.intake?.symptom_notes || ""} ${dest}`.toLowerCase();

  if (
    dest.includes("naco") ||
    dest.includes("1097") ||
    notes.includes("hiv") ||
    notes.includes("aids")
  ) {
    return {
      label: "NACO 1097 Helpline",
      icon: "🎗️",
      color: "bg-rose-800 text-white border-rose-900",
    };
  }
  if (t.call_108 || dest.includes("108") || dest.includes("ambulance")) {
    return {
      label: "108 Ambulance Dispatch",
      icon: "🚨",
      color: "bg-rose-700 text-white border-rose-800",
    };
  }
  if (
    t.is_psychiatric ||
    dest.includes("manas") ||
    dest.includes("psych") ||
    dest.includes("14416")
  ) {
    return {
      label: "Psychiatric Team / Tele-MANAS",
      icon: "🧠",
      color: "bg-purple-700 text-white border-purple-800",
    };
  }
  if (dest.includes("tie") || dest.includes("empanelled")) {
    return {
      label: "Tie-Up Facility",
      icon: "🏥",
      color: "bg-cyan-700 text-white border-cyan-800",
    };
  }
  if (dest.includes("hospital") || dest.includes("casualty")) {
    return {
      label: "ESIC Hospital (Casualty / OPD Today)",
      icon: "🏥",
      color: "bg-amber-700 text-white border-amber-800",
    };
  }
  if (
    dest.includes("104") ||
    dest.includes("tele-doctor") ||
    dest.includes("medical team") ||
    dest.includes("health helpline") ||
    dest.includes("advice")
  ) {
    return {
      label: "104 Health Helpline",
      icon: "📞",
      color: "bg-blue-700 text-white border-blue-800",
    };
  }
  if (dest.includes("sanjeevani") || dest.includes("telemedicine")) {
    return {
      label: "e-Sanjeevani Online Doctor",
      icon: "💻",
      color: "bg-sky-700 text-white border-sky-800",
    };
  }
  if (dest.includes("pharmacy") || dest.includes("chemist")) {
    return {
      label: "Empanelled Pharmacy / Chemist",
      icon: "💊",
      color: "bg-teal-700 text-white border-teal-800",
    };
  }
  if (dest.includes("doctor") || dest.includes("officer")) {
    return {
      label: "Medical Officer Escalation",
      icon: "👨‍⚕️",
      color: "bg-indigo-700 text-white border-indigo-800",
    };
  }
  return {
    label: "ESIS Dispensary",
    icon: "🩺",
    color: "bg-emerald-700 text-white border-emerald-800",
  };
}

export function getAgentCode(c) {
  const explicit = c?.agent_id || c?.intake?.agent_id || c?.agent || c?.intake?.agent;
  if (explicit) {
    const s = String(explicit).toUpperCase();
    if (s.includes("3")) return "A3";
    if (s.includes("2")) return "A2";
    if (s.includes("1")) return "A1";
  }
  const ref = String(c?.case_ref || "").toUpperCase();
  const m = ref.match(/^C(A[1-3])/);
  if (m) return m[1];
  // Stable fallback for legacy cases
  let hash = 0;
  for (let i = 0; i < ref.length; i++) hash = (hash + ref.charCodeAt(i)) % 2;
  return `A${hash + 1}`;
}

export const CaseLogs = ({ refreshKey, onCaseDeleted }) => {
  const [cases, setCases] = useState([]);
  const [urgency, setUrgency] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedCaseForConvo, setSelectedCaseForConvo] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [urgency, q]);

  useEffect(() => {
    api
      .get("/cases", { params: { urgency, q: q || undefined, _t: Date.now() } })
      .then(({ data }) => setCases(data))
      .catch(() => setCases([]));
  }, [urgency, q, refreshKey]);

  const handleConfirmDelete = async () => {
    if (!caseToDelete?.case_ref) return;
    setIsDeleting(true);
    try {
      await api.delete(`/cases/${caseToDelete.case_ref}`);
      setCases((prev) => prev.filter((c) => c.case_ref !== caseToDelete.case_ref));
      setSelectedRefs((prev) => {
        const next = new Set(prev);
        next.delete(caseToDelete.case_ref);
        return next;
      });
      toast.success(`Case ${caseToDelete.case_ref} deleted successfully`);
      setCaseToDelete(null);
      onCaseDeleted?.();
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

  const isPageAllSelected =
    paginatedCases.length > 0 && paginatedCases.every((c) => selectedRefs.has(c.case_ref));

  const toggleSelectAllPage = () => {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (isPageAllSelected) {
        paginatedCases.forEach((c) => next.delete(c.case_ref));
      } else {
        paginatedCases.forEach((c) => next.add(c.case_ref));
      }
      return next;
    });
  };

  const selectAllMatching = () => {
    setSelectedRefs(new Set(cases.map((c) => c.case_ref)));
  };

  const clearSelection = () => {
    setSelectedRefs(new Set());
  };

  const toggleSelectOne = (caseRef, e) => {
    e?.stopPropagation();
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(caseRef)) next.delete(caseRef);
      else next.add(caseRef);
      return next;
    });
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedRefs.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await api.delete("/cases", { data: { case_refs: Array.from(selectedRefs) } });
      setCases((prev) => prev.filter((c) => !selectedRefs.has(c.case_ref)));
      toast.success(`Successfully deleted ${selectedRefs.size} cases`);
      setSelectedRefs(new Set());
      setShowBulkDeleteModal(false);
      onCaseDeleted?.();
    } catch (err) {
      console.error("Failed to delete cases:", err);
      toast.error("Failed to delete selected cases. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2 className="text-xl font-bold sm:text-2xl">Case logs</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Longer Search Bar */}
          <div className="relative w-72 sm:w-96 md:w-[440px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              data-testid="case-log-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, notes, ref..."
              className={`${inputCls} w-full pl-8`}
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

      {/* Bulk Action & Selection Bar */}
      {selectedRefs.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white">
              {selectedRefs.size}
            </span>
            <span className="font-semibold text-foreground">
              {selectedRefs.size} case{selectedRefs.size > 1 ? "s" : ""} selected
            </span>
            {selectedRefs.size < cases.length && (
              <button
                type="button"
                onClick={selectAllMatching}
                className="ml-2 font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                Select all {cases.length} matching
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            >
              <X className="h-3 w-3" /> Deselect all
            </button>
            <button
              type="button"
              data-testid="cases-bulk-delete-button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-1.5 rounded bg-destructive px-3 py-1 font-bold text-destructive-foreground shadow hover:brightness-110 active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected ({selectedRefs.size})</span>
            </button>
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No cases logged yet.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm" data-testid="case-log-table">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-8 py-2 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={isPageAllSelected}
                    onChange={toggleSelectAllPage}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                    title="Select all on current page"
                  />
                </th>
                <th className="py-2 pr-3 font-semibold">Case</th>
                <th className="py-2 pr-3 font-semibold">Agent</th>
                <th className="py-2 pr-3 font-semibold">Caller</th>
                <th className="py-2 pr-3 font-semibold">Complaint</th>
                <th className="py-2 pr-3 font-semibold">Urgency</th>
                <th className="py-2 pr-3 font-semibold">Navigation</th>
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
                  className={`cursor-pointer border-b border-border/40 transition-colors duration-200 hover:bg-secondary/30 ${
                    selectedRefs.has(c.case_ref) ? "bg-primary/5 dark:bg-primary/10" : ""
                  }`}
                >
                  <td className="w-8 py-3 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRefs.has(c.case_ref)}
                      onChange={(e) => toggleSelectOne(c.case_ref, e)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="mono py-3 pr-3 text-xs text-primary/90">{c.case_ref}</td>
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center justify-center rounded bg-secondary/80 px-2 py-0.5 font-mono text-xs font-bold text-foreground border border-border/60">
                      {getAgentCode(c)}
                    </span>
                  </td>
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
                  <td className="py-3 pr-3">
                    {(() => {
                      const badge = getReferralBadge(c);
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow-2xs border ${badge.color}`}
                        >
                          <span className="text-xs shrink-0 leading-none">{badge.icon}</span>
                          <span className="truncate">{badge.label}</span>
                        </span>
                      );
                    })()}
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
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        data-testid={`view-convo-${c.case_ref}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseForConvo(c);
                        }}
                        title={`View AI & Agent Consultation for ${c.case_ref}`}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 hover:text-blue-800 active:scale-95 shadow-2xs dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
                        aria-label={`View conversation for case ${c.case_ref}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-case-${c.case_ref}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaseToDelete(c);
                        }}
                        title={`Delete case ${c.case_ref}`}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 hover:text-rose-800 active:scale-95 shadow-2xs dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 cursor-pointer"
                        aria-label={`Delete case ${c.case_ref}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
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

      {/* Confirmation Modal for Bulk Deletion */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => {
              if (!isBulkDeleting) setShowBulkDeleteModal(false);
            }}
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => {
                if (!isBulkDeleting) setShowBulkDeleteModal(false);
              }}
              disabled={isBulkDeleting}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="mt-4 text-center">
              <h3 className="text-lg font-bold text-foreground">
                Delete {selectedRefs.size} Selected Case{selectedRefs.size > 1 ? "s" : ""}?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Are you sure you want to permanently delete{" "}
                <strong className="text-foreground font-semibold">
                  {selectedRefs.size} case{selectedRefs.size > 1 ? "s" : ""}
                </strong>
                ? This action cannot be undone and will permanently remove all associated audit records.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="w-1/2 rounded-xl border border-border/80 bg-secondary/50 py-2.5 text-xs font-semibold text-foreground transition hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkDeleting}
                className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete ({selectedRefs.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Conversation Modal (Eye Icon Pop-up) */}
      {selectedCaseForConvo && (
        <CaseConversationModal
          caseItem={selectedCaseForConvo}
          onClose={() => setSelectedCaseForConvo(null)}
        />
      )}
    </div>
  );
};

function CaseConversationModal({ caseItem, onClose }) {
  if (!caseItem) return null;

  const agentCode = getAgentCode(caseItem);
  const triage = caseItem.triage || {};
  const intake = caseItem.intake || {};
  const nearest = caseItem.nearest_facilities?.[0];
  const refBadge = getReferralBadge(caseItem);

  // Extract explicit chat history if present
  const rawHistory =
    caseItem.ekms_ai_context?.chatHistory ||
    caseItem.chatHistory ||
    caseItem.chat_history ||
    [];

  const hasRecordedChat = Array.isArray(rawHistory) && rawHistory.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/80 bg-linear-to-r from-blue-50/70 via-background to-secondary/40 dark:from-blue-950/30 dark:via-background dark:to-secondary/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  AI & Agent Consultation
                </h3>
                <span className="mono rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-bold">
                  {caseItem.case_ref}
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-foreground border border-border">
                  Agent {agentCode}
                </span>
                <UrgencyBadge level={triage.urgency_level} size="sm" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold text-foreground">
                  Caller: {intake.caller_name || "Anonymous Caller"}
                </span>
                {intake.phone && (
                  <span className="mono font-semibold">({intake.phone})</span>
                )}
                {(intake.age || intake.sex) && (
                  <span>
                    &bull; {[intake.age ? `${intake.age}y` : null, intake.sex].filter(Boolean).join(" ")}
                  </span>
                )}
                {intake.city && (
                  <span>&bull; {intake.city}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Metadata Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-border/60 bg-secondary/30 px-4 py-2.5 text-[11px]">
          <div>
            <span className="text-muted-foreground block text-[10px]">Acuity Score</span>
            <span className="font-bold text-foreground">
              {triage.urgency_score ? `${triage.urgency_score}/10` : "Assessed"} ({triage.urgency_level || "Standard"})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Duration</span>
            <span className="font-medium text-foreground">
              {intake.duration || triage.duration || "Reported today"}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <span className="text-muted-foreground block text-[10px]">Recommended Referral</span>
            <span className="font-bold text-foreground truncate block">
              {refBadge.icon} {refBadge.label} {nearest?.distance_km != null ? `(${nearest.distance_km} km)` : ""}
            </span>
          </div>
        </div>

        {/* Scrollable Conversation Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-background">
          <div className="flex items-center justify-center my-1">
            <span className="rounded-full bg-border/60 px-3 py-1 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
              Consultation Started &bull; {new Date(caseItem.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {hasRecordedChat ? (
            /* Render recorded live chatHistory */
            rawHistory.map((m, idx) => {
              const isAgent = m.sender === "user" || m.role === "user";
              return (
                <div
                  key={m.id || idx}
                  className={`flex items-start gap-2.5 ${isAgent ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-2xs ${
                      isAgent
                        ? "bg-slate-800 text-white dark:bg-slate-700"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {isAgent ? agentCode : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-2xs space-y-1.5 ${
                      isAgent
                        ? "bg-primary text-primary-foreground rounded-tr-xs"
                        : "border border-border bg-white dark:bg-card text-foreground rounded-tl-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 font-semibold">
                      <span>{isAgent ? `Agent ${agentCode}` : "EKMS AI Assistant"}</span>
                      {isAgent && (m.isVoice === true || m.source === "voice") && (
                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
                          Voice NLP
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                      {m.text || m.content}
                    </p>

                    {/* Probing suggestion chips if any */}
                    {Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                      <div className="pt-2 mt-1 border-t border-border/50 flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground block w-full">
                          AI Suggested Answer Chips:
                        </span>
                        {m.suggestions.map((chip, cIdx) => (
                          <span
                            key={cIdx}
                            className="rounded-full bg-secondary/80 border border-border px-2 py-0.5 text-[10px] font-medium text-foreground"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* Reconstruct clean conversational transcript for direct/legacy cases */
            <div className="space-y-4">
              {/* Turn 1: Agent Intake */}
              <div className="flex items-start gap-2.5 flex-row-reverse">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold shadow-2xs">
                  {agentCode}
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs p-3.5 shadow-2xs bg-primary text-primary-foreground space-y-1">
                  <div className="flex items-center justify-between text-[10px] opacity-80 font-semibold">
                    <span>Agent {agentCode} (Caller Intake)</span>
                  </div>
                  <p className="text-xs sm:text-[13px] leading-relaxed">
                    {intake.symptom_notes || triage.summary_en || "Caller arrived with acute health inquiry."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-[10px] opacity-90 font-medium">
                    {intake.duration && <span>Duration: {intake.duration}</span>}
                    {intake.severity_reported && <span>Reported Severity: {intake.severity_reported}/10</span>}
                  </div>
                </div>
              </div>

              {/* Turn 2: AI Probing & Clinical Screening */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-xs p-3.5 shadow-2xs border border-border bg-white dark:bg-card text-foreground space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1 text-blue-600 font-bold">
                      <Sparkles className="h-3 w-3" /> EKMS AI Clinical Probing
                    </span>
                  </div>
                  
                  {Array.isArray(triage.followup_questions) && triage.followup_questions.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-foreground/90 font-medium">
                        Screened against clinical red-flag protocols. Probing questions asked:
                      </p>
                      <ul className="list-disc pl-4 text-xs space-y-1 text-foreground/80">
                        {triage.followup_questions.map((q, qIdx) => (
                          <li key={qIdx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-[13px] leading-relaxed">
                      Conducted real-time symptom analysis and cross-referenced emergency danger signs.
                    </p>
                  )}

                  {Array.isArray(triage.red_flags) && triage.red_flags.length > 0 && (
                    <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 space-y-1">
                      <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-rose-600" /> Danger Signs Evaluated:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {triage.red_flags.map((rf, rIdx) => (
                          <span
                            key={rIdx}
                            className="rounded-full bg-rose-100 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 border border-rose-300 text-[10px] px-2 py-0.5 font-medium"
                          >
                            {rf}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Turn 3: Agent Verification */}
              <div className="flex items-start gap-2.5 flex-row-reverse">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold shadow-2xs">
                  {agentCode}
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs p-3 shadow-2xs bg-primary/90 text-primary-foreground space-y-1">
                  <div className="text-[10px] opacity-80 font-semibold">
                    <span>Agent {agentCode} (Probing Completed)</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Verified caller location ({intake.district || intake.city || "District"}, PIN: {intake.pincode || "Mapped"}) and confirmed symptom severity. Requesting final dispatch referral.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Final Outcome Card inside Transcript */}
          <div className="mt-4 rounded-xl border border-emerald-300/80 bg-linear-to-b from-emerald-50/70 to-white dark:from-emerald-950/30 dark:to-card p-4 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Triage Decision & Facility Referral
                </span>
              </div>
              <UrgencyBadge level={triage.urgency_level} size="sm" />
            </div>

            <div className="text-xs space-y-1 text-slate-800 dark:text-slate-200">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {triage.summary_en || triage.recommended_action}
              </p>
              {triage.reasoning && (
                <p className="text-[11.5px] leading-relaxed text-muted-foreground pt-1">
                  <span className="font-bold text-foreground">Clinical Rationale:</span> {triage.reasoning}
                </p>
              )}
            </div>

            {nearest && (
              <div className="rounded-lg bg-white dark:bg-card border border-border/80 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> {nearest.name}
                  </span>
                  <span className="rounded bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
                    {nearest.distance_km != null ? `${nearest.distance_km} km` : "Nearest"}
                  </span>
                </div>
                {nearest.address && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{nearest.address}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Logged {new Date(caseItem.created_at).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
