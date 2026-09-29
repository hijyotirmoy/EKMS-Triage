// Geo utilities: Haversine distance calculation, dynamic facility-based location resolution, and proximity routing

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
 * Resolves caller location dynamically using facilities from the facility page / DB.
 * Removes hardcoded pincode tables in favor of dynamic facility data matching.
 */
export function resolveCallerLocation(input, facilities = []) {
  const cleanFacs = cleanFacilityCoordinates(facilities);
  const { latitude, longitude, district, city } = input || {};
  let cleanPin = input?.pincode ? String(input.pincode).trim() : null;

  // Auto-extract 6-digit Assam pincode if mentioned in notes/address
  if (!cleanPin && input?.symptom_notes) {
    const extracted = String(input.symptom_notes).match(/\b(78\d{4})\b/);
    if (extracted) cleanPin = extracted[1];
  }
  if (!cleanPin && input?.address) {
    const extracted = String(input.address).match(/\b(78\d{4})\b/);
    if (extracted) cleanPin = extracted[1];
  }

  // If user selected an explicit district other than Kamrup, ignore default 781022 pincode so district routing takes effect
  const hasExplicitDist = Boolean(district && String(district).trim());
  const isDefaultPin = cleanPin === "781022";
  const isKamrupDist = hasExplicitDist && String(district).toLowerCase().includes("kamrup");
  if (isDefaultPin && hasExplicitDist && !isKamrupDist) {
    cleanPin = null;
  }

  // 1. PINCODE RESOLUTION: Match against facilities from facility directory
  if (cleanPin) {
    // 1a. Exact facility pincode match
    const match = cleanFacs.find(
      (f) => f.pincode && String(f.pincode).trim() === cleanPin && f.latitude != null
    );
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        pincode: cleanPin,
        district: match.district || null,
        method: "pincode",
        matched: `Pincode ${cleanPin} (${match.name})`,
        isDistrictOnly: false,
      };
    }

    // 1b. Address text match containing pincode
    const addrMatch = cleanFacs.find(
      (f) => f.address && f.address.includes(cleanPin) && f.latitude != null
    );
    if (addrMatch) {
      return {
        latitude: addrMatch.latitude,
        longitude: addrMatch.longitude,
        pincode: cleanPin,
        district: addrMatch.district || null,
        method: "pincode",
        matched: `Pincode ${cleanPin} (${addrMatch.name})`,
        isDistrictOnly: false,
      };
    }

    // 1c. Numerically closest pincode match in same postal delivery zone (e.g. 782411 -> 782410 Jagiroad)
    if (/^\d{6}$/.test(cleanPin)) {
      const pinNum = parseInt(cleanPin, 10);
      const sameZone = cleanFacs.filter(
        (f) => f.pincode && /^\d{6}$/.test(String(f.pincode).trim()) && f.latitude != null
      );

      if (sameZone.length > 0) {
        // First check in same 3-digit circle (e.g. 782xxx)
        const same3 = sameZone.filter((f) => String(f.pincode).startsWith(cleanPin.slice(0, 3)));
        const candidates = same3.length > 0 ? same3 : sameZone;

        candidates.sort((a, b) => {
          const diffA = Math.abs(parseInt(a.pincode, 10) - pinNum);
          const diffB = Math.abs(parseInt(b.pincode, 10) - pinNum);
          return diffA - diffB;
        });

        const closest = candidates[0];
        const diff = Math.abs(parseInt(closest.pincode, 10) - pinNum);

        // If within neighboring post office cluster (<= 15 difference)
        if (diff <= 15) {
          return {
            latitude: closest.latitude,
            longitude: closest.longitude,
            pincode: cleanPin,
            district: closest.district || null,
            method: "nearby_pincode",
            matched: `Pincode ${cleanPin} (Near ${closest.name} · ${closest.pincode})`,
            isDistrictOnly: false,
          };
        }

        // Otherwise within 4-digit prefix
        const p4 = cleanPin.substring(0, 4);
        const prefix4Matches = sameZone.filter((f) => String(f.pincode).startsWith(p4));
        if (prefix4Matches.length > 0) {
          prefix4Matches.sort((a, b) => Math.abs(parseInt(a.pincode, 10) - pinNum) - Math.abs(parseInt(b.pincode, 10) - pinNum));
          const best = prefix4Matches[0];
          return {
            latitude: best.latitude,
            longitude: best.longitude,
            pincode: cleanPin,
            district: best.district || null,
            method: "pincode",
            matched: `Pincode Area ${cleanPin} (Near ${best.name} · ${best.pincode})`,
            isDistrictOnly: false,
          };
        }
      }
    }
  }

  // 2. DISTRICT RESOLUTION: Match against facilities from facility directory
  if (district && String(district).trim()) {
    const cleanDist = String(district).trim().toLowerCase();
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
        pincode: cleanPin || match.pincode || null,
        district: match.district,
        method: "district",
        matched: `District ${match.district}`,
        isDistrictOnly: !cleanPin,
      };
    }
  }

  // 3. CITY RESOLUTION: Match against facilities
  if (city && String(city).trim()) {
    const cleanCity = String(city).trim().toLowerCase();
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
        pincode: cleanPin || match.pincode || null,
        district: match.district || null,
        method: "city",
        matched: `City ${city}`,
        isDistrictOnly: false,
      };
    }
  }

  // 4. EXPLICIT GPS COORDINATES
  if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      pincode: cleanPin || null,
      district: null,
      method: "coordinates",
      matched: `GPS (${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`,
      isDistrictOnly: false,
    };
  }

  // 5. DEFAULT FALLBACK: Default explicitly to ESIC Hospital Beltola (781022)
  const beltolaFac = cleanFacs.find(
    (f) =>
      (f.name && f.name.toLowerCase().includes("beltola")) ||
      (f.pincode && String(f.pincode).trim() === "781022")
  );
  const defaultFac = beltolaFac || cleanFacs.find((f) => f.latitude != null && f.longitude != null) || cleanFacs[0];

  return {
    latitude: defaultFac ? defaultFac.latitude : 26.1217525702644,
    longitude: defaultFac ? defaultFac.longitude : 91.8085511242569,
    pincode: "781022",
    district: defaultFac?.district || "Kamrup Metropolitan",
    method: "default",
    matched: "ESIC Hospital Beltola (781022)",
    isDistrictOnly: false,
    isDefaultBeltola: true,
  };
}

