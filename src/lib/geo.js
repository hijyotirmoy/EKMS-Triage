// Geo utilities: Haversine distance calculation, dynamic facility-based location resolution, and proximity routing
import assamPincodesData from "../data/assam_pincodes.json";
import { ASSAM_DISTRICTS, getDistrictCoordinates, normalizeDistrict } from "./districts.js";
import { detectAssamLocationFromText } from "./assamLocations.js";

/**
 * Normalizes facility coordinates directly from the database/facility directory.
 * Auto-corrects any longitude formatting issues (e.g. missing leading 9 in Assam: 1.767... -> 91.767...).
 */
export function cleanFacilityCoordinates(facilities = []) {
  if (!Array.isArray(facilities)) return [];
  return facilities.filter(Boolean).map((f) => {
    let lat = f.latitude != null ? Number(f.latitude) : null;
    let lon = f.longitude != null ? Number(f.longitude) : null;
    // Guard against typo where Assam longitude is missing leading 9 (e.g. 1.7677... -> 91.7677...)
    if (lon != null && lon > 0 && lon < 20 && lat != null && lat > 20 && lat < 30) {
      lon = Number((90 + lon).toFixed(8));
    }
    return { ...f, latitude: lat, longitude: lon };
  });
}

export function isEsicHospital(f) {
  if (!f) return false;
  const name = (f.name || "").toLowerCase();
  const type = (f.facility_type || "").toLowerCase();
  const scheme = (f.scheme || "").toLowerCase();
  return (
    name.includes("esic hospital") ||
    (type === "hospital" && scheme === "esic") ||
    name === "esic hospital beltola" ||
    name === "esic hospital tinsukia"
  );
}

