"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertOctagon,
  Building2,
  Copy,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  ShieldAlert,
  Stethoscope,
  CheckCircle2,
  PhoneCall,
  PhoneForwarded,
  ArrowRight,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  Layers,
  Crosshair,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { urgencyStyle } from "../lib/api";
import { UrgencyBadge } from "./UrgencyBadge";
import { summarizeRedFlags, getDispensaryOperatingStatus, deduplicateRedFlags, extractCallerReportedProblems } from "../lib/triageEngine";
import { CaseHandoverForwarding } from "./CaseHandoverForwarding";
import { getCachedCases } from "../lib/clientCache";
import { MapWrapper } from "./map/MapWrapper";
import { ASSAM_DISTRICTS } from "../lib/districts";
import {
  isHospital,
  isDispensary,
  isTieUp,
  isEsicHospital,
  isGovtDistrictHospital,
  getFacilityCategoryLabel,
  rankNearestFacilities,
  calculateHaversineDistanceKm,
  calculateRoadDistanceKm,
} from "../lib/geo";

const formatApproxKm = (dist) => {
  if (dist == null || isNaN(dist)) return null;
  const num = Number(dist);
  return num < 10 ? num.toFixed(1) : Math.round(num);
};

const getFacilityPincode = (f) => {
  if (f?.pincode && /^\d{6}$/.test(String(f.pincode).trim())) {
    return String(f.pincode).trim();
  }
  const match = f?.address && f.address.match(/\b(78\d{4})\b/);
  return match ? match[1] : null;
};


export const ACTION_DIRECTIVES = {
  CALL_108: {
    id: "CALL_108",
    title: "CALL 108 AMBULANCE IMMEDIATELY",
    category: "Emergency Dispatch",
    badge: "108 Ambulance",
    badgeColor: "bg-rose-700 text-white font-bold",
    cardBorder: "border-rose-400 bg-rose-50 text-rose-950 shadow-xs",
    panelLightTint: "border-rose-300/80 bg-rose-50/50 dark:bg-rose-950/25",
    topBar: "bg-rose-700",
    icon: "🚨",
    summary: "",
    checklist: [
      "1. Verify caller's current location, landmark, and contact phone number.",
      "2. Initiate 108 Emergency Ambulance dispatch immediately.",
      "3. Instruct patient to lie down, remain calm, and NOT exert or travel unassisted.",
    ],
  },
  ESIC_HOSPITAL: {
    id: "ESIC_HOSPITAL",
    title: "REFER / FORWARD TO NEAREST ESIC HOSPITAL",
    category: "Secondary Care & Casualty Evaluation",
    badge: "ESIC Hospital",
    badgeColor: "bg-amber-700 text-white font-bold",
    cardBorder: "border-amber-400 bg-amber-50 text-amber-950 shadow-xs",
    panelLightTint: "border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/25",
    topBar: "bg-amber-700",
    icon: "🏥",
    summary: "",
    checklist: [
      "1. Locate the nearest ESIC Hospital shown in Facilities below.",
      "2. Click 'SMS to Caller' to send the hospital name, address, and Google Maps link.",
      "3. Instruct caller to carry their Pehchan Card and government photo ID for urgent OPD/casualty.",
    ],
  },
  ESIS_DISPENSARY: {
    id: "ESIS_DISPENSARY",
    title: "DIRECT TO NEAREST ESIS DISPENSARY",
    category: "Primary Healthcare & Routine Outpatient",
    badge: "ESIS Dispensary",
    badgeColor: "bg-emerald-700 text-white font-bold",
    cardBorder: "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs",
    panelLightTint: "border-emerald-300/80 bg-emerald-50/50 dark:bg-emerald-950/25",
    topBar: "bg-emerald-700",
    icon: "🩺",
    summary:
      "Condition is suitable for primary clinic level care. Direct the IP to their registered or nearest ESIS Dispensary for doctor consultation and free medicine dispensing.",
    checklist: [
      "1. Check the nearest ESIS Dispensary listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address and dispensary timings (10:00 AM – 3:00 PM, Mon–Fri; Closed Sat/Sun).",
      "3. Remind IP to carry their ESIC Pehchan / Insurance card for free consultations and prescribed medicines.",
    ],
  },
  TELE_104: {
    id: "TELE_104",
    title: "FORWARD TO 104 HEALTH HELPLINE",
    category: "Tele-Doctor Consultation",
    badge: "104 Health Helpline",
    badgeColor: "bg-blue-700 text-white font-bold",
    cardBorder: "border-blue-400 bg-blue-50 text-blue-950 shadow-xs",
    panelLightTint: "border-blue-300/80 bg-blue-50/50 dark:bg-blue-950/25",
    topBar: "bg-blue-700",
    icon: "📞",
    summary:
      "Caller requests direct medical advice or consultation with a government doctor over the phone. Transfer call to 104 Health Helpline.",
    checklist: [
      "1. Inform caller: 'Connecting you to 104 Health Helpline doctor now.'",
      "2. Transfer call line to 104 Health Helpline triage queue.",
      "3. Share case reference number for medical documentation.",
    ],
  },

  TIE_UP_FACILITY: {
    id: "TIE_UP_FACILITY",
    title: "REFER TO EMPANELLED TIE-UP FACILITY",
    category: "Empanelled Network Care",
    badge: "Tie-Up Facility",
    badgeColor: "bg-cyan-700 text-white font-bold",
    cardBorder: "border-cyan-400 bg-cyan-50 text-cyan-950 shadow-xs",
    panelLightTint: "border-cyan-300/80 bg-cyan-50/50 dark:bg-cyan-950/25",
    topBar: "bg-cyan-700",
    icon: "🏥",
    summary: "",
    checklist: [
      "1. Check the nearest empanelled tie-up facility listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address, phone number, and Google Maps directions.",
      "3. Remind IP to carry their ESIC Pehchan / Insurance card for cashless treatment under ESIC tie-up guidelines.",
    ],
  },
  DIST_HOSPITAL: {
    id: "DIST_HOSPITAL",
    title: "REFER TO DISTRICT HOSPITAL / PUBLIC HEALTHCARE",
    category: "Public Healthcare Outside ESIC",
    badge: "Govt District Hospital",
    badgeColor: "bg-blue-800 text-white font-bold",
    cardBorder: "border-blue-500 bg-blue-50 text-blue-950 shadow-xs",
    panelLightTint: "border-blue-300/80 bg-blue-50/50 dark:bg-blue-950/25",
    topBar: "bg-blue-800",
    icon: "🏥",
    summary:
      "Beneficiary requires public healthcare services outside ESIC network, general public specialist care, non-ESIC admissions, or child immunization.",
    checklist: [
      "1. Check the nearest Govt District Hospital listed under Facilities below.",
      "2. Click 'SMS to Caller' to dispatch address and Google Maps directions.",
      "3. Remind caller to carry government photo ID / Aadhaar and medical records for OPD/admissions.",
    ],
  },
};

export function mapDestinationToDirectiveId(dest) {
  if (!dest || typeof dest !== "string") return "ESIS_DISPENSARY";
  const d = dest.toLowerCase();
  if (d.includes("108") || d.includes("ambulance")) return "CALL_108";
  if (d.includes("104") || d.includes("tele-doctor") || d.includes("phone doctor") || d.includes("medical team") || d.includes("health helpline") || d.includes("advice") || d.includes("naco") || d.includes("1097") || d.includes("hiv") || d.includes("aids") || d.includes("manas") || d.includes("psych") || d.includes("counsel")) return "TELE_104";
  if (d.includes("tie") || d.includes("empanelled") || d.includes("swasti") || d.includes("ayursundra") || d.includes("dispur hospital") || d.includes("narayana") || d.includes("hayat") || d.includes("excelcare") || d.includes("down town")) return "TIE_UP_FACILITY";
  if (d.includes("district") || d.includes("dist hosp") || d.includes("public health") || d.includes("civil hospital") || d.includes("immunization")) return "DIST_HOSPITAL";
  if (d.includes("hospital") || d.includes("casualty")) return "ESIC_HOSPITAL";
  if (d.includes("dispensary") || d.includes("clinic")) return "ESIS_DISPENSARY";
  return "ESIS_DISPENSARY";
}

