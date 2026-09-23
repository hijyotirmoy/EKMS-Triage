"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  Code2,
  FileText,
  Menu,
  PhoneCall,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { api } from "@/lib/api";
import { TriageConsole } from "@/components/TriageConsole";
import { CaseLogs } from "@/components/CaseLogs";
import { FacilityDirectory } from "@/components/FacilityDirectory";
import { DeveloperApi } from "@/components/DeveloperApi";
import { CallManager } from "@/components/CallManager";

const TABS = [
  { id: "triage-console", label: "Live intake & triage", icon: PhoneCall },
  { id: "case-logs", label: "Case logs", icon: FileText },
  { id: "facility-directory", label: "Facility directory", icon: Building2 },
  { id: "developer-api", label: "API & playground", icon: Code2 },
];

export default function Home() {
  const [tab, setTab] = useState("triage-console");
  const [menuOpen, setMenuOpen] = useState(false);
  const [meta, setMeta] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [incomingCallerInfo, setIncomingCallerInfo] = useState(null);

  const loadMeta = useCallback(() => {
    api
      .get("/meta")
      .then(({ data }) => setMeta(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    api
      .get("/cases/stats")
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, [refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);

  const handleCallerConnected = useCallback((info) => {
    setIncomingCallerInfo(info ? { ...info, _ts: Date.now() } : null);
  }, []);

  return (
    <div className="min-h-screen">
      <Toaster
        position="top-right"
        theme="light"
        duration={3000}
        closeButton={false}
        visibleToasts={5}
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

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3.5 sm:px-8">
          <button
            type="button"
            onClick={() => setTab("triage-console")}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-85 focus:outline-none"
            title="Go to Home / Live intake & triage"
          >
            <img
              src="/logo.png"
              alt="Triage Logo"
              className="h-9 w-9 rounded-md object-contain shadow-sm"
            />
            <div>
              <h1 className="text-base font-extrabold leading-none text-foreground">EKMS Triage</h1>
            </div>
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {stats?.total > 0 && (
              <span
                data-testid="header-case-count"
                className="mono rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {stats.total} cases
              </span>
            )}
            <span className="mono rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
              {meta?.facility_count ?? "—"} facilities
            </span>

            <a
              href="/caller"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 transition-all duration-200 hover:bg-emerald-100 hover:shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300"
              title="Open IP Caller page in new tab/window to test online voice calling"
            >
              <PhoneCall className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              IP Caller Portal
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-10 flex h-full w-full max-w-xs flex-col border-l border-border bg-background p-5 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <button
                type="button"
                onClick={() => {
                  setTab("triage-console");
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-85 focus:outline-none"
                title="Go to EKMS Triage Home"
              >
                <img
                  src="/logo.png"
                  alt="Triage Logo"
                  className="h-7 w-7 rounded-md object-contain"
                />
                <span className="text-sm font-bold text-foreground">EKMS Triage</span>
              </button>
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
              {TABS.map(({ id, label, icon: Icon }) => {
                const isActive = tab === id;
                return (
                  <button
                    key={id}
                    data-testid={`menu-tab-${id}`}
                    onClick={() => {
                      setTab(id);
                      setMenuOpen(false);
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
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      />
                      <span>{label}</span>
                    </div>
                    {isActive ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 text-xs text-muted-foreground">
              <div>
                Built for{" "}
                <a
                  href="https://ekms.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-600 transition-colors hover:underline dark:text-emerald-400"
                >
                  EKMS
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time WebRTC Voice Call Manager for incoming IP calls */}
      <CallManager onCallerConnected={handleCallerConnected} />

      <main className="mx-auto max-w-[1500px] px-4 py-3 pb-10 sm:px-6 sm:py-4 sm:pb-12">
        {tab === "triage-console" && (
          <TriageConsole
            meta={meta}
            onCaseCreated={bump}
            incomingCaller={incomingCallerInfo}
          />
        )}
        {tab === "case-logs" && <CaseLogs refreshKey={refreshKey} />}
        {tab === "facility-directory" && (
          <FacilityDirectory meta={meta} onImported={loadMeta} />
        )}
        {tab === "developer-api" && <DeveloperApi />}
      </main>
    </div>
  );
}
