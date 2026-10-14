import axios from "axios";

export const API = "/api";
export const API_KEY =
  process.env.NEXT_PUBLIC_API_KEY || "sk_live_vJjfGTfyHd4u5v-5Et49KQTfzSRzD8gk";

export const api = axios.create({
  baseURL: API,
  headers: { "X-API-Key": API_KEY },
});

export function normalizeUrgency(level) {
  if (!level) return "Mild";
  const s = String(level).trim().toLowerCase();
  // Severe (Life-threatening / 108 Emergency)
  if (
    s.includes("sev") ||
    s.includes("emerg") ||
    s.includes("high") ||
    s === "10" ||
    s === "9" ||
    s === "8" ||
    s.startsWith("10/") ||
    s.startsWith("9/") ||
    s.startsWith("8/")
  ) {
    return "Severe";
  }
  // Moderate (Hospital evaluation / Urgent)
  if (
    s.includes("mod") ||
    s.includes("urg") ||
    s === "7" ||
    s === "6" ||
    s === "5" ||
    s.startsWith("7/") ||
    s.startsWith("6/") ||
    s.startsWith("5/")
  ) {
    return "Moderate";
  }
  // Mild (Dispensary / 104 Helpline)
  return "Mild";
}

export const URGENCY = {
  Severe: {
    badge: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800",
    dot: "bg-red-500",
    bar: "bg-red-600",
    label: "Severe — 108 Ambulance",
  },
  Moderate: {
    badge: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    label: "Moderate — ESIC / Govt Hospital",
  },
  Mild: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    bar: "bg-emerald-600",
    label: "Mild — 104 Helpline & ESIS Dispensary",
  },
  // Legacy aliases
  Emergency: {
    badge: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800",
    dot: "bg-red-500",
    bar: "bg-red-600",
    label: "Severe — 108 Ambulance",
  },
  Urgent: {
    badge: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    label: "Moderate — ESIC / Govt Hospital",
  },
  Routine: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    bar: "bg-emerald-600",
    label: "Mild — 104 Helpline & ESIS Dispensary",
  },
  "Self-care": {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    bar: "bg-emerald-600",
    label: "Mild — 104 Helpline & ESIS Dispensary",
  },
};

export const urgencyStyle = (level) => {
  const norm = normalizeUrgency(level);
  return URGENCY[norm] || URGENCY[level] || URGENCY.Mild;
};