export function resolveDirectiveIds(t, result) {
  const intakeText = `${result?.intake?.symptom_notes || ""} ${result?.intake?.complaint || ""} ${result?.ekms_ai_context?.triageState?.condition || ""}`.toLowerCase();
  const isNacoHIV = /\b(hiv|aids|naco|1097|post.?exposure|pep\b|anti.?retroviral|art\s*center)\b/i.test(intakeText);
  const isPsych = /\b(suicid|depress|anxiety|mental|counsel|udaas)\b/i.test(intakeText);

  // Check off-hours (between 4:00 PM and 10:00 AM)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
  const isOffHours = currentMinutes >= 960 || currentMinutes < 600; // 4:00 PM to 10:00 AM

  const severityScore = Number(t?.urgency_score || result?.intake?.severity_reported || result?.ekms_ai_context?.triageState?.severityScore || 0);
  const isSeverity9OrHigh = severityScore >= 8 || t?.urgency_level === "Emergency";

  const is108Ambulance =
    Boolean(t?.call_108) ||
    /\b(108|ambulance)\b/i.test(t?.referral_destination || "") ||
    /\b(108|ambulance)\b/i.test(t?.call_referral_primary || "") ||
    /\b(heavy bleed|massive bleed|bleeding.*stop|uncontrolled bleed|crushing chest|cardiac arrest|unconscious|behosh)\b/i.test(intakeText);

  let primaryDest = t?.call_referral_primary || t?.referral_destination || chatRef;

  if (is108Ambulance) {
    primaryDest = "108 Ambulance";
  } else if (isSeverity9OrHigh) {
    // For severity 9 / 8-10 emergency, forward to hospital first (ESIC Hospital / Govt District Hospital)
    primaryDest = (primaryDest && primaryDest.toLowerCase().includes("hospital")) ? primaryDest : "ESIC Hospital";
  } else if (isNacoHIV || isPsych) {
    primaryDest = "104 Health Helpline";
  } else if (isOffHours) {
    primaryDest = "104 Health Helpline";
  } else if (!primaryDest) {
    primaryDest = "ESIS Dispensary";
  }

  let secondaryDest =
    t?.call_referral_secondary ||
    t?.secondary_referral_destination ||
    (isSeverity9OrHigh ? "104 Health Helpline" : (isOffHours ? "ESIC Hospital" : "104 Health Helpline"));

  if (isSeverity9OrHigh && (!secondaryDest || secondaryDest.includes("Hospital"))) {
    secondaryDest = "104 Health Helpline";
  }

  const primaryId = mapDestinationToDirectiveId(primaryDest);
  let secondaryId = mapDestinationToDirectiveId(secondaryDest);

  if (secondaryId === primaryId) {
    secondaryId = primaryId === "ESIC_HOSPITAL" ? "TELE_104" : "ESIC_HOSPITAL";
  }

  return {
    primaryId,
    secondaryId,
    isDual: false,
    primaryBadge: ACTION_DIRECTIVES[primaryId]?.badge || primaryDest,
    secondaryBadge: ACTION_DIRECTIVES[secondaryId]?.badge || secondaryDest,
  };
}

const Empty = () => (
  <div className="panel grid-lines flex min-h-[480px] flex-col items-center justify-start p-6 pt-8 sm:p-8 sm:pt-10 text-center">
    <div className="mx-auto mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-secondary/80 border border-border/60 text-muted-foreground shadow-2xs">
      <Stethoscope className="h-6 w-6 text-primary/80" strokeWidth={1.75} />
    </div>
    <h3 className="text-base sm:text-lg font-bold text-foreground">Triage output appears here</h3>
  </div>
);

