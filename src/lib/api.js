import axios from "axios";

export const API = "/api";
export const API_KEY =
  process.env.NEXT_PUBLIC_API_KEY || "sk_live_vJjfGTfyHd4u5v-5Et49KQTfzSRzD8gk";

export const api = axios.create({
  baseURL: API,
  headers: { "X-API-Key": API_KEY },
});

export const URGENCY = {
  Emergency: {
    badge: "bg-red-50 text-red-700 border-red-300",
    dot: "bg-red-500",
    bar: "bg-red-600",
    label: "Immediate action — call 108",
  },
  Urgent: {
    badge: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    label: "Care within a few hours",
  },
  Routine: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-500",
    bar: "bg-emerald-600",
    label: "Dispensary / OPD in 1-3 days",
  },
  "Self-care": {
    badge: "bg-sky-50 text-sky-800 border-sky-300",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    label: "Home care and monitoring",
  },
};

export const urgencyStyle = (level) => URGENCY[level] || URGENCY.Routine;
