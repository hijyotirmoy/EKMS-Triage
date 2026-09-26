"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  PhoneForwarded,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit3,
  Copy,
  Clock,
  Building2,
  ShieldAlert,
  Ambulance,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const FORWARDING_TEAMS = [
  {
    id: "108_AMBULANCE",
    name: "108 Emergency Ambulance Dispatch",
    shortName: "108 Ambulance",
    badgeColor: "bg-rose-700 text-white",
    icon: "🚨",
    isEmergency: true,
  },
  {
    id: "104_MEDICAL",
    name: "104 Tele-Doctor Medical Team",
    shortName: "104 Medical Team",
    badgeColor: "bg-blue-700 text-white",
    icon: "📞",
    isEmergency: false,
  },
  {
    id: "NACO_1097",
    name: "NACO 1097 Helpline Team (HIV/AIDS/STI)",
    shortName: "NACO 1097 Helpline",
    badgeColor: "bg-rose-800 text-white",
    icon: "🎗️",
    isEmergency: false,
  },
  {
    id: "TELE_MANAS",
    name: "Tele-MANAS 14416 Crisis Counseling",
    shortName: "Tele-MANAS 14416",
    badgeColor: "bg-purple-700 text-white",
    icon: "🧠",
    isEmergency: false,
  },
  {
    id: "ESIC_HOSPITAL",
    name: "ESIC Hospital Casualty / Triage Desk",
    shortName: "ESIC Hospital",
    badgeColor: "bg-amber-700 text-white",
    icon: "🏥",
    isEmergency: false,
  },
  {
    id: "ESIS_DISPENSARY",
    name: "ESIS Dispensary Medical Officer",
    shortName: "ESIS Dispensary",
    badgeColor: "bg-emerald-700 text-white",
    icon: "🩺",
    isEmergency: false,
  },
  {
    id: "FORWARD_DOCTOR",
    name: "On-Duty Medical Officer Escalation Desk",
    shortName: "Medical Officer",
    badgeColor: "bg-indigo-700 text-white",
    icon: "👨‍⚕️",
    isEmergency: false,
  },
  {
    id: "E_SANJEEVANI",
    name: "e-Sanjeevani Online Doctor Portal",
    shortName: "e-Sanjeevani",
    badgeColor: "bg-sky-700 text-white",
    icon: "💻",
    isEmergency: false,
  },
  {
    id: "NEAREST_PHARMACY",
    name: "Empanelled Pharmacy / Dispensary Chemist",
    shortName: "Pharmacy / Chemist",
    badgeColor: "bg-teal-700 text-white",
    icon: "💊",
    isEmergency: false,
  },
  {
    id: "TIE_UP_FACILITY",
    name: "Empanelled Tie-Up Facility Desk",
    shortName: "Tie-Up Facility",
    badgeColor: "bg-cyan-700 text-white",
    icon: "🏥",
    isEmergency: false,
  },
];

export function mapDirectiveToTeamId(directiveId, t = {}) {
  switch (directiveId) {
    case "CALL_108":
      return "108_AMBULANCE";
    case "TELE_104":
      return "104_MEDICAL";
    case "NACO_1097":
      return "NACO_1097";
    case "TELE_MANAS":
      return "TELE_MANAS";
    case "ESIC_HOSPITAL":
      return "ESIC_HOSPITAL";
    case "ESIS_DISPENSARY":
      return "ESIS_DISPENSARY";
    case "FORWARD_DOCTOR":
      return "FORWARD_DOCTOR";
    case "E_SANJEEVANI":
      return "E_SANJEEVANI";
    case "NEAREST_PHARMACY":
      return "NEAREST_PHARMACY";
    case "TIE_UP_FACILITY":
      return "TIE_UP_FACILITY";
    default:
      if (t?.call_108) return "108_AMBULANCE";
      if (t?.is_psychiatric) return "TELE_MANAS";
      return "104_MEDICAL";
  }
}

