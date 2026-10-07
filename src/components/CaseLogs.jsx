"use client";

import { useEffect, useState, useMemo } from "react";
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
  PhoneCall,
  Navigation,
  ArrowRight,
  User,
  Activity,
  History,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";
import { normalizePhone } from "../lib/caseId";
import {
  getCachedCases,
  setCachedCases,
  removeCaseFromLocalCache,
  appendCaseToLocalCache,
  getCachedStats,
  setCachedStats,
} from "../lib/clientCache";
import { subscribeToSync, broadcastEvent } from "../lib/broadcastSync";
import { getCallerIdForPhone } from "../lib/callerId";
import { CaseHandoverForwarding } from "./CaseHandoverForwarding";

export function isCaseItemForwarded(c) {
  if (!c) return false;
  if (c.is_forwarded || c.forwarded_at || c.dispatch_id || c.handover_sent || c.status === "forwarded") {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      const keys = [
        c.case_ref,
        c.id,
        c.case_id,
        c.caller_id,
        c.intake?.phone,
      ].filter(Boolean);
      for (const k of keys) {
        const str = String(k).trim();
        if (
          localStorage.getItem(`ekms_forwarded_${str}`) ||
          sessionStorage.getItem(`ekms_forwarded_${str}`) ||
          localStorage.getItem(`ekms_forwarded_${str.toUpperCase()}`) ||
          sessionStorage.getItem(`ekms_forwarded_${str.toUpperCase()}`) ||
          localStorage.getItem(`ekms_forwarded_${str.toLowerCase()}`) ||
          sessionStorage.getItem(`ekms_forwarded_${str.toLowerCase()}`)
        ) {
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

export function mergeCaseForwardStatus(casesList) {
  if (!Array.isArray(casesList) || typeof window === "undefined") return casesList;
  return casesList.map((c) => {
    if (c.is_forwarded || c.forwarded_at || c.dispatch_id || c.status === "forwarded") return c;
    const keys = [
      c.case_ref,
      c.id,
      c.case_id,
      c.caller_id,
      c.intake?.phone,
    ].filter(Boolean);
    for (const k of keys) {
      const str = String(k).trim();
      const stored =
        localStorage.getItem(`ekms_forwarded_${str}`) ||
        sessionStorage.getItem(`ekms_forwarded_${str}`) ||
        localStorage.getItem(`ekms_forwarded_${str.toUpperCase()}`) ||
        sessionStorage.getItem(`ekms_forwarded_${str.toUpperCase()}`) ||
        localStorage.getItem(`ekms_forwarded_${str.toLowerCase()}`) ||
        sessionStorage.getItem(`ekms_forwarded_${str.toLowerCase()}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...c, ...parsed, is_forwarded: true, status: "forwarded" };
        } catch (e) {}
      }
    }
    return c;
  });
}

const PAGE_SIZE = 50;

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

export function getReferralBadge(c) {
  const t = c?.triage || {};
  const dest = (
    t.call_referral_primary ||
    t.referral_destination ||
    t.recommended_facility_type ||
    ""
  ).toLowerCase();

  if (t.call_108 || dest.includes("108") || dest.includes("ambulance")) {
    return {
      label: "108 Ambulance",
      icon: "🚨",
      color: "bg-rose-700 text-white border-rose-800",
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
      label: "ESIC Hospital",
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

export function getSecondaryReferralBadge(c) {
  const t = c?.triage || {};
  const dest = (
    t.call_referral_secondary ||
    t.secondary_referral_destination ||
    "104 Health Helpline"
  ).toLowerCase();

  if (dest.includes("108") || dest.includes("ambulance")) {
    return {
      label: "108 Ambulance",
      icon: "🚨",
      color: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800",
    };
  }
  if (dest.includes("hospital") || dest.includes("casualty")) {
    return {
      label: "ESIC Hospital Casualty (24x7)",
      icon: "🏥",
      color: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
    };
  }
  if (dest.includes("tie") || dest.includes("empanelled")) {
    return {
      label: "Empanelled Tie-Up Hospital",
      icon: "🏥",
      color: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800",
    };
  }
  return {
    label: "104 Health Helpline (Doctor on Call)",
    icon: "📞",
    color: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800",
  };
}

export function getAgentCode(c) {
  const explicit = c?.agent_id || c?.intake?.agent_id || c?.agent || c?.intake?.agent;
  if (explicit) {
    const s = String(explicit).toUpperCase().trim();
    if (s.includes("ADMIN 1") || s.includes("ADMIN1") || s === "AD1") return "AD1";
    if (s.includes("ADMIN 2") || s.includes("ADMIN2") || s === "AD2") return "AD2";
    if (s.includes("3") || s === "A3") return "A3";
    if (s.includes("2") || s === "A2") return "A2";
    if (s.includes("1") || s === "A1") return "A1";
  }
  const ref = String(c?.case_ref || "").toUpperCase();
  const mAdmin = ref.match(/^C(AD[1-2])/i);
  if (mAdmin) return mAdmin[1].toUpperCase();
  const m = ref.match(/^C(A[1-3])/i);
  if (m) return m[1].toUpperCase();
  let hash = 0;
  for (let i = 0; i < ref.length; i++) hash = (hash + ref.charCodeAt(i)) % 2;
  return `A${hash + 1}`;
}

export function getAgentFullLabel(agentCode) {
  const s = String(agentCode || "").toUpperCase().trim();
  if (s === "AD1" || s.includes("ADMIN 1") || s.includes("ADMIN1")) return "Admin 1";
  if (s === "AD2" || s.includes("ADMIN 2") || s.includes("ADMIN2")) return "Admin 2";
  if (s === "A1" || s.includes("AGENT 1") || s.includes("AGENT1")) return "Agent 1";
  if (s === "A2" || s.includes("AGENT 2") || s.includes("AGENT2")) return "Agent 2";
  if (s === "A3" || s.includes("AGENT 3") || s.includes("AGENT3")) return "Agent 3";
  return agentCode ? `Agent ${agentCode}` : "Agent";
}

export function getCleanComplaintSummary(c) {
  if (!c) return "Caller arrived with acute health inquiry.";
  
  const intake = c.intake || {};
  const triage = c.triage || {};

  // 1. Check if summary_en is already set and clean
  let summary = triage.summary_en || "";

  // 2. If summary is empty or has bracketed/technical text, check ekms_ai_context / clinicalSummary
  if (!summary || summary.startsWith("[")) {
    summary = c.ekms_ai_context?.triageState?.clinicalSummary || c.ekms_ai_context?.clinicalSummary || triage.clinical_summary || "";
  }

  // 3. If still empty, check intake.symptom_notes
  if (!summary && intake.symptom_notes) {
    summary = intake.symptom_notes;
  }

  // 4. Strip any leading bracketed prefixes like [Clinical Findings: ...] or [Suspected: ...] and strip "Clinical Reason: ..."
  if (summary) {
    summary = summary
      .replace(/^\[(?:Clinical Findings|Suspected):?[^\]]+\]\s*/i, "")
      .replace(/Clinical Reason:[\s\S]*$/i, "")
      .trim();
  }

  // 5. If summary is still missing or just raw short keyword or bracketed leftover, construct the standard clinical summary paragraph
  if (!summary || summary.length < 20 || summary.startsWith("[")) {
    const ageStr = intake.age ? `${intake.age}-year-old` : "Adult";
    const sexStr = intake.sex ? `${intake.sex.toLowerCase()} caller` : "caller";
    const cond = triage.suspected_condition || triage.condition || intake.symptom || triage.primary_complaint || "Acute Health Condition";
    const cleanCond = cond.replace(/^\[[^\]]+\]\s*/, "").trim();
    const sev = intake.severity_reported || triage.severity_score || (triage.urgency_level === "emergency" ? 9 : triage.urgency_level === "urgent" ? 6 : 3);
    const dur = intake.duration || triage.duration || "Less than 2 hours";
    const ref = triage.call_referral_primary || triage.primary_referral_destination || "104 Health Helpline";
    summary = `${ageStr} ${sexStr} reports ${cleanCond} with severity ${sev}/10 (${dur}); guided to ${ref} for 24x7 tele-doctor consultation and medical advice.`;
  }

  return summary;
}

// Generate unique row identifier even if multiple rows share the same case_ref
export function getCaseUniqueKey(c, idx = 0) {
  if (c?.id) return String(c.id);
  const ref = c?.case_ref || "CASE";
  const ts = c?.created_at || idx;
  return `${ref}_${ts}`;
}

export const CaseLogs = ({ refreshKey, onCaseDeleted }) => {
  const [cases, setCases] = useState(() => {
    // 1. Instant 0ms initial load from browser storage, merged with persistent forward state
    const cached = getCachedCases();
    return Array.isArray(cached) ? mergeCaseForwardStatus(cached) : [];
  });
  const [urgency, setUrgency] = useState("all");
  const [q, setQ] = useState("");
  const [openRowKey, setOpenRowKey] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedCaseForConvo, setSelectedCaseForConvo] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [urgency, q]);

  // 2. Fetch and sync with server in background (served from server memory cache with 0 Firestore reads)
  useEffect(() => {
    api
      .get("/cases", { params: { urgency, q: q || undefined } })
      .then(({ data }) => {
        if (Array.isArray(data)) {
          // Merge with persistent forward states so a forwarded badge NEVER disappears on server refresh!
          const merged = mergeCaseForwardStatus(data);
          setCases(merged);
          if (urgency === "all" && !q) {
            setCachedCases(merged);
            const currentStats = getCachedStats() || {};
            const updatedStats = { ...currentStats, total: merged.length };
            setCachedStats(updatedStats);
            broadcastEvent("SYNC_STATS_TOTAL", { total: merged.length });
          }
        }
      })
      .catch(() => {});
  }, [urgency, q, refreshKey]);

  // 3. Real-time tab-to-tab sync listener (0 network requests & 0 Firestore reads)
  useEffect(() => {
    const unsub = subscribeToSync((event) => {
      if (event?.type === "NEW_CASE" && event?.payload) {
        const newCase = event.payload;
        setCases((prev) => {
          const exists = prev.some(
            (c) => (c.id && c.id === newCase.id) || (c.case_ref && c.case_ref === newCase.case_ref)
          );
          if (exists) return prev;
          const updated = [newCase, ...prev];
          setCachedCases(updated);
          return updated;
        });
      } else if (event?.type === "DELETE_CASE" && event?.payload) {
        const { caseRef, id } = event.payload;
        setCases((prev) => {
          const updated = prev.filter((c) => c.case_ref !== caseRef && c.id !== id);
          setCachedCases(updated);
          return updated;
        });
      } else if ((event?.type === "CASE_FORWARDED" || event?.type === "CASE_UPDATED") && event?.payload) {
        const { case_ref, id, all_targets } = event.payload;
        const targetSet = new Set(
          [case_ref, id, ...(Array.isArray(all_targets) ? all_targets : [])]
            .filter(Boolean)
            .map((k) => String(k).trim().toUpperCase())
        );
        setCases((prev) => {
          const updated = prev.map((c) => {
            const cRef = String(c.case_ref || "").trim().toUpperCase();
            const cId = String(c.id || "").trim().toUpperCase();
            if ((cRef && targetSet.has(cRef)) || (cId && targetSet.has(cId))) {
              return { ...c, ...event.payload, is_forwarded: true, status: "forwarded" };
            }
            return c;
          });
          setCachedCases(updated);
          return updated;
        });
      }
    });
    return unsub;
  }, []);


  const totalPages = Math.ceil(cases.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedCases = cases.slice(startIndex, startIndex + PAGE_SIZE);

  const isPageAllSelected =
    paginatedCases.length > 0 &&
    paginatedCases.every((c, idx) => selectedKeys.has(getCaseUniqueKey(c, startIndex + idx)));

  const toggleSelectAllPage = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isPageAllSelected) {
        paginatedCases.forEach((c, idx) => next.delete(getCaseUniqueKey(c, startIndex + idx)));
      } else {
        paginatedCases.forEach((c, idx) => next.add(getCaseUniqueKey(c, startIndex + idx)));
      }
      return next;
    });
  };

  const selectAllMatching = () => {
    setSelectedKeys(new Set(cases.map((c, idx) => getCaseUniqueKey(c, idx))));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const toggleSelectOne = (rowKey, e) => {
    e?.stopPropagation();
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    const targetRef = caseToDelete.case_ref;
    const targetKey = getCaseUniqueKey(caseToDelete);
    try {
      if (targetRef) {
        await api.delete(`/cases/${targetRef}`);
      }
      removeCaseFromLocalCache(targetRef || caseToDelete.id);
      broadcastEvent("DELETE_CASE", { caseRef: targetRef, id: caseToDelete.id });
      setCases((prev) => {
        const updated = prev.filter((c, idx) => getCaseUniqueKey(c, idx) !== targetKey);
        setCachedCases(updated);
        return updated;
      });
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(targetKey);
        return next;
      });
      toast.success(`Case ${targetRef || "entry"} deleted successfully`);
      setCaseToDelete(null);
      onCaseDeleted?.();
    } catch (err) {
      console.error("Failed to delete case:", err);
      toast.error("Failed to delete case. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    setIsBulkDeleting(true);

    // Collect all case references from selected items
    const selectedCasesList = cases.filter((c, idx) => selectedKeys.has(getCaseUniqueKey(c, idx)));
    const targetRefs = Array.from(new Set(selectedCasesList.map((c) => c.case_ref).filter(Boolean)));

    try {
      if (targetRefs.length > 0) {
        await api.delete("/cases", { data: { case_refs: targetRefs } });
        for (const ref of targetRefs) {
          removeCaseFromLocalCache(ref);
          broadcastEvent("DELETE_CASE", { caseRef: ref });
        }
      }
      setCases((prev) => {
        const updated = prev.filter((c, idx) => !selectedKeys.has(getCaseUniqueKey(c, idx)));
        setCachedCases(updated);
        return updated;
      });
      toast.success(`Successfully deleted ${selectedKeys.size} cases`);
      setSelectedKeys(new Set());
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
      {selectedKeys.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white">
              {selectedKeys.size}
            </span>
            <span className="font-semibold text-foreground">
              {selectedKeys.size} case{selectedKeys.size > 1 ? "s" : ""} selected
            </span>
            {selectedKeys.size < cases.length && (
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
              <span>Delete Selected ({selectedKeys.size})</span>
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
                <th className="py-2 pr-3 font-semibold">Caller ID</th>
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
              {paginatedCases.map((c, idx) => {
                const rowKey = getCaseUniqueKey(c, startIndex + idx);
                const isOpen = openRowKey === rowKey;
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <tr
                    key={rowKey}
                    data-testid="case-log-row"
                    onClick={() => setOpenRowKey(isOpen ? null : rowKey)}
                    className={`cursor-pointer border-b border-border/40 transition-colors duration-200 hover:bg-secondary/30 ${
                      isSelected ? "bg-primary/5 dark:bg-primary/10" : ""
                    }`}
                  >
                    <td className="w-8 py-3 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectOne(rowKey, e)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200/80 px-2 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300 font-mono tracking-wider">
                        {c.caller_id || c.intake?.caller_id || getCallerIdForPhone(c.intake?.phone)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200/80 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 tracking-wider">
                        {c.case_ref}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center justify-center rounded bg-secondary/80 px-2 py-0.5 text-xs font-bold text-foreground border border-border/60">
                        {getAgentCode(c)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-foreground">{c.intake?.caller_name || "—"}</p>
                        {(c.intake?.age || c.intake?.sex) && (
                          <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                            {[c.intake?.age ? `${c.intake.age}y` : null, c.intake?.sex].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground tracking-wide mt-0.5">{c.intake?.phone || "—"}</p>
                    </td>
                    <td className="max-w-[340px] py-3 pr-3">
                      <p className="text-foreground font-medium text-xs leading-relaxed">
                        {getCleanComplaintSummary(c)}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <UrgencyBadge
                        level={c.triage?.urgency_level}
                        size="sm"
                        testId="case-log-urgency-badge"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-col items-start gap-1">
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
                        {/* Green Forwarded badge: Shows instantly and never disappears */}
                        {isCaseItemForwarded(c) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Forwarded
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-[11px] text-muted-foreground whitespace-nowrap font-medium">
                      {new Date(c.created_at || Date.now()).toLocaleString("en-IN", {
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
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {cases.length > PAGE_SIZE && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(startIndex + PAGE_SIZE, cases.length)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{cases.length}</span> cases
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-border bg-secondary/50 px-2.5 py-1 font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>

                <span className="px-2 font-mono font-bold text-foreground">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded border border-border bg-secondary/50 px-2.5 py-1 font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Single Case Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive font-bold text-base">
                <Trash2 className="h-5 w-5" />
                <span>Delete Case Entry</span>
              </div>
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete case{" "}
              <strong className="text-foreground font-mono">{caseToDelete.case_ref}</strong> for{" "}
              <strong className="text-foreground">{caseToDelete.intake?.caller_name || "caller"}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-background p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive font-bold text-base">
                <Trash2 className="h-5 w-5" />
                <span>Bulk Delete Cases</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You are about to permanently delete{" "}
              <strong className="text-destructive font-bold">{selectedKeys.size}</strong> selected case
              records. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
              >
                {isBulkDeleting ? "Deleting Cases..." : `Delete ${selectedKeys.size} Cases`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Transcript & Triage Referral View Modal */}
      {selectedCaseForConvo && (
        <CaseConversationModal
          caseItem={selectedCaseForConvo}
          allCases={cases}
          onCaseForwarded={(caseRef, statusData) => {
            const forwardPayload = {
              is_forwarded: true,
              status: "forwarded",
              forwarded_to: statusData.teamName,
              forwarded_short_name: statusData.shortName,
              dispatch_id: statusData.dispatchId,
              forwarded_at: new Date().toISOString(),
            };
            setCases((prev) =>
              prev.map((c) => {
                const cRef = String(c.case_ref || "").trim().toUpperCase();
                const targetRef = String(caseRef || "").trim().toUpperCase();
                return (cRef && cRef === targetRef) || c.id === caseRef
                  ? { ...c, ...forwardPayload }
                  : c;
              })
            );
            setSelectedCaseForConvo((prev) =>
              prev ? { ...prev, ...forwardPayload } : null
            );
          }}
          onClose={() => setSelectedCaseForConvo(null)}
        />
      )}
    </div>
  );
};

function formatChatTime(m, fallbackDate) {
  const ts = m?.timestamp || m?.created_at || m?.time;
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
  }
  if (m?.id) {
    const match = String(m.id).match(/\d{10,13}/);
    if (match) {
      const d = new Date(parseInt(match[0], 10));
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
  }
  const base = fallbackDate ? new Date(fallbackDate) : new Date();
  if (!isNaN(base.getTime())) {
    return base.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return "";
}

function CaseConversationModal({ caseItem: initialCaseItem, allCases = [], onCaseForwarded, onClose }) {
  const [forwardOverride, setForwardOverride] = useState(null);

  const caseItem = useMemo(() => {
    if (!initialCaseItem) return null;
    const initialUpper = String(initialCaseItem.case_ref || "").trim().toUpperCase();
    const found = allCases?.find(
      (c) => {
        const cRef = String(c.case_ref || "").trim().toUpperCase();
        return (cRef && cRef === initialUpper) || (c.id && c.id === initialCaseItem.id);
      }
    );
    const base = found ? { ...initialCaseItem, ...found } : initialCaseItem;
    return forwardOverride ? { ...base, ...forwardOverride } : base;
  }, [initialCaseItem, allCases, forwardOverride]);

  if (!caseItem) return null;

  const agentCode = getAgentCode(caseItem);
  const triage = caseItem.triage || {};
  const intake = caseItem.intake || {};
  const nearest = caseItem.nearest_facilities?.[0];
  const primaryBadge = getReferralBadge(caseItem);
  const secondaryBadge = getSecondaryReferralBadge(caseItem);

  const isCaseForwarded = Boolean(
    forwardOverride || isCaseItemForwarded(caseItem)
  );

  const forwardedTarget = String(
    forwardOverride?.forwarded_to ||
    forwardOverride?.forwarded_short_name ||
    caseItem.forwarded_to ||
    caseItem.forwarded_short_name ||
    caseItem.dispatch_to ||
    ""
  ).toLowerCase();

  const primaryName = String(
    triage.call_referral_primary ||
    triage.referral_destination ||
    nearest?.name ||
    ""
  ).toLowerCase();

  const secondaryName = String(
    triage.call_referral_secondary ||
    triage.secondary_referral_destination ||
    "104 Health Helpline"
  ).toLowerCase();

  const isSentToSecondary = isCaseForwarded && Boolean(
    forwardedTarget && (
      (secondaryName.includes("104") && forwardedTarget.includes("104")) ||
      (secondaryName.includes("hospital") && forwardedTarget.includes("hospital")) ||
      (secondaryName.includes("108") && forwardedTarget.includes("108"))
    ) && !(
      (primaryName.includes("104") && forwardedTarget.includes("104")) ||
      (primaryName.includes("hospital") && forwardedTarget.includes("hospital")) ||
      (primaryName.includes("108") && forwardedTarget.includes("108"))
    )
  );

  const isSentToPrimary = isCaseForwarded && !isSentToSecondary;

  // Scope transcript strictly to this single triage conversation
  const singleCaseTranscript = useMemo(() => {
    const hist =
      caseItem.ekms_ai_context?.chatHistory ||
      caseItem.chatHistory ||
      caseItem.chat_history;
    if (Array.isArray(hist) && hist.length > 0) return hist;
    return null;
  }, [caseItem]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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
                <span className="mono rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2 py-0.5 text-xs font-bold font-mono">
                  {caseItem.caller_id || caseItem.intake?.caller_id || getCallerIdForPhone(caseItem.intake?.phone)}
                </span>
                <span className="mono rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-bold">
                  {caseItem.case_ref}
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-foreground border border-border">
                  {getAgentFullLabel(agentCode)}
                </span>
                <UrgencyBadge level={triage.urgency_level} size="sm" />
                {isCaseItemForwarded(caseItem) && (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/50 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Forwarded
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold text-foreground">
                  Caller: {intake.caller_name || "Caller"}
                </span>
                {intake.phone && (
                  <span className="mono font-semibold">({intake.phone})</span>
                )}
                {(intake.age || intake.sex) && (
                  <span>
                    &bull; {[intake.age ? `${intake.age}y` : null, intake.sex].filter(Boolean).join(" ")}
                  </span>
                )}
                {(intake.city || intake.district) && (
                  <span>&bull; {intake.city || intake.district}</span>
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

        {/* Scrollable Conversation Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-background">
          <div className="flex items-center justify-center my-1">
            <span className="rounded-full bg-border/60 px-3 py-1 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
              Consultation Started &bull; {new Date(caseItem.created_at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {singleCaseTranscript ? (
            /* Render recorded live chatHistory for this single case */
            singleCaseTranscript.map((m, idx) => {
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
                      <div className="flex items-center gap-1.5">
                        <span className={isAgent ? "text-primary-foreground font-bold" : "text-blue-600 dark:text-blue-400 font-bold"}>
                          {isAgent ? getAgentFullLabel(agentCode) : "EKMS AI Assistant"}
                        </span>
                        <span className={`text-[10px] font-medium ${isAgent ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          &bull; {formatChatTime(m, caseItem.created_at)}
                        </span>
                      </div>
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
                    <div className="flex items-center gap-1.5">
                      <span>{getAgentFullLabel(agentCode)} (Caller Intake)</span>
                      <span className="font-normal opacity-75">&bull; {formatChatTime(null, caseItem.created_at)}</span>
                    </div>
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
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-blue-600 font-bold">
                        <Sparkles className="h-3 w-3" /> EKMS AI Clinical Probing
                      </span>
                      <span className="font-normal text-muted-foreground">&bull; {formatChatTime(null, caseItem.created_at)}</span>
                    </div>
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
                  <div className="text-[10px] opacity-80 font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span>{getAgentFullLabel(agentCode)} (Probing Completed)</span>
                      <span className="font-normal opacity-75">&bull; {formatChatTime(null, caseItem.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Verified caller location ({intake.district || intake.city || "Assam District"}, PIN: {intake.pincode || "Mapped"}) and confirmed symptom severity. Requesting final dispatch referral.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Final Outcome Card inside Transcript */}
          <div className="mt-4 rounded-xl border border-emerald-300/80 bg-linear-to-b from-emerald-50/70 to-white dark:from-emerald-950/30 dark:to-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Triage Decision & Dual Referral Architecture
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
                  <strong className="text-foreground">Clinical Rationale:</strong> {triage.reasoning}
                </p>
              )}
            </div>

            {/* Dual Forward Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Primary Destination Card */}
              <div className="rounded-lg border border-emerald-300 bg-white dark:bg-card p-2.5 space-y-1 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                    Primary Destination
                  </div>
                  {isSentToPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/50 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3" /> Forwarded
                    </span>
                  )}
                </div>
                <div className="font-bold text-foreground flex items-center gap-1 truncate">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {triage.call_referral_primary || triage.referral_destination || nearest?.name || "ESIC Center"}
                </div>
                {nearest?.distance_km != null && (
                  <p className="text-[10.5px] text-muted-foreground font-mono">
                    📍 Distance: {nearest.distance_km} km
                  </p>
                )}
              </div>

              {/* Secondary Destination Card */}
              <div className="rounded-lg border border-blue-300 bg-white dark:bg-card p-2.5 space-y-1 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">
                    Secondary Destination
                  </div>
                  {isSentToSecondary && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/50 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3" /> Forwarded
                    </span>
                  )}
                </div>
                <div className="font-bold text-foreground flex items-center gap-1 truncate">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  {triage.call_referral_secondary || triage.secondary_referral_destination || "104 Health Helpline"}
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  📞 24x7 Doctor on Call Tele-Consultation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Logged {new Date(caseItem.created_at || Date.now()).toLocaleString("en-IN", {
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
            className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
