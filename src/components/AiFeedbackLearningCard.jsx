"use client";

import { useState, useEffect } from "react";
import {
  BrainCircuit,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

const URGENCY_OPTIONS = [
  { value: "Emergency", label: "Emergency", color: "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
  { value: "Urgent", label: "Urgent", color: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  { value: "Routine", label: "Routine", color: "border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  { value: "Self-care", label: "Self-care", color: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
];

const REFERRAL_OPTIONS = [
  "108 Ambulance",
  "104 Health Helpline",
  "ESIC Hospital",
  "ESIS Dispensary",
  "Nearest Tie-Up Facility",
  "Tele-MANAS (14416)",
  "NACO 1097 Helpline",
  "Nearest Pharmacy",
  "Forward to Doctor",
];

export function AiFeedbackLearningCard({ result, callerIntake, onFeedbackSubmitted, currentAgent }) {
  const [status, setStatus] = useState("idle"); // "idle" | "correcting" | "submitted"
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState(null);
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  // Helper to get active agent ID dynamically
  const getActiveAgentId = () => {
    if (currentAgent?.agentId) return currentAgent.agentId;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.agentId) return parsed.agentId;
        }
      } catch (_) {}
    }
    return "Agent 1";
  };

  // Form states for correction
  const [selectedUrgency, setSelectedUrgency] = useState(result?.urgency_level || "Urgent");
  const [selectedReferral, setSelectedReferral] = useState(result?.referral_destination || "ESIS Dispensary");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  // Sync with new results
  useEffect(() => {
    setStatus("idle");
    setSubmittedMessage("");
    setSelectedUrgency(result?.urgency_level || "Urgent");
    setSelectedReferral(result?.referral_destination || "ESIS Dispensary");
    setClinicalNotes("");
  }, [result?.urgency_level, result?.referral_destination, result?.primary_complaint]);

  // Load stats
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handlePositiveFeedback = async () => {
    setSubmitting(true);
    try {
      const payload = {
        case_ref: callerIntake?.case_id || "AGENT_CALL",
        agent_id: getActiveAgentId(),
        type: "triage",
        symptom_notes: callerIntake?.symptom_notes || result?.summary_en || result?.primary_complaint || "",
        is_positive: true,
        ai_urgency: result?.urgency_level,
        ai_referral: result?.referral_destination,
        notes: "Validated as accurate by agent desk.",
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setStatus("submitted");
        setSubmittedMessage("Outcome verified! The AI & algorithm reinforced this clinical pattern.");
        toast.success("AI Learning: Decision reinforced successfully!");
        if (json.stats) {
          setStats(json.stats);
        } else {
          fetchStats();
        }
        onFeedbackSubmitted?.();
      } else {
        toast.error("Failed to save feedback.");
      }
    } catch (err) {
      toast.error("Error saving feedback: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNegativeSubmit = async (e) => {
    e.preventDefault();
    if (!clinicalNotes.trim()) {
      toast.error("Please provide a short clinical rationale or note for the correction.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        case_ref: callerIntake?.case_id || "AGENT_CALL",
        agent_id: getActiveAgentId(),
        type: "triage",
        symptom_notes: callerIntake?.symptom_notes || result?.summary_en || result?.primary_complaint || "",
        is_positive: false,
        ai_urgency: result?.urgency_level,
        corrected_urgency: selectedUrgency,
        ai_referral: result?.referral_destination,
        corrected_referral: selectedReferral,
        notes: clinicalNotes.trim(),
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setStatus("submitted");
        setSubmittedMessage(
          `Rule learned! Urgency adjusted to ${selectedUrgency} and referral to ${selectedReferral}. The AI and algorithm will apply this correction immediately.`
        );
        toast.success("AI Learned: Rule added to live knowledge base!");
        if (json.stats) {
          setStats(json.stats);
        } else {
          fetchStats();
        }
        onFeedbackSubmitted?.();
      } else {
        toast.error("Failed to save correction.");
      }
    } catch (err) {
      toast.error("Error saving correction: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200/80 bg-linear-to-b from-blue-50/60 to-white dark:border-blue-900/60 dark:from-blue-950/20 dark:to-background p-4 sm:p-4.5 shadow-2xs space-y-3.5 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 dark:border-blue-900/40 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
              <span>Agent Feedback & AI Self-Learning</span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                Under Development
              </span>
            </h4>
          </div>
        </div>

        {stats && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 px-1.5 py-0.5 text-[10px] font-bold">
              {(stats?.correctionsCount ?? stats?.stats?.correctionsCount ?? (Array.isArray(stats?.recentCorrections) ? stats.recentCorrections.length : 0))} Learned
            </span>
          </div>
        )}
      </div>

      {/* Applied Learned Rule Banner (if current triage was influenced by agent feedback) */}
      {result?.learned_override_applied && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Self-Learned Rule Triggered:</span>
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
              {result.reasoning?.includes("Agent-Learned Override")
                ? result.reasoning.split("[Agent-Learned Override:")[1]?.replace("]", "")
                : "This triage outcome was automatically enhanced by a previous agent correction."}
            </p>
          </div>
        </div>
      )}

      {/* Main Feedback State */}
      {status === "idle" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              Was this triage outcome accurate?
            </span>
            <span className="text-[11px] text-muted-foreground">
              Your feedback teaches the AI prompt and algorithmic routing rules in real time.
            </span>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handlePositiveFeedback}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 px-3 py-1.5 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
                <span>Correct Outcome</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setStatus("correcting")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-50 hover:bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 px-3 py-1.5 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <ThumbsDown className="h-3.5 w-3.5 text-amber-600" />
                <span>Needs Correction</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Correction Form */}
      {status === "correcting" && (
        <form onSubmit={handleNegativeSubmit} className="space-y-3 pt-1 border-t border-blue-200/50 dark:border-blue-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Teach AI the Correct Clinical Decision:
            </span>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Urgency Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Correct Urgency Level:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedUrgency(opt.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all text-center cursor-pointer ${
                    selectedUrgency === opt.value
                      ? `${opt.color} ring-2 ring-blue-500 shadow-2xs`
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Referral Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Correct Referral Destination:
            </label>
            <select
              value={selectedReferral}
              onChange={(e) => setSelectedReferral(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {REFERRAL_OPTIONS.map((dest) => (
                <option key={dest} value={dest}>
                  {dest}
                </option>
              ))}
            </select>
          </div>

          {/* Clinical Rationale */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Clinical Rationale / Why is this right?
            </label>
            <input
              type="text"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Dispensary was closed; after hours requires Tie-Up hospital or 104"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Teaching AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Save & Teach AI System</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Submitted Confirmation */}
      {status === "submitted" && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-bold text-emerald-900 dark:text-emerald-200">
              Agent Knowledge Integrated!
            </span>
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
              {submittedMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer"
          >
            Review
          </button>
        </div>
      )}

      {/* Active Rules Drawer Toggle */}
      {stats && stats.recentCorrections?.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowRulesDrawer(!showRulesDrawer)}
            className="flex items-center justify-between w-full text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer py-0.5"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" />
              <span>View Learned Rules Active in AI ({stats.recentCorrections.length})</span>
            </span>
            {showRulesDrawer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showRulesDrawer && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px]">
              {stats.recentCorrections.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  className="rounded-md border border-border/60 bg-background/80 p-2 space-y-1 text-slate-800 dark:text-slate-200 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-800 dark:text-blue-300">
                      Rule #{idx + 1}: {rule.keywords?.slice(0, 3).join(", ") || "General"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Agent {rule.agent_id}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-foreground">Urgency:</span>
                    <span className="text-rose-700 font-bold">{rule.corrected_urgency}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-bold text-foreground">Referral:</span>
                    <span className="text-blue-700 font-bold">{rule.corrected_referral}</span>
                  </div>
                  {rule.notes && (
                    <p className="text-[10px] text-muted-foreground italic truncate">
                      &ldquo;{rule.notes}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
