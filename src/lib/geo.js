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

  // 1. PINCODE RESOLUTION (Highest Priority: Exact match to caller's postal area)
  if (callerPin) {
    // 1a. Exact facility pincode match
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
        matched: `Pincode ${callerPin} (${match.name})`,
        isDistrictOnly: false,
      };
    }

    // 1b. Address text match containing pincode
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
        matched: `Pincode ${callerPin} (${addrMatch.name})`,
        isDistrictOnly: false,
      };
    }

    // 1c. Numerically closest pincode match in same postal delivery zone (e.g. 782411 -> 782410 Jagiroad)
    if (/^\d{6}$/.test(callerPin)) {
      const pinNum = parseInt(callerPin, 10);
      const sameZone = cleanFacs.filter(
        (f) => f.pincode && /^\d{6}$/.test(String(f.pincode).trim()) && f.latitude != null
      );

      if (sameZone.length > 0) {
        const same3 = sameZone.filter((f) => String(f.pincode).startsWith(callerPin.slice(0, 3)));
        const candidates = same3.length > 0 ? same3 : sameZone;

        candidates.sort((a, b) => {
          const diffA = Math.abs(parseInt(a.pincode, 10) - pinNum);
          const diffB = Math.abs(parseInt(b.pincode, 10) - pinNum);
          return diffA - diffB;
        });

        const closest = candidates[0];
        const diff = Math.abs(parseInt(closest.pincode, 10) - pinNum);

        if (diff <= 15) {
          return {
            latitude: closest.latitude,
            longitude: closest.longitude,
            pincode: callerPin,
            district: closest.district || rawDistrict || null,
            method: "nearby_pincode",
            matched: `Pincode ${callerPin} (Near ${closest.name} · ${closest.pincode})`,
            isDistrictOnly: false,
          };
        }

        const p4 = callerPin.substring(0, 4);
        const prefix4Matches = sameZone.filter((f) => String(f.pincode).startsWith(p4));
        if (prefix4Matches.length > 0) {
          prefix4Matches.sort((a, b) => Math.abs(parseInt(a.pincode, 10) - pinNum) - Math.abs(parseInt(b.pincode, 10) - pinNum));
          const best = prefix4Matches[0];
          return {
            latitude: best.latitude,
            longitude: best.longitude,
            pincode: callerPin,
            district: best.district || rawDistrict || null,
            method: "pincode",
            matched: `Pincode Area ${callerPin} (Near ${best.name} · ${best.pincode})`,
            isDistrictOnly: false,
          };
        }
      }
    }
  }

  // 2. DISTRICT RESOLUTION: Match against facilities in caller's district
  if (rawDistrict && String(rawDistrict).trim()) {
    const cleanDist = String(rawDistrict).trim().toLowerCase();
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

  // 4. EXPLICIT GPS COORDINATES (Only if provided explicitly by user)
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

    let closestFac = null;
    let minD = Infinity;
    for (const f of cleanFacs) {
      if (f.latitude != null && f.longitude != null) {
        const d = calculateHaversineDistanceKm(latNum, lonNum, f.latitude, f.longitude);
        if (d != null && d < minD) {
          minD = d;
          closestFac = f;
        }
      }
    }

    return {
      latitude: latNum,
      longitude: lonNum,
      pincode: callerPin || closestFac?.pincode || null,
      district: (rawDistrict && String(rawDistrict).trim()) || closestFac?.district || null,
      method: "coordinates",
      matched: `Location Coordinates (${latNum.toFixed(4)}, ${lonNum.toFixed(4)})`,
      isDistrictOnly: false,
      isNoLocation: false,
    };
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
 * Ranks nearest facilities based on clinical rules:
 *
 * Rules:
 * 1. Exact match / Pincode match MUST always be shown at the VERY TOP (Position 1)!
 * 2. Filter out any facility with distance > 50 KM (never force distant Beltola / Tinsukia ESIC hospitals if > 50km).
 * 3. Only show ESIC Hospitals if they are within <= 25 KM (or <= 50 KM max).
 * 4. For EMERGENCY cases:
 *    - If ESIC Hospital <= 25 KM, show ESIC Hospital first.
 *    - If no ESIC Hospital <= 25 KM, show closest Govt District Hospital first.
 * 5. For NON-EMERGENCY / NORMAL cases:
 *    - Always give priority to ESIS Dispensary if dispensary is open / available!
 *    - If no dispensary, refer to ESIC Hospital (if <= 25km), else District Hospital / Tie-Up Hospital.
 */
export function rankNearestFacilities(callerLoc, facilities = [], limit = 6, isSevere = false) {
  if (!facilities || !facilities.length) return [];
  if (
    !callerLoc ||
    callerLoc.isNoLocation ||
    (!callerLoc.pincode && !callerLoc.district && callerLoc.latitude == null)
  ) {
    return [];
  }

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

    if (isExactPin || (isNearbyPinArea && pinDiff === 0)) {
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

  // RULE: Filter out any facility with distance > 50 KM (unless no facilities exist <= 50km)
  const within50Km = scored.filter((f) => f.distance_km != null && f.distance_km <= 50);
  const eligiblePool = within50Km.length > 0 ? within50Km : scored;

  // Proximity sorting comparator:
  // 1. Exact pincode match (distance 0 km) at top
  // 2. Strict ascending order of distance_km
  // 3. District match if district-only
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
  const nearestEsicUnder25 = sortedByProximity.find((f) => f.is_esic_hospital && f.distance_km <= 25);
  const nearestGovtHosp = sortedByProximity.find((f) => f.is_govt_district_hospital);
  const nearestTieUp = sortedByProximity.find((f) => f.is_tie_up);

  if (isSevere) {
    // -------------------------------------------------------------
    // EMERGENCY CASES:
    // Refer to ESIC Hospital if <= 25 KM, else closest Govt District Hospital (any hospital closest to caller)
    // -------------------------------------------------------------
    if (nearestEsicUnder25) {
      addFacility(nearestEsicUnder25);
    } else if (nearestGovtHosp) {
      addFacility(nearestGovtHosp);
    } else if (sortedByProximity.find((f) => f.is_hospital)) {
      addFacility(sortedByProximity.find((f) => f.is_hospital));
    } else {
      addFacility(sortedByProximity[0]);
    }
  } else {
    // -------------------------------------------------------------
    // NON-EMERGENCY / NORMAL CASES:
    // 1. If exact pincode match exists (e.g. ESIS Dispensary Hojai for 782435), show at Position 1!
    // 2. Always give priority to ESIS Dispensary if dispensary is available / open!
    // 3. If no dispensary, refer to ESIC Hospital if <= 25 KM, else District Hospital or Tie-Up Hospital.
    // -------------------------------------------------------------
    if (exactPinFac) {
      addFacility(exactPinFac);
    } else if (nearestDispensary) {
      addFacility(nearestDispensary);
    } else if (nearestEsicUnder25) {
      addFacility(nearestEsicUnder25);
    } else if (nearestGovtHosp || nearestTieUp) {
      const primaryAlt = (nearestGovtHosp && nearestTieUp)
        ? (nearestGovtHosp.distance_km <= nearestTieUp.distance_km ? nearestGovtHosp : nearestTieUp)
        : (nearestGovtHosp || nearestTieUp);
      addFacility(primaryAlt);
    }
  }

  // Populate all remaining slots strictly from sortedByProximity in ascending distance order
  for (const fac of sortedByProximity) {
    if (selected.length >= limit) break;
    addFacility(fac);
  }

  return selected.slice(0, limit);
}
