// Geo utilities: Haversine distance calculation and location resolution

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

export function resolveCallerLocation(input, facilities) {
  const { latitude, longitude, pincode, district, city } = input;

  if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      method: "coordinates",
      matched: `GPS (${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`,
    };
  }

  if (pincode && String(pincode).trim()) {
    const cleanPin = String(pincode).trim();
    const match = facilities.find((f) => f.pincode && f.pincode.trim() === cleanPin);
    if (match && match.latitude != null && match.longitude != null) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        method: "pincode",
        matched: `pincode ${cleanPin}`,
      };
    }
  }

  if (district && String(district).trim()) {
    const cleanDist = String(district).trim().toLowerCase();
    const match = facilities.find(
      (f) => f.district && f.district.toLowerCase() === cleanDist && f.latitude != null
    );
    if (match) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        method: "district",
        matched: `district ${match.district}`,
      };
    }
  }

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
        method: "city",
        matched: `city ${city}`,
      };
    }
  }

  // Default fallback to Guwahati center
  return {
    latitude: 26.1445,
    longitude: 91.7362,
    method: "default",
    matched: "Assam regional center",
  };
}

export function rankNearestFacilities(callerLoc, facilities, limit = 5) {
  if (!callerLoc || callerLoc.latitude == null || callerLoc.longitude == null) {
    return facilities.slice(0, limit).map((f) => ({
      ...f,
      distance_km: null,
      maps_url: `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`,
    }));
  }

  const scored = facilities.map((f) => {
    const dist = calculateHaversineDistanceKm(
      callerLoc.latitude,
      callerLoc.longitude,
      f.latitude,
      f.longitude
    );
    return {
      ...f,
      distance_km: dist ?? 9999,
      maps_url: `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`,
    };
  });

  scored.sort((a, b) => a.distance_km - b.distance_km);
  return scored.slice(0, limit);
}
