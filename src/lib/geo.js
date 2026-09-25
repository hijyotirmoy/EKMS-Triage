// Geo utilities: Haversine distance calculation, dynamic facility-based location resolution, and proximity routing

/**
 * Normalizes and guards facility coordinates against corrupted entries.
 * Specifically guarantees that ESIC Beltola Hospital (Guwahati) and ESIC Tinsukia Hospital
 * always maintain their correct, distinct geographic coordinates.
 */
export function cleanFacilityCoordinates(facilities = []) {
  if (!Array.isArray(facilities)) return [];

  return facilities.map((f) => {
    if (!f) return f;
    const name = (f.name || "").toLowerCase();

    // Guard ESIC Hospital Beltola in Khanapara, Guwahati, Kamrup Metro
    if (name.includes("beltola")) {
      return {
        ...f,
        latitude: 26.121567,
        longitude: 91.808542,
        pincode: f.pincode || "781022",
        district: f.district || "Kamrup Metropolitan",
      };
    }

    // Guard ESIC Hospital Tinsukia in Bordoloi Nagar, Tinsukia
    if (name.includes("tinsukia") && (name.includes("hospital") || f.facility_type === "Hospital")) {
      return {
        ...f,
        latitude: 27.49962,
        longitude: 95.356849,
        pincode: f.pincode || "786126",
        district: f.district || "Tinsukia",
      };
    }

    return f;
  });
}

export function isHospital(f) {
  if (!f) return false;
  const type = (f.facility_type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();
  const scheme = (f.scheme || "").toLowerCase();

  // If designated as tie-up or empanelled, classify as tie-up
  if (
    type.includes("tie-up") ||
    type.includes("tie up") ||
    type.includes("empanelled") ||
    name.includes("tie-up") ||
    name.includes("tie up") ||
    name.includes("empanelled") ||
    scheme.includes("tie")
  ) {
    return false;
  }

  return (
    type.includes("hospital") ||
    type.includes("medical college") ||
    name.includes("hospital") ||
    name.includes("medical college") ||
    name.includes("casualty") ||
    name.includes("emergency")
  );
}

export function isDispensary(f) {
  if (!f) return false;
  if (isHospital(f)) return false;
  const type = (f.facility_type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();
  const scheme = (f.scheme || "").toLowerCase();

  if (
    type.includes("tie-up") ||
    type.includes("tie up") ||
    type.includes("empanelled") ||
    name.includes("tie-up") ||
    name.includes("tie up") ||
    name.includes("empanelled") ||
    scheme.includes("tie")
  ) {
    return false;
  }

  return (
    type.includes("dispensary") ||
    type.includes("opd") ||
    type.includes("phc") ||
    type.includes("chc") ||
    type.includes("clinic") ||
    type.includes("health centre") ||
    name.includes("dispensary") ||
    name.includes("clinic")
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
    type.includes("private") ||
    name.includes("tie-up") ||
    name.includes("tie up") ||
    name.includes("empanelled") ||
    name.includes("diagnostic") ||
    scheme.includes("tie") ||
    (!isHospital(f) && !isDispensary(f))
  );
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
        method: "pincode",
        matched: `Pincode ${cleanPin} (${match.name})`,
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
        method: "pincode",
        matched: `Pincode ${cleanPin} (${addrMatch.name})`,
      };
    }

    // 1c. Pincode prefix match from facility dataset (e.g., 7810, 7861, etc.)
    if (cleanPin.length >= 4) {
      const p4 = cleanPin.substring(0, 4);
      const prefix4Matches = cleanFacs.filter(
        (f) => f.pincode && String(f.pincode).startsWith(p4) && f.latitude != null
      );
      if (prefix4Matches.length > 0) {
        const avgLat =
          prefix4Matches.reduce((sum, f) => sum + f.latitude, 0) / prefix4Matches.length;
        const avgLon =
          prefix4Matches.reduce((sum, f) => sum + f.longitude, 0) / prefix4Matches.length;
        const sample = prefix4Matches[0];
        return {
          latitude: Math.round(avgLat * 10000) / 10000,
          longitude: Math.round(avgLon * 10000) / 10000,
          pincode: cleanPin,
          method: "pincode",
          matched: `Pincode Area ${cleanPin} (${sample.district || sample.name})`,
        };
      }
    }

    if (cleanPin.length >= 3) {
      const p3 = cleanPin.substring(0, 3);
      const prefix3Matches = cleanFacs.filter(
        (f) => f.pincode && String(f.pincode).startsWith(p3) && f.latitude != null
      );
      if (prefix3Matches.length > 0) {
        const avgLat =
          prefix3Matches.reduce((sum, f) => sum + f.latitude, 0) / prefix3Matches.length;
        const avgLon =
          prefix3Matches.reduce((sum, f) => sum + f.longitude, 0) / prefix3Matches.length;
        const sample = prefix3Matches[0];
        return {
          latitude: Math.round(avgLat * 10000) / 10000,
          longitude: Math.round(avgLon * 10000) / 10000,
          pincode: cleanPin,
          method: "pincode",
          matched: `Pincode Region ${cleanPin} (${sample.district || sample.name})`,
        };
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
        method: "district",
        matched: `District ${match.district}`,
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
        method: "city",
        matched: `City ${city}`,
      };
    }
  }

  // 4. EXPLICIT GPS COORDINATES
  if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      pincode: cleanPin || null,
      method: "coordinates",
      matched: `GPS (${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`,
    };
  }

  // 5. DEFAULT FALLBACK: ESIC Hospital Beltola, Guwahati
  return {
    latitude: 26.121567,
    longitude: 91.808542,
    pincode: cleanPin || "781022",
    method: "default",
    matched: "Default Location (Beltola, Guwahati)",
  };
}

