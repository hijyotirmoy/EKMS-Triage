"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Code2,
  FileText,
  LogOut,
  Menu,
  PhoneCall,
  X,
  BrainCircuit,
  LayoutDashboard,
  Home,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { api, normalizeUrgency } from "@/lib/api";
import { AgentLogin } from "@/components/AgentLogin";
import { CallManager } from "@/components/CallManager";
import { getFirestoreDb } from "@/lib/firebase";
import { doc, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { resolveClientIpAndGeo } from "@/lib/geoIpResolver";
import {
  getCachedStats,
  setCachedStats,
  getCachedMeta,
  setCachedMeta,
  getCachedCases,
} from "@/lib/clientCache";
import { subscribeToSync } from "@/lib/broadcastSync";


const NAV_ITEMS = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "crm", href: "/crm", label: "CRM View", icon: LayoutDashboard },
  { id: "cases", href: "/cases", label: "Triage Case", icon: FileText },
  { id: "facilities", href: "/facilities", label: "Triage Facility", icon: Building2 },
  { id: "feedback", href: "/feedback", label: "AI Learning & Feedback", icon: BrainCircuit },
];

// In-memory module cache for instant 0ms page transitions without SSR hydration mismatches
let cachedAgentInMemory = null;
let cachedAuthInitialized = false;

