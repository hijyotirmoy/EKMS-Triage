"use client";

import { useState } from "react";
import { Copy, Loader2, Play, KeyRound, Gauge } from "lucide-react";
import { toast } from "sonner";
import { API, API_KEY, api } from "../lib/api";

const SAMPLE = {
  caller_name: "Akash Gupta",
  phone: "9876543210",
  age: 45,
  sex: "Male",
  symptom_notes:
    "Chhati me tej dard, baayein haath me jhanjhanahat aur thanda pasina. 40 minute se ho raha hai.",
  duration: "Less than 2 hours",
  severity_reported: 9,
  city: "Guwahati",
  district: "Kamrup Metropolitan",
  pincode: "781005",
  source_app: "worker-app-android",
};

const ENDPOINTS = [
  ["GET", "/api/", "Public liveness check — no key needed."],
  ["POST", "/api/triage", "Triage a complaint + return nearest facilities. The black box."],
  ["GET", "/api/facilities/nearest", "Facility routing only — lat/lng, pincode, city or district."],
  ["GET", "/api/facilities", "Search the ESIC / ESIS directory."],
  ["GET", "/api/cases", "List logged cases (filter by urgency)."],
  ["GET", "/api/cases/{case_ref}", "Fetch one case with its full triage payload."],
  ["POST", "/api/facilities/import", "Bulk CSV import of facilities."],
  ["GET", "/api/meta", "Districts, pincodes, facility types, duration options."],
];

export const DeveloperApi = () => {
  const [body, setBody] = useState(JSON.stringify(SAMPLE, null, 2));
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);

  const curl = `curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}${API}/triage \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '${body.replace(/\n\s*/g, " ")}'`;

  const send = async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return toast.error("Request body is not valid JSON");
    }
    setLoading(true);
    const t0 = performance.now();
    try {
      const { data } = await api.post("/triage", parsed);
      setResp({ status: 200, ms: Math.round(performance.now() - t0), data });
    } catch (err) {
      setResp({
        status: err.response?.status || 0,
        ms: Math.round(performance.now() - t0),
        data: err.response?.data || { error: String(err) },
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <p className="eyebrow">Black-box contract</p>
        <h2 className="text-xl font-bold sm:text-2xl">API endpoints</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Any of your applications can call these directly. Base URL:{" "}
          <span className="mono text-primary">{API}</span>
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="eyebrow mb-1.5 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Authentication
            </p>
            <p className="text-sm">
              Every endpoint except <span className="mono text-xs">GET /api/</span> needs a header:
            </p>
            <p className="mono mt-2 break-all rounded border border-border bg-card px-2 py-1.5 text-xs">
              X-API-Key: {API_KEY ? `${API_KEY.slice(0, 11)}…${API_KEY.slice(-4)}` : "not set"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              One key per calling app, set in the <span className="mono">API_KEYS</span> env var.
              Remove a key there to revoke that app.
            </p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="eyebrow mb-1.5 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" /> Rate limits (per key)
            </p>
            <p className="text-sm">
              <span className="mono">60</span> / min on triage &amp; CSV import,{" "}
              <span className="mono">300</span> / min on read endpoints.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Over the limit returns <span className="mono">429</span> with a{" "}
              <span className="mono">Retry-After</span> header. Missing or wrong key returns{" "}
              <span className="mono">401</span>.
            </p>
          </div>
        </div>
        <div className="mt-4 divide-y divide-border/50">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={p} className="flex flex-wrap items-baseline gap-3 py-2.5">
              <span
                className={`mono rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  m === "POST"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {m}
              </span>
              <span className="mono text-sm">{p}</span>
              <span className="text-xs text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Request · POST /api/triage</h3>
            <button
              data-testid="api-playground-send-request"
              onClick={send}
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-all duration-200 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
          <textarea
            data-testid="api-playground-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            spellCheck={false}
            className="mono mt-4 w-full resize-y rounded-md border border-border/80 bg-secondary/50 p-3 text-xs leading-relaxed outline-none transition-colors duration-200 focus:border-primary/70"
          />
          <button
            data-testid="api-playground-curl-output"
            onClick={() => copy(curl, "cURL snippet")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border/70 py-2 text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
          >
            <Copy className="h-3.5 w-3.5" /> Copy cURL
          </button>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Response</h3>
            {resp && (
              <span
                className={`mono rounded px-2 py-0.5 text-[11px] font-bold ${
                  resp.status === 200
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {resp.status} · {resp.ms} ms
              </span>
            )}
          </div>
          <pre
            data-testid="api-playground-response"
            className="mono mt-4 max-h-[430px] overflow-auto rounded-md border border-border/80 bg-secondary/50 p-3 text-[11px] leading-relaxed text-foreground/90"
          >
            {resp
              ? JSON.stringify(resp.data, null, 2)
              : "// Hit Send to call the triage engine and see the exact payload your apps will receive."}
          </pre>
        </div>
      </div>
    </div>
  );
};