/**
 * Checks if ESIS Dispensary is currently open in Assam (Mon-Fri, 10:00 AM - 4:00 PM IST).
 */
export function isDispensaryOpenNow(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const isWeekend = day === 0 || day === 6;
  const isOpenHours = currentMinutes >= 600 && currentMinutes < 960; // 10:00 AM to 4:00 PM IST
  return !isWeekend && isOpenHours;
}

/**
 * Ranks 6 facilities nearest to caller's pincode / location, guaranteeing all 4 facility types:
 * 1. Govt District Hospital (34 facilities)
 * 2. ESIC Hospital (2 facilities: Beltola, Tinsukia)
 * 3. ESIS Dispensary (33 facilities)
 * 4. ESIC Tie-Up Hospital (29 facilities)
 *
 * Emergency Case Hierarchy:
 * Slot 1: Nearest Hospital (Emergency casualty: closest Govt District Hospital or ESIC Hospital to caller's PIN)
 * Slot 2: Nearest ESIC Hospital (or nearest Govt District Hospital if Slot 1 was an ESIC Hospital)
 * If Dispensary Open: Slot 3 is Dispensary, next nearest non-tie-up, Slot 6 is strictly Tie-Up
 * If Dispensary Closed: Open hospitals first, Tie-Up hospital ABOVE dispensary, Closed Dispensary at bottom
 *
 * Normal / Routine Case Hierarchy:
 * If Dispensary Open:
 * Slot 1: Nearest ESIS Dispensary (Primary Care OPD)
 * Slot 2: Nearest ESIC Hospital (Secondary Care)
 * Slot 3: Nearest Govt District Hospital
 * Slot 4 & 5: Next two nearest facilities overall
 * Slot 6: Strictly Nearest Tie-Up Hospital
 *
 * If Dispensary Closed:
 * Do NOT show Dispensary in first position!
 * Open hospitals (ESIC Hospital / Govt District Hospital) take top slots.
 * Tie-Up Hospital is placed ABOVE Dispensary.
 * Closed Dispensary is placed at the bottom / last position.
 */
