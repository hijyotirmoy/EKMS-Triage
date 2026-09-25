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
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { api } from "@/lib/api";
import { AgentLogin } from "@/components/AgentLogin";
import { CallManager } from "@/components/CallManager";
import { getFirestoreDb } from "@/lib/firebase";
import { doc, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";

const NAV_ITEMS = [
  { id: "home", href: "/", label: "Live Intake & Triage", icon: PhoneCall },
  { id: "cases", href: "/cases", label: "Triage Case", icon: FileText },
  { id: "facilities", href: "/facilities", label: "Triage Facility", icon: Building2 },
];

export function AppShell({ activePage = "home", children }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [meta, setMeta] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [incomingCallerInfo, setIncomingCallerInfo] = useState(null);
  const [callSession, setCallSession] = useState(null);

  // Authentication State
  const [currentAgent, setCurrentAgent] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Load active agent from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ekms_active_agent");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.agentId && parsed?.sessionId) {
          setCurrentAgent(parsed);
        }
      }
    } catch (e) {}
    setAuthInitialized(true);
  }, []);

  // Real-time single active session watcher via Firestore
  useEffect(() => {
    if (!currentAgent?.agentId || !currentAgent?.sessionId) return;

    let unsubscribe = null;
    let heartbeatTimer = null;

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
              localStorage.removeItem("ekms_active_agent");
              setCurrentAgent(null);
            }
          }
        },
        (err) => {
          console.warn("Session snapshot notice:", err.message);
        }
      );

      // Keep heartbeat alive every 45 seconds
      heartbeatTimer = setInterval(() => {
        updateDoc(sessionDocRef, {
          lastHeartbeat: Date.now(),
        }).catch(() => {});
      }, 45000);
    } catch (e) {
      console.warn("Session monitoring warning:", e.message);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [currentAgent]);

  const handleLogout = async () => {
    if (currentAgent?.agentId) {
      try {
        const db = getFirestoreDb();
        await deleteDoc(doc(db, "sessions", currentAgent.agentId));
      } catch (e) {}
    }
    localStorage.removeItem("ekms_active_agent");
    setCurrentAgent(null);
    toast.info("Logged out successfully");
  };

  const loadMeta = useCallback(() => {
    api
      .get("/meta")
      .then(({ data }) => setMeta(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadStats = useCallback(() => {
    api
      .get(`/cases/stats?_t=${Date.now()}`)
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadStats();
  }, [loadStats]);

  // Cache-enabled stats refresher (served from server memory cache with 0 Firestore reads)
  useEffect(() => {
    loadStats();
    const interval = setInterval(() => {
      loadStats();
    }, 45000); // 45 seconds polling
    return () => clearInterval(interval);
  }, [loadStats, refreshKey]);

  const handleCallerConnected = useCallback((info) => {
    setIncomingCallerInfo(info ? { ...info, _ts: Date.now() } : null);
    // If not on home page when call connects, optionally navigate to home to log the call
    if (activePage !== "home") {
      router.push("/");
    }
  }, [activePage, router]);

  // Loading indicator before reading localStorage
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

        <AgentLogin onLoginSuccess={setCurrentAgent} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
            <Link
              href="/cases"
              data-testid="header-case-count"
              className={`mono rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activePage === "cases"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30"
                  : "border-border text-foreground/80 hover:border-primary/60 hover:text-foreground hover:bg-secondary/60"
              }`}
              title="Open Triage Case logs page"
            >
              <span>Triage Case</span>
              <span className="font-mono text-emerald-800">({stats?.total ?? "—"})</span>
            </Link>

            {/* Facilities count link -> opens /facilities */}
            <Link
              href="/facilities"
              className={`mono rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activePage === "facilities"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30"
                  : "border-border text-foreground/80 hover:border-primary/60 hover:text-foreground hover:bg-secondary/60"
              }`}
              title="Open Triage Facility directory page"
            >
              <span>Triage Facility</span>
              <span className="font-mono text-emerald-800">({meta?.facility_count ?? "—"})</span>
            </Link>

            {/* Logged in Agent Badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>{currentAgent.agentId}</span>
            </div>

            {/* IP Caller link */}
            <a
              href="/caller"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-600/60 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-950 transition-all duration-200 hover:bg-emerald-100 hover:shadow-xs shadow-2xs"
              title="Open Triage Caller portal in new tab/window"
            >
              <PhoneCall className="h-3 w-3 text-emerald-700" />
              Triage Caller
            </a>

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

            <div className="mt-5 flex-1 space-y-1.5">
              {NAV_ITEMS.map(({ id, href, label, icon: Icon }) => {
                const isActive = activePage === id;
                return (
                  <Link
                    key={id}
                    href={href}
                    onClick={() => setMenuOpen(false)}
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

            <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
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

      <main className="mx-auto max-w-[1500px] px-3.5 py-3 pb-12 sm:px-6 sm:py-4 sm:pb-16">
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