export function isTieUp(f) {
  if (!f) return false;
  const type = (f.facility_type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();
  const scheme = (f.scheme || "").toLowerCase();

  return (
    type.includes("tie-up") ||
    type.includes("tie up") ||
    type.includes("empanelled") ||
    type.includes("diagnostic") ||
    name.includes("tie-up") ||
    name.includes("tie up") ||
    name.includes("empanelled") ||
    scheme.includes("tie")
  );
}

export function isGovtDistrictHospital(f) {
  if (!f || isEsicHospital(f) || isTieUp(f)) return false;
  const type = (f.facility_type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();

  return (
    type.includes("district hospital") ||
    type.includes("civil hospital") ||
    type.includes("medical college") ||
    name.includes("civil hospital") ||
    name.includes("district hospital") ||
    name.includes("medical college") ||
    name.includes("general hospital") ||
    type === "hospital"
  );
}

export function isDispensary(f) {
  if (!f || isEsicHospital(f) || isGovtDistrictHospital(f) || isTieUp(f)) return false;
  const type = (f.facility_type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();

  return (
    type.includes("dispensary") ||
    type.includes("opd") ||
    type.includes("clinic") ||
    name.includes("dispensary") ||
    name.includes("clinic")
  );
}

export function isHospital(f) {
  return isEsicHospital(f) || isGovtDistrictHospital(f);
}

export function getFacilityCategoryType(f) {
  if (isEsicHospital(f)) return "ESIC_HOSPITAL";
  if (isGovtDistrictHospital(f)) return "GOVT_DISTRICT_HOSPITAL";
  if (isDispensary(f)) return "DISPENSARY";
  if (isTieUp(f)) return "TIE_UP_HOSPITAL";
  return "OTHER";
}

export function getFacilityCategoryLabel(f) {
  if (isEsicHospital(f)) return "ESIC Hospital · Secondary Care & Casualty";
  if (isGovtDistrictHospital(f)) return "Govt District Hospital · 24x7 Casualty";
  if (isDispensary(f)) return "ESIS Dispensary · Primary Care OPD";
  if (isTieUp(f)) return "Empanelled Tie-Up Hospital";
  return f.facility_type || "Medical Facility";
}

export function getFacilityTier(facility, isSevere) {
  if (isTieUp(facility)) return 2; // Tier 3: Tie-up facility

  if (isSevere) {
    // Severe condition: Hospital (Tier 0) -> Dispensary (Tier 1) -> Tie-up (Tier 2)
    if (isHospital(facility)) return 0;
    if (isDispensary(facility)) return 1;
    return 2;
  } else {
    // Normal / Moderate condition: Dispensary (Tier 0) -> Hospital (Tier 1) -> Tie-up (Tier 2)
    if (isDispensary(facility)) return 0;
    if (isHospital(facility)) return 1;
    return 2;
  }
}

/**
 * Intelligent sub-type guesser based on facility name and primary category (from EKMS Map)
 */
export function deriveSubType(name = "", type = "NHM") {
  const nameUpper = (name || "").toUpperCase();
  const cleanType = (type || "").toUpperCase();

  if (cleanType === "ESIC") {
    if (nameUpper.includes("TIE UP") || nameUpper.includes("TIE-UP")) {
      return "ESIC Tie-Up Hospital";
    }
    if (nameUpper.includes("HOSPITAL")) {
      return "ESIC Hospital";
    }
    return "ESIS Dispensary";
  }

  // NHM Sub-types
  if (
    nameUpper.includes("DISTRICT HOSPITAL") ||
    nameUpper.includes("CIVIL HOSPITAL") ||
    nameUpper.includes("MEDICAL COLLEGE") ||
    nameUpper.match(/\bDH\b/)
  ) {
    return "DH";
  }
  if (nameUpper.includes("SUB DIVISIONAL") || nameUpper.match(/\bSDH\b/)) {
    return "SDH";
  }
  if (nameUpper.includes("PRIMARY HEALTH") || nameUpper.match(/\bPHC\b/)) {
    return "PHC";
  }
  return "CHC";
}

/**
 * Strict Assam coordinate sanitation (from EKMS Map):
 * Auto-corrects missing decimals and ensures point lies strictly within Assam bounds (Lat 24.0-28.3, Lng 89.6-96.3)
 */
export function sanitizeCoordinates(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { lat: null, lng: null };
  }
  let pLat = typeof lat === "number" ? lat : parseFloat(lat);
  let pLng = typeof lng === "number" ? lng : parseFloat(lng);

  if (isNaN(pLat) || isNaN(pLng)) {
    return { lat: null, lng: null };
  }

  // Auto-correct missing decimal point in longitude (e.g. 9263827268... -> 92.63827268)
  if (pLng > 180) {
    const str = pLng.toString();
    if (
      str.startsWith("89") ||
      str.startsWith("90") ||
      str.startsWith("91") ||
      str.startsWith("92") ||
      str.startsWith("93") ||
      str.startsWith("94") ||
      str.startsWith("95") ||
      str.startsWith("96")
    ) {
      pLng = parseFloat(str.slice(0, 2) + "." + str.slice(2));
    }
  }

  // Strict check: Is coordinate inside Assam? (Lat: 24.0-28.3, Lng: 89.6-96.3)
  if (pLat < 24.0 || pLat > 28.3 || pLng < 89.6 || pLng > 96.3) {
    return { lat: null, lng: null };
  }

  return { lat: pLat, lng: pLng };
}

/**
 * Haversine distance in meters (from EKMS Map)
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100;
}

/**
 * Calculates approximate road driving distance in kilometers.
 * Applies the empirical road circuity factor (~1.28x) for Assam road terrain,
 * with realistic baseline buffer for local arterial road access.
 */
export function calculateRoadDistanceKm(lat1, lon1, lat2, lon2) {
  const straightKm = calculateHaversineDistanceKm(lat1, lon1, lat2, lon2);
  if (straightKm == null) return null;
  const roadKm = straightKm * 1.28;
  return Math.round(roadKm * 10) / 10;
}

/**
 * Resolves caller location dynamically based on caller Pincode, District, City, or Coordinates/IP.
 * Caller's explicit PINCODE/District always takes precedence over workstation IP coordinates.
 */
export function resolveCallerLocation(input, facilities = []) {
  const cleanFacs = cleanFacilityCoordinates(facilities);
  let callerPin = input?.pincode ? String(input.pincode).trim() : null;
  const callerDist = input?.district ? String(input.district).trim() : null;
  const callerCity = input?.city ? String(input.city).trim() : null;

  // Auto-extract 6-digit Assam pincode if mentioned in notes/address
  if (!callerPin && input?.symptom_notes) {
    const extracted = String(input.symptom_notes).match(/\b(78\d{4})\b/);
    if (extracted) callerPin = extracted[1];
  }
  if (!callerPin && input?.address) {
    const extracted = String(input.address).match(/\b(78\d{4})\b/);
    if (extracted) callerPin = extracted[1];
  }

  // Fallback to IP postal if caller didn't supply pincode
  if (!callerPin) {
    callerPin = (input?.ip_pincode ?? input?.postal ?? input?.ip_postal)
      ? String(input?.ip_pincode ?? input?.postal ?? input?.ip_postal).trim()
      : null;
  }

  const rawDistrict = callerDist || input?.ip_district || input?.region || input?.ip_region;
  const rawCity = callerCity || input?.ip_city || input?.location || input?.ip_location;

  // 1. EXPLICIT GPS / NOMINATIM COORDINATES (Highest Priority when coordinates are supplied)
  const rawLat = input?.latitude ?? input?.lat;
  const rawLon = input?.longitude ?? input?.lon;

  if (
    rawLat != null &&
    rawLon != null &&
    !isNaN(Number(rawLat)) &&
    !isNaN(Number(rawLon)) &&
    Number(rawLat) !== 0 &&
    Number(rawLon) !== 0
  ) {
    const latNum = Number(rawLat);
    const lonNum = Number(rawLon);

    let closestPin = null;
    let minPinD = Infinity;
    if (assamPincodesData) {
      for (const [pin, pData] of Object.entries(assamPincodesData)) {
        if (pData.lat != null && pData.lng != null) {
          const d = calculateHaversineDistanceKm(latNum, lonNum, pData.lat, pData.lng);
          if (d != null && d < minPinD) {
            minPinD = d;
            closestPin = { pin, ...pData, distKm: d };
          }
        }
      }
    }

    const isDropPin = Boolean(input?.isDroppedPin || input?.is_drop_pin || input?.method === "dropped_pin");
    const validCallerPin = callerPin && /^\d{6}$/.test(callerPin) ? callerPin : null;
    const resolvedPin = validCallerPin || (minPinD <= 25 && closestPin?.pin ? closestPin.pin : null);
    const resolvedDistrict =
      (rawDistrict && String(rawDistrict).trim()) ||
      closestPin?.district ||
      null;
    const resolvedCity = input?.city || closestPin?.office || null;

    return {
      latitude: latNum,
      longitude: lonNum,
      pincode: resolvedPin,
      district: resolvedDistrict,
      city: resolvedCity,
      method: isDropPin ? "dropped_pin" : "coordinates",
      matched: isDropPin
        ? `Dropped Pin (${latNum.toFixed(4)}, ${lonNum.toFixed(4)})`
        : (validCallerPin ? `PIN: ${validCallerPin}${resolvedDistrict ? ` (${resolvedDistrict})` : ""}` : `Location (${latNum.toFixed(4)}, ${lonNum.toFixed(4)})`),
      isDistrictOnly: false,
      isNoLocation: false,
      isDroppedPin: isDropPin,
    };
  }

  // 2. PINCODE RESOLUTION (Official Postal & GST GIS centroid coordinates)
  if (callerPin) {
    // If caller explicitly provided a district, verify that the callerPin does not belong to a completely different district.
    // If it belongs to a different district (e.g. caller changed district to Tinsukia but stale 781001 remained), prioritize the updated district.
    const pinDistrict = assamPincodesData?.[callerPin]?.district;
    const isPinConflictingWithDistrict =
      Boolean(rawDistrict && pinDistrict && normalizeDistrict(pinDistrict) !== normalizeDistrict(rawDistrict));

    if (!isPinConflictingWithDistrict) {
      // 1a. Canonical Assam Pincode Database (Exact permanent match)
      if (assamPincodesData && assamPincodesData[callerPin]) {
        const pinData = assamPincodesData[callerPin];
        const canonicalDistrict = pinData.district
          ? ASSAM_DISTRICTS.find((d) => normalizeDistrict(d) === normalizeDistrict(pinData.district)) ||
            String(pinData.district).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
          : (rawDistrict || null);

        return {
          latitude: Number(pinData.lat),
          longitude: Number(pinData.lng),
          pincode: callerPin,
          district: canonicalDistrict,
          method: "pincode",
          matched: `PIN: ${callerPin}${canonicalDistrict ? ` (${canonicalDistrict})` : ""}`,
          isDistrictOnly: false,
        };
      }

      // 1b. Exact facility pincode match
      const match = cleanFacs.find(
        (f) => f.pincode && String(f.pincode).trim() === callerPin && f.latitude != null
      );
      if (match) {
        return {
          latitude: match.latitude,
          longitude: match.longitude,
          pincode: callerPin,
          district: match.district || rawDistrict || null,
          method: "pincode",
          matched: `PIN: ${callerPin} (${match.district || match.name})`,
          isDistrictOnly: false,
        };
      }

      // 1c. Address text match containing pincode
      const addrMatch = cleanFacs.find(
        (f) => f.address && f.address.includes(callerPin) && f.latitude != null
      );
      if (addrMatch) {
        return {
          latitude: addrMatch.latitude,
          longitude: addrMatch.longitude,
          pincode: callerPin,
          district: addrMatch.district || rawDistrict || null,
          method: "pincode",
          matched: `PIN: ${callerPin} (${addrMatch.district || addrMatch.name})`,
          isDistrictOnly: false,
        };
      }
      // 1d. If a 6-digit PIN code is supplied, find nearest Assam postal PIN code
      if (/^\d{6}$/.test(callerPin)) {
        const pinNum = parseInt(callerPin, 10);
        const allPins = Object.keys(assamPincodesData || {});
        if (allPins.length > 0) {
          allPins.sort((a, b) => Math.abs(parseInt(a, 10) - pinNum) - Math.abs(parseInt(b, 10) - pinNum));
          const closestPin = allPins[0];
          const pinData = assamPincodesData[closestPin];
          const canonicalDistrict = pinData.district
            ? ASSAM_DISTRICTS.find((d) => normalizeDistrict(d) === normalizeDistrict(pinData.district)) ||
              String(pinData.district).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
            : (rawDistrict || null);

          return {
            latitude: Number(pinData.lat),
            longitude: Number(pinData.lng),
            pincode: callerPin,
            district: canonicalDistrict,
            method: "pincode",
            matched: `PIN: ${callerPin}${canonicalDistrict ? ` (${canonicalDistrict})` : ""}`,
            isDistrictOnly: false,
          };
        }
      }
    }
  }

  // 2. DISTRICT RESOLUTION: First match canonical district centroid, then fallback to district facilities
  if (rawDistrict && String(rawDistrict).trim()) {
    const cleanDist = String(rawDistrict).trim().toLowerCase();
    const distCenter = getDistrictCoordinates(cleanDist);
    if (distCenter) {
      return {
        latitude: distCenter.lat,
        longitude: distCenter.lng,
        pincode: callerPin || null,
        district: distCenter.name,
        method: "district_centroid",
        matched: `District ${distCenter.name}`,
        isDistrictOnly: !callerPin,
      };
    }

    const match =
      cleanFacs.find(
        (f) => f.district && f.district.toLowerCase() === cleanDist && f.latitude != null
      ) ||
      cleanFacs.find(
        (f) => f.district && f.district.toLowerCase().includes(cleanDist) && f.latitude != null
      );
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        pincode: callerPin || match.pincode || null,
        district: match.district,
        method: "district",
        matched: `District ${match.district}`,
        isDistrictOnly: !callerPin,
      };
    }
  }

  // 3. CITY / LOCATION RESOLUTION: Match against facilities in caller's city
  if (rawCity && String(rawCity).trim()) {
    const cleanCity = String(rawCity).trim().toLowerCase();
    const match = cleanFacs.find(
      (f) =>
        ((f.district && f.district.toLowerCase().includes(cleanCity)) ||
          (f.name && f.name.toLowerCase().includes(cleanCity)) ||
          (f.address && f.address.toLowerCase().includes(cleanCity))) &&
        f.latitude != null
    );
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        pincode: callerPin || match.pincode || null,
        district: match.district || null,
        method: "city",
        matched: `City / Location ${rawCity}`,
        isDistrictOnly: false,
      };
    }
  }



  // 4. ASSAM LANDMARK RESOLUTION (e.g. Zoo Road Tiniali, Paltan Bazaar, Six Mile, Dispur)
  const fullTextToSearch = `${rawCity || ""} ${input?.address || ""} ${input?.symptom_notes || ""}`.trim();
  if (fullTextToSearch) {
    const landmarkMatch = detectAssamLocationFromText(fullTextToSearch);
    if (landmarkMatch.found) {
      return {
        latitude: landmarkMatch.lat,
        longitude: landmarkMatch.lng,
        pincode: callerPin || landmarkMatch.pincode || null,
        district: landmarkMatch.district || rawDistrict || null,
        method: landmarkMatch.type === "landmark" ? "landmark" : "pincode",
        matched: `${landmarkMatch.name}${landmarkMatch.pincode ? ` (${landmarkMatch.pincode})` : ""}`,
        isDistrictOnly: false,
      };
    }
  }

  // 5. NO PINCODE / LOCATION ENTERED: DO NOT default to Beltola or any default pincode!
  return {
    latitude: null,
    longitude: null,
    pincode: null,
    district: null,
    method: "none",
    matched: "No pincode provided",
    isNoLocation: true,
    isDistrictOnly: false,
  };
}

