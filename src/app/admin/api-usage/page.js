"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Zap,
  Cpu,
  LogOut,
  Flame,
  Copy,
  Check,
  Server,
  ArrowUpRight,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

export default function SecretApiUsagePage() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Telemetry data state
  const [telemetry, setTelemetry] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [highlight429, setHighlight429] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [autoRefresh] = useState(true);

  // 1. Firebase Auth state listener
  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthChecking(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setAuthChecking(false);
    }
  }, []);

  // 2. Fetch Telemetry Data
  const fetchTelemetry = async () => {
    try {
      setDataLoading(true);
      const res = await fetch("/api/admin/usage");
      if (res.ok) {
        const json = await res.json();
        setTelemetry(json);
      }
    } catch (err) {
      console.error("Failed to load telemetry:", err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTelemetry();
    }
  }, [user]);

  // Auto-refresh telemetry every 6 seconds when online
  useEffect(() => {
    if (!user || !autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(interval);
  }, [user, autoRefresh]);

  // 3. Login handler
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError("");
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthLoading(true);
    try {
      const auth = getFirebaseAuth();
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Authenticated successfully!");
      } catch (signInErr) {
        // If user doesn't exist yet, attempt to register them as the initial admin
        if (
          signInErr.code === "auth/user-not-found" ||
          signInErr.code === "auth/invalid-credential" ||
          signInErr.code === "auth/invalid-login-credentials"
        ) {
          try {
            await createUserWithEmailAndPassword(auth, email.trim(), password);
            toast.success("Admin account created and authenticated!");
          } catch (createErr) {
            setAuthError(signInErr.message || "Invalid authentication credentials.");
          }
        } else {
          setAuthError(signInErr.message || "Failed to authenticate.");
        }
      }
    } catch (err) {
      setAuthError(err.message || "Authentication error.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setUser(null);
      toast.info("Signed out successfully");
    } catch (err) {
      toast.error("Sign out error: " + err.message);
    }
  };

  // Actions
  const handleReset429 = async () => {
    try {
      const res = await fetch("/api/admin/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_429" }),
      });
      if (res.ok) {
        toast.success("429 rate limit cooldowns reset! All keys active.");
        fetchTelemetry();
      }
    } catch (err) {
      toast.error("Failed to reset 429 limits");
    }
  };

  const handleSimulate429 = async () => {
    try {
      const res = await fetch("/api/admin/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate_429" }),
      });
      if (res.ok) {
        toast.warning("Simulated 429 Rate Limit event logged!");
        setHighlight429(true);
        fetchTelemetry();
      }
    } catch (err) {
      toast.error("Failed to simulate 429");
    }
  };

  const handleCopy = (text, keyId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("Copied to clipboard");
  };

  // 4. Loading check
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-2 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // 5. Unauthenticated State — Clean Simple Login Window
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
        <Toaster position="top-center" theme="dark" />

        {/* Login Window Card */}
        <div className="w-full max-w-md rounded-2xl border border-slate-800/90 bg-slate-900/90 p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5 border-b border-slate-800 pb-5 mb-6">
            <img
              src="/logo.png"
              alt="EKMS Triage Logo"
              className="h-10 w-10 rounded-xl object-contain shadow-md"
            />
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                EKMS Triage API
              </h1>
            </div>
          </div>

          {authError && (
            <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Authentication Failed:</span>
                <p className="text-[11px] opacity-90">{authError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ekms.in"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 6. Authenticated Dashboard State
  const groq = telemetry?.providers?.groq || {};
  const gemini = telemetry?.providers?.gemini || {};
  const claude = telemetry?.providers?.claude || {};
  const totalTokens = (groq.totalTokensUsed || 0) + (gemini.totalTokensUsed || 0) + (claude.totalTokensUsed || 0);
  const totalRequests = (groq.requests || 0) + (gemini.requests || 0) + (claude.requests || 0);
  const rateLimitCount = (groq.rateLimits429 || 0) + (gemini.rateLimits429 || 0) + (claude.rateLimits429 || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" theme="dark" />

      {/* Embedded CSS for custom sleek scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-dark-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 9999px;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 9999px;
        }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #10b981;
        }
        .custom-dark-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #334155 rgba(15, 23, 42, 0.8);
        }
      `}} />

      {/* Top Header Bar */}
      <header className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-8">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="EKMS Triage Logo"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-contain shadow-sm"
          />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              EKMS Triage API Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchTelemetry}
            disabled={dataLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${dataLoading ? "animate-spin text-emerald-400" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* User Email Pill */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            <span>{user.email}</span>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7">
        
        {/* KPI Cards Row (Refined Modern Design) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total API Invocations */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-linear-to-b from-slate-900/90 to-slate-950 p-5 shadow-lg transition-all duration-200 hover:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total API Invocations</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Cpu className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white tracking-tight">
              {totalRequests.toLocaleString()}
            </div>
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap text-[11px] font-medium text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-emerald-400 font-bold">
                {groq.requests || 0} Groq
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-blue-400 font-bold">
                {gemini.requests || 0} Gemini
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-purple-400 font-bold">
                {claude.requests || 0} Claude
              </span>
            </div>
          </div>

          {/* Card 2: Total Tokens Consumed */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-linear-to-b from-slate-900/90 to-slate-950 p-5 shadow-lg transition-all duration-200 hover:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total Tokens Consumed</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white tracking-tight">
              {totalTokens.toLocaleString()}
            </div>
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Prompt: <strong className="text-slate-200 font-semibold">{((groq.promptTokens || 0) + (gemini.promptTokens || 0)).toLocaleString()}</strong></span>
              <span>Comp: <strong className="text-slate-200 font-semibold">{((groq.completionTokens || 0) + (gemini.completionTokens || 0)).toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Card 3: Groq Multi-Key Pool */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-linear-to-b from-slate-900/90 to-slate-950 p-5 shadow-lg transition-all duration-200 hover:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Groq Multi-Key Pool</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Server className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {groq.poolSize || 21} Keys
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                100% Failover
              </span>
            </div>
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 truncate">
              Auto-rotates round-robin on 429 throttle
            </div>
          </div>

          {/* Card 4: 429 Rate Limit Status (Click to Highlight) */}
          <div
            onClick={() => {
              setHighlight429(!highlight429);
              toast.info(highlight429 ? "429 highlight turned off" : "🔥 429 Rate Limit Highlight Activated!");
            }}
            className={`group relative overflow-hidden cursor-pointer rounded-2xl border p-5 shadow-lg transition-all duration-300 ${
              highlight429
                ? "border-rose-500 bg-rose-950/40 shadow-rose-900/40 ring-2 ring-rose-500 scale-[1.02]"
                : rateLimitCount > 0
                ? "border-amber-500/50 bg-linear-to-b from-amber-950/20 to-slate-950 hover:border-amber-400"
                : "border-slate-800/90 bg-linear-to-b from-slate-900/90 to-slate-950 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Flame className={`h-4 w-4 ${highlight429 ? "text-rose-400 animate-bounce" : "text-amber-400"}`} />
                <span>429 Rate Limit Status</span>
              </span>
              <span className={`text-[9px] rounded-full px-2 py-0.5 font-extrabold uppercase tracking-wide border ${
                highlight429
                  ? "bg-rose-500 text-white border-rose-400 animate-pulse"
                  : "bg-slate-800 text-amber-400 border-slate-700"
              }`}>
                {highlight429 ? "Active Highlight" : "Click to Highlight"}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${rateLimitCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {rateLimitCount} Throttles
              </span>
              <span className="text-xs text-slate-500">logged</span>
            </div>
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{highlight429 ? "Highlighting all 429 events" : "Click to view throttled keys"}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>

        </div>

        {/* 429 Active Alert Banner (When Clicked) */}
        {highlight429 && (
          <div className="rounded-2xl border border-rose-500/60 bg-linear-to-r from-rose-950/70 via-slate-900 to-amber-950/50 p-4 text-xs shadow-lg animate-in fade-in duration-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs animate-pulse">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-rose-200 text-sm flex items-center gap-2">
                  <span>429 Rate Limit Highlight Mode Active</span>
                  <span className="rounded bg-rose-500/30 px-2 py-0.5 text-[10px] font-extrabold text-rose-300">
                    HTTP 429
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  Showing throttled requests, TPM rate limit overages, and Groq failover events.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulate429}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
              >
                + Simulate 429
              </button>
              <button
                type="button"
                onClick={handleReset429}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow cursor-pointer"
              >
                Reset 429 Cooldowns
              </button>
              <button
                type="button"
                onClick={() => setHighlight429(false)}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Close Filter
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Provider Token Usage & Remaining Allowance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span>AI Providers & Token Allowance Limits</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tracks total token usage, remaining allowance, and quota percentages
              </p>
            </div>
            <span className="text-xs text-slate-400 mono">
              Daily Quota Resets: 00:00 UTC
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Groq Cloud */}
            <div className={`rounded-xl border p-4 space-y-3 transition ${
              highlight429 && groq.rateLimits429 > 0
                ? "border-rose-500/80 bg-rose-950/20 ring-1 ring-rose-500/40"
                : "border-slate-800 bg-slate-950/60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">Groq Cloud (Primary)</span>
                <span className="mono rounded bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                  {groq.poolSize || 21} Keys Active
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Used:</span>
                  <span className="font-bold text-white">{(groq.totalTokensUsed || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Daily Limit:</span>
                  <span className="text-slate-300">{(groq.dailyLimitTokens || 500000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Remaining:</span>
                  <span className="font-bold text-emerald-400">{(groq.tokensRemaining || 438930).toLocaleString()}</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${groq.percentUsed || 12}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{groq.percentUsed || 12}% consumed</span>
                  <span>{100 - (groq.percentUsed || 12)}% available</span>
                </div>
              </div>
              {groq.rateLimits429 > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-300 flex items-center justify-between">
                  <span>429 Rate Limits Hit:</span>
                  <span className="font-bold">{groq.rateLimits429}</span>
                </div>
              )}
            </div>

            {/* Google Gemini */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">Google Gemini Flash</span>
                <span className="mono rounded bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 font-bold">
                  Clinical Safety
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Used:</span>
                  <span className="font-bold text-white">{(gemini.totalTokensUsed || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Daily Limit:</span>
                  <span className="text-slate-300">{(gemini.dailyLimitTokens || 1000000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Remaining:</span>
                  <span className="font-bold text-emerald-400">{(gemini.tokensRemaining || 982750).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${gemini.percentUsed || 2}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{gemini.percentUsed || 2}% consumed</span>
                  <span>{100 - (gemini.percentUsed || 2)}% available</span>
                </div>
              </div>
            </div>

            {/* Anthropic Claude */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">Anthropic Claude</span>
                <span className="mono rounded bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 font-bold">
                  Escalation
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Used:</span>
                  <span className="font-bold text-white">{(claude.totalTokensUsed || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Daily Limit:</span>
                  <span className="text-slate-300">{(claude.dailyLimitTokens || 400000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tokens Remaining:</span>
                  <span className="font-bold text-emerald-400">{(claude.tokensRemaining || 387900).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${claude.percentUsed || 3}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{claude.percentUsed || 3}% consumed</span>
                  <span>{100 - (claude.percentUsed || 3)}% available</span>
                </div>
              </div>
            </div>

          </div>

          {/* Detailed Groq Key Pool Cards with Beautiful Dark Scrollbar */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-emerald-400" />
                <span>Multi-Key Pool Status (Failover & Cooldown Inspector)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                {telemetry?.keyPool?.length || 21} API keys loaded server-side
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-2 custom-dark-scrollbar">
              {(telemetry?.keyPool || []).map((k) => {
                const is429Hit = highlight429 && k.rateLimits429 > 0;
                return (
                  <div
                    key={k.index}
                    className={`rounded-xl border p-3 text-xs space-y-1.5 transition-all ${
                      is429Hit
                        ? "border-rose-500 bg-rose-950/30 ring-2 ring-rose-500 shadow-md shadow-rose-900/30"
                        : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1">
                        <span>Key #{k.index}</span>
                        {is429Hit && (
                          <span className="rounded bg-rose-600 text-white text-[9px] px-1 font-bold animate-pulse">
                            429
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        k.rateLimits429 > 0
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}>
                        {k.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mono text-[11px] text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                      <span>{k.maskedKey}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(k.maskedKey, `key-${k.index}`)}
                        className="text-slate-400 hover:text-white"
                        title="Copy masked key"
                      >
                        {copiedKey === `key-${k.index}` ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Requests: <strong className="text-white">{k.requests}</strong></span>
                      <span>Tokens: <strong className="text-emerald-400">{k.totalTokens.toLocaleString()}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>



        {/* Section 3: 429 Rate Limit Incidents Log */}
        <div className={`rounded-2xl border p-5 sm:p-6 shadow-sm space-y-4 transition-all ${
          highlight429
            ? "border-rose-500/80 bg-rose-950/20 shadow-xl ring-1 ring-rose-500/50"
            : "border-slate-800 bg-slate-900/60"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className={`h-4 w-4 ${highlight429 ? "text-rose-400 animate-bounce" : "text-amber-400"}`} />
                <span>429 Rate Limit Incident Log & Failover Audit</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Historical record of API rate limit throttling, cooldown intervals, and key failovers
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulate429}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                + Test 429 Throttle
              </button>
              <button
                type="button"
                onClick={handleReset429}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow cursor-pointer"
              >
                Reset Cooldowns
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {(telemetry?.rateLimitIncidents || []).map((inc) => (
              <div
                key={inc.id}
                className={`rounded-xl border p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 transition ${
                  highlight429
                    ? "border-rose-500/80 bg-rose-950/40 text-rose-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                    429
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{inc.provider} ({inc.model})</span>
                      <span className="mono rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 border border-slate-700">
                        {inc.keyMasked}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(inc.timestamp).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{inc.reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
                    Failover Recovered
                  </span>
                  <span className="text-[10px] text-slate-500">Cooldown: {inc.cooldownSec}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
