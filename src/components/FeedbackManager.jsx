"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit,
  Trash2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  HelpCircle,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

export function FeedbackManager({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchFeedback = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback?page=${targetPage}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setStats(data.stats || null);
      } else {
        toast.error("Failed to load feedback records");
      }
    } catch (err) {
      toast.error("Error loading feedback: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback(page);
  }, [fetchFeedback, page, refreshKey]);

  const handleDelete = async (rule) => {
    if (!rule?.id) return;
    const confirmed = window.confirm(
      `Delete and unlearn this rule?\n\nSymptom: "${rule.symptom_notes || rule.keywords?.join(", ")}"\n\nThe AI and algorithm will immediately remove this rule from active triage logic.`
    );
    if (!confirmed) return;

    setDeletingId(rule.id);
    try {
      const res = await fetch(`/api/feedback?id=${encodeURIComponent(rule.id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Rule deleted — AI has unlearned this correction!");
        fetchFeedback(page);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete rule");
      }
    } catch (err) {
      toast.error("Error deleting rule: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <span>AI Learning & Agent Feedback Rules</span>
                <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 border border-blue-300">
                  Adaptive
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clinical corrections submitted by human agents. When deleted, the system unlearns the rule immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchFeedback(page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 p-3.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Active Learned Rules
          </span>
          <span className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1 block">
            {stats?.correctionsCount ?? items.filter((r) => !r.is_positive).length}
          </span>
          <span className="text-[10px] text-muted-foreground">Injected into live LLM & algorithmic logic</span>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Positive Reinforcements
          </span>
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
            {stats?.positiveValidationCount ?? items.filter((r) => r.is_positive).length}
          </span>
          <span className="text-[10px] text-muted-foreground">Confirmed accurate by agents</span>
        </div>

        <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20 p-3.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Total Feedback Records
          </span>
          <span className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 block">
            {total}
          </span>
          <span className="text-[10px] text-muted-foreground">Logged across all call desks</span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/20 p-3.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Page View (Limit 30)
          </span>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-1 block">
            {page} / {totalPages || 1}
          </span>
          <span className="text-[10px] text-muted-foreground">Showing 30 records per page</span>
        </div>
      </div>

      {/* Main Content List / Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Loading learned rules from knowledge base...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <BrainCircuit className="h-8 w-8 text-muted-foreground/60 mx-auto" />
            <p className="text-sm font-bold text-foreground">No Agent Feedback Rules Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              When agents mark outcomes as accurate or submit corrections on the triage desk, the rules will be listed here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-3.5">Date & Agent</th>
                  <th className="py-3 px-3.5">Type & Status</th>
                  <th className="py-3 px-3.5">Symptoms / Context</th>
                  <th className="py-3 px-3.5">AI vs Corrected Decision</th>
                  <th className="py-3 px-3.5">Clinical Rationale / Notes</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((rule) => {
                  const isPositive = rule.is_positive;
                  const isDeleting = deletingId === rule.id;

                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-secondary/30 transition-colors text-slate-800 dark:text-slate-200"
                    >
                      {/* Date & Agent */}
                      <td className="py-3 px-3.5 whitespace-nowrap align-top">
                        <span className="font-semibold block text-[11px] text-foreground">
                          {formatDate(rule.created_at)}
                        </span>
                        <span className="inline-block mt-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-extrabold border border-border">
                          {rule.agent_id || "Agent"}
                        </span>
                      </td>

                      {/* Type & Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap align-top space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground border border-border">
                          {rule.type === "probing" ? "Probing Question" : "Triage Outcome"}
                        </span>
                        <div>
                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="h-3 w-3" />
                              Reinforced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 px-1.5 py-0.5 rounded-md">
                              <Sparkles className="h-3 w-3" />
                              Learned Rule
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Symptoms / Context */}
                      <td className="py-3 px-3.5 align-top max-w-[260px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                          {rule.symptom_notes || "—"}
                        </p>
                        {Array.isArray(rule.keywords) && rule.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.keywords.slice(0, 4).map((kw, i) => (
                              <span
                                key={i}
                                className="rounded bg-muted px-1.5 py-0.2 text-[9.5px] font-medium text-muted-foreground"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* AI vs Corrected Decision */}
                      <td className="py-3 px-3.5 align-top max-w-[240px]">
                        {isPositive ? (
                          <div className="space-y-0.5 text-[11px]">
                            <span className="text-muted-foreground block">Confirmed:</span>
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">
                              {rule.ai_urgency || "Accurate"} • {rule.ai_referral || "Confirmed"}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1 text-[11px]">
                            <div>
                              <span className="text-muted-foreground text-[10px]">Original: </span>
                              <span className="line-through text-slate-500">
                                {rule.ai_urgency || "—"} / {rule.ai_referral || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300">
                              <span>➔ {rule.corrected_urgency}</span>
                              <span>•</span>
                              <span>{rule.corrected_referral}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Clinical Rationale / Notes */}
                      <td className="py-3 px-3.5 align-top max-w-[300px]">
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 italic">
                          {rule.notes ? `“${rule.notes}”` : "—"}
                        </p>
                      </td>

                      {/* Action (Delete / Unlearn) */}
                      <td className="py-3 px-3.5 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          disabled={isDeleting}
                          title="Delete rule and force AI to unlearn it"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300/80 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          <span>Unlearn</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar (30 items per page) */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 bg-secondary/20">
            <span className="text-xs text-muted-foreground">
              Showing <span className="font-bold text-foreground">{(page - 1) * 30 + 1}</span> to{" "}
              <span className="font-bold text-foreground">{Math.min(page * 30, total)}</span> of{" "}
              <span className="font-bold text-foreground">{total}</span> rules
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 text-xs font-bold text-muted-foreground">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
