"use client";

import { AlertTriangle, Clock, Stethoscope } from "lucide-react";
import { urgencyStyle, normalizeUrgency } from "../lib/api";

const ICONS = {
  Severe: AlertTriangle,
  Emergency: AlertTriangle,
  Moderate: Clock,
  Urgent: Clock,
  Mild: Stethoscope,
  Routine: Stethoscope,
  "Self-care": Stethoscope,
};

export const UrgencyBadge = ({ level, score, testId = "triage-urgency-badge", size = "lg" }) => {
  const normalizedLevel = normalizeUrgency(level);
  const s = urgencyStyle(normalizedLevel);
  const Icon = ICONS[normalizedLevel] || Stethoscope;
  const big = size === "lg";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.badge} ${
        big ? "px-3.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      } font-bold tracking-wide uppercase ${normalizedLevel === "Severe" && big ? "pulse-emergency" : ""}`}
    >
      <Icon className={big ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.4} />
      <span>{normalizedLevel}</span>
    </span>
  );
};