/**
 * Checks if ESIS Dispensary is currently open in Assam:
 * - Monday to Friday: 10:00 AM – 4:00 PM IST
 * - 1st & 3rd Saturday: 10:00 AM – 12:00 PM IST
 * - Closed: 2nd, 4th, 5th Saturday & all Sundays
 */
export function isDispensaryOpenNow(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  const dateOfMonth = istDate.getDate();
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const isSunday = day === 0;
  const is1stOr3rdSaturday = day === 6 && ((dateOfMonth >= 1 && dateOfMonth <= 7) || (dateOfMonth >= 15 && dateOfMonth <= 21));
  const is2ndOr4thOr5thSaturday = day === 6 && !is1stOr3rdSaturday;

  if (isSunday || is2ndOr4thOr5thSaturday) return false;
  if (is1stOr3rdSaturday) {
    return currentMinutes >= 600 && currentMinutes < 720; // 10:00 AM to 12:00 PM IST
  }
  return currentMinutes >= 600 && currentMinutes < 960; // Mon-Fri 10:00 AM to 4:00 PM IST
}

/**
 * Ranks nearest facilities based on clinical rules:
 * 
 * Clinical Criteria:
 * - Mild: Low-intensity, localized, or early-stage symptoms. Little to no disruption of daily activities, normal functions, or vitals.
 *   Forwarding: During open hours -> 1st: ESIS Dispensary, 2nd: 104, 3rd: ESIC Hospital, 4th: Govt Hospital, 5th: Tie-up, 6th: 108.
 *   During closed hours -> 1st: 104, 2nd: Dispensary, 3rd: ESIC Hospital, 4th: Govt Hospital, 5th: Tie-up, 6th: 108.
 * 
 * - Moderate: Noticeable symptoms requiring active intervention or medication. Measurable interference with normal daily functioning, work, or physical activity.
 *   Forwarding:
 *   * If ESIC Hospital <= 15 KM: 1st: ESIC Hospital, 2nd: Govt Hospital, 3rd: Tie-up Hospital, 4th: Dispensary, 5th: 104, 6th: 108.
 *   * If ESIC Hospital > 15 KM: 1st: Govt Hospital, 2nd: Tie-up Hospital, 3rd: ESIC Hospital, 4th: Dispensary, 5th: 104, 6th: 108.
 * 
 * - Severe: High-intensity, widespread, or life-threatening symptoms. Gross/total interference with basic physical function, organ systems, or consciousness.
 *   Forwarding:
 *   * Morning / daytime manageable in hospital directly (no active collapse):
 *     If ESIC Hospital <= 15 KM: 1st: ESIC Hospital (24x7 Casualty), 2nd: Govt Hospital, 3rd: Tie-up, 4th: 108, 5th: 104, 6th: Dispensary.
 *     If ESIC Hospital > 15 KM: 1st: Govt Hospital (24x7 Casualty), 2nd: Tie-up, 3rd: ESIC Hospital, 4th: 108, 5th: 104, 6th: Dispensary.
 *   * Critical life-or-death crisis (cardiac arrest, unconscious, gasping, spurting bleed, etc.):
 *     1st: 108 Ambulance, 2nd: ESIC Hospital (or Govt Hospital if closer), 3rd: Govt Hospital, 4th: Tie-up, 5th: 104, 6th: Dispensary.
 */
