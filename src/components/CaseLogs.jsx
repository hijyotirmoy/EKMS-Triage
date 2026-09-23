"use client";

import { useEffect, useState } from "react";
import { Search, Inbox } from "lucide-react";
import { api } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

export const CaseLogs = ({ refreshKey }) => {
  const [cases, setCases] = useState([]);
  const [urgency, setUrgency] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api
      .get("/cases", { params: { urgency, q: q || undefined } })
      .then(({ data }) => setCases(data))
      .catch(() => setCases([]));
  }, [urgency, q, refreshKey]);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2 className="text-xl font-bold sm:text-2xl">Case logs</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              data-testid="case-log-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, notes"
              className={`${inputCls} pl-8`}
            />
          </div>
          <select
            data-testid="case-log-filter-urgency"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className={inputCls}
          >
            <option value="all">All urgencies</option>
            <option value="Emergency">Emergency</option>
            <option value="Urgent">Urgent</option>
            <option value="Routine">Routine</option>
            <option value="Self-care">Self-care</option>
          </select>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No cases logged yet.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm" data-testid="case-log-table">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Case</th>
                <th className="py-2 pr-3 font-semibold">Caller</th>
                <th className="py-2 pr-3 font-semibold">Complaint</th>
                <th className="py-2 pr-3 font-semibold">Urgency</th>
                <th className="py-2 pr-3 font-semibold">Navigation</th>
                <th className="py-2 pr-3 font-semibold">Nearest</th>
                <th className="py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.case_ref}
                  data-testid="case-log-row"
                  onClick={() => setOpen(open === c.case_ref ? null : c.case_ref)}
                  className="cursor-pointer border-b border-border/40 transition-colors duration-200 hover:bg-secondary/30"
                >
                  <td className="mono py-3 pr-3 text-xs text-primary/90">{c.case_ref}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-foreground">{c.intake?.caller_name || "—"}</p>
                      {(c.intake?.age || c.intake?.sex) && (
                        <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                          {[c.intake?.age ? `${c.intake.age}y` : null, c.intake?.sex].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="mono text-[11px] text-muted-foreground">{c.intake?.phone || "—"}</p>
                  </td>
                  <td className="max-w-[280px] py-3 pr-3">
                    <p className={open === c.case_ref ? "text-foreground font-medium text-xs leading-relaxed" : "truncate text-muted-foreground"}>
                      {open === c.case_ref ? c.intake?.symptom_notes : c.triage?.summary_en}
                    </p>
                    {open === c.case_ref && c.triage?.reasoning && (
                      <div className="mt-2 text-xs leading-relaxed text-foreground/80 border-t border-border/40 pt-1.5">
                        <p>{c.triage?.reasoning}</p>
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <UrgencyBadge
                      level={c.triage?.urgency_level}
                      size="sm"
                      testId="case-log-urgency-badge"
                    />
                  </td>
                  <td className="max-w-[280px] py-3 pr-3 text-xs leading-snug">
                    <p
                      className="line-clamp-2 text-foreground/90 font-medium"
                      title={c.triage?.recommended_action || c.triage?.recommended_facility_type}
                    >
                      {c.triage?.recommended_action || c.triage?.recommended_facility_type || "—"}
                    </p>
                    {c.triage?.recommended_facility_type && c.triage?.recommended_action && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                        {c.triage.recommended_facility_type}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {c.nearest_facilities?.[0]
                      ? `${c.nearest_facilities[0].name} · ${c.nearest_facilities[0].distance_km} km`
                      : "—"}
                  </td>
                  <td className="mono py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
