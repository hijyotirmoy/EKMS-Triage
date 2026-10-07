// Client-Side High-Performance Browser Storage & Cache Manager
// Eliminates duplicate downloads, enables instant 0ms page loads, and avoids redundant Firestore reads

const CACHE_KEYS = {
  CASES: "ekms_cache_cases_v2",
  CASES_META: "ekms_cache_cases_meta_v2",
  FACILITIES: "ekms_cache_facilities_v2",
  FACILITIES_META: "ekms_cache_facilities_meta_v2",
  STATS: "ekms_cache_stats_v2",
};

export function getCachedCases() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEYS.CASES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function setCachedCases(cases) {
  if (typeof window === "undefined" || !Array.isArray(cases)) return;
  try {
    localStorage.setItem(CACHE_KEYS.CASES, JSON.stringify(cases));
    localStorage.setItem(
      CACHE_KEYS.CASES_META,
      JSON.stringify({
        updated_at: Date.now(),
        count: cases.length,
        latest_created_at: cases[0]?.created_at || null,
      })
    );
  } catch (e) {
    console.warn("Could not save cases to localStorage:", e);
  }
}

export function appendCaseToLocalCache(newCase) {
  if (typeof window === "undefined" || !newCase) return;
  try {
    const cases = getCachedCases();
    const newRef = String(newCase.case_ref || "").trim().toUpperCase();
    const newId = String(newCase.id || "").trim().toUpperCase();
    const filtered = cases.filter((c) => {
      const cRef = String(c.case_ref || "").trim().toUpperCase();
      const cId = String(c.id || "").trim().toUpperCase();
      if (newRef && cRef === newRef) return false;
      if (newId && cId === newId) return false;
      return true;
    });
    filtered.unshift(newCase);
    setCachedCases(filtered);
  } catch (e) {}
}

export function removeCaseFromLocalCache(caseRefOrId) {
  if (typeof window === "undefined" || !caseRefOrId) return;
  try {
    const cases = getCachedCases();
    const target = String(caseRefOrId).trim().toUpperCase();
    const filtered = cases.filter((c) => {
      const cRef = String(c.case_ref || "").trim().toUpperCase();
      const cId = String(c.id || "").trim().toUpperCase();
      return cRef !== target && cId !== target;
    });
    setCachedCases(filtered);
  } catch (e) {}
}

export function updateCaseInLocalCache(caseRefOrId, updates) {
  if (typeof window === "undefined" || !caseRefOrId || !updates) return;
  try {
    const cases = getCachedCases();
    const target = String(caseRefOrId).trim().toUpperCase();
    let matchedRef = target;
    const updated = cases.map((c) => {
      const cRef = String(c.case_ref || "").trim().toUpperCase();
      const cId = String(c.id || "").trim().toUpperCase();
      if (cRef === target || cId === target) {
        if (c.case_ref) matchedRef = String(c.case_ref);
        return { ...c, ...updates };
      }
      return c;
    });
    setCachedCases(updated);
    if (updates.is_forwarded) {
      localStorage.setItem(`ekms_forwarded_${target}`, JSON.stringify(updates));
      localStorage.setItem(`ekms_forwarded_${caseRefOrId}`, JSON.stringify(updates));
      if (matchedRef && matchedRef !== target) {
        localStorage.setItem(`ekms_forwarded_${matchedRef}`, JSON.stringify(updates));
        localStorage.setItem(`ekms_forwarded_${matchedRef.toUpperCase()}`, JSON.stringify(updates));
      }
    }
  } catch (e) {}
}

export function getCachedFacilities() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEYS.FACILITIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function setCachedFacilities(facilities) {
  if (typeof window === "undefined" || !Array.isArray(facilities)) return;
  try {
    localStorage.setItem(CACHE_KEYS.FACILITIES, JSON.stringify(facilities));
    localStorage.setItem(
      CACHE_KEYS.FACILITIES_META,
      JSON.stringify({
        updated_at: Date.now(),
        count: facilities.length,
      })
    );
  } catch (e) {
    console.warn("Could not save facilities to localStorage:", e);
  }
}

export function getCachedStats() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEYS.STATS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setCachedStats(stats) {
  if (typeof window === "undefined" || !stats) return;
  try {
    localStorage.setItem(CACHE_KEYS.STATS, JSON.stringify(stats));
  } catch (e) {}
}

export function getCachedMeta() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ekms_cache_app_meta_v2");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setCachedMeta(meta) {
  if (typeof window === "undefined" || !meta) return;
  try {
    localStorage.setItem("ekms_cache_app_meta_v2", JSON.stringify(meta));
  } catch (e) {}
}

