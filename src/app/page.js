"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { TriageConsole } from "@/components/TriageConsole";

export default function Home() {
  useEffect(() => {
    document.title = "EKMS Triage";
  }, []);

  return (
    <AppShell activePage="home">
      {({ meta, bump, incomingCallerInfo, currentAgent, callSession }) => (
        <TriageConsole
          meta={meta}
          onCaseCreated={bump}
          incomingCaller={incomingCallerInfo}
          currentAgent={currentAgent}
          callSession={callSession}
        />
      )}
    </AppShell>
  );
}
