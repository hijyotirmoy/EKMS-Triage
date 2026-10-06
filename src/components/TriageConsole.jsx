"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { broadcastEvent } from "../lib/broadcastSync";
import { appendCaseToLocalCache, getCachedCases } from "../lib/clientCache";
import { getCallerIdForPhone } from "../lib/callerId";

const EMPTY = {
  caller_name: "",
  phone: "",
  caller_id: "",
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
  const [activeDirective, setActiveDirective] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState("triage"); // 'triage' | 'scribe' - Default to Triage Outcome tab open on the left
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

  const activeCallerId = useMemo(() => {
    return form.caller_id || callerFoundInfo?.caller_id || getCallerIdForPhone(form.phone, callerHistory);
  }, [form.caller_id, form.phone, callerFoundInfo, callerHistory]);

  const hasClearedOnMountRef = useRef(false);

  // On page load / refresh: clear manual room transcripts once on initial load
  useEffect(() => {
    if (!hasClearedOnMountRef.current && callSession?.clearTranscripts) {
      hasClearedOnMountRef.current = true;
      callSession.clearTranscripts();
      callSession.stopManualRecording?.();
    }
  }, [callSession?.clearTranscripts]);

  // 1. Session Storage persistence: restore state on initial mount so refreshing inside triage preserves data
  const hasRestoredSessionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasRestoredSessionRef.current) return;
    hasRestoredSessionRef.current = true;
    try {
      const stored = sessionStorage.getItem("ekms_active_triage_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.form && (parsed.form.phone || parsed.form.caller_name || parsed.form.symptom_notes)) {
          if (parsed.form.caller_name === "." || parsed.form.caller_name === "'") parsed.form.caller_name = "";
          if (parsed.form.pincode === "Kamrup Metro" || parsed.form.pincode === ".") parsed.form.pincode = "";
          setForm(parsed.form);
        }
        if (parsed.result) {
          const res = parsed.result;
          const caseTarget = res.case_ref || res.case_id || res.id;
          if (caseTarget && !res.is_forwarded) {
            try {
              const forwardStored = sessionStorage.getItem(`ekms_forwarded_${caseTarget}`) || localStorage.getItem(`ekms_forwarded_${caseTarget}`);
              if (forwardStored) {
                const fParsed = JSON.parse(forwardStored);
                if (fParsed.is_forwarded) {
                  res.is_forwarded = true;
                  res.forwarded_at = fParsed.forwarded_at;
                  res.dispatch_id = fParsed.dispatch_id;
                  res.forwarded_to = fParsed.forwarded_to;
                  res.forwarded_short_name = fParsed.forwarded_short_name;
                  res.status = "forwarded";
                  res.dispatch_info = fParsed.dispatch_info;
                }
              }
            } catch (e) {}
          }
          setResult(res);
        }
        if (parsed.callerFoundInfo) {
          const storedPhone10 = (parsed.callerFoundInfo.phone || "").replace(/\D/g, "").slice(-10);
          const formPhone10 = (parsed.form?.phone || "").replace(/\D/g, "").slice(-10);
          if (storedPhone10.length === 10 && storedPhone10 === formPhone10) {
            setCallerFoundInfo(parsed.callerFoundInfo);
            if (Array.isArray(parsed.callerHistory) && parsed.callerHistory.length > 0) {
              setCallerHistory(parsed.callerHistory);
            }
          } else {
            setCallerFoundInfo(null);
            setCallerHistory([]);
          }
        }
        if (parsed.activeDirective) {
          setActiveDirective(parsed.activeDirective);
        }
        if (parsed.ekmsContext) {
          setEkmsContext(parsed.ekmsContext);
        }
      }
    } catch (e) {
      console.warn("Could not restore triage session from storage:", e);
    }
  }, []);

  // 2. Save active state to sessionStorage on changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sessionData = {
        form,
        result,
        callerHistory,
        callerFoundInfo,
        activeDirective,
        ekmsContext,
      };
      sessionStorage.setItem("ekms_active_triage_session", JSON.stringify(sessionData));
    } catch (e) {}
  }, [form, result, callerHistory, callerFoundInfo, activeDirective, ekmsContext]);

  // 3. Auto-save intake draft to database on beforeunload / refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cleanPhone = String(form.phone || "").replace(/\D/g, "");
      if (cleanPhone.length >= 10 && (form.caller_name || form.symptom_notes)) {
        const draftPayload = JSON.stringify({
          phone: form.phone,
          caller_name: form.caller_name || "Caller",
          age: form.age ? Number(form.age) : null,
          sex: form.sex || null,
          symptom_notes: form.symptom_notes || "Triage consultation intake",
          duration: form.duration || null,
          severity_reported: Number(form.severity_reported) || 5,
          city: form.city || null,
          district: form.district || null,
          pincode: form.pincode || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          ekms_ai_context: ekmsContext,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/caller/draft", new Blob([draftPayload], { type: "application/json" }));
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form, ekmsContext]);

  // Caller history lookup by phone number - works directly without needing browser refresh
  const lookupCaller = useCallback(async (phoneNumber, force = false) => {
    if (!phoneNumber) {
      setCallerFoundInfo(null);
      setCallerHistory([]);
      return;
    }
    const clean = String(phoneNumber).replace(/\D/g, "");
    const query = clean.length >= 10 ? clean.slice(-10) : "";
    if (query.length !== 10) {
      setCallerFoundInfo(null);
      setCallerHistory([]);
      lastLookedUpRef.current = "";
      return;
    }
    if (!force && lastLookedUpRef.current === query) return;

    lastLookedUpRef.current = query;
    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/caller/lookup?phone=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.found && data.caller) {
        const c = data.caller;
        const cleanCallerName = (c.caller_name && c.caller_name.trim() !== "." && c.caller_name.trim() !== "'") ? c.caller_name : "";
        const resolvedCid = c.caller_id || getCallerIdForPhone(query, data.history);
        c.caller_id = resolvedCid;
        // Known caller: populate THIS caller's stored data and history
        setForm((f) => ({
          ...f,
          phone: phoneNumber,
          caller_id: resolvedCid,
          caller_name: cleanCallerName || f.caller_name || "",
          age: c.age ? String(c.age) : (f.age || ""),
          sex: c.sex || f.sex || "",
          city: c.city || f.city || "",
          district: c.district || f.district || "",
          pincode: (c.pincode && c.pincode !== "Kamrup Metro") ? c.pincode : (f.pincode || ""),
          latitude: c.latitude ? String(c.latitude) : (f.latitude || ""),
          longitude: c.longitude ? String(c.longitude) : (f.longitude || ""),
        }));
        setCallerFoundInfo(c);
        if (data.history && Array.isArray(data.history)) {
          setCallerHistory(data.history);
        } else {
          setCallerHistory([]);
        }
        toast.success(
          `Record found for ${cleanCallerName || phoneNumber}: Details & history loaded.`
        );
      } else {
        // Fallback: Check local cache ONLY with strict 10-digit exact match
        const localCases = getCachedCases();
        const matches = localCases.filter((item) => {
          const rawIp = String(item.intake?.phone || "").replace(/\D/g, "");
          const ip10 = rawIp.length >= 10 ? rawIp.slice(-10) : "";
          return ip10.length === 10 && ip10 === query;
        });

        if (matches.length > 0) {
          const latestLocal = matches[0];
          const intake = latestLocal.intake || {};
          const cleanCallerName = (intake.caller_name && intake.caller_name.trim() !== "." && intake.caller_name.trim() !== "'") ? intake.caller_name : "";
          const resolvedCid = latestLocal.caller_id || latestLocal.intake?.caller_id || getCallerIdForPhone(query, matches);
          const callerInfo = {
            caller_name: cleanCallerName,
            phone: intake.phone || phoneNumber,
            caller_id: resolvedCid,
            age: intake.age != null && String(intake.age).trim() !== "." ? String(intake.age) : "",
            sex: intake.sex && intake.sex !== "." ? intake.sex : "",
            city: intake.city && intake.city !== "." ? intake.city : "",
            district: intake.district && intake.district !== "." ? intake.district : "",
            pincode: intake.pincode && intake.pincode !== "Kamrup Metro" ? intake.pincode : "",
            last_case_ref: latestLocal.case_ref || "",
            case_count: matches.length,
          };
          setForm((f) => ({
            ...f,
            phone: phoneNumber,
            caller_id: resolvedCid,
            caller_name: cleanCallerName || f.caller_name || "",
            age: callerInfo.age || f.age || "",
            sex: callerInfo.sex || f.sex || "",
            city: callerInfo.city || f.city || "",
            district: callerInfo.district || f.district || "",
            pincode: callerInfo.pincode || f.pincode || "",
            latitude: intake.latitude ? String(intake.latitude) : (f.latitude || ""),
            longitude: intake.longitude ? String(intake.longitude) : (f.longitude || ""),
          }));
          setCallerFoundInfo(callerInfo);
          setCallerHistory(
            matches.map((c) => ({
              case_ref: c.case_ref || "",
              caller_id: c.caller_id || c.intake?.caller_id || resolvedCid,
              created_at: c.created_at || "",
              caller_name: c.intake?.caller_name || "",
              chief_complaint: c.triage?.primary_complaint || c.intake?.symptom_notes || c.triage?.summary_en || "",
              reason: c.intake?.symptom_notes || c.triage?.summary_en || "",
              summary: c.triage?.summary_en || "",
              red_flags: Array.isArray(c.triage?.red_flags) && c.triage.red_flags.length > 0
                ? c.triage.red_flags
                : (c.ekms_ai_context?.triageState?.redFlagsDetected || []),
              urgency_level: c.triage?.urgency_level || "Routine",
              urgency_score: c.triage?.urgency_score || 0,
              navigation: c.triage?.recommended_action || c.triage?.recommended_facility_type || "",
              recommended_action: c.triage?.recommended_action || "",
              recommended_facility_type: c.triage?.recommended_facility_type || "",
            }))
          );
          toast.success(
            `Record found for ${cleanCallerName || phoneNumber}: Details loaded.`
          );
        } else {
          // Brand New Number: Clear all previous returning caller state completely!
          const newCid = data?.caller_id || getCallerIdForPhone(query);
          setCallerFoundInfo(null);
          setCallerHistory([]);
          setHistoryPage(1);
          setForm((f) => ({
            ...f,
            phone: phoneNumber,
            caller_id: newCid,
            caller_name: f.caller_name === "." ? "" : f.caller_name,
            pincode: f.pincode === "Kamrup Metro" ? "" : f.pincode,
          }));
          toast.info(
            `New number (${phoneNumber}): Please fill caller details.`
          );
        }
      }
    } catch (err) {
      console.warn("Caller lookup error:", err);
      setCallerFoundInfo(null);
      setCallerHistory([]);
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
        const stored = sessionStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          rawAgent = parsed?.agentId;
        }
      } catch (e) {}
    }
    const rawUpper = String(rawAgent || "").toUpperCase();
    const agentCode = rawUpper.includes("ADMIN 1") || rawUpper.includes("ADMIN1") || rawUpper === "AD1"
      ? "AD1"
      : rawUpper.includes("ADMIN 2") || rawUpper.includes("ADMIN2") || rawUpper === "AD2"
      ? "AD2"
      : rawUpper.includes("3")
      ? "A3"
      : rawUpper.includes("2")
      ? "A2"
      : "A1";

    let ipGeo = null;
    try {
      const cached = sessionStorage.getItem("ekms_agent_geo_telemetry");
      if (cached) ipGeo = JSON.parse(cached);
    } catch (e) {}

    const payload = {
      ...form,
      caller_id: activeCallerId,
      agent_id: agentCode,
      symptom_notes: compiledNotes,
      age: form.age === "" ? null : Number(form.age),
      severity_reported: Number(form.severity_reported),
      latitude: form.latitude !== "" && form.latitude != null ? Number(form.latitude) : null,
      longitude: form.longitude !== "" && form.longitude != null ? Number(form.longitude) : null,
      district: form.district ? String(form.district).trim() : null,
      pincode: form.pincode ? String(form.pincode).trim() : null,
      city: form.city ? String(form.city).trim() : null,
      ekms_ai_context: activeContext,
      source_app: "console",
    };
    Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
    try {
      const { data } = await api.post("/triage", payload);
      setResult(data);
      setActiveRightTab("triage");
      
      // Update local storage cache & broadcast to other tabs instantly without extra Firestore reads
      const finalCallerId = data.caller_id || activeCallerId;
      const caseRecord = {
        id: data.case_id || data.case_ref,
        case_ref: data.case_ref,
        caller_id: finalCallerId,
        agent_id: data.agent_id || agentCode,
        intake: {
          ...(data.intake || payload),
          caller_id: finalCallerId,
        },
        triage: data.triage,
        resolved_location: data.resolved_location,
        nearest_facilities: data.nearest_facilities,
        ekms_ai_context: data.ekms_ai_context || activeContext,
        created_at: new Date().toISOString(),
      };
      appendCaseToLocalCache(caseRecord);
      broadcastEvent("NEW_CASE", caseRecord);

      onCaseCreated?.();
      toast.success(`${data.triage.urgency_level} — ${finalCallerId || data.case_ref}`);
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
                  <span className="mono text-[11px] text-primary/80 font-bold">
                    {item.caller_id || activeCallerId || item.case_ref}
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
              try {
                sessionStorage.removeItem("ekms_active_triage_session");
              } catch (e) {}
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
              {(callerFoundInfo.caller_id || activeCallerId) ? (
                <span className="font-mono text-[11px] text-emerald-800 hidden sm:inline font-bold">
                  Caller ID: {callerFoundInfo.caller_id || activeCallerId}
                </span>
              ) : callerFoundInfo.last_case_ref && (
                <span className="font-mono text-[11px] text-emerald-800 hidden sm:inline font-bold">
                  Caller ID: {activeCallerId}
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
                const digits = val.replace(/\D/g, "");
                const autoCid = digits.length === 10 ? getCallerIdForPhone(digits, callerHistory) : "";
                setForm((f) => ({ ...f, phone: val, caller_id: autoCid || f.caller_id }));
                if (digits.length !== 10) {
                  if (callerFoundInfo) setCallerFoundInfo(null);
                  if (callerHistory.length > 0) setCallerHistory([]);
                  lastLookedUpRef.current = "";
                } else {
                  lookupCaller(val, true);
                }
              }}
              onBlur={() => {
                const digits = (form.phone || "").replace(/\D/g, "");
                if (digits.length === 10) {
                  lookupCaller(form.phone, true);
                } else {
                  setCallerFoundInfo(null);
                  setCallerHistory([]);
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

        {/* 2. Caller ID & Location Fields - 4 in a row on desktop */}
        <div className="mt-2.5 sm:mt-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Field label="Caller ID">
            <input
              data-testid="intake-form-caller-id"
              readOnly
              className={`${inputCls} font-mono font-bold bg-muted/40 cursor-default ${
                activeCallerId ? "text-primary dark:text-primary-foreground" : "text-muted-foreground"
              }`}
              value={activeCallerId || "Pending phone..."}
              placeholder="e.g. CID0001K102"
              title="Unique permanent Caller ID assigned to this phone number"
            />
          </Field>
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
              placeholder="e.g. 781022"
              maxLength={6}
            />
          </Field>
        </div>

        {/* 3. Complaint Notes & Adaptive Questioning */}
        <div className="mt-4">
          <label className="field-label mb-2 block">Complaint Notes &amp; Adaptive Questioning</label>
          <EkmsAiChatArea
            ref={chatRef}
            currentAgent={currentAgent}
            initialNotes={chatPresetTrigger}
            triageResult={result}
            activeDirective={activeDirective}
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

        const currentRightView = activeRightTab || "triage";

        return (
          <div ref={outcomeRef} className="flex flex-col w-full min-w-0 scroll-mt-16">
            {/* Always visible tab toggle bar: Triage Outcome on the left (default), Call Transcript on the right */}
            <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
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
                  Triage Outcome {result ? "✓" : ""}
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
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-950 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                  Call Live
                </span>
              )}
            </div>

            {currentRightView === "scribe" ? (
              <LiveScribeWindow
                currentAgent={currentAgent}
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
              <TriageResultPanel
                result={result}
                loading={loading}
                callerIntake={form}
                currentAgent={currentAgent}
                onDirectiveChange={setActiveDirective}
                callerHistory={callerHistory}
                onForwardSuccess={(statusData) => {
                  setResult((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      is_forwarded: true,
                      forwarded_at: statusData?.timestamp || new Date().toISOString(),
                      dispatch_id: statusData?.dispatchId,
                      forwarded_to: statusData?.teamName,
                      forwarded_short_name: statusData?.shortName,
                      status: "forwarded",
                      dispatch_info: statusData,
                    };
                  });
                }}
                onUpdatePincode={(newPin) => {
                  if (newPin) {
                    setForm((f) => ({ ...f, pincode: newPin }));
                  }
                }}
              />
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
