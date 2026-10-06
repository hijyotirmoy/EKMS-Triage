"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";

export default function ApiUsagePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Console</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">API Usage & Diagnostics</h1>
            <p className="text-xs text-muted-foreground">
              Real-time Groq and centralized LLM usage analytics
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Telemetry monitoring and token metrics are running live via client sessions.
        </div>
      </div>
    </div>
  );
}
