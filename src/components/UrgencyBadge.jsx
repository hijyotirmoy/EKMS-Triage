"use client";

import { AlertTriangle, Clock, Stethoscope, HeartPulse } from "lucide-react";
import { urgencyStyle } from "../lib/api";

const ICONS = {
  Emergency: AlertTriangle,
  Urgent: Clock,
  Routine: Stethoscope,
  "Self-care": HeartPulse,
};

export const UrgencyBadge = ({ level, score, testId = "triage-urgency-badge", size = "lg" }) => {
  const s = urgencyStyle(level);
  const Icon = ICONS[level] || Stethoscope;
  const big = size === "lg";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-2 rounded-full border ${s.badge} ${
        big ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs"
      } font-semibold tracking-tight ${level === "Emergency" && big ? "pulse-emergency" : ""}`}
    >
      <Icon className={big ? "h-4 w-4" : "h-3 w-3"} strokeWidth={2.4} />
      {level}
      {score != null && <span className="opacity-70 mono">{score}/10</span>}
    </span>
  );
};
