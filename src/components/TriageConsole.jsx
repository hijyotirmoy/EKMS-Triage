"use client";

import { useState } from "react";
import { Loader2, Sparkles, Crosshair, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PRESETS } from "./presets";
import { TriageResultPanel } from "./TriageResultPanel";

const EMPTY = {
  caller_name: "",
  phone: "",
  age: "",
  sex: "",
  symptom_notes: "",
  duration: "",
  severity_reported: 5,
  city: "",
  district: "",
  pincode: "",
  latitude: "",
  longitude: "",
};

const inputCls =
  "w-full rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors duration-200 focus:border-primary/70 focus:bg-background";

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <label className="field-label">{label}</label>
    {children}
  </div>
);

export const TriageConsole = ({ meta, onCaseCreated }) => {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyPreset = (p) => {
    setForm({ ...EMPTY, ...p.data });
    setResult(null);
    toast.success(`Loaded sample call: ${p.title}`);
  };

  const useGps = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not available in this browser");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        })),
      () => toast.error("Could not read GPS; enter city or pincode instead")
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.symptom_notes.trim().length < 3) return toast.error("Enter the complaint notes first");
    setLoading(true);
    setResult(null);
    const payload = {
      ...form,
      age: form.age === "" ? null : Number(form.age),
      severity_reported: Number(form.severity_reported),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      source_app: "console",
    };
    Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
    try {
      const { data } = await api.post("/triage", payload);
      setResult(data);
      onCaseCreated?.();
      toast.success(`${data.triage.urgency_level} — ${data.case_ref}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Triage failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <form onSubmit={submit} className="panel p-5 sm:p-6" data-testid="intake-form">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Step 01</p>
            <h2 className="text-xl font-bold sm:text-2xl">Caller intake</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Type the complaint in English, Hindi or Hinglish — exactly as the caller says it.
            </p>
          </div>
          <button
            type="button"
            data-testid="intake-form-reset"
            onClick={() => {
              setForm(EMPTY);
              setResult(null);
            }}
            className="shrink-0 rounded-md border border-border/70 p-2 text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-foreground"
            title="Clear form"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={p.testId}
              onClick={() => applyPreset(p)}
              className="group rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary"
            >
              {p.title}
              <span className="ml-1.5 text-[10px] text-muted-foreground group-hover:text-primary/70">
                {p.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caller name">
            <input
              data-testid="intake-form-caller-name"
              className={inputCls}
              value={form.caller_name}
              onChange={set("caller_name")}
              placeholder="Ramesh Kalita"
            />
          </Field>
          <Field label="Phone">
            <input
              data-testid="intake-form-phone"
              className={inputCls}
              value={form.phone}
              onChange={set("phone")}
              placeholder="98XXXXXXXX"
            />
          </Field>
          <Field label="Age">
            <input
              data-testid="intake-form-age"
              type="number"
              min="0"
              max="120"
              className={inputCls}
              value={form.age}
              onChange={set("age")}
              placeholder="42"
            />
          </Field>
          <Field label="Sex">
            <select
              data-testid="intake-form-sex"
              className={inputCls}
              value={form.sex}
              onChange={set("sex")}
            >
              <option value="">Not stated</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </Field>
        </div>

        <Field label="Complaint notes (English / हिंदी / Hinglish)" className="mt-4">
          <textarea
            data-testid="intake-form-symptoms"
            rows={5}
            className={`${inputCls} resize-y leading-relaxed`}
            value={form.symptom_notes}
            onChange={set("symptom_notes")}
            placeholder="Chhati me dard ho raha hai, pasina aa raha hai..."
          />
        </Field>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Duration">
            <select
              data-testid="intake-form-duration"
              className={inputCls}
              value={form.duration}
              onChange={set("duration")}
            >
              <option value="">Not stated</option>
              {(meta?.durations || []).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label={`Severity reported — ${form.severity_reported}/10`}>
            <input
              data-testid="intake-form-severity-slider"
              type="range"
              min="1"
              max="10"
              value={form.severity_reported}
              onChange={set("severity_reported")}
              className="mt-3 w-full accent-primary"
            />
          </Field>
        </div>

        <div className="mt-5 rounded-md border border-border/60 bg-secondary/20 p-4">
          <p className="eyebrow mb-3">Caller location</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City / town">
              <input
                data-testid="intake-form-city"
                className={inputCls}
                value={form.city}
                onChange={set("city")}
                placeholder="Guwahati"
              />
            </Field>
            <Field label="District">
              <select
                data-testid="intake-form-district"
                className={inputCls}
                value={form.district}
                onChange={set("district")}
              >
                <option value="">Select district</option>
                {(meta?.districts || []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Pincode">
              <input
                data-testid="intake-form-pincode"
                className={inputCls}
                value={form.pincode}
                onChange={set("pincode")}
                placeholder="781022"
                maxLength={6}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Latitude (optional)">
              <input
                data-testid="intake-form-latitude"
                className={inputCls}
                value={form.latitude}
                onChange={set("latitude")}
                placeholder="26.1445"
              />
            </Field>
            <Field label="Longitude (optional)">
              <input
                data-testid="intake-form-longitude"
                className={inputCls}
                value={form.longitude}
                onChange={set("longitude")}
                placeholder="91.7362"
              />
            </Field>
            <button
              type="button"
              data-testid="intake-form-use-gps"
              onClick={useGps}
              className="mt-auto flex h-[38px] items-center gap-2 rounded-md border border-border/70 px-3 text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
            >
              <Crosshair className="h-3.5 w-3.5" /> GPS
            </button>
          </div>
        </div>

        <button
          type="submit"
          data-testid="intake-form-submit-button"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Triaging with Claude Sonnet 4.6…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Run triage
            </>
          )}
        </button>
      </form>

      <TriageResultPanel result={result} loading={loading} />
    </div>
  );
};