export function rankNearestFacilities(
  callerLoc,
  facilities = [],
  limit = 50,
  urgencyOrIsSevere = "Mild",
  isWeekend = null,
  options = {}
) {
  if (!facilities || !facilities.length) return [];
  if (
    !callerLoc ||
    callerLoc.isNoLocation ||
    (!callerLoc.pincode && !callerLoc.district && callerLoc.latitude == null)
  ) {
    return [];
  }

  const normUrgency = typeof urgencyOrIsSevere === "string"
    ? (urgencyOrIsSevere.toLowerCase().includes("sev") ? "Severe" : (urgencyOrIsSevere.toLowerCase().includes("mod") ? "Moderate" : "Mild"))
    : (urgencyOrIsSevere ? "Severe" : "Mild");

  // Determine if weekend schedule is active (Saturday / Sunday IST)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + (new Date().getTimezoneOffset() * 60 * 1000) + istOffset);
  const istDay = istDate.getDay();
  const istHour = istDate.getHours();
  const isMorningOrDaytime = istHour >= 6 && istHour < 18;

  const weekendActive = isWeekend !== null ? Boolean(isWeekend) : (istDay === 0 || istDay === 6);
  const isDispOpen = isDispensaryOpenNow(istDate);

  const cleanFacs = cleanFacilityCoordinates(facilities);
  const callerPin = callerLoc?.pincode ? String(callerLoc.pincode).trim() : null;
  const hasCoords = callerLoc && callerLoc.latitude != null && callerLoc.longitude != null;
  const isDistrictOnly = Boolean(
    callerLoc?.isDistrictOnly || (callerLoc?.district && !callerPin)
  );

  const scored = cleanFacs.map((f) => {
    const cleanFacPin = f.pincode ? String(f.pincode).trim() : null;
    const isExactPin = Boolean(
      callerPin && (
        (cleanFacPin && callerPin === cleanFacPin) ||
        (f.address && f.address.includes(callerPin))
      )
    );

    let dist = null;
    if (hasCoords && f.latitude != null && f.longitude != null) {
      dist = calculateRoadDistanceKm(
        callerLoc.latitude,
        callerLoc.longitude,
        f.latitude,
        f.longitude
      );
    }

    const pinDiff =
      callerPin && cleanFacPin && /^\d{6}$/.test(callerPin) && /^\d{6}$/.test(cleanFacPin)
        ? Math.abs(parseInt(cleanFacPin, 10) - parseInt(callerPin, 10))
        : 9999;
    const isNearbyPinArea = isExactPin || (pinDiff <= 5 && cleanFacPin.startsWith(callerPin.slice(0, 4)));

    let finalDist = dist;
    if (finalDist !== null && finalDist !== undefined) {
      if (finalDist <= 0.2) {
        finalDist = 0.5;
      } else {
        finalDist = Math.round(finalDist * 10) / 10;
      }
    } else {
      if (isExactPin) finalDist = 1.5;
      else if (pinDiff <= 2) finalDist = 3.5;
      else if (pinDiff <= 5) finalDist = 6.0;
      else finalDist = 9999;
    }

    const isSameDistrict = Boolean(
      callerLoc?.district &&
      f.district &&
      f.district.toLowerCase().trim() === callerLoc.district.toLowerCase().trim()
    );

    const catType = getFacilityCategoryType(f);
    const catLabel = getFacilityCategoryLabel(f);

    return {
      ...f,
      distance_km: finalDist,
      is_exact_pincode: isExactPin,
      is_nearby_pincode: isNearbyPinArea,
      is_same_district: isSameDistrict,
      pincode_difference: pinDiff,
      facility_category_type: catType,
      facility_category_label: catLabel,
      facility_tag: catLabel,
      is_esic_hospital: catType === "ESIC_HOSPITAL",
      is_govt_district_hospital: catType === "GOVT_DISTRICT_HOSPITAL",
      is_hospital: catType === "ESIC_HOSPITAL" || catType === "GOVT_DISTRICT_HOSPITAL",
      is_dispensary: catType === "DISPENSARY",
      is_tie_up: catType === "TIE_UP_HOSPITAL",
      maps_url: f.latitude && f.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name + " " + (f.address || ""))}`,
    };
  });

  const within50Km = scored.filter((f) => f.distance_km != null && f.distance_km <= 50);
  const beyond50Km = scored.filter((f) => f.distance_km == null || f.distance_km > 50);
  const eligiblePool = [...within50Km, ...beyond50Km];

  const byProximity = (a, b) => {
    if (a.is_exact_pincode !== b.is_exact_pincode) {
      return (b.is_exact_pincode ? 1 : 0) - (a.is_exact_pincode ? 1 : 0);
    }
    const distA = a.distance_km != null ? a.distance_km : 9999;
    const distB = b.distance_km != null ? b.distance_km : 9999;
    if (distA !== distB) {
      return distA - distB;
    }
    if (a.is_nearby_pincode !== b.is_nearby_pincode) {
      return (b.is_nearby_pincode ? 1 : 0) - (a.is_nearby_pincode ? 1 : 0);
    }
    if (isDistrictOnly && a.is_same_district !== b.is_same_district) {
      return (b.is_same_district ? 1 : 0) - (a.is_same_district ? 1 : 0);
    }
    return (a.name || "").localeCompare(b.name || "");
  };

  const sortedByProximity = [...eligiblePool].sort(byProximity);

  const selected = [];
  const selectedKeys = new Set();

  const addFacility = (fac) => {
    if (!fac) return;
    const key = fac.id || fac.name;
    if (!selectedKeys.has(key)) {
      selected.push(fac);
      selectedKeys.add(key);
    }
  };

  const exactPinFac = sortedByProximity.find((f) => f.is_exact_pincode);
  const nearestDispensary = sortedByProximity.find((f) => f.is_dispensary);
  const nearestEsic = sortedByProximity.find((f) => f.is_esic_hospital);
  const isEsicWithin15Km = Boolean(nearestEsic && nearestEsic.distance_km != null && nearestEsic.distance_km <= 15);
  const nearestGovtHosp = sortedByProximity.find((f) => f.is_govt_district_hospital);
  const nearestTieUp = sortedByProximity.find((f) => f.is_tie_up);

  if (normUrgency === "Mild") {
    // -------------------------------------------------------------
    // MILD CASES:
    // During dispensary open hours: 1st Dispensary, 3rd ESIC Hospital, 4th Govt Hospital, 5th Tie Up
    // During closed hours: 1st Open hospital, then dispensary next working day
    // -------------------------------------------------------------
    if (isDispOpen) {
      if (exactPinFac && exactPinFac.is_dispensary) {
        addFacility(exactPinFac);
      } else if (nearestDispensary) {
        addFacility(nearestDispensary);
      }
      if (nearestEsic) addFacility(nearestEsic);
      if (nearestGovtHosp) addFacility(nearestGovtHosp);
      if (nearestTieUp) addFacility(nearestTieUp);
    } else {
      // Off hours / closed: ESIC Hospital -> Govt Hospital -> Tie Up -> Dispensary
      if (nearestEsic) addFacility(nearestEsic);
      if (nearestGovtHosp) addFacility(nearestGovtHosp);
      if (nearestTieUp) addFacility(nearestTieUp);
      if (nearestDispensary) addFacility(nearestDispensary);
    }
  } else if (normUrgency === "Moderate") {
    // -------------------------------------------------------------
    // MODERATE CASES:
    // If ESIC Hospital <= 15 KM: 1st ESIC Hospital, 2nd Govt Hospital, 3rd Tie Up
    // If ESIC Hospital > 15 KM: 1st Govt Hospital, 2nd Tie Up, 3rd ESIC Hospital
    // -------------------------------------------------------------
    if (isEsicWithin15Km) {
      if (nearestEsic) addFacility(nearestEsic);
      if (nearestGovtHosp) addFacility(nearestGovtHosp);
      if (nearestTieUp) addFacility(nearestTieUp);
      if (nearestDispensary) addFacility(nearestDispensary);
    } else {
      if (nearestGovtHosp) addFacility(nearestGovtHosp);
      if (nearestTieUp) addFacility(nearestTieUp);
      if (nearestEsic) addFacility(nearestEsic);
      if (nearestDispensary) addFacility(nearestDispensary);
    }
  } else {
    // -------------------------------------------------------------
    // SEVERE CASES:
    // During morning if manageable in hospital:
    //   If ESIC <= 15 KM: 1st ESIC Hospital (24x7 Casualty), 2nd Govt Hospital, 3rd Tie Up
    //   If ESIC > 15 KM: 1st Govt Hospital (24x7 Casualty), 2nd Tie Up, 3rd ESIC Hospital
    // If needs 108 / critical emergency:
    //   1st Nearest Hospital Casualty (for ambulance transport)
    // -------------------------------------------------------------
    const isMorningManageable = isMorningOrDaytime && Boolean(options.isManageableInHospital);
    if (isMorningManageable) {
      if (isEsicWithin15Km) {
        if (nearestEsic) addFacility(nearestEsic);
        if (nearestGovtHosp) addFacility(nearestGovtHosp);
        if (nearestTieUp) addFacility(nearestTieUp);
      } else {
        if (nearestGovtHosp) addFacility(nearestGovtHosp);
        if (nearestTieUp) addFacility(nearestTieUp);
        if (nearestEsic) addFacility(nearestEsic);
      }
    } else {
      // Acute 108 emergency destination
      if (isEsicWithin15Km && nearestEsic) {
        addFacility(nearestEsic);
        if (nearestGovtHosp) addFacility(nearestGovtHosp);
        if (nearestTieUp) addFacility(nearestTieUp);
      } else if (nearestGovtHosp) {
        addFacility(nearestGovtHosp);
        if (nearestTieUp) addFacility(nearestTieUp);
        if (nearestEsic) addFacility(nearestEsic);
      } else if (nearestEsic) {
        addFacility(nearestEsic);
      }
    }
  }

  // Populate remaining slots from sortedByProximity
  for (const fac of sortedByProximity) {
    if (selected.length >= limit) break;
    addFacility(fac);
  }

  return selected.slice(0, limit);
}
