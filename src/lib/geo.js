// Geo utilities: Haversine distance calculation, Assam pincode lookup, and hospital-first routing

export const ASSAM_PINCODES = {
  // Kamrup Metropolitan / Guwahati
  "781001": { latitude: 26.1856, longitude: 91.7516, area: "Panbazar, Guwahati" },
  "781003": { latitude: 26.1868, longitude: 91.7672, area: "Silpukhuri / Uzanbazar, Guwahati" },
  "781004": { latitude: 26.1890, longitude: 91.7820, area: "Chandmari, Guwahati" },
  "781005": { latitude: 26.1554, longitude: 91.7766, area: "Dispur / Ganeshguri, Guwahati" },
  "781006": { latitude: 26.1396, longitude: 91.7928, area: "Dispur Super Market / Six Mile, Guwahati" },
  "781007": { latitude: 26.1772, longitude: 91.7455, area: "Santipur, Guwahati" },
  "781008": { latitude: 26.1704, longitude: 91.7329, area: "Bharalumukh, Guwahati" },
  "781009": { latitude: 26.1624, longitude: 91.7188, area: "Maligaon, Guwahati" },
  "781011": { latitude: 26.1578, longitude: 91.7056, area: "Pandu, Guwahati" },
  "781012": { latitude: 26.1420, longitude: 91.6880, area: "Jalukbari, Guwahati" },
  "781014": { latitude: 26.1542, longitude: 91.6853, area: "West Guwahati / Jalukbari" },
  "781015": { latitude: 26.1350, longitude: 91.6620, area: "Guwahati University" },
  "781016": { latitude: 26.1528, longitude: 91.7397, area: "Kalapahar / Gopinath Nagar, Guwahati" },
  "781017": { latitude: 26.1154, longitude: 91.7245, area: "Birubari / Fatasil, Guwahati" },
  "781020": { latitude: 26.1874, longitude: 91.7995, area: "Noonmati / Guwahati Refinery" },
  "781021": { latitude: 26.1782, longitude: 91.7854, area: "Bamunimaidam, Guwahati" },
  "781022": { latitude: 26.1216, longitude: 91.8085, area: "Beltola / Khanapara, Guwahati" },
  "781023": { latitude: 26.1180, longitude: 91.8210, area: "Amerigog / Khanapara, Guwahati" },
  "781024": { latitude: 26.1450, longitude: 91.8120, area: "Six Mile / Chachal, Guwahati" },
  "781028": { latitude: 26.1320, longitude: 91.8020, area: "Borbari / VIP Road, Guwahati" },
  "781031": { latitude: 26.1846, longitude: 91.6604, area: "Amingaon / North Guwahati" },
  "781032": { latitude: 26.1557, longitude: 91.7770, area: "GMCH / Bhangagarh, Guwahati" },
  "781034": { latitude: 26.1265, longitude: 91.7580, area: "Lalganesh / Odalbakra, Guwahati" },
  "781035": { latitude: 26.1140, longitude: 91.7180, area: "Lokhra / Garchuk, Guwahati" },
  "781038": { latitude: 26.1380, longitude: 91.7480, area: "Rehabari, Guwahati" },
  "781039": { latitude: 26.1950, longitude: 91.6950, area: "IIT Guwahati" },
  "781071": { latitude: 26.1720, longitude: 91.8320, area: "Narengi / Patharquary, Guwahati" },
  "781122": { latitude: 26.0680, longitude: 91.4920, area: "Bijoynagar / Kamrup Rural" },
  // Nalbari / Barpeta
  "781301": { latitude: 26.3210, longitude: 91.0040, area: "Barpeta Town / FAA Medical College" },
  "781335": { latitude: 26.4450, longitude: 91.4390, area: "Nalbari, Assam" },
  // Nagaon / Morigaon / Hojai
  "782001": { latitude: 26.3450, longitude: 92.6850, area: "Nagaon Town" },
  "782002": { latitude: 26.3520, longitude: 92.6780, area: "Nagaon Bazaar" },
  "782410": { latitude: 26.1240, longitude: 92.1760, area: "Jagiroad, Morigaon" },
  "782435": { latitude: 26.0020, longitude: 92.8640, area: "Hojai, Assam" },
  // Lower Assam / BTR
  "783301": { latitude: 26.0257, longitude: 89.9721, area: "Dhubri, Assam" },
  "783370": { latitude: 26.4010, longitude: 90.2720, area: "Kokrajhar, BTR" },
  "783380": { latitude: 26.4820, longitude: 90.5650, area: "Bongaigaon Town" },
  "783385": { latitude: 26.5030, longitude: 90.5539, area: "Bongaigaon Refinery / Dhaligaon" },
  // Sonitpur / Tezpur
  "784001": { latitude: 26.6340, longitude: 92.7930, area: "Tezpur, Sonitpur" },
  "784010": { latitude: 26.6528, longitude: 92.7925, area: "Bihaguri / TMCH, Tezpur" },
  // Upper Assam (Jorhat / Sivasagar / Golaghat)
  "785001": { latitude: 26.7583, longitude: 94.2167, area: "Jorhat Town / JMCH" },
  "785004": { latitude: 26.7450, longitude: 94.2050, area: "Jorhat RRL" },
  "785640": { latitude: 26.9840, longitude: 94.6390, area: "Sivasagar, Assam" },
  "785699": { latitude: 26.6320, longitude: 93.7540, area: "Numaligarh, Golaghat" },
  // Dibrugarh & Tinsukia
  "786001": { latitude: 27.4756, longitude: 94.9087, area: "Dibrugarh Town" },
  "786002": { latitude: 27.4667, longitude: 94.9333, area: "AMCH, Dibrugarh" },
  "786125": { latitude: 27.4915, longitude: 95.3730, area: "Parbatia / Tinsukia" },
  "786126": { latitude: 27.4996, longitude: 95.3568, area: "Bordoloi Nagar / ESIC Hospital Tinsukia" },
  "786151": { latitude: 27.5680, longitude: 95.5720, area: "Doomdooma, Tinsukia" },
  "786170": { latitude: 27.4920, longitude: 95.4480, area: "Makum, Tinsukia" },
  "786171": { latitude: 27.4035, longitude: 95.6153, area: "Digboi, Tinsukia" },
  "786181": { latitude: 27.2840, longitude: 95.6820, area: "Margherita, Tinsukia" },
  "786602": { latitude: 27.3250, longitude: 95.3180, area: "Duliajan, Dibrugarh" },
  "787057": { latitude: 27.4874, longitude: 94.5708, area: "Dhemaji, Assam" },
  // Barak Valley (Silchar / Cachar / Hailakandi)
  "788001": { latitude: 24.8280, longitude: 92.7980, area: "Silchar Town, Cachar" },
  "788003": { latitude: 24.8150, longitude: 92.8020, area: "Silchar Tarapur" },
  "788014": { latitude: 24.7957, longitude: 92.7938, area: "Ghungoor / SMCH, Silchar" },
  "788151": { latitude: 24.6850, longitude: 92.5680, area: "Hailakandi, Assam" },
};