export function AppShell({ activePage = "home", children }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [meta, setMeta] = useState(() => getCachedMeta());
  const [stats, setStats] = useState(() => getCachedStats());
  const [refreshKey, setRefreshKey] = useState(0);
  const [incomingCallerInfo, setIncomingCallerInfo] = useState(null);
  const [callSession, setCallSession] = useState(null);

  // Authentication State
  const [currentAgent, setCurrentAgent] = useState(() => cachedAgentInMemory);
  const [authInitialized, setAuthInitialized] = useState(() => cachedAuthInitialized);

  // Load and synchronize active agent across Main Page and CRM
  useEffect(() => {
    const syncActiveAgent = () => {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.agentId && parsed?.sessionId) {
            cachedAgentInMemory = parsed;
            setCurrentAgent(parsed);
            return;
          }
        }
        cachedAgentInMemory = null;
        setCurrentAgent(null);
      } catch (e) {}
    };

    syncActiveAgent();
    cachedAuthInitialized = true;
    setAuthInitialized(true);

    window.addEventListener("storage", syncActiveAgent);
    window.addEventListener("ekms_auth_change", syncActiveAgent);
    return () => {
      window.removeEventListener("storage", syncActiveAgent);
      window.removeEventListener("ekms_auth_change", syncActiveAgent);
    };
  }, []);

  // Prefetch routes in background for instant 0ms transitions
  useEffect(() => {
    router.prefetch("/cases");
    router.prefetch("/facilities");
    router.prefetch("/crm");
    router.prefetch("/");
  }, [router]);

  // Real-time single active session watcher via Firestore
  useEffect(() => {
    if (!currentAgent?.agentId || !currentAgent?.sessionId) return;

    let unsubscribe = null;

    try {
      const db = getFirestoreDb();
      const sessionDocRef = doc(db, "sessions", currentAgent.agentId);

      // Listen for remote session updates
      unsubscribe = onSnapshot(
        sessionDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            // If another session ID took over this agent, log out immediately
            if (data?.sessionId && data.sessionId !== currentAgent.sessionId) {
              toast.error(
                `Your session was terminated because ${currentAgent.agentId} logged in from another device/tab.`
              );
              cachedAgentInMemory = null;
              sessionStorage.removeItem("ekms_active_agent");
              localStorage.removeItem("ekms_active_agent");
              setCurrentAgent(null);
            }
          }
        },
        (err) => {
          console.warn("Session snapshot notice:", err.message);
        }
      );
    } catch (e) {
      console.warn("Session monitoring warning:", e.message);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentAgent]);

  const handleLogout = async () => {
    cachedAgentInMemory = null;
    cachedAuthInitialized = true;
    const agentId = currentAgent?.agentId;

    // Synchronously clear all active agent & CRM session keys
    sessionStorage.removeItem("ekms_active_agent");
    localStorage.removeItem("ekms_active_agent");
    sessionStorage.removeItem("crm_logged_in");
    localStorage.removeItem("crm_logged_in");

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("ekms_auth_change"));
    }
    setCurrentAgent(null);
    toast.info("Logged out successfully");

    // Clean up firestore session asynchronously in background without blocking logout
    if (agentId) {
      try {
        const db = getFirestoreDb();
        deleteDoc(doc(db, "sessions", agentId)).catch(() => {});
      } catch (e) {}
    }
  };

  const loadMeta = useCallback(() => {
    api
      .get("/meta")
      .then(({ data }) => {
        setMeta(data);
        setCachedMeta(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadStats = useCallback(() => {
    api
      .get("/cases/stats")
      .then(({ data }) => {
        setStats(data);
        setCachedStats(data);
      })
      .catch(() => {});
  }, []);

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadStats();
  }, [loadStats]);

  // Real-time cross-tab sync for stats without making any server/database reads
  useEffect(() => {
    const unsub = subscribeToSync((msg) => {
      const event = msg?.type;
      const data = msg?.payload;
      if (event === "NEW_CASE") {
        setStats((prev) => {
          const currentTotal = prev?.total || 0;
          const urgency = normalizeUrgency(data?.triage?.urgency_level) || "Mild";
          const newStats = {
            ...prev,
            total: currentTotal + 1,
            by_urgency: {
              ...(prev?.by_urgency || {}),
              [urgency]: ((prev?.by_urgency?.[urgency]) || 0) + 1,
            },
          };
          setCachedStats(newStats);
          return newStats;
        });
      } else if (event === "DELETE_CASE") {
        setStats((prev) => {
          const currentTotal = Math.max(0, (prev?.total || 1) - 1);
          const newStats = {
            ...prev,
            total: currentTotal,
          };
          setCachedStats(newStats);
          return newStats;
        });
      } else if (event === "SYNC_STATS_TOTAL") {
        if (typeof data?.total === "number") {
          setStats((prev) => {
            const newStats = {
              ...(prev || {}),
              total: data.total,
            };
            setCachedStats(newStats);
            return newStats;
          });
        }
      } else if (event === "FACILITIES_UPDATED") {
        loadMeta();
      }
    });
    return unsub;
  }, [loadMeta]);

  // Initial stats load from memory/cache
  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const totalCaseCount = stats?.total != null ? stats.total : (getCachedCases()?.length ?? 0);



  const handleCallerConnected = useCallback((info) => {
    setIncomingCallerInfo(info ? { ...info, _ts: Date.now() } : null);
    // If not on home page when call connects, optionally navigate to home to log the call
    if (info && activePage !== "home") {
      router.push("/");
    }
  }, [activePage, router]);

  // Loading indicator before reading session
  if (!authInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // If not logged in, render AgentLogin
  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500/20">
        <Toaster position="top-right" theme="light" />
        <header className="border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-8 sm:py-3.5">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
              <img
                src="/logo.png"
                alt="Triage Logo"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain shadow-sm"
              />
              <div>
                <h1 className="text-sm sm:text-base font-extrabold leading-none text-foreground">
                  EKMS Triage
                </h1>
              </div>
            </Link>
            <a
              href="/caller"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-emerald-600/60 bg-emerald-50 px-2.5 py-1 sm:px-3 text-[11px] font-bold text-emerald-950 transition-all hover:bg-emerald-100 shadow-2xs"
            >
              <PhoneCall className="h-3 w-3 text-emerald-700" />
              Triage Caller
            </a>
          </div>
        </header>

        <AgentLogin
          onLoginSuccess={(agent) => {
            cachedAgentInMemory = agent;
            cachedAuthInitialized = true;
            setCurrentAgent(agent);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <Toaster
        position="top-right"
        theme="light"
        duration={3000}
        closeButton={false}
        visibleToasts={1}
        toastOptions={{
          className:
            "!bg-white !text-slate-900 !border !border-slate-200/90 !shadow-xl !rounded-xl text-xs font-medium p-3.5",
          style: {
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            boxShadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
            borderRadius: "12px",
          },
        }}
      />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-4 py-2.5 sm:px-8 sm:py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 text-left transition-opacity hover:opacity-85 focus:outline-none"
            title="Go to Home / Live intake & triage"
          >
            <img
              src="/logo.png"
              alt="Triage Logo"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain shadow-sm"
            />
            <div>
              <h1 className="text-sm sm:text-base font-extrabold leading-none text-foreground">
                EKMS Triage
              </h1>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            {/* Cases count link -> opens /cases */}
            {/* 1. CRM View Toggle Switch (First position, to the left of Triage Case) */}
            <Link
              href={activePage === "crm" ? "/" : "/crm"}
              prefetch={true}
              onClick={() => {
                if (activePage !== "crm") {
                  try {
                    sessionStorage.removeItem("crm_authenticated_session");
                  } catch (_) {}
                }
              }}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition shadow-2xs ${
                activePage === "crm"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/40"
                  : "border-border text-foreground/80 hover:border-primary/60 hover:text-foreground hover:bg-secondary/60"
              }`}
              title={
                activePage === "crm"
                  ? "CRM View is ON (Click to toggle OFF & return to Standard Triage)"
                  : "CRM View is OFF (Click to toggle ON & open Piramal CRM)"
              }
            >
              <LayoutDashboard
                className={`h-3.5 w-3.5 ${
                  activePage === "crm" ? "text-emerald-700" : "text-muted-foreground"
                }`}
              />
              <span className="hidden xs:inline sm:inline">CRM View</span>
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${
                  activePage === "crm" ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                    activePage === "crm" ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </Link>

            {/* 2. Triage Case logs link -> opens /cases */}
            <Link
              href="/cases"
              prefetch={true}
              data-testid="header-case-count"
              className={`hidden sm:flex rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer items-center gap-1.5 shadow-2xs ${
                activePage === "cases"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30"
                  : "border-border text-foreground/80 hover:border-primary/60 hover:text-foreground hover:bg-secondary/60"
              }`}
              title="Open Triage Case logs page"
            >
              <span>Triage Case</span>
              <span suppressHydrationWarning className="font-bold text-emerald-800">({totalCaseCount})</span>
            </Link>

            {/* 3. Facilities count link -> opens /facilities */}
            <Link
              href="/facilities"
              prefetch={true}
              className={`hidden sm:flex rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer items-center gap-1.5 shadow-2xs ${
                activePage === "facilities"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30"
                  : "border-border text-foreground/80 hover:border-primary/60 hover:text-foreground hover:bg-secondary/60"
              }`}
              title="Open Triage Facility directory page"
            >
              <span>Triage Facility</span>
              <span suppressHydrationWarning className="font-bold text-emerald-800">({meta?.facility_count ?? "—"})</span>
            </Link>

            {/* 4. Logged in Agent Badge */}
            <div suppressHydrationWarning className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span suppressHydrationWarning>{currentAgent.agentId}</span>
            </div>

            {/* Hamburger Menu Button */}
            <button
              type="button"
              data-testid="header-hamburger-menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground transition-all duration-200 hover:border-primary/60 hover:bg-secondary hover:text-primary active:scale-95"
              title="Navigation Menu"
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Navigation Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          <div className="relative z-10 flex h-full w-full max-w-xs flex-col border-l border-border bg-background p-5 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-85 focus:outline-none"
                title="Go to EKMS Triage Home"
              >
                <img
                  src="/logo.png"
                  alt="Triage Logo"
                  className="h-7 w-7 rounded-md object-contain"
                />
                <span className="text-sm font-bold text-foreground">
                  EKMS Triage
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                title="Close Menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile quick status pills */}
            <div className="mt-3 flex items-center justify-between gap-2 border-b border-border/60 pb-3 sm:hidden">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>{currentAgent.agentId}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Link
                  href="/cases"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-secondary/80 px-2 py-0.5 border border-border/60 text-foreground hover:bg-secondary"
                >
                  Cases: <span className="font-bold text-emerald-800">{totalCaseCount}</span>
                </Link>
                <Link
                  href="/facilities"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-secondary/80 px-2 py-0.5 border border-border/60 text-foreground hover:bg-secondary"
                >
                  Fac: <span className="font-bold text-emerald-800">{meta?.facility_count ?? "—"}</span>
                </Link>
              </div>
            </div>


            <div className="mt-4 flex-1 space-y-1.5">
              {NAV_ITEMS.map(({ id, href, label, icon: Icon }) => {
                const isActive = activePage === id;
                return (
                  <Link
                    key={id}
                    href={href}
                    prefetch={true}
                    onClick={() => {
                      setMenuOpen(false);
                      if (id === "crm") {
                        try {
                          sessionStorage.removeItem("crm_authenticated_session");
                        } catch (_) {}
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 ${
                          isActive
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span>{label}</span>
                    </div>
                    {isActive ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-border/60 pt-3">
                <a
                  href="/caller"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center justify-between rounded-xl border border-emerald-600/50 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <PhoneCall className="h-4 w-4 text-emerald-700" />
                    <span>Triage Caller</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                </a>
              </div>
            </div>

            <div className="border-t border-border pt-3.5 text-xs text-muted-foreground space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  Logged in as:{" "}
                  <span className="font-bold text-foreground">
                    {currentAgent.agentId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-2xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log Out
                </button>
              </div>

              <div className="border-t border-border/60 pt-2.5 space-y-1 text-[11px] leading-relaxed">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <span>©</span>
                  <a
                    href="https://ekms.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-red-600 hover:underline"
                  >
                    EKMS
                  </a>
                  <span className="font-semibold text-foreground">Triage</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Designed and Developed by{" "}
                  <a
                    href="https://jyotirmoychoudhury.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-primary hover:underline transition-colors"
                  >
                    Jyotirmoy Choudhury
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time WebRTC Voice Call Manager filtered for this specific agent */}
      <CallManager
        agentId={currentAgent.agentId}
        onCallerConnected={handleCallerConnected}
        onCallUpdate={setCallSession}
      />

      <main className="mx-auto w-full max-w-[1500px] px-2.5 sm:px-6 py-2.5 sm:py-4 pb-12 sm:pb-16 overflow-x-hidden">
        {typeof children === "function"
          ? children({
              meta,
              stats,
              bump,
              loadMeta,
              incomingCallerInfo,
              currentAgent,
              callSession,
            })
          : children}
      </main>
    </div>
  );
}