export function getTeamButtonClass(teamId) {
  switch (teamId) {
    case "ESIC_HOSPITAL":
      return "bg-amber-700 hover:bg-amber-800 ring-2 ring-amber-500/25";
    case "108_AMBULANCE":
    case "CALL_108":
      return "bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-500/25";
    case "104_MEDICAL":
    case "TELE_104":
      return "bg-blue-700 hover:bg-blue-800 ring-2 ring-blue-500/25";
    case "TIE_UP_FACILITY":
      return "bg-cyan-700 hover:bg-cyan-800 ring-2 ring-cyan-500/25";
    case "TELE_MANAS":
      return "bg-purple-700 hover:bg-purple-800 ring-2 ring-purple-500/25";
    case "NACO_1097":
      return "bg-rose-800 hover:bg-rose-900 ring-2 ring-rose-500/25";
    case "ESIS_DISPENSARY":
      return "bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-500/25";
    case "FORWARD_DOCTOR":
      return "bg-indigo-700 hover:bg-indigo-800 ring-2 ring-indigo-500/25";
    case "E_SANJEEVANI":
      return "bg-sky-700 hover:bg-sky-800 ring-2 ring-sky-500/25";
    case "NEAREST_PHARMACY":
      return "bg-teal-700 hover:bg-teal-800 ring-2 ring-teal-500/25";
    default:
      return "bg-primary hover:bg-primary/90 ring-2 ring-primary/25";
  }
}