export function lookupAssamPincode(pin) {
  if (!pin) return null;
  const clean = String(pin).trim();
  return ASSAM_PINCODES[clean] || null;
}

export function lookupAssamPincodePrefix(pin) {
  if (!pin || String(pin).length < 3) return null;
  const str = String(pin).trim();
  const p3 = str.substring(0, 3);
  const p4 = str.substring(0, 4);

  if (p4 === "7810" || p3 === "781") {
    return { latitude: 26.1445, longitude: 91.7362, area: "Kamrup Metropolitan / Guwahati Region" };
  }
  if (p3 === "786") {
    return { latitude: 27.4996, longitude: 95.3568, area: "Upper Assam / Tinsukia / Dibrugarh" };
  }
  if (p3 === "785") {
    return { latitude: 26.7583, longitude: 94.2167, area: "Jorhat / Sivasagar / Golaghat" };
  }
  if (p3 === "788") {
    return { latitude: 24.8280, longitude: 92.7980, area: "Barak Valley / Silchar / Cachar" };
  }
  if (p3 === "782") {
    return { latitude: 26.3450, longitude: 92.6850, area: "Nagaon / Morigaon / Hojai" };
  }
  if (p3 === "784") {
    return { latitude: 26.6340, longitude: 92.7930, area: "Sonitpur / Tezpur / Darrang" };
  }
  if (p3 === "783") {
    return { latitude: 26.4820, longitude: 90.5650, area: "Bongaigaon / Dhubri / Kokrajhar" };
  }
  if (p3 === "787") {
    return { latitude: 27.4874, longitude: 94.5708, area: "Dhemaji / North Lakhimpur" };
  }
  return null;
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
 * Resolves caller location with strict priority given to PINCODE when provided.
 */
export function resolveCallerLocation(input, facilities = []) {
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

  // PRIORITY 1: PINCODE (Always route to nearest from the caller's pincode)
  if (cleanPin) {
    // 1. Exact match in facilities dataset
    const match = facilities.find((f) => f.pincode && f.pincode.trim() === cleanPin && f.latitude != null);
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        pincode: cleanPin,
        method: "pincode",
        matched: `Pincode ${cleanPin} (${match.name})`,
      };
    }

    // 2. Known Assam Pincode database lookup (accurate geographic coordinates)
    const pinCoord = lookupAssamPincode(cleanPin);
    if (pinCoord) {
      return {
        latitude: pinCoord.latitude,
        longitude: pinCoord.longitude,
        pincode: cleanPin,
        method: "pincode",
        matched: `Pincode ${cleanPin} (${pinCoord.area})`,
      };
    }

    // 3. Direct address text match for pincode
    const addrMatch = facilities.find((f) => f.address && f.address.includes(cleanPin) && f.latitude != null);
    if (addrMatch) {
      return {
        latitude: addrMatch.latitude,
        longitude: addrMatch.longitude,
        pincode: cleanPin,
        method: "pincode",
        matched: `Pincode ${cleanPin} (${addrMatch.name})`,
      };
    }

    // 4. Regional Pincode prefix lookup
    const prefixMatch = lookupAssamPincodePrefix(cleanPin);
    if (prefixMatch) {
      return {
        latitude: prefixMatch.latitude,
        longitude: prefixMatch.longitude,
        pincode: cleanPin,
        method: "pincode",
        matched: `Pincode Area ${cleanPin} (${prefixMatch.area})`,
      };
    }
  }

  // PRIORITY 2: Explicit GPS coordinates (when no pincode was specified)
  if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      pincode: cleanPin || null,
      method: "coordinates",
      matched: `GPS (${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`,
    };
  }

  // PRIORITY 3: District
  if (district && String(district).trim()) {
    const cleanDist = String(district).trim().toLowerCase();
    const match = facilities.find(
      (f) => f.district && f.district.toLowerCase() === cleanDist && f.latitude != null
    );
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        pincode: cleanPin || null,
        method: "district",
        matched: `District ${match.district}`,
      };
    }
  }

  // PRIORITY 4: City
  if (city && String(city).trim()) {
    const cleanCity = String(city).trim().toLowerCase();
    const match = facilities.find(
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
        pincode: cleanPin || null,
        method: "city",
        matched: `City ${city}`,
      };
    }
  }

  // Default fallback to Guwahati center
  return {
    latitude: 26.1445,
    longitude: 91.7362,
    pincode: cleanPin || null,
    method: "default",
    matched: "Assam regional center",
  };
}

