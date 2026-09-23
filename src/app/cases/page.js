"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { CaseLogs } from "@/components/CaseLogs";

export default function CasesPage() {
  useEffect(() => {
    document.title = "Triage Case";
  }, []);

  return (
    <AppShell activePage="cases">
      {({ refreshKey, bump }) => (
        <CaseLogs refreshKey={refreshKey} onCaseDeleted={bump} />
      )}
    </AppShell>
  );
}