export function CaseHandoverForwarding({
  result,
  activeDirective,
  allRedFlags = [],
  callerIntake = null,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentStatus, setSentStatus] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const t = result?.triage || {};
  const caseRef = result?.case_ref || `CASE-${Date.now().toString(36).toUpperCase()}`;

  // Automatically determine target forwarded team based on active directive / decision switcher
  const targetTeamId = useMemo(() => {
    return mapDirectiveToTeamId(activeDirective?.id, t);
  }, [activeDirective?.id, t]);

  const [selectedTeamId, setSelectedTeamId] = useState(targetTeamId);

  // Synchronize immediately whenever activeDirective changes from Decision Switcher
  useEffect(() => {
    setSelectedTeamId(targetTeamId);
  }, [targetTeamId]);

  // Extract caller details from live caller intake form, falling back to result.intake or defaults
  const intakeData = useMemo(() => {
    const src = callerIntake || result?.intake || {};
    const name = src.caller_name || result?.intake?.caller_name || "Akash Gupta";
    const phone = src.phone || result?.intake?.phone || "9876543210";
    const age =
      src.age != null && src.age !== ""
        ? String(src.age)
        : result?.intake?.age != null && result?.intake?.age !== ""
        ? String(result?.intake?.age)
        : "45";
    const sex = src.sex || result?.intake?.sex || "Male";
    const city = src.city || result?.intake?.city || "";
    const district = src.district || result?.intake?.district || "";
    const pincode = src.pincode || result?.intake?.pincode || "";
    const landmark = src.landmark || result?.intake?.landmark || "";

    // Build human-readable patient location
    const locParts = [];
    if (landmark.trim()) locParts.push(landmark.trim());
    if (city.trim()) locParts.push(city.trim());
    if (
      district.trim() &&
      district.trim().toLowerCase() !== city.trim().toLowerCase()
    ) {
      locParts.push(district.trim());
    }
    if (pincode.trim()) locParts.push(`PIN: ${pincode.trim()}`);

    let formattedLocation = "";
    let isDefault = false;
    if (locParts.length > 0) {
      formattedLocation = locParts.join(", ");
    } else if (result?.resolved_location?.matched) {
      formattedLocation = `${result.resolved_location.matched}, Assam - PIN: 781005`;
    } else {
      formattedLocation = "Guwahati, Kamrup Metro, Assam - PIN: 781005 (Default Area)";
      isDefault = true;
    }

    return {
      callerName: name,
      phone,
      age,
      sex,
      city: city || "Guwahati",
      district: district || "Kamrup Metro",
      pincode: pincode || "781005",
      landmark,
      locationDisplay: formattedLocation,
      isDefault,
    };
  }, [callerIntake, result]);

  // Editable form state for the verification popup
  const [editData, setEditData] = useState({
    callerName: intakeData.callerName,
    phone: intakeData.phone,
    age: intakeData.age,
    sex: intakeData.sex,
    landmark: intakeData.locationDisplay,
    chiefComplaint:
      t.primary_complaint ||
      callerIntake?.symptom_notes ||
      result?.intake?.symptom_notes ||
      "Primary Clinical Assessment",
    redFlagsText:
      allRedFlags.length > 0
        ? allRedFlags.join("; ")
        : "No acute red-flag signs detected",
    agentNote: "",
  });

  const displayRedFlags = useMemo(() => {
    if (Array.isArray(allRedFlags) && allRedFlags.length > 0) {
      return allRedFlags;
    }
    if (
      editData.redFlagsText &&
      editData.redFlagsText !== "No acute red-flag signs detected"
    ) {
      return editData.redFlagsText
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [allRedFlags, editData.redFlagsText]);

  const selectedTeam =
    FORWARDING_TEAMS.find((team) => team.id === selectedTeamId) ||
    FORWARDING_TEAMS[0];

  const isTarget108 = selectedTeam.id === "108_AMBULANCE";

  const handleOpenModal = () => {
    // Refresh with latest caller intake values
    setSelectedTeamId(targetTeamId);
    setEditData({
      callerName: intakeData.callerName,
      phone: intakeData.phone,
      age: intakeData.age,
      sex: intakeData.sex,
      landmark: intakeData.locationDisplay,
      chiefComplaint:
        t.primary_complaint ||
        callerIntake?.symptom_notes ||
        result?.intake?.symptom_notes ||
        "Primary Clinical Assessment",
      redFlagsText:
        allRedFlags.length > 0
          ? allRedFlags.join("; ")
          : "No acute red-flag signs detected",
      agentNote: "",
    });
    setModalOpen(true);
  };

  const handleConfirmSend = () => {
    setIsSending(true);

    const dispatchId = `DISP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dispatchDossier = `[CASE DISPATCH HANDOVER]
Ref: ${caseRef} | Dispatch ID: ${dispatchId}
Forwarded Team: ${selectedTeam.name}
Time: ${timestamp}

[PATIENT DETAILS]
Name: ${editData.callerName} (${editData.age ? editData.age + "y" : "Age N/A"}, ${editData.sex || "N/A"})
Contact Phone: +91 ${editData.phone}
Exact Location / Landmark: ${editData.landmark || "Not specified"}

[CLINICAL ASSESSMENT]
Chief Complaint: ${editData.chiefComplaint}
Urgency Level: ${t.urgency_level || "Urgent"} (${t.urgency_score || 7}/10)
Red Flags: ${displayRedFlags.length > 0 ? displayRedFlags.join("; ") : "No acute red-flag signs detected"}
Agent Instructions: ${editData.agentNote || "Standard clinical handover."}`;

    // Simulate instant transmission
    setTimeout(() => {
      try {
        navigator.clipboard?.writeText?.(dispatchDossier);
      } catch (e) {}

      setSentStatus({
        teamName: selectedTeam.name,
        shortName: selectedTeam.shortName,
        dispatchId,
        timestamp,
        location: editData.landmark,
      });

      setIsSending(false);
      setModalOpen(false);
      toast.success(
        `Case details transmitted to ${selectedTeam.shortName}! (Ref: ${dispatchId})`
      );
    }, 600);
  };

  return (
    <>
      {/* Referral Forwarding Dispatch & Confirmation (rendered cleanly right below Action Steps for Agent) */}
      <div className="pt-3 border-t border-current/15 space-y-3">
        {sentStatus && (
          <div className="rounded-xl border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 sm:p-3.5 text-xs font-bold text-emerald-950 dark:text-emerald-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-extrabold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                  Transmitted to {sentStatus.shortName} at {sentStatus.timestamp}
                </p>
                <p className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                  Handover Ref: {sentStatus.dispatchId} · Location:{" "}
                  {sentStatus.location || "Default Location (Beltola, Guwahati), Assam - PIN: 781005"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 transition hover:bg-emerald-100/80 shadow-2xs cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" /> Update / Re-send
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-medium hidden sm:block">
            Transmit verified caller intake, location landmark &amp; clinical findings.
          </p>

          <button
            type="button"
            onClick={handleOpenModal}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer ${getTeamButtonClass(
              selectedTeam.id
            )}`}
          >
            <Send className="h-4 w-4" />
            <span>Verify &amp; Send Details to {selectedTeam.shortName}</span>
          </button>
        </div>
      </div>

      {/* 2. Verification & Edit Pop-up Modal rendered across the FULL WEBSITE via React Portal */}
      {modalOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="border-b border-border/80 bg-secondary/40 px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-2xs">
                    <Send className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-foreground">
                      Verify &amp; Forward Case Details
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Review, verify, and edit patient intake information before transmission
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
                {/* Target Team Selector */}
                <div>
                  <label className="field-label mb-1.5 block font-bold text-foreground">
                    Target Forwarded Referral Team
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FORWARDING_TEAMS.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition text-left cursor-pointer ${
                          selectedTeamId === team.id
                            ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                            : "border-border/80 bg-card text-foreground hover:bg-secondary/70"
                        }`}
                      >
                        <span className="text-base">{team.icon}</span>
                        <span className="truncate">{team.shortName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crucial Ambulance / 108 Callout if applicable */}
                {isTarget108 && (
                  <div className="rounded-xl border border-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-950 dark:text-rose-200 font-bold space-y-1 shadow-2xs">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                      <Ambulance className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-400 animate-pulse" />
                      <span className="uppercase tracking-wider font-black text-xs">
                        108 Ambulance Dispatch Alert
                      </span>
                    </div>
                    <p className="font-medium text-rose-900 dark:text-rose-200 leading-relaxed text-xs">
                      Ask the IP: <strong>&ldquo;What is your exact current house number, street, or nearby landmark?&rdquo;</strong> so the ambulance crew can navigate immediately without delay.
                    </p>
                  </div>
                )}

                {/* Editable Caller Fields (pre-filled from Caller Intake) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label mb-1 block font-semibold text-foreground">
                      Caller Name (from Caller Intake)
                    </label>
                    <input
                      type="text"
                      value={editData.callerName}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, callerName: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                      placeholder="e.g. Akash Gupta"
                    />
                  </div>
                  <div>
                    <label className="field-label mb-1 block font-semibold text-foreground">
                      Contact Phone (from Caller Intake)
                    </label>
                    <input
                      type="text"
                      value={editData.phone}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, phone: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground font-mono font-semibold outline-none focus:border-primary transition"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label mb-1 block font-semibold text-foreground">
                      Age
                    </label>
                    <input
                      type="text"
                      value={editData.age}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, age: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                      placeholder="e.g. 45"
                    />
                  </div>
                  <div>
                    <label className="field-label mb-1 block font-semibold text-foreground">
                      Sex / Gender
                    </label>
                    <input
                      type="text"
                      value={editData.sex}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, sex: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                      placeholder="e.g. Male"
                    />
                  </div>
                </div>

                {/* Exact Location & Landmark (HIGH VISIBILITY) */}
                <div>
                  <label className="field-label mb-1 block flex items-center justify-between font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-rose-600" />
                      Exact Pickup Landmark &amp; Current Location{" "}
                      <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-[10px] text-primary font-bold">
                      Crucial for navigation &amp; ambulance
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={editData.landmark}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, landmark: e.target.value }))
                    }
                    placeholder="e.g. Near Beltola Tiniali, Opposite SBI ATM, House No 14, Guwahati 781005"
                    className="w-full rounded-lg border border-border/80 bg-background p-2.5 text-xs text-foreground font-medium outline-none focus:border-primary transition"
                  />
                </div>

                {/* Chief Complaint */}
                <div>
                  <label className="field-label mb-1 block font-semibold text-foreground">
                    Chief Complaint / Primary Clinical Reason
                  </label>
                  <input
                    type="text"
                    value={editData.chiefComplaint}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, chiefComplaint: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                  />
                </div>

                {/* Red Flags & Clinical Findings Box - Same design as Triage Outcome */}
                <div
                  className={`rounded-xl border p-3.5 shadow-2xs ${
                    displayRedFlags.length > 0
                      ? "border-red-300 bg-rose-50/90 dark:bg-rose-950/40"
                      : "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30"
                  }`}
                  data-testid="modal-red-flags-box"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${
                        displayRedFlags.length > 0
                          ? "text-red-700 dark:text-red-400"
                          : "text-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      {displayRedFlags.length > 0 ? (
                        <>
                          <ShieldAlert className="h-4 w-4 text-red-600" />
                          Clinical Red Flags Detected ({displayRedFlags.length} points)
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Clinical Red Flags Assessment
                        </>
                      )}
                    </p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                        displayRedFlags.length > 0
                          ? "bg-red-600 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {displayRedFlags.length > 0 ? "High Alert" : "Stable"}
                    </span>
                  </div>

                  {displayRedFlags.length > 0 ? (
                    <ul
                      className="space-y-1.5 text-xs text-red-950 dark:text-red-200"
                      data-testid="modal-red-flags-list"
                    >
                      {displayRedFlags.map((flag, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 py-0.5 text-red-950 dark:text-red-200"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                          <span className="font-semibold leading-snug">{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 py-1 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>No acute red-flag hemodynamic signs detected from caller inquiry.</span>
                    </div>
                  )}
                </div>

                {/* Agent Handover Note */}
                <div>
                  <label className="field-label mb-1 block font-semibold text-foreground">
                    Agent Dispatch Notes &amp; Handover Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={editData.agentNote}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, agentNote: e.target.value }))
                    }
                    placeholder="e.g. Patient advised to stay seated and resting. Alert but anxious. Call line kept open."
                    className="w-full rounded-lg border border-border/80 bg-background p-2.5 text-xs text-foreground font-medium outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/80 bg-secondary/30 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleConfirmSend}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${getTeamButtonClass(
                    selectedTeam.id
                  )}`}
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {isSending
                      ? "Transmitting..."
                      : `Confirm & Transmit to ${selectedTeam.shortName}`}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
