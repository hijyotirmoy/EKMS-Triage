"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { FeedbackManager } from "@/components/FeedbackManager";

export default function FeedbackPage() {
  useEffect(() => {
    document.title = "AI Learning & Feedback | EKMS Triage";
  }, []);

  return (
    <AppShell activePage="feedback">
      {({ refreshKey }) => <FeedbackManager refreshKey={refreshKey} />}
    </AppShell>
  );
}
