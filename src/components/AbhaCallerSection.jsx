"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  ShieldCheck,
  History,
  Lock,
  QrCode,
  FileText,
  Plus,
  Pill,
  CheckCircle2,
  CalendarClock,
  Clock,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  Loader2,
  Trash2,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  User,
  HeartPulse,
  Activity,
  FileCheck,
  Building2,
  Stethoscope,
  Send,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { UrgencyBadge } from "./UrgencyBadge";

export const AbhaCallerSection = ({
  form,
  callerHistory = [],
  currentAgent,
  activeCallerId,
}) => {
  // Main switch tab: 'abha' | 'history'
  const [activeMainTab, setActiveMainTab] = useState("abha");

  // ABHA sub-tab: 'records' | 'prescription'
  const [activeAbhaSubTab, setActiveAbhaSubTab] = useState("records");

  // ABHA State
  const [abhaProfile, setAbhaProfile] = useState(null);
  const [isAbhaLoading, setIsAbhaLoading] = useState(false);
  const [otpStep, setOtpStep] = useState("idle"); // 'idle' | 'otp_sent' | 'verifying'
  const [enteredOtp, setEnteredOtp] = useState("");
  const [demoOtpCode, setDemoOtpCode] = useState("839201");
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpTxnId, setOtpTxnId] = useState("");
  const [smsDispatchedInfo, setSmsDispatchedInfo] = useState(null);

  // Prescription Form State
  const [doctorName, setDoctorName] = useState(
    currentAgent?.name
      ? `Dr. ${currentAgent.name} (Triage MO)`
      : "Dr. B. K. Sarma, MD (Reg: AMC-18492)"
  );
  const [doctorReg, setDoctorReg] = useState("NMC-IND-994102");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescAdvice, setPrescAdvice] = useState(
    "Drink warm water, take light meals, ensure adequate rest, and visit nearest PHC/hospital if symptoms aggravate."
  );
  const [medications, setMedications] = useState([
    {
      name: "Tab. Paracetamol 650mg",
      dosage: "1 Tab",
      frequency: "1-0-1 (BID)",
      duration: "3 Days",
      instructions: "After meals",
    },
    {
      name: "Tab. Levocetirizine 5mg",
      dosage: "1 Tab",
      frequency: "0-0-1 (Night)",
      duration: "5 Days",
      instructions: "After food",
    },
  ]);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [lastSavedPrescription, setLastSavedPrescription] = useState(null);

  // Pagination for Call History
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;

  const phoneDigits = useMemo(() => {
    return (form.phone || "").replace(/\D/g, "");
  }, [form.phone]);

  // Synchronize diagnosis with symptom notes when available
  useEffect(() => {
    if (form.symptom_notes && !diagnosis) {
      const summary = form.symptom_notes.split("\n")[0].slice(0, 80);
      setDiagnosis(summary || "Acute Clinical Consultation");
    }
  }, [form.symptom_notes, diagnosis]);

  // Load persistent ABHA profile for this phone from localStorage and server
  useEffect(() => {
    if (!phoneDigits || phoneDigits.length !== 10) {
      setAbhaProfile(null);
      setOtpStep("idle");
      return;
    }

    // 1. Check client local cache
    try {
      const cachedStore = localStorage.getItem(`abha_cache_${phoneDigits}`);
      if (cachedStore) {
        const parsed = JSON.parse(cachedStore);
        setAbhaProfile(parsed);
      }
    } catch (e) {}

    // 2. Fetch from backend API
    const fetchAbha = async () => {
      try {
        setIsAbhaLoading(true);
        const res = await fetch(`/api/abha?phone=${phoneDigits}`);
        const data = await res.json();
        if (data?.profile) {
          setAbhaProfile(data.profile);
          try {
            localStorage.setItem(`abha_cache_${phoneDigits}`, JSON.stringify(data.profile));
          } catch (e) {}
        }
      } catch (err) {
        console.error("Error fetching ABHA profile:", err);
      } finally {
        setIsAbhaLoading(false);
      }
    };

    fetchAbha();
  }, [phoneDigits]);

  // Countdown timer for OTP
  useEffect(() => {
    let interval = null;
    if (otpStep === "otp_sent" && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, otpTimer]);

  // Action: Request OTP
  const handleSendOtp = async () => {
    if (!phoneDigits || phoneDigits.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number in the intake form first.");
      return;
    }

    try {
      setIsAbhaLoading(true);
      const res = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_otp",
          phone: phoneDigits,
          caller_name: form.caller_name || "Caller",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setOtpTxnId(data.txn_id || "");
      setDemoOtpCode(data.demo_otp || "839201");
      setSmsDispatchedInfo({
        sent: data.real_sms_dispatched,
        provider: data.sms_provider,
        message: data.message,
      });
      setOtpStep("otp_sent");
      setOtpTimer(60);
      toast.success(
        data.real_sms_dispatched
          ? `Real SMS OTP sent to +91 ${phoneDigits} via ${data.sms_provider}`
          : data.message || `OTP generated for +91 ${phoneDigits}`
      );
    } catch (err) {
      toast.error(err.message || "Failed to send ABDM OTP. Please try again.");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  // Action: Verify OTP & Link ABHA
  const handleVerifyOtp = async () => {
    if (!enteredOtp || enteredOtp.trim().length < 6) {
      toast.error("Please enter the 6-digit verification OTP.");
      return;
    }

    try {
      setIsAbhaLoading(true);
      const res = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          phone: phoneDigits,
          otp: enteredOtp.trim(),
          txn_id: otpTxnId,
          caller_name: form.caller_name,
          age: form.age,
          sex: form.sex,
          district: form.district,
          pincode: form.pincode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP verification failed");

      setAbhaProfile(data.profile);
      setOtpStep("idle");
      setEnteredOtp("");
      try {
        localStorage.setItem(`abha_cache_${phoneDigits}`, JSON.stringify(data.profile));
      } catch (e) {}

      toast.success(`ABHA ID Linked: ${data.profile.abha_address}`);
    } catch (err) {
      toast.error(err.message || "Failed to verify OTP.");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  // Action: Unlink ABHA
  const handleUnlink = async () => {
    try {
      await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink", phone: phoneDigits }),
      });
    } catch (e) {}
    try {
      localStorage.removeItem(`abha_cache_${phoneDigits}`);
    } catch (e) {}
    setAbhaProfile(null);
    setOtpStep("idle");
    setEnteredOtp("");
    toast.info("ABHA profile unlinked for this phone session.");
  };

  // Medication row management
  const handleAddMedication = () => {
    setMedications((prev) => [
      ...prev,
      {
        name: "",
        dosage: "1 Tab",
        frequency: "1-0-1 (BID)",
        duration: "5 Days",
        instructions: "After meals",
      },
    ]);
  };

  const handleRemoveMedication = (index) => {
    setMedications((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMedication = (index, field, value) => {
    setMedications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Action: Push Prescription to ABHA
  const handleSavePrescription = async (e) => {
    e?.preventDefault?.();

    const targetPhone = phoneDigits || abhaProfile?.phone;
    if (!targetPhone) {
      toast.error("Caller phone number is required to link prescription.");
      return;
    }

    const validMeds = medications.filter((m) => m.name && m.name.trim());
    if (validMeds.length === 0) {
      toast.error("Please enter at least one medication name.");
      return;
    }

    const activeDiagnosis =
      diagnosis?.trim() ||
      form.symptom_notes?.trim() ||
      "Acute Clinical Consultation / Symptom Review";

    try {
      setIsSavingPrescription(true);
      const res = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_prescription",
          phone: targetPhone,
          caller_name: form.caller_name || abhaProfile?.name || "Patient",
          age: form.age || abhaProfile?.age || "35",
          sex: form.sex || abhaProfile?.sex || "Male",
          district: form.district || abhaProfile?.district || "Kamrup Metropolitan",
          doctor_name: doctorName || "Medical Officer (104 Tele-Triage)",
          doctor_reg: doctorReg || "MCI-NHA-99410",
          diagnosis: activeDiagnosis,
          medications: validMeds,
          advice:
            prescAdvice ||
            "Drink warm water, take light meals, ensure adequate rest, and visit nearest PHC/hospital if symptoms aggravate.",
          chief_complaint: form.symptom_notes,
          facility_name: "Assam 104 Tele-Triage & Health Helpline",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to push prescription");

      setLastSavedPrescription(data.prescription);

      // Refresh local ABHA state
      setAbhaProfile((prev) => {
        const base = prev || {};
        const prevHistory = base.medical_history || {};
        const updated = {
          ...base,
          medical_history: {
            ...prevHistory,
            past_prescriptions: [
              data.prescription,
              ...(prevHistory.past_prescriptions || []),
            ],
          },
        };
        try {
          localStorage.setItem(`abha_cache_${targetPhone}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      toast.success(
        `Prescription linked to ABHA ID (${data.prescription.id}) Care Context: ${data.care_context_id}`
      );
      setActiveAbhaSubTab("records");
    } catch (err) {
      toast.error(err.message || "Failed to push prescription to ABHA.");
    } finally {
      setIsSavingPrescription(false);
    }
  };

  // Print ABHA Prescription
  const handlePrintPrescription = (rx) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print prescription.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>ABDM e-Prescription - ${rx.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #ecfdf5; color: #047857; border: 1px solid #10b981; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            .advice-box { margin-top: 16px; background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px; font-size: 12px; }
            .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 style="margin: 0; color: #0f172a; font-size: 18px;">AYUSHMAN BHARAT DIGITAL MISSION (ABDM)</h2>
              <p style="margin: 2px 0 0; font-size: 12px; color: #475569;">Official e-Prescription & Care Context Record</p>
            </div>
            <span class="badge">FHIR R4 COMPLIANT</span>
          </div>

          <div class="meta-grid">
            <div><strong>Patient Name:</strong> ${abhaProfile?.name || form.caller_name || "Patient"}</div>
            <div><strong>ABHA Address:</strong> ${abhaProfile?.abha_address || "N/A"}</div>
            <div><strong>ABHA Number:</strong> ${abhaProfile?.abha_number || "N/A"}</div>
            <div><strong>Phone:</strong> +91 ${phoneDigits}</div>
            <div><strong>Prescribed By:</strong> ${rx.prescribed_by || doctorName}</div>
            <div><strong>Registration No:</strong> ${rx.doctor_reg || doctorReg}</div>
            <div><strong>Date & Time:</strong> ${rx.date} ${rx.timestamp ? "(" + new Date(rx.timestamp).toLocaleTimeString() + ")" : ""}</div>
            <div><strong>Care Context ID:</strong> ${rx.care_context_id || "CC-ABDM-001"}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <strong style="font-size: 13px; color: #0f172a;">Clinical Diagnosis:</strong>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;">${rx.diagnosis || "Acute Clinical Consultation"}</p>
          </div>

          <strong style="font-size: 13px; color: #0f172a;">Rx Medications:</strong>
          <table>
            <thead>
              <tr>
                <th style="width: 35%;">Medicine Name</th>
                <th style="width: 15%;">Dosage</th>
                <th style="width: 20%;">Frequency</th>
                <th style="width: 15%;">Duration</th>
                <th style="width: 15%;">Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${(rx.medications || [])
                .map(
                  (m) => `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.dosage}</td>
                  <td>${m.frequency}</td>
                  <td>${m.duration}</td>
                  <td>${m.instructions}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>

          <div class="advice-box">
            <strong>Dietary & Clinical Advice:</strong>
            <p style="margin: 4px 0 0;">${rx.advice || "Adequate rest and hydration."}</p>
          </div>

          <div class="footer">
            <div>Electronically signed and verified via ABDM Gateway</div>
            <div>Prescribing Facility: 104 Health Helpline & Tele-Triage</div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Render normal call history
  const renderNormalCallHistory = () => {
    if (!callerHistory || callerHistory.length === 0) {
      return (
        <div className="rounded-lg border border-border/70 bg-card/60 p-8 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
          <h4 className="text-sm font-bold text-foreground">No Call History Found</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {phoneDigits
              ? `No prior triage calls recorded under +91 ${phoneDigits}. Connected calls and submitted triages will appear here automatically.`
              : "Enter a phone number in the caller intake form to view previous call logs."}
          </p>
        </div>
      );
    }

    const totalPages = Math.ceil(callerHistory.length / HISTORY_PER_PAGE) || 1;
    const currentPage = Math.min(Math.max(1, historyPage), totalPages);
    const paginated = callerHistory.slice(
      (currentPage - 1) * HISTORY_PER_PAGE,
      currentPage * HISTORY_PER_PAGE
    );

    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-foreground">
              Caller Call History ({callerHistory.length}{" "}
              {callerHistory.length === 1 ? "call" : "calls"} recorded)
            </h3>
          </div>
          {phoneDigits && (
            <span className="mono text-[11px] text-muted-foreground font-semibold">
              +91 {phoneDigits}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {paginated.map((item, idx) => (
            <div
              key={item.id ? `hist_${item.id}_${idx}` : `${item.case_ref || "hist"}_${idx}`}
              className="rounded-lg border border-border/70 bg-card p-3 sm:p-4 shadow-2xs transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      {(item.created_at || item.createdAt || item.timestamp)
                        ? new Date(item.created_at || item.createdAt || item.timestamp).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Recent call"}
                    </span>
                  </div>
                  <span className="mono text-[11px] text-primary/80 font-bold">
                    {item.case_ref || item.caseId || item.case_id || (item.caller_id && !item.caller_id.match(/^\d{6}-\d{5}$/) ? item.caller_id : "") || (item.id && String(item.id).startsWith("CA") ? item.id : "") || (activeCallerId && !activeCallerId.match(/^\d{6}-\d{5}$/) ? activeCallerId : "") || "Case"}
                  </span>
                </div>
                <UrgencyBadge level={item.urgency_level || item.urgency || "ROUTINE"} score={item.urgency_score ?? 4} size="sm" />
              </div>

              <div className="mt-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reason for Call / Symptoms
                </p>
                <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed font-medium">
                  {item.reason || item.summary || item.notes || item.campaign || "Inbound consultation"}
                </p>
              </div>

              <div className="mt-2.5 rounded-md bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300/80 dark:border-emerald-800 p-2.5 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                  <Navigation className="h-3 w-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>Navigation Provided by Agent</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200 leading-relaxed">
                  {item.navigation || item.recommended_action || item.category || "Standard consultation / triage guidance"}
                </p>
                {item.recommended_facility_type && (
                  <p className="mt-1 text-[11px] text-emerald-900 dark:text-emerald-300 font-bold border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1">
                    Routed Facility:{" "}
                    <span className="underline font-extrabold">
                      {item.recommended_facility_type}
                    </span>
                    {item.nearest_facility ? ` (${item.nearest_facility})` : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-muted-foreground">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
      {/* Top Main Switch Tabs: [1] ABHA Health Locker | [2] Call History */}
      <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-3 pt-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          {/* TAB 1: ABHA */}
          <button
            type="button"
            onClick={() => setActiveMainTab("abha")}
            className={`relative flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-150 ${
              activeMainTab === "abha"
                ? "bg-card text-emerald-700 dark:text-emerald-400 border-t-2 border-emerald-600 shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>ABHA Health Record</span>
            {abhaProfile ? (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Linked" />
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-semibold text-muted-foreground">
                ABDM
              </span>
            )}
          </button>

          {/* TAB 2: CALL HISTORY */}
          <button
            type="button"
            onClick={() => setActiveMainTab("history")}
            className={`relative flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-150 ${
              activeMainTab === "history"
                ? "bg-card text-primary border-t-2 border-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <History className="h-4 w-4 text-primary shrink-0" />
            <span>Normal Call History</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
              {callerHistory.length}
            </span>
          </button>
        </div>

        {/* Status Chip on the Right */}
        <div className="hidden sm:flex items-center gap-2 pb-2">
          {activeMainTab === "abha" && abhaProfile && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <BadgeCheck className="h-3 w-3 text-emerald-600" />
              KYC Active
            </span>
          )}
        </div>
      </div>

      {/* Main Tab Content Body */}
      <div className="p-3.5 sm:p-5">
        {/* ======================= TAB 1: ABHA ======================= */}
        {activeMainTab === "abha" && (
          <div className="space-y-4">
            {/* Case A: No Phone entered in intake */}
            {(!phoneDigits || phoneDigits.length !== 10) && (
              <div className="rounded-lg border border-dashed border-border/80 bg-secondary/20 p-6 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <h4 className="text-sm font-bold text-foreground">Caller Phone Required</h4>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Please enter a valid 10-digit caller phone number in the intake form above to look up or verify their Ayushman Bharat Health Account (ABHA).
                </p>
              </div>
            )}

            {/* Case B: Phone entered, but NOT verified/linked yet */}
            {phoneDigits && phoneDigits.length === 10 && !abhaProfile && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-linear-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-emerald-900/40 pb-3.5">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          Ayushman Bharat Digital Mission (ABDM)
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        National Health Authority • Secure e-KYC &amp; Health Locker Gateway
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                    <Lock className="h-3 w-3 text-emerald-600" />
                    +91 {phoneDigits}
                  </div>
                </div>

                {/* OTP Drawer / Action */}
                {otpStep === "idle" ? (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-foreground/80 leading-relaxed max-w-lg">
                      Authenticate caller via Aadhaar / Mobile OTP to retrieve their historical hospital visits, lab reports, previous prescriptions, and push new digital prescriptions directly to their ABHA account.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isAbhaLoading}
                      className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
                    >
                      {isAbhaLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send ABDM Verification OTP
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-card p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-emerald-600" />
                        Enter 6-Digit OTP for +91 {phoneDigits}
                      </span>
                      {/* Dynamic OTP Helper Pill */}
                      <button
                        type="button"
                        onClick={() => setEnteredOtp(demoOtpCode)}
                        className="rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition"
                        title="Click to auto-fill generated OTP"
                      >
                        ⚡ Generated OTP: <span className="underline font-mono">{demoOtpCode}</span> (Auto-fill)
                      </button>
                    </div>

                    {/* Real SMS notification banner */}
                    {smsDispatchedInfo?.sent && (
                      <div className="flex items-center gap-2 rounded-md bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 p-2 text-xs text-emerald-900 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          Real SMS OTP delivered to <strong>+91 {phoneDigits}</strong> via <strong>{smsDispatchedInfo.provider}</strong>. Check your phone inbox!
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        value={enteredOtp}
                        onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="••••••"
                        className="w-full sm:w-48 rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-center text-sm font-mono tracking-widest font-bold text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-600"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isAbhaLoading || enteredOtp.length < 6}
                        className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isAbhaLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Verify &amp; Link ABHA
                      </button>

                      <button
                        type="button"
                        disabled={otpTimer > 0 || isAbhaLoading}
                        onClick={handleSendOtp}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 text-center sm:text-left"
                      >
                        {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend OTP"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Case C: ABHA Profile VERIFIED & LINKED */}
            {abhaProfile && (
              <div className="space-y-4">
                {/* 1. Official Government Digital ABHA Card */}
                <div className="relative overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-800 bg-linear-to-br from-emerald-50 via-card to-teal-50 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/30 p-4 sm:p-5 shadow-xs">
                  {/* Saffron / White / Green subtle tricolor top ribbon */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                    <div className="w-1/3 bg-[#FF9933]" />
                    <div className="w-1/3 bg-white" />
                    <div className="w-1/3 bg-[#138808]" />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                    {/* Left: Emblem, Profile Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-md border-2 border-white dark:border-emerald-900">
                        <User className="h-8 w-8 text-white/90" />
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white font-bold ring-2 ring-white">
                          ✓
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-foreground">
                            {abhaProfile.name}
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            Aadhaar KYC Verified
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                              ABHA Address
                            </span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              {abhaProfile.abha_address}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                              14-Digit ABHA Number
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              {abhaProfile.abha_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                              Demographics
                            </span>
                            <span className="text-muted-foreground font-medium">
                              {abhaProfile.age ? `${abhaProfile.age}y` : "Adult"} • {abhaProfile.sex} • {abhaProfile.district || "Assam"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: QR Code Visual & Actions */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 p-2 shadow-2xs">
                        <QrCode className="h-9 w-9 text-foreground/80 shrink-0" />
                        <div className="text-[9px] leading-tight text-muted-foreground font-mono">
                          <strong className="text-foreground block">ABDM QR</strong>
                          Scan for Health Record Token
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnlink}
                        className="rounded-md border border-border/80 p-2 text-muted-foreground hover:bg-secondary hover:text-red-600 transition"
                        title="Unlink ABHA Profile"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs: [Medical Records (HIU)] vs [+ Issue Prescription (HIP)] */}
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAbhaSubTab("records")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        activeAbhaSubTab === "records"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      Medical History &amp; Records
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAbhaSubTab("prescription")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        activeAbhaSubTab === "prescription"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      + Issue ABHA Prescription
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                    ABDM Care Contexts: {(abhaProfile.medical_history?.past_prescriptions || []).length + 2}
                  </span>
                </div>

                {/* Sub-Tab 1: Medical History Records (HIU) */}
                {activeAbhaSubTab === "records" && (
                  <div className="space-y-4">
                    {/* Allergies & Conditions summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Allergies */}
                      <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Known Allergies</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(abhaProfile.medical_history?.allergies || []).map((a, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300"
                            >
                              {a.allergen} ({a.severity})
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Chronic conditions */}
                      <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1.5">
                          <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                          <span>Chronic Conditions</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(abhaProfile.medical_history?.chronic_conditions || []).map((c, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:text-rose-300"
                            >
                              {c.condition} • {c.status}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Past Prescriptions list */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Pill className="h-3.5 w-3.5 text-emerald-600" />
                          Linked E-Prescriptions ({abhaProfile.medical_history?.past_prescriptions?.length || 0})
                        </h4>
                      </div>

                      {(abhaProfile.medical_history?.past_prescriptions || []).map((rx, idx) => (
                        <div
                          key={rx.id || idx}
                          className="rounded-lg border border-border/80 bg-card p-3.5 shadow-2xs space-y-2.5 hover:border-emerald-500/60 transition"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  {rx.id}
                                </span>
                                <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300">
                                  FHIR LINKED
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Prescribed by <strong>{rx.prescribed_by}</strong> ({rx.facility || "104 Triage"})
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {rx.date}
                              </span>
                              <button
                                type="button"
                                onClick={() => handlePrintPrescription(rx)}
                                className="flex items-center gap-1 rounded border border-border/70 bg-secondary/40 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                                title="Print / Download Rx Slip"
                              >
                                <Printer className="h-3 w-3" />
                                Print Rx
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                              Diagnosis
                            </span>
                            <p className="text-xs font-semibold text-foreground">
                              {rx.diagnosis}
                            </p>
                          </div>

                          {/* Medicines pill table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border border-border/60 rounded">
                              <thead className="bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase">
                                <tr>
                                  <th className="p-1.5">Medicine</th>
                                  <th className="p-1.5">Dosage</th>
                                  <th className="p-1.5">Frequency</th>
                                  <th className="p-1.5">Duration</th>
                                  <th className="p-1.5">Instructions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {(rx.medications || []).map((m, mIdx) => (
                                  <tr key={mIdx} className="hover:bg-muted/20">
                                    <td className="p-1.5 font-bold text-foreground">{m.name}</td>
                                    <td className="p-1.5 text-muted-foreground">{m.dosage}</td>
                                    <td className="p-1.5 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{m.frequency}</td>
                                    <td className="p-1.5 text-muted-foreground">{m.duration}</td>
                                    <td className="p-1.5 text-muted-foreground">{m.instructions}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {rx.advice && (
                            <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                              <strong>Advice:</strong> {rx.advice}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Past Hospital Encounters */}
                    <div className="space-y-2.5 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        Past Hospital Visits &amp; OPD Encounters ({abhaProfile.medical_history?.past_encounters?.length || 0})
                      </h4>

                      {(abhaProfile.medical_history?.past_encounters || []).map((enc) => (
                        <div
                          key={enc.id}
                          className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-xs text-foreground font-bold">
                              {enc.facility} • {enc.department}
                            </strong>
                            <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                              {enc.date}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/90 font-medium">
                            <span className="text-muted-foreground">Diagnosis: </span>
                            <strong>{enc.diagnosis}</strong>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {enc.summary} (Attending: {enc.doctor})
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Diagnostic Lab Reports */}
                    <div className="space-y-2.5 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-cyan-600" />
                        Diagnostic Lab Tests ({abhaProfile.medical_history?.lab_reports?.length || 0})
                      </h4>

                      {(abhaProfile.medical_history?.lab_reports || []).map((lab, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-xs text-foreground">{lab.test_name}</strong>
                            <span className="text-[11px] text-muted-foreground font-mono">{lab.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{lab.facility}</p>
                          <p className="text-xs font-medium text-foreground bg-muted/20 p-2 rounded border border-border/40">
                            {lab.results}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Tab 2: + Issue New E-Prescription (HIP) */}
                {activeAbhaSubTab === "prescription" && (
                  <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
                    <div className="border-b border-border/60 pb-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-emerald-600" />
                          Author ABHA Electronic Prescription (HIP Care Context)
                        </h4>
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                          FHIR R4 Format
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prescription will be digitally linked to caller ABHA ID <strong>{abhaProfile.abha_number}</strong>
                      </p>
                    </div>

                    {/* Doctor Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          Prescribing Medical Officer / Doctor
                        </label>
                        <input
                          type="text"
                          value={doctorName}
                          onChange={(e) => setDoctorName(e.target.value)}
                          className="w-full rounded-md border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs text-foreground outline-none focus:border-emerald-600 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          Medical Registration / NMC ID
                        </label>
                        <input
                          type="text"
                          value={doctorReg}
                          onChange={(e) => setDoctorReg(e.target.value)}
                          className="w-full rounded-md border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs text-foreground outline-none focus:border-emerald-600 font-mono"
                        />
                      </div>
                    </div>

                    {/* Clinical Diagnosis */}
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Clinical Diagnosis / Chief Complaint
                      </label>
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="e.g. Acute Viral Bronchitis, Fever with chills"
                        className="w-full rounded-md border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs text-foreground outline-none focus:border-emerald-600 font-semibold"
                      />
                    </div>

                    {/* Medications Table / Rows */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Pill className="h-3.5 w-3.5 text-emerald-600" />
                          Prescribed Medicines ({medications.length})
                        </label>
                        <button
                          type="button"
                          onClick={handleAddMedication}
                          className="flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-xs font-bold text-foreground hover:bg-secondary/80 transition"
                        >
                          <Plus className="h-3 w-3" /> Add Medicine
                        </button>
                      </div>

                      <div className="space-y-2">
                        {medications.map((med, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5"
                          >
                            <input
                              type="text"
                              placeholder="Medicine Name (e.g. Tab. Paracetamol 650mg)"
                              value={med.name}
                              onChange={(e) => handleUpdateMedication(idx, "name", e.target.value)}
                              className="flex-1 rounded border border-border/70 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-emerald-600"
                            />
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                              <input
                                type="text"
                                placeholder="Dosage (1 tab)"
                                value={med.dosage}
                                onChange={(e) => handleUpdateMedication(idx, "dosage", e.target.value)}
                                className="w-full sm:w-24 rounded border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                              />
                              <select
                                value={med.frequency}
                                onChange={(e) => handleUpdateMedication(idx, "frequency", e.target.value)}
                                className="w-full sm:w-28 rounded border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none font-semibold"
                              >
                                <option>1-0-1 (BID)</option>
                                <option>1-1-1 (TID)</option>
                                <option>1-0-0 (Morning)</option>
                                <option>0-0-1 (Night)</option>
                                <option>SOS (As Needed)</option>
                                <option>1-1-1-1 (QID)</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Duration (5 Days)"
                                value={med.duration}
                                onChange={(e) => handleUpdateMedication(idx, "duration", e.target.value)}
                                className="w-full sm:w-24 rounded border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                              />
                              <select
                                value={med.instructions}
                                onChange={(e) => handleUpdateMedication(idx, "instructions", e.target.value)}
                                className="w-full sm:w-28 rounded border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                              >
                                <option>After meals</option>
                                <option>Before food</option>
                                <option>With water</option>
                                <option>Empty stomach</option>
                              </select>
                              {medications.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedication(idx)}
                                  className="p-1.5 text-muted-foreground hover:text-red-500 transition col-span-2 sm:col-span-1 flex justify-center"
                                  title="Delete medication"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Advice */}
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Doctor Advice &amp; Follow-up Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={prescAdvice}
                        onChange={(e) => setPrescAdvice(e.target.value)}
                        className="w-full rounded-md border border-border/80 bg-secondary/40 p-2.5 text-xs text-foreground outline-none focus:border-emerald-600"
                        placeholder="Dietary instructions, rest, precautions..."
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3 text-emerald-600" />
                        Signed electronically via Ayushman Bharat Gateway
                      </span>
                      <button
                        type="button"
                        onClick={handleSavePrescription}
                        disabled={isSavingPrescription}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 disabled:opacity-60 cursor-pointer"
                      >
                        {isSavingPrescription ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Pushing to ABHA...
                          </>
                        ) : (
                          <>
                            <FileCheck className="h-4 w-4" />
                            Sign &amp; Push to Caller ABHA
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: NORMAL CALL HISTORY ======================= */}
        {activeMainTab === "history" && (
          <div className="space-y-4">{renderNormalCallHistory()}</div>
        )}
      </div>
    </div>
  );
};
