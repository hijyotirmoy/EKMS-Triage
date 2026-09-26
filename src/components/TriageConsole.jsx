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
import { extractClinicalEntities, processTranscriptionForAi } from "../lib/clinicalAdaptiveEngine";

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
  "w-full rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors duration-200 focus:border-primary/70 focus:bg-background";

const Field = ({ label, children, className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    <label className="field-label text-[10px] sm:text-[11px] mb-1 sm:mb-1.5 truncate">{label}</label>
    {children}
  </div>
);

export const TriageConsole = ({ meta, onCaseCreated, incomingCaller, currentAgent, callSession }) => {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState("scribe"); // 'scribe' | 'triage' - Default to Call Transcript tab so it is always present
  const [ekmsContext, setEkmsContext] = useState(null);
  const [chatPresetTrigger, setChatPresetTrigger] = useState("");
  const [callerFoundInfo, setCallerFoundInfo] = useState(null);
  const [callerHistory, setCallerHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const lastLookedUpRef = useRef("");
  const chatRef = useRef(null);
  const outcomeRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const hasClearedOnMountRef = useRef(false);

  // On page load / refresh: clear manual room transcripts once on initial load
  useEffect(() => {
    if (!hasClearedOnMountRef.current && callSession?.clearTranscripts) {
      hasClearedOnMountRef.current = true;
      callSession.clearTranscripts();
      callSession.stopManualRecording?.();
      try {
        localStorage.removeItem("ekms_scribe_sync");
      } catch (e) {}
    }
  }, [callSession?.clearTranscripts]);

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
        // Different / New caller number: preserve whatever details the agent has already typed
        setForm((f) => ({
          ...f,
          phone: phoneNumber,
          caller_name: f.caller_name || "",
          age: f.age || "",
          sex: f.sex || "",
          city: f.city || "",
          district: f.district || "",
          pincode: f.pincode || "",
          latitude: f.latitude || "",
          longitude: f.longitude || "",
        }));
        setCallerFoundInfo(null);
        setCallerHistory([]);
        toast.info(
          `New number (${phoneNumber}): Please fill caller details.`
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
      // New incoming call: clear previous caller's data and start clean
      setForm(() => ({
        ...EMPTY,
        phone: rawPhone,
        caller_name: incomingCaller.name || "",
        city: incomingCaller.city || "",
        district: incomingCaller.district || "",
      }));
      setCallerFoundInfo(null);
      setCallerHistory([]);
      lastLookedUpRef.current = "";
      setChatPresetTrigger("");
      chatRef.current?.resetChat();
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

  // When a real phone call connects, auto-switch to Call Transcript tab
  useEffect(() => {
    if (callSession?.callState === "connected") {
      setActiveRightTab("scribe");
    }
  }, [callSession?.callState]);

  // Real-time NLP stream: Processes transcribed speech with NLP, filters conversational filler,
  // prevents duplicate submissions, and sends standardized structured clinical formats to the AI chat.
  const lastProcessedTranscriptLenRef = useRef(0);
  const sentClinicalSignaturesRef = useRef(new Set());

  // Process finalized segments as soon as they commit
  useEffect(() => {
    const transcripts = callSession?.transcripts || [];
    if (transcripts.length === 0) {
      lastProcessedTranscriptLenRef.current = 0;
      sentClinicalSignaturesRef.current.clear();
      return;
    }

    if (transcripts.length > lastProcessedTranscriptLenRef.current) {
      const newItems = transcripts.slice(lastProcessedTranscriptLenRef.current);
      lastProcessedTranscriptLenRef.current = transcripts.length;

      const newSpeech = newItems.map((t) => t.text).join(" ").trim();
      if (newSpeech) {
        // 1. Process transcription through NLP: extract entities, strip small-talk/silence, format into standard format
        const nlpResult = processTranscriptionForAi(
          newSpeech,
          ekmsContext?.triageState || {},
          sentClinicalSignaturesRef.current
        );

        if (nlpResult) {
          // 2. Prevent sending the same thing multiple times
          sentClinicalSignaturesRef.current.add(nlpResult.entitySignature);

          // 3. Send ONLY standard structured format to the AI chat
          chatRef.current?.processLiveSpeech?.(nlpResult.standardText);

          // 4. Update Intake Form with clean clinical findings
          const cleanNotes = `[NLP Findings: ${nlpResult.standardText}]`;
          setForm((f) => ({
            ...f,
            symptom_notes: f.symptom_notes && f.symptom_notes.includes(cleanNotes)
              ? f.symptom_notes
              : f.symptom_notes ? `${f.symptom_notes}\n${cleanNotes}` : cleanNotes,
            duration: nlpResult.nlp.detectedDuration || f.duration,
            severity_reported: nlpResult.nlp.detectedSeverity || f.severity_reported,
          }));
        }
      }
    }
  }, [callSession?.transcripts, ekmsContext?.triageState]);

  const handleInsertScribeToComplaint = (callerSpeech) => {
    if (!callerSpeech || !callerSpeech.trim()) return;
    const cleanSpeech = callerSpeech.trim();

    // Process entire accumulated speech through NLP
    const nlpResult = processTranscriptionForAi(
      cleanSpeech,
      ekmsContext?.triageState || {},
      sentClinicalSignaturesRef.current
    );

    if (nlpResult) {
      sentClinicalSignaturesRef.current.add(nlpResult.entitySignature);
      const cleanNotes = `[NLP Findings: ${nlpResult.standardText}]`;
      setForm((f) => ({
        ...f,
        symptom_notes: f.symptom_notes && f.symptom_notes.includes(cleanNotes)
          ? f.symptom_notes
          : f.symptom_notes ? `${f.symptom_notes}\n${cleanNotes}` : cleanNotes,
        duration: nlpResult.nlp.detectedDuration || f.duration,
        severity_reported: nlpResult.nlp.detectedSeverity || f.severity_reported,
      }));

      // Send standard format to chat AI
      if (chatRef.current?.insertComplaintText) {
        chatRef.current.insertComplaintText(nlpResult.standardText);
      }
      toast.success("Clinical entities extracted & formatted for AI Consultation!");
    } else {
      // If no new clinical entities, update notes without confusing the chat AI
      setForm((f) => ({
        ...f,
        symptom_notes: f.symptom_notes && f.symptom_notes.includes(cleanSpeech)
          ? f.symptom_notes
          : f.symptom_notes ? `${f.symptom_notes}\n${cleanSpeech}` : cleanSpeech,
      }));
      toast.info("Notes updated from transcript.");
    }
  };

  const submit = async (e, overrideContext) => {
    e?.preventDefault?.();
    const activeContext = overrideContext || ekmsContext;
    if (!form.caller_name || !form.caller_name.trim()) {
      return toast.error("Caller Name is mandatory. Please enter caller name.");
    }
    if (!form.phone || !form.phone.trim()) {
      return toast.error("Phone number is mandatory. Please enter or receive a caller phone.");
    }
    if (form.age && (isNaN(Number(form.age)) || Number(form.age) <= 0)) {
      return toast.error("Please enter a valid age.");
    }

    const compiledNotes =
      form.symptom_notes?.trim() ||
      activeContext?.triageState?.notes ||
      activeContext?.triageState?.condition ||
      activeContext?.triageState?.symptom ||
      "";

    if (!compiledNotes || compiledNotes.length < 3) {
      return toast.error("Please enter the caller's complaint notes in the chat area");
    }
    setLoading(true);
    setActiveRightTab("triage");
    setResult(null);

    let rawAgent = currentAgent?.agentId;
    if (!rawAgent) {
      try {
        const stored = localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          rawAgent = parsed?.agentId;
        }
      } catch (e) {}
    }
    const agentCode = rawAgent && String(rawAgent).includes("3")
      ? "A3"
      : rawAgent && String(rawAgent).includes("2")
      ? "A2"
      : "A1";

    const payload = {
      ...form,
      agent_id: agentCode,
      symptom_notes: compiledNotes,
      age: form.age === "" ? null : Number(form.age),
      severity_reported: Number(form.severity_reported),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      ekms_ai_context: activeContext,
      source_app: "console",
    };
    Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
    try {
      const { data } = await api.post("/triage", payload);
      setResult(data);
      setActiveRightTab("triage");
      onCaseCreated?.();
      toast.success(`${data.triage.urgency_level} — ${data.case_ref}`);
      if (form.phone) {
        lastLookedUpRef.current = "";
        lookupCaller(form.phone);
      }
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setTimeout(() => {
          outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Triage failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryContent = () => {
    if (!callerHistory || callerHistory.length === 0) return null;
    const HISTORY_PER_PAGE = 10;
    const totalPages = Math.ceil(callerHistory.length / HISTORY_PER_PAGE) || 1;
    const currentPage = Math.min(Math.max(1, historyPage), totalPages);
    const paginatedHistory = callerHistory.slice(
      (currentPage - 1) * HISTORY_PER_PAGE,
      currentPage * HISTORY_PER_PAGE
    );

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary shrink-0" />
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
              className="rounded-lg border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs transition-colors hover:border-primary/50"
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
              <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-400 p-3 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span>Navigation Provided by Agent</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-emerald-950 leading-relaxed">
                  {item.navigation || item.recommended_action || "Standard consultation / triage guidance"}
                </p>
                {item.recommended_facility_type && (
                  <p className="mt-1.5 text-[11px] text-emerald-900 font-bold border-t border-emerald-300 pt-1.5">
                    Routed Facility: <span className="underline font-extrabold">{item.recommended_facility_type}</span>
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
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] w-full max-w-full overflow-x-hidden min-w-0">
      <form onSubmit={submit} className="panel p-3.5 sm:p-6 w-full max-w-full min-w-0" data-testid="intake-form">
        <div className="mb-3.5 sm:mb-4 flex items-center justify-between gap-4">
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
              callSession?.clearTranscripts?.();
              callSession?.stopManualRecording?.();
              try {
                localStorage.removeItem("ekms_scribe_sync");
              } catch (e) {}
              toast.info("Intake form, AI chat, and transcripts reset");
            }}
            className="shrink-0 rounded-md border border-border/70 p-2 text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:text-foreground"
            title="Reset form and AI chat"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Caller Demographic Fields - 2 in a row on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {callerFoundInfo && (
            <div className="col-span-2 sm:col-span-2 lg:col-span-4 flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-400 px-3 py-1.5 text-xs text-emerald-950 font-bold shadow-2xs">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>
                  Returning IP Caller: <strong>{callerFoundInfo.caller_name}</strong>
                  {callerFoundInfo.age ? ` (${callerFoundInfo.age}y, ${callerFoundInfo.sex})` : ""}
                  {(callerFoundInfo.city || callerFoundInfo.district) ? ` • ${callerFoundInfo.city || callerFoundInfo.district}` : ""}
                </span>
              </div>
              {callerFoundInfo.last_case_ref && (
                <span className="font-mono text-[11px] text-emerald-800 hidden sm:inline font-bold">
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
              placeholder="Akash Gupta"
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
              placeholder="987XXXXXXX"
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
              placeholder="45"
            />
          </Field>
          <Field label="Sex">
            <select
              data-testid="intake-form-sex"
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

        {/* 2. Location Fields - 2 in a row on mobile */}
        <div className="mt-2.5 sm:mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
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
          <Field label="Pincode" className="col-span-2 sm:col-span-1">
            <input
              data-testid="intake-form-pincode"
              className={inputCls}
              value={form.pincode}
              onChange={set("pincode")}
              placeholder="781005"
              maxLength={6}
            />
          </Field>
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
            onReadyToShowResult={(tState) => {
              setActiveRightTab("triage");
            }}
            onRunTriage={(overrideCtx) => {
              submit({ preventDefault: () => {} }, overrideCtx);
            }}
          />
        </div>

        {/* Run Triage CTA */}
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

        {/* Desktop Caller Consultation History - rendered only on desktop (lg and above) inside the form */}
        {callerHistory && callerHistory.length > 0 && (
          <div className="hidden lg:block mt-6 border-t border-border/70 pt-5">
            {renderHistoryContent()}
          </div>
        )}
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

        const currentRightView = activeRightTab || "scribe";

        return (
          <div ref={outcomeRef} className="flex flex-col w-full min-w-0 scroll-mt-16">
            {/* Always visible tab toggle bar so agent can access Call Transcript & Triage Outcome at any time */}
            <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/50 p-1 text-xs">
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
                  Triage Outcome {result ? "✓" : ""}
                </button>
              </div>

              {isCallActive && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-950 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                  Call Live
                </span>
              )}
            </div>

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
                transcribeMode={callSession?.transcribeMode || "live_call"}
                onTranscribeModeChange={callSession?.setTranscribeMode}
                currentManualSpeaker={callSession?.currentManualSpeaker || "caller"}
                onManualSpeakerToggle={callSession?.toggleManualSpeaker}
                onClearTranscripts={callSession?.clearTranscripts}
                isManualRecording={callSession?.isManualRecording || false}
                onStartManualRecording={callSession?.startManualRecording}
                onStopManualRecording={callSession?.stopManualRecording}
              />
            ) : (
              <TriageResultPanel result={result} loading={loading} callerIntake={form} />
            )}

            {/* Mobile Caller Consultation History - rendered AFTER Triage Outcome / Call Transcript on mobile (< lg) */}
            {callerHistory && callerHistory.length > 0 && (
              <div className="block lg:hidden mt-5 panel p-3.5 sm:p-5 w-full">
                {renderHistoryContent()}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