/**
 * Ranks facilities strictly by NEAREST GEOGRAPHIC DISTANCE.
 *
 * Rules:
 * - Distance is the primary sorting determinant. A facility hundreds of kilometers away (e.g. Tinsukia from Guwahati)
 *   will NEVER override a local facility.
 * - If a Tie-Up facility is near, it is shown in the nearest facilities list.
 * - Within the same immediate vicinity (difference <= 25 km):
 *   - For severe/emergency cases: Hospitals > Tie-Up Facilities > Dispensaries.
 *   - Otherwise: Closest distance wins.
 */
export function rankNearestFacilities(callerLoc, facilities = [], limit = 5, isSevere = false) {
  if (!facilities || !facilities.length) return [];

  const cleanFacs = cleanFacilityCoordinates(facilities);
  const callerPin = callerLoc?.pincode ? String(callerLoc.pincode).trim() : null;
  const hasCoords = callerLoc && callerLoc.latitude != null && callerLoc.longitude != null;

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

    if (isExactPin && (dist == null || dist < 1)) {
      dist = 0;
    }

    const isTie = isTieUp(f);
    const isHosp = isHospital(f);
    const isDisp = isDispensary(f);

    const categoryLabel = isTie
      ? "Empanelled Tie-Up Facility"
      : isHosp
      ? (isSevere ? "Hospital (Emergency / Casualty)" : "Hospital (Secondary Care OPD)")
      : "Dispensary (Primary Care OPD)";

    return {
      ...f,
      distance_km: dist != null ? dist : (isExactPin ? 0 : 9999),
      is_exact_pincode: isExactPin,
      is_tie_up: isTie,
      is_hospital: isHosp,
      is_dispensary: isDisp,
      facility_category_label: categoryLabel,
      maps_url: f.latitude && f.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name + " " + (f.address || ""))}`,
    };
  });

  scored.sort((a, b) => {
    // 1. Exact Pincode match comes first
    if (a.is_exact_pincode !== b.is_exact_pincode) {
      return (b.is_exact_pincode ? 1 : 0) - (a.is_exact_pincode ? 1 : 0);
    }

    // 2. Proximity threshold:
    // If one facility is significantly farther (> 25 km difference), the closer facility ALWAYS wins!
    // A 390 km facility will NEVER override a local facility.
    const distDiff = Math.abs(a.distance_km - b.distance_km);
    if (distDiff > 25) {
      return a.distance_km - b.distance_km;
    }

    // 3. Within the same local vicinity (difference <= 25 km):
    // For severe emergency cases: prefer Hospital > Tie-Up Facility > Dispensary
    if (isSevere) {
      const rankScore = (fac) => (fac.is_hospital ? 0 : fac.is_tie_up ? 1 : 2);
      const scoreDiff = rankScore(a) - rankScore(b);
      if (scoreDiff !== 0) return scoreDiff;
    }

    // 4. Closer distance in km
    if (a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }

    // 5. Stable alphabetical tie-breaker
    return (a.name || "").localeCompare(b.name || "");
  });

  return scored.slice(0, limit);
}

