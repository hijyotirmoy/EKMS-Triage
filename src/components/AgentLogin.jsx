"use client";

import { useState } from "react";
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  LogIn,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getFirestoreDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const VALID_AGENTS = [
  { id: "Agent 1", label: "Agent 1 (Triage Desk 1)" },
  { id: "Agent 2", label: "Agent 2 (Triage Desk 2)" },
  { id: "Agent 3", label: "Agent 3 (Triage Desk 3)" },
];

const VALID_PASSWORD = "pass123";

export function AgentLogin({ onLoginSuccess }) {
  const [selectedAgent, setSelectedAgent] = useState("Agent 1");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictedAgent, setConflictedAgent] = useState(null);

  const normalizeAgentId = (id) => {
    const clean = id.trim().toLowerCase().replace(/\s+/g, "");
    if (clean === "agent1") return "Agent 1";
    if (clean === "agent2") return "Agent 2";
    if (clean === "agent3") return "Agent 3";
    return id.trim();
  };

  const handleLoginAttempt = async (e) => {
    e?.preventDefault();
    setErrorMsg("");

    const normAgent = normalizeAgentId(selectedAgent);
    if (!["Agent 1", "Agent 2", "Agent 3"].includes(normAgent)) {
      setErrorMsg("Please select a valid Agent (Agent 1, Agent 2, or Agent 3)");
      return;
    }

    if (!password) {
      setErrorMsg("Password is required");
      return;
    }

    if (password !== VALID_PASSWORD) {
      setErrorMsg("Invalid password. Demo password is pass123");
      return;
    }

    setLoading(true);
    try {
      const db = getFirestoreDb();
      const sessionDocRef = doc(db, "sessions", normAgent);
      const snap = await getDoc(sessionDocRef);

      if (snap.exists()) {
        const sessionData = snap.data();
        // Check if an active session exists
        if (sessionData && sessionData.sessionId) {
          // Conflict: prompt user to confirm evicting existing session
          setConflictedAgent(normAgent);
          setConflictModalOpen(true);
          setLoading(false);
          return;
        }
      }

      // No active session conflict: proceed to login
      await completeLogin(normAgent);
    } catch (err) {
      console.warn("Session check fallback:", err.message);
      // Fallback if firestore is offline
      await completeLogin(normAgent);
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (agentId) => {
    const newSessionId =
      "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 8);

    try {
      const db = getFirestoreDb();
      await setDoc(doc(db, "sessions", agentId), {
        agentId,
        sessionId: newSessionId,
        loggedInAt: Date.now(),
        lastHeartbeat: Date.now(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (e) {
      console.warn("Could not record session in Firestore:", e.message);
    }

    const sessionObj = { agentId, sessionId: newSessionId };
    if (typeof window !== "undefined") {
      localStorage.setItem("ekms_active_agent", JSON.stringify(sessionObj));
    }

    toast.success(`Logged in as ${agentId}`);
    setConflictModalOpen(false);
    onLoginSuccess(sessionObj);
  };

  const handleConfirmEviction = async () => {
    if (!conflictedAgent) return;
    setLoading(true);
    try {
      await completeLogin(conflictedAgent);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-70px)] items-center justify-center p-3.5 sm:p-6">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        {/* Header */}
        <div className="mb-5 sm:mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Agent Authentication
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sign in to your assigned triage operator desk
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLoginAttempt} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Agent ID / Desk
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 sm:py-2.5 pl-10 pr-4 text-base sm:text-sm font-semibold text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {VALID_AGENTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="pass123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 sm:py-2.5 pl-10 pr-4 text-base sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>


          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Verifying..." : "Sign In to Console"}
          </button>
        </form>
      </div>

      {/* Concurrent Session Eviction Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setConflictModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/50 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-center text-base font-bold text-slate-900 dark:text-white">
              Active Session Detected
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <strong className="text-emerald-600 dark:text-emerald-400">{conflictedAgent}</strong> is
              currently logged in on another device or browser tab.
            </p>
            <p className="mt-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
              Do you want to log out the current user and log in here?
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEviction}
                disabled={loading}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-900/20 transition hover:bg-amber-700 active:scale-95 disabled:opacity-50"
              >
                {loading ? "Switching..." : "Yes, Log Out & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
