"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Sparkles,
  Crosshair,
  RotateCcw,
  UserCheck,
  History,
  CalendarClock,
  Navigation,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { TriageResultPanel } from "./TriageResultPanel";
import { EkmsAiChatArea } from "./EkmsAiChatArea";
import { UrgencyBadge } from "./UrgencyBadge";
import { LiveScribeWindow } from "./LiveScribeWindow";

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

export const TriageConsole = ({ meta, onCaseCreated, incomingCaller, callSession }) => {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState("auto"); // 'auto' | 'scribe' | 'triage'
  const [ekmsContext, setEkmsContext] = useState(null);
  const [chatPresetTrigger, setChatPresetTrigger] = useState("");
  const [callerFoundInfo, setCallerFoundInfo] = useState(null);
  const [callerHistory, setCallerHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const lastLookedUpRef = useRef("");
  const chatRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Caller history lookup by phone number
  const lookupCaller = useCallback(async (phoneNumber) => {
    if (!phoneNumber) return;
    const clean = String(phoneNumber).replace(/\D/g, "");
    const query = clean.length >= 10 ? clean.slice(-10) : clean;
    if (query.length < 6) return;
    if (lastLookedUpRef.current === query) return;

    lastLookedUpRef.current = query;
    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/caller/lookup?phone=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.found && data.caller) {
        const c = data.caller;
        // Known caller: populate THIS caller's stored data and history
        setForm((f) => ({
          ...f,
          phone: phoneNumber,
          caller_name: c.caller_name || "",
          age: c.age ? String(c.age) : "",
          sex: c.sex || "",
          city: c.city || "",
          district: c.district || "",
          pincode: c.pincode || "",
          latitude: c.latitude ? String(c.latitude) : "",
          longitude: c.longitude ? String(c.longitude) : "",
        }));
        setCallerFoundInfo(c);
        if (data.history && Array.isArray(data.history)) {
          setCallerHistory(data.history);
        } else {
          setCallerHistory([]);
        }
        toast.success(
          `Previous record found for ${c.caller_name || phoneNumber}: Details & history loaded.`
        );
      } else {
        // Different / New caller number: clear old caller's data so agent can fill new caller details
        setForm((f) => ({
          ...f,
          phone: phoneNumber,
          caller_name: "",
          age: "",
          sex: "",
          city: "",
          district: "",
          pincode: "",
          latitude: "",
          longitude: "",
        }));
        setCallerFoundInfo(null);
        setCallerHistory([]);
        toast.info(
          `New number (${phoneNumber}): Please fill caller name, age, sex & location.`
        );
      }
    } catch (err) {
      console.warn("Caller lookup error:", err);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Auto-fill form when caller connects via online voice call
  useEffect(() => {
    if (incomingCaller && incomingCaller.phone) {
      const rawPhone = incomingCaller.phone;
      // New incoming call: clear previous caller's data
      setForm((f) => ({
        ...EMPTY,
        symptom_notes: f.symptom_notes,
        duration: f.duration,
        severity_reported: f.severity_reported,
        phone: rawPhone,
        caller_name: incomingCaller.name || "",
        city: incomingCaller.city || "",
        district: incomingCaller.district || "",
      }));
      setCallerFoundInfo(null);
      setCallerHistory([]);
      lastLookedUpRef.current = "";

      if (incomingCaller.symptoms) {
        setChatPresetTrigger(incomingCaller.symptoms);
      }
      lookupCaller(rawPhone);
    }
  }, [incomingCaller, lookupCaller]);

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

  const handleInsertScribeToComplaint = (callerSpeech) => {
    if (!callerSpeech) return;
    setForm((f) => ({
      ...f,
      symptom_notes: f.symptom_notes
        ? `${f.symptom_notes}\n${callerSpeech}`
        : callerSpeech,
    }));
    toast.success("Transcribed speech inserted into complaint notes");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.caller_name || !form.caller_name.trim()) {
      return toast.error("Caller Name is mandatory. Please enter caller name.");
    }
    if (!form.phone || !form.phone.trim()) {
      return toast.error("Phone number is mandatory. Please enter or receive a caller phone.");
    }
    if (!form.age || isNaN(Number(form.age)) || Number(form.age) <= 0) {
      return toast.error("Age is mandatory. Please enter a valid age.");
    }
    if (!form.sex || form.sex === "" || form.sex === "Not stated") {
      return toast.error("Sex is mandatory. Please select Male, Female, or Other.");
    }
    if (!form.symptom_notes || form.symptom_notes.trim().length < 3) {
      return toast.error("Please enter the caller's complaint notes in the chat area");
    }
    setLoading(true);
    setActiveRightTab("triage");
    setResult(null);
    const payload = {
      ...form,
      age: form.age === "" ? null : Number(form.age),
      severity_reported: Number(form.severity_reported),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      ekms_ai_context: ekmsContext,
      source_app: "console",
    };
    Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
    try {
      const { data } = await api.post("/triage", payload);
      setResult(data);
      onCaseCreated?.();
      toast.success(`${data.triage.urgency_level} — ${data.case_ref}`);
      if (form.phone) {
        lastLookedUpRef.current = "";
        lookupCaller(form.phone);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Triage failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <form onSubmit={submit} className="panel p-5 sm:p-6" data-testid="intake-form">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold sm:text-2xl">Caller intake</h2>
          <button
            type="button"
            data-testid="intake-form-reset"
            onClick={() => {
              setForm(EMPTY);
              setResult(null);
              setChatPresetTrigger("");
              setEkmsContext(null);
              setCallerFoundInfo(null);
              setCallerHistory([]);
              setHistoryPage(1);
              lastLookedUpRef.current = "";
              chatRef.current?.resetChat();
              toast.info("Intake form and AI chat reset");
            }}
            className="shrink-0 rounded-md border border-border/70 p-2 text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-foreground"
            title="Reset form and AI chat"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Caller Demographic Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {callerFoundInfo && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Returning IP Caller: <strong>{callerFoundInfo.caller_name}</strong>
                  {callerFoundInfo.age ? ` (${callerFoundInfo.age}y, ${callerFoundInfo.sex})` : ""}
                  {(callerFoundInfo.city || callerFoundInfo.district) ? ` • ${callerFoundInfo.city || callerFoundInfo.district}` : ""}
                </span>
              </div>
              {callerFoundInfo.last_case_ref && (
                <span className="font-mono text-[11px] opacity-75 hidden sm:inline">
                  Prev: {callerFoundInfo.last_case_ref}
                </span>
              )}
            </div>
          )}

          <Field
            label={
              <span className="flex items-center gap-1">
                Caller name <span className="text-red-500 font-bold">*</span>
              </span>
            }
          >
            <input
              data-testid="intake-form-caller-name"
              required
              className={inputCls}
              value={form.caller_name}
              onChange={set("caller_name")}
              placeholder="Ramesh Kalita"
            />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-1">
                Phone <span className="text-red-500 font-bold">*</span>
                {isLookingUp && <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />}
              </span>
            }
          >
            <input
              data-testid="intake-form-phone"
              required
              className={inputCls}
              value={form.phone}
              onChange={(e) => {
                const val = e.target.value;
                setForm((f) => ({ ...f, phone: val }));
                const digits = val.replace(/\D/g, "");
                if (callerFoundInfo && digits !== (callerFoundInfo.phone || "").replace(/\D/g, "").slice(-10)) {
                  setCallerFoundInfo(null);
                  setCallerHistory([]);
                  setHistoryPage(1);
                  lastLookedUpRef.current = "";
                }
                if (digits.length === 10) {
                  lookupCaller(val);
                }
              }}
              onBlur={() => {
                if (form.phone && form.phone.trim().length >= 6) {
                  lookupCaller(form.phone);
                }
              }}
              placeholder="98XXXXXXXX"
            />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-1">
                Age <span className="text-red-500 font-bold">*</span>
              </span>
            }
          >
            <input
              data-testid="intake-form-age"
              required
              type="number"
              min="0"
              max="120"
              className={inputCls}
              value={form.age}
              onChange={set("age")}
              placeholder="42"
            />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-1">
                Sex <span className="text-red-500 font-bold">*</span>
              </span>
            }
          >
            <select
              data-testid="intake-form-sex"
              required
              className={inputCls}
              value={form.sex}
              onChange={set("sex")}
            >
              <option value="">Select sex</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </Field>
        </div>

        {/* 2. Location Fields (seamlessly styled matching demographic fields) */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
          <div className="flex flex-col justify-end">
            <button
              type="button"
              data-testid="intake-form-use-gps"
              onClick={useGps}
              className="flex h-[38px] items-center gap-2 rounded-md border border-border/70 px-3 text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
            >
              <Crosshair className="h-3.5 w-3.5" /> GPS
            </button>
          </div>
        </div>

        {/* 3. Complaint Notes & Adaptive Questioning */}
        <div className="mt-4">
          <label className="field-label mb-2 block">Complaint Notes &amp; Adaptive Questioning</label>
          <EkmsAiChatArea
            ref={chatRef}
            initialNotes={chatPresetTrigger}
            onComplaintChange={(compiledNotes, ctx) => {
              setForm((f) => ({ ...f, symptom_notes: compiledNotes }));
              setEkmsContext(ctx);
            }}
            onSyncFields={(field, val) => {
              setForm((f) => ({ ...f, [field]: val }));
            }}
          />
        </div>

        {/* 4. Duration & Severity */}
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

        {/* 5. Run Triage CTA */}
        <button
          type="submit"
          data-testid="intake-form-submit-button"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing the case...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Run triage
            </>
          )}
        </button>

        {/* 6. Caller Consultation History - unboxed, shows 10 per page with pagination */}
        {callerHistory && callerHistory.length > 0 && (() => {
          const HISTORY_PER_PAGE = 10;
          const totalPages = Math.ceil(callerHistory.length / HISTORY_PER_PAGE) || 1;
          const currentPage = Math.min(Math.max(1, historyPage), totalPages);
          const paginatedHistory = callerHistory.slice(
            (currentPage - 1) * HISTORY_PER_PAGE,
            currentPage * HISTORY_PER_PAGE
          );

          return (
            <div className="mt-6 border-t border-border/70 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Caller Past History ({callerHistory.length} {callerHistory.length === 1 ? "call" : "calls"} recorded)
                  </h3>
                </div>
                <span className="mono text-[11px] text-muted-foreground">
                  +91 {form.phone}
                </span>
              </div>

              <div className="space-y-3.5">
                {paginatedHistory.map((item, idx) => (
                  <div
                    key={item.case_ref || idx}
                    className="rounded-lg border border-border/70 bg-card p-4 shadow-2xs transition-colors hover:border-primary/50"
                  >
                    {/* Top Bar: Date, Time, Case Ref, Urgency Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>
                            {new Date(item.created_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <span className="mono text-[11px] text-primary/80">
                          {item.case_ref}
                        </span>
                      </div>
                      <UrgencyBadge level={item.urgency_level} score={item.urgency_score} size="sm" />
                    </div>

                    {/* Reason for Call / Symptoms */}
                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Reason for Call / Symptoms
                      </p>
                      <p className="mt-1 text-xs text-foreground/90 leading-relaxed font-medium">
                        {item.reason || item.summary || "No complaint notes logged"}
                      </p>
                    </div>

                    {/* Navigation Provided by Agent */}
                    <div className="mt-3 rounded-md bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        <span>Navigation Provided by Agent</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-emerald-950 dark:text-emerald-100 leading-relaxed">
                        {item.navigation || item.recommended_action || "Standard consultation / triage guidance"}
                      </p>
                      {item.recommended_facility_type && (
                        <p className="mt-1.5 text-[11px] text-emerald-800 dark:text-emerald-300/90 font-semibold border-t border-emerald-500/20 pt-1.5">
                          Routed Facility: <span className="underline font-bold">{item.recommended_facility_type}</span>
                          {item.nearest_facility ? ` (${item.nearest_facility})` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1.5 rounded-md border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous page
                  </button>

                  <span className="text-xs text-muted-foreground font-medium">
                    Page <strong className="text-foreground">{currentPage}</strong> of <strong>{totalPages}</strong> ({callerHistory.length} calls)
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1.5 rounded-md border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next page <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </form>

      {/* Right Side: Live Scribe Window OR Triage Result Panel */}
      {(() => {
        const isCallActive =
          callSession?.callState === "connected" ||
          callSession?.callState === "on_hold";
        const transcriptsCount = callSession?.transcripts?.length || 0;
        const hasTranscripts = transcriptsCount > 0;
        const hasInterim = Boolean(callSession?.interimTranscript);
        const hasActiveScribe = isCallActive || hasTranscripts || hasInterim;

        let currentRightView = activeRightTab;
        if (currentRightView === "auto") {
          if (result || loading) {
            currentRightView = "triage";
          } else if (hasActiveScribe) {
            currentRightView = "scribe";
          } else {
            currentRightView = "triage";
          }
        }

        const showToggleBar = hasActiveScribe || Boolean(result);

        return (
          <div className="flex flex-col">
            {showToggleBar && (
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/50 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("triage")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                      currentRightView === "triage"
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                    Triage Outcome
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("scribe")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                      currentRightView === "scribe"
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    Call Transcript {transcriptsCount > 0 ? `(${transcriptsCount})` : ""}
                    {isCallActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                    )}
                  </button>
                </div>

                {isCallActive && (
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Call Live
                  </span>
                )}
              </div>
            )}

            {currentRightView === "scribe" ? (
              <LiveScribeWindow
                transcripts={callSession?.transcripts || []}
                interimTranscript={callSession?.interimTranscript || null}
                isCallActive={isCallActive}
                callDuration={callSession?.callDuration || 0}
                activeCaller={
                  callSession?.activeCaller ||
                  incomingCaller || {
                    caller_name: form.caller_name || "Caller",
                    phone: form.phone,
                  }
                }
                onInsertToComplaint={handleInsertScribeToComplaint}
                currentLanguage={callSession?.agentLang || "en-IN"}
                onLanguageChange={callSession?.setAgentLang}
              />
            ) : (
              <TriageResultPanel result={result} loading={loading} />
            )}
          </div>
        );
      })()}
    </div>
  );
};