/**
 * Ranks nearest facilities based on caller location and condition severity:
 * - If Pincode is provided: First and always refer to the facility with the nearest / matching pincode.
 * - If Severe condition: Always refer to Hospital nearest -> then Dispensary -> then Tie-up.
 * - If Normal/Moderate condition: Always refer to Dispensary nearest -> then Hospital -> then Tie-up.
 */
export function rankNearestFacilities(callerLoc, facilities, limit = 5, isSevere = false) {
  if (!facilities || !facilities.length) return [];

  const callerPin = callerLoc?.pincode ? String(callerLoc.pincode).trim() : null;
  const hasCoords = callerLoc && callerLoc.latitude != null && callerLoc.longitude != null;

  const scored = facilities.map((f) => {
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

    if (isExactPin) {
      dist = 0;
    }

    const tier = getFacilityTier(f, isSevere);
    const categoryLabel =
      tier === 0
        ? (isSevere ? "Hospital (Emergency / Casualty)" : "Dispensary (Primary Care OPD)")
        : tier === 1
        ? (isSevere ? "Dispensary (Secondary Option)" : "Hospital (Secondary Option)")
        : "Tie-up Facility";

    return {
      ...f,
      distance_km: dist != null ? dist : (isExactPin ? 0 : 9999),
      is_exact_pincode: isExactPin,
      facility_tier: tier,
      facility_category_label: categoryLabel,
      maps_url: f.latitude && f.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name + " " + (f.address || ""))}`,
    };
  });

  scored.sort((a, b) => {
    // 1. Condition Hierarchy:
    // Severe: Hospital (0) -> Dispensary (1) -> Tie-up (2)
    // Normal/Moderate: Dispensary (0) -> Hospital (1) -> Tie-up (2)
    if (a.facility_tier !== b.facility_tier) {
      return a.facility_tier - b.facility_tier;
    }

    // 2. Exact Pincode match within the same tier comes first
    if (a.is_exact_pincode !== b.is_exact_pincode) {
      return (b.is_exact_pincode ? 1 : 0) - (a.is_exact_pincode ? 1 : 0);
    }

    // 3. Nearest Distance in km from caller's pincode / location
    if (a.distance_km !== b.distance_km) {
      return a.distance_km - b.distance_km;
    }

    // 4. Stable tie-breaker
    return (a.name || "").localeCompare(b.name || "");
  });

  return scored.slice(0, limit);
}