const Loading = () => (
  <div className="space-y-5 animate-in fade-in duration-300" data-testid="triage-skeleton">
    {/* Main Outcome Card Skeleton */}
    <div className="panel overflow-hidden border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      {/* Top Shimmer Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500/40 via-primary/60 to-emerald-500/40 animate-pulse rounded-full" />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-28 rounded-full bg-primary/25 animate-pulse" />
            <div className="h-7 w-24 rounded-full bg-muted/60 animate-pulse" />
          </div>
        </div>
        <div className="space-y-1.5 text-right">
          <div className="h-3.5 w-32 rounded bg-muted/70 animate-pulse ml-auto" />
          <div className="h-3 w-24 rounded bg-muted/50 animate-pulse ml-auto" />
        </div>
      </div>

      {/* Summary Skeleton */}
      <div className="mt-5 space-y-2.5">
        <div className="h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
        <div className="h-4 w-full rounded bg-muted/50 animate-pulse" />
        <div className="h-4 w-11/12 rounded bg-muted/50 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
      </div>

      {/* Clinical Reasoning Box Skeleton */}
      <div className="mt-5 rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-primary/30 animate-pulse" />
          <div className="h-3.5 w-36 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-3.5 w-full rounded bg-muted/40 animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-muted/40 animate-pulse" />
      </div>

      {/* Red Flags Skeleton Box */}
      <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-rose-500/30 animate-pulse" />
          <div className="h-3.5 w-28 rounded bg-rose-500/20 animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-6 w-36 rounded-full bg-rose-500/15 animate-pulse" />
          <div className="h-6 w-44 rounded-full bg-rose-500/15 animate-pulse" />
        </div>
      </div>

      {/* Recommended Action Banner Skeleton */}
      <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-44 rounded bg-emerald-500/30 animate-pulse" />
          <div className="h-5 w-24 rounded-full bg-emerald-500/20 animate-pulse" />
        </div>
        <div className="h-4 w-3/4 rounded bg-emerald-500/20 animate-pulse" />
      </div>
    </div>

    {/* Nearest Facilities Card Skeleton */}
    <div className="panel border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-primary/30 animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
      </div>

      {/* 2 Facility items placeholder */}
      {[1, 2].map((i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-3.5 bg-secondary/20">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-52 rounded bg-muted/70 animate-pulse" />
            <div className="h-3 w-4/5 rounded bg-muted/50 animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
            <div className="h-7 w-20 rounded-md bg-primary/20 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TriageResultPanel = ({
  result,
  loading,
  callerIntake,
  currentAgent,
  onUpdatePincode,
  onUpdateLocation,
  onRunTriageWithPincode,
  onDirectiveChange,
  callerHistory = [],
  onForwardSuccess,
}) => {
  if (loading) return <Loading />;
  if (!result) return <Empty />;

  const { triage: t, nearest_facilities: facs, resolved_location: loc } = result;
  const s = urgencyStyle(t.urgency_level);

  const [searchPincode, setSearchPincode] = useState("");
  const [largeViewSearchPin, setLargeViewSearchPin] = useState("");
  const [searchedFacilities, setSearchedFacilities] = useState(null);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [isSearchingFacilities, setIsSearchingFacilities] = useState(false);

  // Assam Map States (from EKMS Map)
  const mapRef = useRef(null);
  const fullScreenMapRef = useRef(null);
  const [mapLayer, setMapLayer] = useState("minimal");
  const [isPinModeActive, setIsPinModeActive] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedFacilityForMap, setSelectedFacilityForMap] = useState(null);
  const [droppedPinLocation, setDroppedPinLocation] = useState(null);
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState("all");

  // Reset search and pin state on new case
  useEffect(() => {
    setSearchedFacilities(null);
    setSearchedLocation(null);
    setDroppedPinLocation(null);
    setIsPinModeActive(false);
    setSearchPincode("");
    setLargeViewSearchPin("");
  }, [result?.case_ref, result?.case_id, result?.id]);

  const handleFacilitySearch = async (targetQuery) => {
    const raw = targetQuery !== undefined ? targetQuery : (largeViewSearchPin || searchPincode);
    const query = String(raw || "").trim();
    if (!query) {
      return toast.error("Please enter a 6-digit Assam PIN code or District");
    }

    // Immediately clear any prior dropped pin and deactivate pin mode
    setDroppedPinLocation(null);
    setIsPinModeActive(false);
    setSelectedDistrictFilter("all");
    setSearchPincode(query);
    setLargeViewSearchPin(query);
    setDrawerSearchQuery(""); // Clear drawer text filter so all nearest facilities of new PIN are displayed

    setIsSearchingFacilities(true);
    try {
      const isSevere = t.urgency_level === "Emergency" || t.call_108;
      const isPin = /^\d{6}$/.test(query);

      // Geocode using exact same method as EKMS Map: OpenStreetMap Nominatim (${query}, Assam, India)
      let geoLat = null;
      let geoLon = null;
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query + ", Assam, India"
          )}&limit=1`
        );
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (nomData && nomData.length > 0 && nomData[0].lat && nomData[0].lon) {
            const pLat = parseFloat(nomData[0].lat);
            const pLon = parseFloat(nomData[0].lon);
            if (pLat >= 24.0 && pLat <= 28.5 && pLon >= 89.5 && pLon <= 96.5) {
              geoLat = pLat;
              geoLon = pLon;
            }
          }
        }
      } catch (nomErr) {
        // Fallback to internal dataset
      }

      let url = "";
      if (geoLat != null && geoLon != null) {
        url = `/api/facilities/nearest?lat=${geoLat}&lon=${geoLon}&pincode=${encodeURIComponent(query)}&severe=${isSevere}`;
      } else if (isPin) {
        url = `/api/facilities/nearest?pincode=${encodeURIComponent(query)}&severe=${isSevere}`;
      } else {
        url = `/api/facilities/nearest?district=${encodeURIComponent(query)}&pincode=${encodeURIComponent(query)}&severe=${isSevere}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch facilities");
      const data = await res.json();

      setSearchedFacilities(data.nearest_facilities || []);
      setSearchedLocation(data.resolved_location || null);
      setVisibleFacilityCount(6);
      setDrawerVisibleCount(6);

      // Only pass 6-digit numeric string to pincode; place names go to city / town!
      const validPin = isPin
        ? query
        : (data.resolved_location?.pincode && /^\d{6}$/.test(String(data.resolved_location.pincode).trim())
            ? String(data.resolved_location.pincode).trim()
            : null);
      const placeCity = !isPin ? query : (data.resolved_location?.city || null);
      const placeDistrict = data.resolved_location?.district || (!isPin ? query : null);

      if (onUpdateLocation) {
        onUpdateLocation({
          pincode: validPin,
          city: placeCity,
          district: placeDistrict,
        });
      } else if (onUpdatePincode && validPin) {
        onUpdatePincode(validPin);
      }

      if (data.resolved_location?.latitude != null && data.resolved_location?.longitude != null) {
        const coords = [Number(data.resolved_location.latitude), Number(data.resolved_location.longitude)];
        mapRef.current?.flyTo(coords, 11);
        fullScreenMapRef.current?.flyTo(coords, 11);
      }

      if (data.nearest_facilities?.length > 0) {
        toast.success(`Found ${data.nearest_facilities.length} facilities near ${query}!`);
      } else {
        toast.info(`No facilities found within 50 KM of ${query}.`);
      }
    } catch (err) {
      console.error("Search facilities error:", err);
      toast.error("Could not load facilities for this location.");
    } finally {
      setIsSearchingFacilities(false);
    }
  };

  const effectiveLoc = searchedLocation || loc;

  // Compute effective target location for Assam Map
  const effectiveTargetLocation = useMemo(() => {
    if (droppedPinLocation && droppedPinLocation.lat != null && droppedPinLocation.lng != null) {
      return {
        lat: Number(droppedPinLocation.lat),
        lng: Number(droppedPinLocation.lng),
        radius: droppedPinLocation.radius || 15,
        name: droppedPinLocation.name || "Dropped Pin",
      };
    }
    if (
      effectiveLoc &&
      effectiveLoc.latitude != null &&
      effectiveLoc.longitude != null &&
      !effectiveLoc.isNoLocation
    ) {
      const pinPart = effectiveLoc.pincode ? `PIN: ${effectiveLoc.pincode}` : "";
      const distPart = effectiveLoc.district || "";
      const displayName = [distPart, pinPart].filter(Boolean).join(" · ") || effectiveLoc.matched || "Target Location";

      return {
        lat: Number(effectiveLoc.latitude),
        lng: Number(effectiveLoc.longitude),
        radius: 15,
        name: displayName,
      };
    }
    return null;
  }, [droppedPinLocation, effectiveLoc]);

  // Handle Drop Pin on Assam Map
  const handlePinDropped = async (pinLoc) => {
    setDroppedPinLocation(pinLoc);
    setIsPinModeActive(false);
    setIsSearchingFacilities(true);
    try {
      const isSevere = t.urgency_level === "Emergency" || t.call_108;
      const url = `/api/facilities/nearest?lat=${pinLoc.lat}&lon=${pinLoc.lng}&is_drop_pin=true&severe=${isSevere}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSearchedFacilities(data.nearest_facilities || []);
        setVisibleFacilityCount(6);
        setDrawerVisibleCount(6);

        const resolved = data.resolved_location || {
          latitude: pinLoc.lat,
          longitude: pinLoc.lng,
          matched: pinLoc.name,
          pincode: pinLoc.pincode || null,
          city: pinLoc.city || pinLoc.name || null,
          district: pinLoc.district || null,
          method: "dropped_pin",
          isNoLocation: false,
          isDroppedPin: true,
        };

        setSearchedLocation(resolved);

        // Put place name into City / town, and ONLY a valid 6-digit numeric postal code into Pincode!
        const resolvedPin = (resolved.pincode && /^\d{6}$/.test(String(resolved.pincode).trim()))
          ? String(resolved.pincode).trim()
          : (pinLoc.pincode && /^\d{6}$/.test(String(pinLoc.pincode).trim()) ? String(pinLoc.pincode).trim() : null);

        const placeCity =
          (resolved.city && resolved.city !== "." ? resolved.city : null) ||
          (pinLoc.city && !pinLoc.city.startsWith("Dropped Pin") ? pinLoc.city : null) ||
          (pinLoc.name && !pinLoc.name.startsWith("Dropped Pin") ? pinLoc.name : null);
        const placeDistrict = resolved.district || pinLoc.district || null;

        if (onUpdateLocation) {
          onUpdateLocation({
            pincode: resolvedPin,
            city: placeCity,
            district: placeDistrict,
          });
        } else if (onUpdatePincode && resolvedPin) {
          onUpdatePincode(resolvedPin);
        }

        toast.success(`Dropped pin set to "${pinLoc.name}"! Found ${data.nearest_facilities?.length || 0} facilities.`);
      }
    } catch (err) {
      console.error("Pin drop search error:", err);
      toast.error("Could not fetch facilities for dropped pin.");
    } finally {
      setIsSearchingFacilities(false);
    }
  };

  const handleDistrictSelect = (districtName) => {
    setSelectedDistrictFilter(districtName);
    setSearchPincode(districtName);
    handleFacilitySearch(districtName);
  };

  const focusFacilityOnMap = (f) => {
    setSelectedFacilityForMap(f);
    if (mapRef.current) {
      mapRef.current.focusFacility(f);
    }
    if (fullScreenMapRef.current) {
      fullScreenMapRef.current.focusFacility(f);
    }
  };

  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isMapExpanded) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsMapExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMapExpanded]);

  useEffect(() => {
    if (isMapExpanded) {
      const activePin = searchPincode || effectiveLoc?.pincode || (effectiveLoc?.district && effectiveLoc.district !== "all" ? effectiveLoc.district : "") || "";
      if (activePin) setLargeViewSearchPin(activePin);
      const timer = setTimeout(() => {
        fullScreenMapRef.current?.invalidateSize();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isMapExpanded, searchPincode, effectiveLoc?.pincode, effectiveLoc?.district]);

  const effectiveRawFacs =
    searchedFacilities !== null ? searchedFacilities : (Array.isArray(facs) ? facs : []);

  const directiveIds = useMemo(() => {
    return resolveDirectiveIds(t, result);
  }, [t, result]);

  const [manualDirectiveId, setManualDirectiveId] = useState(null);
  const activeDirective =
    ACTION_DIRECTIVES[manualDirectiveId || directiveIds.primaryId] || ACTION_DIRECTIVES.ESIS_DISPENSARY;
  const secondaryDirective =
    ACTION_DIRECTIVES[directiveIds.secondaryId] || ACTION_DIRECTIVES.TELE_104;

  const [visibleFacilityCount, setVisibleFacilityCount] = useState(6);
  const [drawerVisibleCount, setDrawerVisibleCount] = useState(6);

  // Reset pagination to 6 when search / filter / pin / directive changes
  useEffect(() => {
    setVisibleFacilityCount(6);
    setDrawerVisibleCount(6);
  }, [searchPincode, droppedPinLocation, manualDirectiveId, effectiveLoc?.district, effectiveLoc?.pincode]);

  useEffect(() => {
    setDrawerVisibleCount(6);
  }, [drawerSearchQuery]);

  const [forwardedStatus, setForwardedStatus] = useState(() => {
    const caseRef = result?.case_ref || result?.case_id || result?.id;
    if (result?.is_forwarded || result?.forwarded_at || result?.dispatch_id) {
      return {
        shortName: result.forwarded_short_name || (result.forwarded_to?.includes("Dispensary") ? "ESIS Dispensary" : (result.forwarded_to?.includes("104") ? "104 Health Helpline" : (result.forwarded_to?.includes("108") ? "108 Ambulance" : result.forwarded_to))) || "Facility",
        teamName: result.forwarded_to || "ESIS Dispensary",
        dispatchId: result.dispatch_id || `DISP-${String(caseRef || "SENT").slice(-6)}`,
        timestamp: result.forwarded_at || new Date().toISOString(),
      };
    }
    if (typeof window !== "undefined" && caseRef) {
      try {
        const stored =
          sessionStorage.getItem(`ekms_forwarded_${caseRef}`) ||
          localStorage.getItem(`ekms_forwarded_${caseRef}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.is_forwarded && (parsed.case_ref === caseRef || parsed.dispatch_id)) {
            return {
              shortName: parsed.forwarded_short_name || "Facility",
              teamName: parsed.forwarded_to || "ESIS Dispensary",
              dispatchId: parsed.dispatch_id || `DISP-${String(caseRef || "SENT").slice(-6)}`,
              timestamp: parsed.forwarded_at || new Date().toISOString(),
            };
          }
        }
      } catch (e) {}
    }
    return null;
  });

  useEffect(() => {
    const caseRef = result?.case_ref || result?.case_id || result?.id;
    if (result?.is_forwarded || result?.forwarded_at || result?.dispatch_id) {
      setForwardedStatus({
        shortName: result.forwarded_short_name || (result.forwarded_to?.includes("Dispensary") ? "ESIS Dispensary" : (result.forwarded_to?.includes("104") ? "104 Health Helpline" : (result.forwarded_to?.includes("108") ? "108 Ambulance" : result.forwarded_to))) || "Facility",
        teamName: result.forwarded_to || "ESIS Dispensary",
        dispatchId: result.dispatch_id || `DISP-${String(caseRef || "SENT").slice(-6)}`,
        timestamp: result.forwarded_at || new Date().toISOString(),
      });
      return;
    }

    if (typeof window !== "undefined" && caseRef) {
      try {
        const stored =
          sessionStorage.getItem(`ekms_forwarded_${caseRef}`) ||
          localStorage.getItem(`ekms_forwarded_${caseRef}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.is_forwarded && (parsed.case_ref === caseRef || parsed.dispatch_id)) {
            setForwardedStatus({
              shortName: parsed.forwarded_short_name || "Facility",
              teamName: parsed.forwarded_to || "ESIS Dispensary",
              dispatchId: parsed.dispatch_id || `DISP-${String(caseRef || "SENT").slice(-6)}`,
              timestamp: parsed.forwarded_at || new Date().toISOString(),
            });
            return;
          }
        }

        const cached = getCachedCases().find((c) => String(c.case_ref) === String(caseRef) || String(c.id) === String(caseRef));
        if (cached && (cached.is_forwarded || cached.forwarded_at || cached.status === "forwarded")) {
          setForwardedStatus({
            shortName: cached.forwarded_short_name || (cached.forwarded_to?.includes("Dispensary") ? "ESIS Dispensary" : (cached.forwarded_to?.includes("104") ? "104 Health Helpline" : (cached.forwarded_to?.includes("108") ? "108 Ambulance" : cached.forwarded_to))) || "Facility",
            teamName: cached.forwarded_to || "ESIS Dispensary",
            dispatchId: cached.dispatch_id || `DISP-${String(caseRef).slice(-6)}`,
            timestamp: cached.forwarded_at,
          });
          return;
        }
      } catch (e) {}
    }

    // Default to null if this case is not specifically forwarded
    setForwardedStatus(null);
  }, [result]);

  useEffect(() => {
    if (activeDirective && onDirectiveChange) {
      onDirectiveChange(activeDirective);
    }
  }, [activeDirective, onDirectiveChange]);

  const dispensaryStatus = useMemo(() => getDispensaryOperatingStatus(), []);
  const isWeekend = dispensaryStatus.isWeekend;

  const isFacilityRequired = [
    "ESIC_HOSPITAL",
    "ESIS_DISPENSARY",
    "TIE_UP_FACILITY",
    "DIST_HOSPITAL",
    "CALL_108",
  ].includes(activeDirective.id);

  // Dynamically organize facilities with clear categorization badges and all 4 facility types
  const dynamicFacilities = useMemo(() => {
    const rawList = effectiveRawFacs || [];
    if (!rawList || rawList.length === 0) return [];

    const effectiveFacs = rawList.map((f) => {
      let calcDist = f.distance_km;
      if (
        droppedPinLocation &&
        droppedPinLocation.lat != null &&
        droppedPinLocation.lng != null &&
        f.latitude != null &&
        f.longitude != null
      ) {
        calcDist = calculateRoadDistanceKm(
          Number(droppedPinLocation.lat),
          Number(droppedPinLocation.lng),
          Number(f.latitude),
          Number(f.longitude)
        );
      } else if (
        searchedLocation &&
        searchedLocation.latitude != null &&
        searchedLocation.longitude != null &&
        f.latitude != null &&
        f.longitude != null
      ) {
        calcDist = calculateRoadDistanceKm(
          Number(searchedLocation.latitude),
          Number(searchedLocation.longitude),
          Number(f.latitude),
          Number(f.longitude)
        );
      } else if (
        calcDist == null &&
        effectiveLoc &&
        effectiveLoc.latitude != null &&
        effectiveLoc.longitude != null &&
        !effectiveLoc.isNoLocation &&
        f.latitude != null &&
        f.longitude != null
      ) {
        calcDist = calculateRoadDistanceKm(
          Number(effectiveLoc.latitude),
          Number(effectiveLoc.longitude),
          Number(f.latitude),
          Number(f.longitude)
        );
      }
      return {
        ...f,
        distance_km: calcDist != null ? Math.round(calcDist * 10) / 10 : f.distance_km,
      };
    });

    const getTag = (f) => {
      if (f.facility_tag) return f.facility_tag;
      return getFacilityCategoryLabel(f);
    };

    const getCategoryStyle = (f) => {
      if (isDispensary(f)) {
        return "bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300 font-bold";
      }
      if (isEsicHospital(f)) {
        return "bg-blue-500/15 border-blue-500/40 text-blue-800 dark:text-blue-300 font-bold";
      }
      if (isTieUp(f)) {
        return "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold";
      }
      if (isGovtDistrictHospital(f)) {
        return "bg-purple-500/15 border-purple-500/40 text-purple-800 dark:text-purple-300 font-bold";
      }
      return "bg-secondary/80 border-border/70 text-foreground/90 font-bold";
    };

    const byDistance = (a, b) => {
      const distA = a.distance_km != null ? a.distance_km : 9999;
      const distB = b.distance_km != null ? b.distance_km : 9999;
      return distA - distB;
    };

    const isOpenFacility = (f) =>
      isHospital(f) || isEsicHospital(f) || isGovtDistrictHospital(f) || isTieUp(f) || !isDispensary(f);

    let orderedFacs = [...effectiveFacs];

    if (manualDirectiveId === "TIE_UP_FACILITY" || activeDirective.id === "TIE_UP_FACILITY") {
      const tieUps = effectiveFacs.filter(isTieUp).sort(byDistance);
      const topTieUp = tieUps[0];
      const rest = effectiveFacs.filter((f) => f !== topTieUp).sort(byDistance);
      orderedFacs = topTieUp ? [topTieUp, ...rest] : rest;
    } else if (manualDirectiveId === "DIST_HOSPITAL" || activeDirective.id === "DIST_HOSPITAL") {
      const distHosps = effectiveFacs.filter(isGovtDistrictHospital).sort(byDistance);
      const topDistHosp = distHosps[0];
      const rest = effectiveFacs.filter((f) => f !== topDistHosp).sort(byDistance);
      orderedFacs = topDistHosp ? [topDistHosp, ...rest] : rest;
    } else if (manualDirectiveId === "ESIC_HOSPITAL" || activeDirective.id === "ESIC_HOSPITAL") {
      const esicHosps = effectiveFacs.filter(isEsicHospital).sort(byDistance);
      const topEsicHosp = esicHosps[0];
      const rest = effectiveFacs.filter((f) => f !== topEsicHosp).sort(byDistance);
      orderedFacs = topEsicHosp ? [topEsicHosp, ...rest] : rest;
    } else if (manualDirectiveId === "ESIS_DISPENSARY" || activeDirective.id === "ESIS_DISPENSARY") {
      if (isWeekend) {
        // On weekends, dispensaries are closed. Prioritize open facilities (hospitals / tie-ups) first
        const openFacs = effectiveFacs.filter(isOpenFacility).sort(byDistance);
        const closedDispensaries = effectiveFacs.filter(isDispensary).sort(byDistance);
        const minOpen = Math.max(4, openFacs.length >= 4 ? 4 : openFacs.length);
        orderedFacs = [
          ...openFacs.slice(0, minOpen),
          ...closedDispensaries,
          ...openFacs.slice(minOpen),
        ];
      } else {
        const sortedDispensaries = effectiveFacs.filter(isDispensary).sort(byDistance);
        const topDispensary = sortedDispensaries[0];
        const rest = effectiveFacs.filter((f) => f !== topDispensary).sort(byDistance);
        orderedFacs = topDispensary ? [topDispensary, ...rest] : rest;
      }
    } else {
      if (isWeekend) {
        // On weekends, prioritize open facilities first
        const openFacs = effectiveFacs.filter(isOpenFacility).sort(byDistance);
        const closedDispensaries = effectiveFacs.filter(isDispensary).sort(byDistance);
        const minOpen = Math.max(4, openFacs.length >= 4 ? 4 : openFacs.length);
        orderedFacs = [
          ...openFacs.slice(0, minOpen),
          ...closedDispensaries,
          ...openFacs.slice(minOpen),
        ];
      } else {
        orderedFacs = [...effectiveFacs].sort(byDistance);
      }
    }

    const seenKeys = new Set();
    const dedupedFacs = [];
    for (const f of orderedFacs) {
      const key = f.id || `${f.name}-${f.latitude}-${f.longitude}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        dedupedFacs.push(f);
      }
    }

    return dedupedFacs.map((f) => ({
      ...f,
      facility_tag: getTag(f),
      category_style: getCategoryStyle(f),
    }));
  }, [
    effectiveRawFacs,
    manualDirectiveId,
    activeDirective.id,
    dispensaryStatus.isOpen,
    isWeekend,
    droppedPinLocation,
    effectiveLoc,
  ]);

  const modalDrawerFacilities = useMemo(() => {
    let list = dynamicFacilities || [];
    if (drawerSearchQuery.trim()) {
      const q = drawerSearchQuery.toLowerCase().trim();
      // If drawerSearchQuery is a 6-digit pin matching searched pin, don't filter out nearest results
      if (/^\d{6}$/.test(q) && (searchPincode === q || largeViewSearchPin === q)) {
        return list;
      }
      list = list.filter(
        (f) =>
          (f.name && f.name.toLowerCase().includes(q)) ||
          (f.district && f.district.toLowerCase().includes(q)) ||
          (f.address && f.address.toLowerCase().includes(q)) ||
          (f.pincode && String(f.pincode).toLowerCase().includes(q))
      );
    }
    return list;
  }, [dynamicFacilities, drawerSearchQuery, searchPincode, largeViewSearchPin]);

  const dispatchSms = (f) => {
    navigator.clipboard?.writeText(
      `${f.name}, ${f.address}. Directions: ${f.maps_url}`
    );
    toast.success("Facility address copied — ready to SMS to the caller");
  };

  const allRedFlags = useMemo(() => {
    const raw = [];
    if (Array.isArray(t?.red_flags)) raw.push(...t.red_flags);
    const ctxFlags =
      result?.ekms_ai_context?.triageState?.redFlagsDetected ||
      result?.ekms_ai_context?.clinicalState?.redFlagsDetected ||
      result?.ekms_ai_context?.redFlagsDetected;
    if (Array.isArray(ctxFlags)) raw.push(...ctxFlags);

    // Look ONLY at actual caller-reported text, never circular AI summaries or bot assistant prompts
    const callerChat = Array.isArray(result?.ekms_ai_context?.chatHistory)
      ? result.ekms_ai_context.chatHistory
          .filter((m) => m.sender === "user" || m.role === "user")
          .map((m) => m.text || m.content || "")
          .join(" ")
      : "";
    const callerText = `${result?.intake?.symptom_notes || ""} ${result?.intake?.complaint || ""} ${result?.caller_spoken_text || ""} ${callerChat}`.toLowerCase().trim();
    const isSafe = /\b(safe|surakshit|no,?\s*i am safe|i am safe|not suicidal|no self.?harm|theek hoon)\b/i.test(callerText);

    return deduplicateRedFlags(summarizeRedFlags(raw, callerText, isSafe));
  }, [t, result]);

  const callerProblems = useMemo(() => {
    return extractCallerReportedProblems({
      result,
      callerIntake,
      t,
    });
  }, [result, callerIntake, t]);

  const primaryComplaint = useMemo(() => {
    if (callerProblems.length > 0) {
      return callerProblems.join(" · ");
    }
    return (
      t.primary_complaint ||
      result?.ekms_ai_context?.triageState?.suspectedCondition ||
      result?.ekms_ai_context?.triageState?.condition ||
      result?.ekms_ai_context?.triageState?.symptom ||
      (t.is_psychiatric ? "Emotional Distress / Mental Health Support" : "Primary Clinical Assessment")
    );
  }, [callerProblems, t, result]);

  const assessedSeverity =
    t.assessed_severity ||
    (t.urgency_score >= 8 ? "High" : t.urgency_score >= 5 ? "Moderate" : "Mild");
  let rawDuration =
    t.duration ||
    result?.intake?.duration ||
    result?.ekms_ai_context?.triageState?.duration ||
    "Reported today";
  if (/\b(fall|fell|falling|accident|injury|trauma|pain|chot|gir gaya|impact)\b/i.test(rawDuration)) {
    rawDuration = "Reported today";
  }
  const durationText = rawDuration;
  const severityAndDuration = assessedSeverity.includes("(")
    ? `${assessedSeverity} · ${durationText}`
    : `${assessedSeverity} (${t.urgency_score || 5}/10) · ${durationText}`;

  // USER MANDATE: Near Urgent and Primary Referral 01 MUST show the exact same referral!
  const primaryReferralDest = activeDirective.badge;

  const cleanReason = (reason) => {
    if (!reason || typeof reason !== "string") return "";
    if (reason.includes("Symptoms require secondary hospital casualty")) return "";
    return reason;
  };

  const primaryReferralReason = cleanReason(
    t.call_referral_primary_reason ||
    t.referral_reason ||
    activeDirective.summary ||
    t.recommended_action ||
    ""
  );

  const effectiveSecondaryDirective =
    (secondaryDirective.id === activeDirective.id
      ? (activeDirective.id === "ESIC_HOSPITAL" ? ACTION_DIRECTIVES.TELE_104 : ACTION_DIRECTIVES.ESIC_HOSPITAL)
      : secondaryDirective) || (activeDirective.id === "TELE_104" ? ACTION_DIRECTIVES.ESIC_HOSPITAL : ACTION_DIRECTIVES.TELE_104);

  const secondaryReferralDest = effectiveSecondaryDirective.badge;
  const secondaryReferralReason = cleanReason(
    t.call_referral_secondary_reason ||
    t.secondary_referral_reason ||
    effectiveSecondaryDirective?.summary ||
    ""
  );

  const forwardedTeamStr = String(
    forwardedStatus?.shortName ||
    forwardedStatus?.teamName ||
    result?.forwarded_short_name ||
    result?.forwarded_to ||
    ""
  ).toLowerCase();

  const isCaseForwarded = Boolean(
    forwardedStatus ||
    result?.is_forwarded ||
    result?.forwarded_at ||
    result?.dispatch_id ||
    result?.status === "forwarded"
  );

  const secondaryStr = String(secondaryReferralDest || "").toLowerCase();
  const isSentToSecondary = Boolean(
    isCaseForwarded &&
    secondaryStr &&
    (
      (secondaryStr.includes("104") && forwardedTeamStr.includes("104")) ||
      (secondaryStr.includes("108") && forwardedTeamStr.includes("108")) ||
      (secondaryStr.includes("hospital") && forwardedTeamStr.includes("hospital")) ||
      (secondaryStr.includes("dispensary") && forwardedTeamStr.includes("dispensary")) ||
      (secondaryStr.includes("tie") && forwardedTeamStr.includes("tie"))
    )
  );

  const isSentToPrimary = Boolean(isCaseForwarded && !isSentToSecondary);

  return (
    <div className="space-y-5 rise w-full max-w-full min-w-0" data-testid="triage-result">
      <div
        className={`panel overflow-hidden transition-all duration-300 ${
          activeDirective.panelLightTint || "bg-card border-border"
        }`}
      >
        <div
          className={`h-1.5 w-full transition-colors duration-300 ${
            activeDirective.topBar || s.bar
          }`}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Triage outcome</p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <UrgencyBadge level={t.urgency_level} score={t.urgency_score} />
                {activeDirective.id === "CALL_108" ? (
                  <span
                    data-testid="triage-call-108"
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    🚨 108 AMBULANCE
                  </span>
                ) : activeDirective.id === "TELE_104" ? (
                  <span
                    data-testid="triage-tele-104"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> 104 HEALTH HELPLINE
                  </span>
                ) : activeDirective.id === "ESIC_HOSPITAL" ? (
                  <span
                    data-testid="triage-esic-hospital"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> ESIC HOSPITAL
                  </span>
                ) : activeDirective.id === "TIE_UP_FACILITY" ? (
                  <span
                    data-testid="triage-tie-up"
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> TIE-UP FACILITY
                  </span>
                ) : activeDirective.id === "DIST_HOSPITAL" ? (
                  <span
                    data-testid="triage-dist-hospital"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-800 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Building2 className="h-3.5 w-3.5" /> GOVT DISTRICT HOSPITAL
                  </span>
                ) : (
                  <span
                    data-testid="triage-esis-dispensary"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-2xs"
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> {activeDirective.badge || "ESIS DISPENSARY"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-base font-semibold leading-snug" data-testid="triage-summary-en">
            {t.summary_en}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{s.label}</p>

          {/* Unified Clinical Assessment & Action items directly inside Triage outcome panel */}
          <div className="mt-5 space-y-4 pt-1">

            {/* 2. Clinical Assessment Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-border shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                  Chief Complaint
                </span>
                {callerProblems && callerProblems.length > 1 ? (
                  <div className="space-y-1 mt-0.5">
                    {callerProblems.map((prob, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 font-bold text-foreground text-xs sm:text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{prob}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="font-bold text-foreground text-sm">
                    {primaryComplaint}
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-border shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                  Assessed Severity &amp; Duration
                </span>
                <span className="font-bold text-foreground">
                  {severityAndDuration}
                </span>
              </div>

              {/* Recommended Call Referral 01 (Primary Immediate Destination) */}
              <div className="col-span-1 sm:col-span-2 rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-emerald-500/40 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400">
                    Recommended Call Referral 01 (Primary Immediate Destination)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Boolean(isSentToPrimary) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/50 shadow-2xs animate-in fade-in duration-200">
                        <CheckCircle2 className="h-3 w-3" /> Forwarded
                      </span>
                    )}
                    <span className="rounded bg-emerald-700 text-white text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                      Primary
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-950 dark:text-emerald-200 text-sm">
                  <PhoneForwarded className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{primaryReferralDest}</span>
                </div>
                {primaryReferralReason && (
                  <p className="mt-1 text-xs text-foreground/80 font-medium leading-relaxed">
                    {primaryReferralReason}
                  </p>
                )}
              </div>

              {/* Recommended Call Referral 02 (Co-Occurring / Secondary Referral) */}
              {secondaryReferralDest && (
                <div className="col-span-1 sm:col-span-2 rounded-lg bg-background/95 dark:bg-slate-900 p-2.5 border border-blue-400/50 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-400">
                      Recommended Call Referral 02 (Co-Occurring / Secondary Referral)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {Boolean(isSentToSecondary) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/50 shadow-2xs animate-in fade-in duration-200">
                          <CheckCircle2 className="h-3 w-3" /> Forwarded
                        </span>
                      )}
                      <span className="rounded bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider">
                        Secondary
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-extrabold text-blue-950 dark:text-blue-200 text-sm">
                    <PhoneForwarded className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>{secondaryReferralDest}</span>
                  </div>
                  {secondaryReferralReason && (
                    <p className="mt-1 text-xs text-foreground/80 font-medium leading-relaxed">
                      {secondaryReferralReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4. Decision Switcher Buttons (Redesigned with clean responsive grid and modern clinical controls) */}
            <div className="rounded-xl border border-current/15 bg-background/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                      Decision Switcher
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Select or switch referral destination channel
                    </span>
                  </div>
                </div>
                {manualDirectiveId && (
                  <button
                    type="button"
                    onClick={() => setManualDirectiveId(null)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/90 transition-colors bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-full cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to AI Primary</span>
                  </button>
                )}
              </div>

              {/* Clean structured responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(ACTION_DIRECTIVES).map((dir) => {
                  const isSelected = dir.id === activeDirective.id;
                  const isPrimary = dir.id === directiveIds.primaryId;
                  const isSecondary = dir.id === directiveIds.secondaryId;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setManualDirectiveId(dir.id)}
                      className={`group relative flex items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `${dir.badgeColor} ring-2 ring-offset-1 ring-current shadow-md scale-[1.01]`
                          : "bg-background/95 dark:bg-slate-800/90 text-foreground border border-border/80 hover:bg-secondary/70 hover:border-foreground/25 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0 leading-none">{dir.icon}</span>
                        <div className="min-w-0">
                          <p className="truncate tracking-tight leading-snug">{dir.badge}</p>
                          <p
                            className={`text-[10px] font-medium truncate ${
                              isSelected ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            {dir.category || "Referral Directive"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {isPrimary && (
                          <span
                            className={`rounded text-[9px] font-extrabold px-1.5 py-0.5 border ${
                              isSelected
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/40"
                            }`}
                          >
                            ⭐ Primary
                          </span>
                        )}
                        {isSecondary && !isPrimary && (
                          <span
                            className={`rounded text-[9px] font-extrabold px-1.5 py-0.5 border ${
                              isSelected
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-400/40"
                            }`}
                          >
                            ⭐ Secondary
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Point-wise Clinical Red Flags Box (AI Processed based on IP condition) */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                allRedFlags.length > 0
                  ? "border-red-300 bg-rose-50/90 dark:bg-rose-950/40"
                  : "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30"
              }`}
              data-testid="triage-red-flags-box"
            >
              <div className="mb-2 flex items-center justify-between">
                <p
                  className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${
                    allRedFlags.length > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {allRedFlags.length > 0 ? (
                    <>
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      Clinical Red Flags Detected ({allRedFlags.length} points)
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
                    allRedFlags.length > 0
                      ? "bg-red-600 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {allRedFlags.length > 0 ? "High Alert" : "Stable"}
                </span>
              </div>

              {allRedFlags.length > 0 ? (
                <ul
                  className="space-y-1.5 text-xs sm:text-sm text-red-950 dark:text-red-200"
                  data-testid="triage-red-flags-list"
                >
                  {allRedFlags.map((flag, idx) => (
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

            {/* 6. Directive Guidance Summary */}
            {activeDirective.summary && (
              <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                {activeDirective.summary}
              </p>
            )}

            {/* 7. Action Steps for Agent Checklist */}
            <div className="space-y-1.5 rounded-lg bg-background/90 p-3 border border-current/15 text-xs text-foreground shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Action Steps for Agent:
              </span>
              {activeDirective.checklist.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span className="font-semibold leading-snug">{step}</span>
                </div>
              ))}
            </div>

            {/* Referral Forwarding Dispatch Button & Confirmation */}
            <CaseHandoverForwarding
              result={result}
              activeDirective={activeDirective}
              allRedFlags={allRedFlags}
              callerIntake={callerIntake}
              callerHistory={callerHistory}
              onForwardSuccess={(statusData) => {
                setForwardedStatus(statusData);
                onForwardSuccess?.(statusData);
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel p-5 sm:p-6" data-testid="triage-facilities-list">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {isFacilityRequired
                ? "Nearest Facilities Directory"
                : "Nearest Facilities Directory"}
            </h3>
          </div>
          {effectiveLoc && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs font-semibold text-foreground/80 shadow-2xs">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {effectiveLoc.isNoLocation
                  ? "No Location Provided"
                  : [effectiveLoc.district, effectiveLoc.pincode].filter(Boolean).join(" · ") || effectiveLoc.matched || "Assam"}
              </span>
            </div>
          )}
        </div>

        {/* Weekend Operating Notice */}
        {isWeekend && dynamicFacilities?.length > 0 && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-950 dark:text-amber-200 shadow-2xs">
            <AlertOctagon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-extrabold text-xs">
                Weekend Schedule Active ({dispensaryStatus.reason || "Saturday / Sunday"}):
              </p>
              <p className="text-[11.5px] text-amber-900 dark:text-amber-300 mt-0.5 leading-snug">
                ESIS Dispensaries operate Monday–Friday 10:00 AM – 3:00 PM (Closed Sat &amp; Sun). All 4 facility types are displayed below for immediate caller referral. For acute symptoms, direct patient to 24x7 Casualty at the nearest Hospital.
              </p>
            </div>
          </div>
        )}

        {/* ASSAM HEALTH NETWORK MAP CONTAINER */}
        <div className="mt-4 rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
          {/* Map Top Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-secondary/40 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-primary shrink-0" />
              <span className="font-bold text-foreground">Assam Health Map</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Layer Switcher: Minimal vs Detailed */}
              <div className="inline-flex rounded-lg border border-border/80 bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMapLayer("minimal")}
                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                    mapLayer === "minimal"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Minimal Map Layer (CARTO Voyager)"
                >
                  Minimal
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayer("detailed")}
                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                    mapLayer === "detailed"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Detailed Map Layer (Google Maps)"
                >
                  Detailed
                </button>
              </div>

              {/* Drop Pin Toggle */}
              <button
                type="button"
                onClick={() => setIsPinModeActive((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-2xs border ${
                  isPinModeActive
                    ? "bg-rose-600 text-white border-rose-500 animate-pulse"
                    : "bg-background border-border/80 text-foreground hover:bg-secondary hover:border-primary/50"
                }`}
                title="Drop custom pin on map to set location"
              >
                <Crosshair className="h-3 w-3" />
                <span>{isPinModeActive ? "Click on Map" : "Drop Pin"}</span>
              </button>

              {/* Reset View */}
              <button
                type="button"
                onClick={() => mapRef.current?.resetView()}
                className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shadow-2xs"
                title="Reset Assam map view"
              >
                <RotateCcw className="h-3 w-3" />
              </button>

              {/* Full-Screen / Make Large Modal Button */}
              <button
                type="button"
                onClick={() => setIsMapExpanded(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer shadow-2xs"
                title="Expand Assam Map Full Screen"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Large View</span>
              </button>
            </div>
          </div>

          {/* Active Drop Pin Hint Banner */}
          {isPinModeActive && (
            <div className="bg-rose-500/15 border-b border-rose-500/30 px-3 py-1.5 text-center text-xs font-bold text-rose-700 dark:text-rose-300 animate-in fade-in">
              📍 Drop Pin Active: Click anywhere inside Assam to set a custom location and recalculate distances!
            </div>
          )}

          {/* Map Canvas */}
          <div className="h-[340px] sm:h-[380px] w-full relative bg-[#0a1128]">
            <MapWrapper
              ref={mapRef}
              theme="light"
              isLargeView={false}
              facilities={dynamicFacilities.slice(0, visibleFacilityCount)}
              filters={{
                mapLayer,
                district: effectiveLoc?.district || "all",
                searchQuery: searchPincode || "",
                radius: 0,
              }}
              targetLocation={effectiveTargetLocation}
              isPinModeActive={isPinModeActive}
              onPinDropped={handlePinDropped}
              onDistrictSelect={handleDistrictSelect}
              selectedFacility={selectedFacilityForMap}
            />
          </div>
        </div>

        {/* Inline search bar to change/search another pincode anytime */}
        <div className="mt-3.5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/40 p-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Search className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Search / Change Location:</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFacilitySearch();
            }}
            className="flex items-center gap-1.5 flex-1 max-w-md ml-auto"
          >
            <input
              type="text"
              value={searchPincode}
              onChange={(e) => setSearchPincode(e.target.value)}
              placeholder="Enter PIN code (e.g. 782435) or District (e.g. Hojai)..."
              className="flex-1 min-w-0 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={isSearchingFacilities || !searchPincode.trim()}
              className="flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer shrink-0 shadow-2xs"
            >
              {isSearchingFacilities ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              <span>Search</span>
            </button>
          </form>
        </div>

        {dynamicFacilities?.length ? (
          <>
            <ul className="mt-3 space-y-3">
              {dynamicFacilities.slice(0, visibleFacilityCount).map((f, i) => {
                const cleanDisplayAddress = f.address
                  ? f.address
                      .replace(/[\uFFFD\u00BF\u00EF\u00BF\u00BD]+/g, " - ")
                      .replace(/\b(pin|pincode)?\s*[-:,]?\s*78\d{4}\b/gi, "")
                      .replace(/\s*-\s*-\s*/g, " - ")
                      .replace(/,\s*,/g, ",")
                      .replace(/\s*,\s*$/g, "")
                      .trim()
                  : "";

                const isSelectedOnMap = selectedFacilityForMap?.id === f.id || selectedFacilityForMap?.name === f.name;

                return (
                  <li
                    key={f.id || f.name + i}
                    data-testid="facility-card-item"
                    onClick={() => focusFacilityOnMap(f)}
                    className={`group rounded-xl border p-4 transition-all duration-200 shadow-2xs cursor-pointer ${
                      isSelectedOnMap
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border/70 bg-card/60 hover:bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-md border px-2 py-0.5 text-[10.5px] ${f.category_style || "bg-secondary/80 border-border/70 text-foreground/90 font-bold"}`}>
                            {f.facility_tag}
                          </span>

                          {(f.is_dispensary || isDispensary(f)) && isWeekend && (
                            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                              Closed on Weekends (OPD Mon–Fri 10AM–4PM)
                            </span>
                          )}
                          {(f.is_dispensary || isDispensary(f)) && !isWeekend && (
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                              OPD: Mon–Fri 10:00 AM – 4:00 PM
                            </span>
                          )}
                          {(f.is_hospital || isHospital(f) || f.is_tie_up || isTieUp(f)) && (
                            <span className="rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                              Open · IPD &amp; Casualty: 24x7
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                        <span>{f.name}</span>
                      </p>

                      {cleanDisplayAddress && (
                        <p className="text-xs leading-relaxed text-muted-foreground">{cleanDisplayAddress}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {f.district && (
                            <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground font-medium">
                              {f.district}
                            </span>
                          )}
                          {getFacilityPincode(f) && (
                            <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground font-mono font-medium">
                              {getFacilityPincode(f)}
                            </span>
                          )}
                          {f.phone && (
                            <span className="mono text-primary font-bold">{f.phone}</span>
                          )}
                        </div>

                        {(f.distance_km != null || f.maps_url) && (
                          <span
                            className="inline-flex items-center text-[11.5px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            {f.distance_km != null
                              ? `Approx ${formatApproxKm(f.distance_km)} KM`
                              : "Approx -- KM"}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {visibleFacilityCount < dynamicFacilities.length && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleFacilityCount((prev) => prev + 6)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-2.5 text-xs font-bold transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                >
                  <span>Load More</span>
                  <span className="text-[10px] opacity-75 font-mono">
                    ({dynamicFacilities.length - visibleFacilityCount} remaining)
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Interactive Search Card when no pincode/location was provided */
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-5 space-y-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                <MapPin className="h-5 w-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  No PIN Code Entered by Caller
                </h4>
                <p className="text-xs text-amber-900/90 dark:text-amber-300 leading-relaxed">
                  Triage clinical decision is evaluated above. To view and rank nearest healthcare facilities in ascending distance order, please enter the caller&apos;s 6-digit Assam PIN code or District below, or click <strong>&quot;Drop Pin&quot;</strong> on the map above:
                </p>
              </div>
            </div>

            {/* Quick Assam Location Shortcuts */}
            <div className="space-y-2 pt-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300 block">
                Quick Location Shortcuts (Click to load):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Hojai", pin: "782435" },
                  { name: "Guwahati / Beltola", pin: "781022" },
                  { name: "Dispur", pin: "781006" },
                  { name: "Dibrugarh", pin: "786001" },
                  { name: "Silchar", pin: "788001" },
                  { name: "Tezpur", pin: "784001" },
                  { name: "Tinsukia", pin: "786125" },
                  { name: "Bongaigaon", pin: "783380" },
                  { name: "Nagaon", pin: "782001" },
                  { name: "Jorhat", pin: "785001" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchPincode(item.pin);
                      handleFacilitySearch(item.pin);
                    }}
                    className="flex items-center gap-1 rounded-full border border-amber-600/30 bg-white/90 dark:bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:border-primary hover:bg-primary/10 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <span>📍</span>
                    <span>{item.name} ({item.pin})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FULL-SCREEN / LARGE VIEW MODAL FOR ASSAM MAP (PORTALED TO DOCUMENT.BODY OVER ENTIRE WEBSITE) */}
      {isMapExpanded && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col w-screen h-screen min-w-[100vw] min-h-[100vh] bg-slate-100/98 dark:bg-slate-950/98 p-3 sm:p-4 lg:p-5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          {/* Modal Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-800 dark:text-slate-100 shadow-sm mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Assam Health Map — Large View
                  </h3>
                </div>
              </div>
            </div>

            {/* Modal Toolbar Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Location / PIN code in Large Map View */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (largeViewSearchPin.trim()) {
                    handleFacilitySearch(largeViewSearchPin.trim());
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={largeViewSearchPin}
                    onChange={(e) => setLargeViewSearchPin(e.target.value)}
                    placeholder="Enter PIN (e.g. 782410) or District..."
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 w-48 sm:w-56"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingFacilities || !largeViewSearchPin.trim()}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1 shrink-0 disabled:opacity-50"
                  title="Search facilities near this PIN code"
                >
                  {isSearchingFacilities ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  <span>Search</span>
                </button>
              </form>

              {/* District Filter Dropdown */}
              <select
                value={selectedDistrictFilter}
                onChange={(e) => handleDistrictSelect(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 shadow-2xs"
              >
                <option value="all">All Assam Districts</option>
                {ASSAM_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Minimal vs Detailed Layer Buttons */}
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMapLayer("minimal")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    mapLayer === "minimal"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Minimal
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayer("detailed")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    mapLayer === "detailed"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Detailed (Google)
                </button>
              </div>

              {/* Drop Pin Toggle */}
              <button
                type="button"
                onClick={() => setIsPinModeActive((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                  isPinModeActive
                    ? "bg-rose-600 text-white border-rose-500 animate-pulse"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>{isPinModeActive ? "Click Map to Drop Pin" : "Drop Pin"}</span>
              </button>

              {/* Reset View */}
              <button
                type="button"
                onClick={() => fullScreenMapRef.current?.resetView()}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
                title="Reset View"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsMapExpanded(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <X className="h-4 w-4" />
                <span>Close (Esc)</span>
              </button>
            </div>
          </div>

          {/* Modal Main Body */}
          <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
            {/* Map Canvas */}
            <div className="flex-1 h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-[#0a1128] shadow-sm">
              {isPinModeActive && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-rose-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce">
                  📍 Click anywhere inside Assam to drop location pin &amp; recalculate
                </div>
              )}
              <MapWrapper
                ref={fullScreenMapRef}
                theme="light"
                isLargeView={true}
                facilities={modalDrawerFacilities}
                filters={{
                  mapLayer,
                  district: selectedDistrictFilter !== "all" ? selectedDistrictFilter : (effectiveLoc?.district || "all"),
                  searchQuery: searchPincode || "",
                  radius: 0,
                }}
                targetLocation={effectiveTargetLocation}
                isPinModeActive={isPinModeActive}
                onPinDropped={handlePinDropped}
                onDistrictSelect={handleDistrictSelect}
                selectedFacility={selectedFacilityForMap}
              />
            </div>

            {/* Right Side Facility Drawer (in full-screen mode) */}
            <div className="hidden lg:flex w-80 sm:w-96 xl:w-[410px] flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-800 dark:text-slate-100 overflow-hidden shadow-sm shrink-0">
              {/* Drawer Header & Count */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>Healthcare Facilities</span>
                  </h4>
                  <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 font-bold">
                    {Math.min(drawerVisibleCount, modalDrawerFacilities.length)} of {modalDrawerFacilities.length} shown
                  </span>
                </div>
              </div>

              {/* Scrollable Facility Cards in Drawer */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {modalDrawerFacilities.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No facilities found matching your criteria.
                  </div>
                ) : (
                  <>
                    {modalDrawerFacilities.slice(0, drawerVisibleCount).map((f, i) => {
                      const cleanDisplayAddress = f.address
                        ? f.address
                            .replace(/[\uFFFD\u00BF\u00EF\u00BF\u00BD]+/g, " - ")
                            .replace(/\b(pin|pincode)?\s*[-:,]?\s*78\d{4}\b/gi, "")
                            .replace(/\s*-\s*-\s*/g, " - ")
                            .replace(/,\s*,/g, ",")
                            .replace(/\s*,\s*$/g, "")
                            .trim()
                        : "";

                      const isSelectedOnMap = selectedFacilityForMap?.id === f.id || selectedFacilityForMap?.name === f.name;

                      return (
                        <div
                          key={f.id || f.name + i}
                          onClick={() => focusFacilityOnMap(f)}
                          className={`rounded-xl border p-3.5 transition-all duration-200 cursor-pointer shadow-2xs space-y-2 ${
                            isSelectedOnMap
                              ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/30"
                              : "border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/60 hover:shadow-xs"
                          }`}
                        >
                          {/* Badges row matching homepage */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-md border px-2 py-0.5 text-[10.5px] ${f.category_style || "bg-secondary/80 border-border/70 text-foreground/90 font-bold"}`}>
                                {f.facility_tag}
                              </span>

                              {(f.is_dispensary || isDispensary(f)) && isWeekend && (
                                <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                                  Closed on Weekends
                                </span>
                              )}
                              {(f.is_dispensary || isDispensary(f)) && !isWeekend && (
                                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                  OPD: Mon–Fri 10AM–4PM
                                </span>
                              )}
                              {(f.is_hospital || isHospital(f) || f.is_tie_up || isTieUp(f)) && (
                                <span className="rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                                  Open · 24x7 Casualty
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Facility Name */}
                          <p
                            onClick={(e) => {
                              e.stopPropagation();
                              focusFacilityOnMap(f);
                            }}
                            className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="leading-snug">{f.name}</span>
                          </p>

                          {/* Clean Address */}
                          {cleanDisplayAddress && (
                            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                              {cleanDisplayAddress}
                            </p>
                          )}

                          {/* Footer row: District, Pincode, Approx KM, and Phone */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/60 text-[10.5px]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {f.district && (
                                <span className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-slate-600 dark:text-slate-400 font-medium">
                                  {f.district}
                                </span>
                              )}
                              {getFacilityPincode(f) && (
                                <span className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-slate-600 dark:text-slate-400 font-mono font-medium">
                                  {getFacilityPincode(f)}
                                </span>
                              )}
                              {f.distance_km != null && (
                                <span
                                  className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-300 font-bold"
                                >
                                  Approx {formatApproxKm(f.distance_km)} KM
                                </span>
                              )}
                            </div>

                            {f.phone && (
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{f.phone}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {drawerVisibleCount < modalDrawerFacilities.length && (
                      <div className="pt-2 pb-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setDrawerVisibleCount((prev) => prev + 6)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 py-2.5 text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <span>Load More</span>
                          <span className="text-[10px] opacity-75 font-mono">
                            ({modalDrawerFacilities.length - drawerVisibleCount} remaining)
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