export function rankNearestFacilities(callerLoc, facilities = [], limit = 6, isSevere = false) {
  if (!facilities || !facilities.length) return [];

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
      dist = calculateHaversineDistanceKm(
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

    if ((isExactPin || (isNearbyPinArea && pinDiff <= 1)) && (dist == null || dist < 1)) {
      dist = 0;
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
      distance_km: dist != null ? dist : (isExactPin ? 0 : 9999),
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

  // Proximity comparator:
  // 1. Avoid facilities > 100km: prefer facilities within 100km
  // 2. If district-only: facilities in that district first, then nearest facilities around that district
  // 3. Otherwise: exact pincode match first, nearby pincode area, then closer distance, then alphabetical
  const byProximity = (a, b) => {
    const aWithin100 = a.distance_km != null && a.distance_km <= 100 ? 1 : 0;
    const bWithin100 = b.distance_km != null && b.distance_km <= 100 ? 1 : 0;
    if (aWithin100 !== bWithin100) {
      return bWithin100 - aWithin100;
    }

    if (isDistrictOnly) {
      if (a.is_same_district !== b.is_same_district) {
        return (b.is_same_district ? 1 : 0) - (a.is_same_district ? 1 : 0);
      }
    } else {
      if (a.is_exact_pincode !== b.is_exact_pincode) {
        return (b.is_exact_pincode ? 1 : 0) - (a.is_exact_pincode ? 1 : 0);
      }
      if (a.is_nearby_pincode !== b.is_nearby_pincode) {
        return (b.is_nearby_pincode ? 1 : 0) - (a.is_nearby_pincode ? 1 : 0);
      }
    }
    if (a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }
    return (a.name || "").localeCompare(b.name || "");
  };

  // 1. Prioritize facilities within <= 100km, fallback to all scored if none under 100km
  const within100 = scored.filter((f) => f.distance_km == null || f.distance_km <= 100);
  const pool = within100.length > 0 ? within100 : scored;

  // Group and sort each of the 4 facility groups by proximity within 100km
  const esicHospitals = pool
    .filter((f) => f.facility_category_type === "ESIC_HOSPITAL")
    .sort(byProximity);

  const govtDistrictHospitals = pool
    .filter((f) => f.facility_category_type === "GOVT_DISTRICT_HOSPITAL")
    .sort(byProximity);

  const dispensaries = pool
    .filter((f) => f.facility_category_type === "DISPENSARY")
    .sort(byProximity);

  const tieUpHospitals = pool
    .filter((f) => f.facility_category_type === "TIE_UP_HOSPITAL")
    .sort(byProximity);

  const allHospitals = pool
    .filter((f) => f.is_hospital)
    .sort(byProximity);

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

  // Facility Hierarchy:
  // 1. If an ESIC Hospital is available within <= 100km, show ESIC Hospital first.
  //    If NO ESIC Hospital is available within 100km, show the Nearest Hospital (Govt District Hospital / Civil Hospital <= 100km) first!
  if (esicHospitals.length > 0) {
    addFacility(esicHospitals[0]);
    // 2. Govt District Hospital
    if (govtDistrictHospitals[0]) {
      addFacility(govtDistrictHospitals[0]);
    }
  } else {
    // No ESIC Hospital within 100km -> Nearest Hospital in 1st position
    if (allHospitals[0]) {
      addFacility(allHospitals[0]);
    }
    // 2. Next nearest hospital if available
    const nextHosp = allHospitals.find((f) => !selectedKeys.has(f.id || f.name));
    if (nextHosp) {
      addFacility(nextHosp);
    }
  }

  // 3. Dispensary (whether open or closed, it sits above tie-up if available)
  if (dispensaries[0]) {
    addFacility(dispensaries[0]);
  }

  // 4 & 5. Next nearest open non-tie-up facilities
  const nonTieUpPool = pool.filter((f) => !f.is_tie_up).sort(byProximity);
  for (const fac of nonTieUpPool) {
    if (selected.length >= limit - 1) break;
    addFacility(fac);
  }

  // 6. Strictly nearest ESIC Tie-Up Hospital at the LAST position (below dispensary)
  if (tieUpHospitals[0]) {
    addFacility(tieUpHospitals[0]);
  }

  // If still fewer than limit, fill with remaining facilities in pool
  for (const fac of pool.slice().sort(byProximity)) {
    if (selected.length >= limit) break;
    addFacility(fac);
  }

  // Guarantee that up to `limit` facilities are always returned
  for (const fac of scored.slice().sort(byProximity)) {
    if (selected.length >= limit) break;
    addFacility(fac);
  }

  return selected.slice(0, limit);
}


