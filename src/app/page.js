"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Building2, Code2, FileText, PhoneCall } from "lucide-react";
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

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" theme="light" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Triage Logo"
              className="h-9 w-9 rounded-md object-contain shadow-sm"
            />
            <div>
              <h1 className="text-base font-extrabold leading-none">EKMS Triage Sandbox</h1>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ESIC / ESIS Assam · Claude Sonnet 4.6 triage engine
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
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
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 transition-all duration-200 hover:bg-emerald-100 hover:shadow-xs"
              title="Open IP Caller page in new tab/window to test online voice calling"
            >
              <PhoneCall className="h-3 w-3 text-emerald-600" />
              IP Caller Portal
            </a>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-3 sm:px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`nav-tab-${id}`}
              onClick={() => setTab(id)}
              className={`relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors duration-200 sm:text-sm ${
                tab === id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {tab === id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Real-time WebRTC Voice Call Manager for incoming IP calls */}
      <CallManager onCallerConnected={(info) => setIncomingCallerInfo(info)} />

      <main className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
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

      <footer className="mx-auto max-w-[1500px] px-5 pb-10 sm:px-8">
        <p className="border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
          Triage sorting and facility routing only — not a diagnosis, prescription or medical
          advice. Coverage limited to ESIC / ESIS facilities in Assam.
        </p>
      </footer>
    </div>
  );
}
