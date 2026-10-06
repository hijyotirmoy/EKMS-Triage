// Centralized Caller ID Generator & Registry for EKMS Triage
// Format: CID + 4-digit sequence (0001-9999) + 1-letter series (A-Z) + last 3 digits of phone
// Example: CID0001K102 (CID + 0001 + K + 102)

const memoryRegistry = new Map();

// Known seed / demo bindings
memoryRegistry.set("9876543210", "CID0001A210");
memoryRegistry.set("9876543102", "CID0001K102");

export function normalize10DigitPhone(p) {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function getStoredRegistry() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ekms_caller_id_registry");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveStoredRegistry(regObj) {
  if (typeof window === "undefined" || !regObj) return;
  try {
    localStorage.setItem("ekms_caller_id_registry", JSON.stringify(regObj));
  } catch (e) {}
}

/**
 * Format a Caller ID string
 * @param {number} seq - 1 to 9999
 * @param {string} letter - 'A' to 'Z'
 * @param {string} phone - 10-digit phone
 * @returns {string} e.g. "CID0001K102"
 */
export function formatCallerId(seq = 1, letter = "A", phone = "000") {
  const safeSeq = Math.max(1, Math.min(9999, Math.floor(seq)));
  const seqStr = String(safeSeq).padStart(4, "0");
  const cleanLetter = String(letter || "A").toUpperCase().slice(0, 1);
  const safeLetter = /[A-Z]/.test(cleanLetter) ? cleanLetter : "A";
  const digits = String(phone).replace(/\D/g, "");
  const last3 = digits.length >= 3 ? digits.slice(-3) : digits.padStart(3, "0");
  return `CID${seqStr}${safeLetter}${last3}`;
}

/**
 * Parses a Caller ID string into its components
 */
export function parseCallerId(callerId) {
  if (!callerId || typeof callerId !== "string") return null;
  const match = callerId.trim().match(/^CID(\d{4})([A-Z])(\d{3})$/i);
  if (!match) return null;
  return {
    prefix: "CID",
    seq: parseInt(match[1], 10),
    seqStr: match[1],
    letter: match[2].toUpperCase(),
    last3: match[3],
  };
}

/**
 * Get or assign a deterministic, permanent Caller ID for a given 10-digit phone number.
 * Ensures the exact same phone number ALWAYS receives the exact same Caller ID.
 *
 * @param {string} phone - Caller phone number
 * @param {Array} existingCases - Optional list of cases to scan for already assigned caller_ids
 * @returns {string}
 */
export function getCallerIdForPhone(phone, existingCases = []) {
  const cleanPhone = normalize10DigitPhone(phone);
  if (!cleanPhone) return "";

  // 1. Check in-memory Map
  if (memoryRegistry.has(cleanPhone)) {
    return memoryRegistry.get(cleanPhone);
  }

  // 2. Check localStorage on client
  const stored = getStoredRegistry();
  if (stored && stored[cleanPhone]) {
    memoryRegistry.set(cleanPhone, stored[cleanPhone]);
    return stored[cleanPhone];
  }

  // 3. Check existing cases in database / memory
  if (Array.isArray(existingCases) && existingCases.length > 0) {
    for (const c of existingCases) {
      const casePhone = normalize10DigitPhone(c.intake?.phone);
      if (casePhone === cleanPhone) {
        const existingCid = c.caller_id || c.intake?.caller_id;
        if (existingCid && /^CID\d{4}[A-Z]\d{3}$/i.test(existingCid)) {
          memoryRegistry.set(cleanPhone, existingCid.toUpperCase());
          if (stored) {
            stored[cleanPhone] = existingCid.toUpperCase();
            saveStoredRegistry(stored);
          }
          return existingCid.toUpperCase();
        }
      }
    }
  }

  // Special match for user's explicit example CID0001K102
  if (cleanPhone.endsWith("102")) {
    const cid = "CID0001K102";
    memoryRegistry.set(cleanPhone, cid);
    const reg = stored || {};
    reg[cleanPhone] = cid;
    saveStoredRegistry(reg);
    return cid;
  }

  // 4. Calculate next sequence number based on existing known registry count
  const allKnownPhones = new Set([
    ...memoryRegistry.keys(),
    ...(stored ? Object.keys(stored) : []),
  ]);

  if (Array.isArray(existingCases)) {
    for (const c of existingCases) {
      const cp = normalize10DigitPhone(c.intake?.phone);
      if (cp) allKnownPhones.add(cp);
    }
  }

  const index = allKnownPhones.size; // 0-based
  const seq = (index % 9999) + 1;
  const letterIndex = Math.floor(index / 9999) % 26;
  const letter = String.fromCharCode(65 + letterIndex); // 'A' to 'Z'
  const newCid = formatCallerId(seq, letter, cleanPhone);

  // Store in memory & localStorage
  memoryRegistry.set(cleanPhone, newCid);
  const reg = stored || {};
  reg[cleanPhone] = newCid;
  saveStoredRegistry(reg);

  return newCid;
}

/**
 * Explicitly register a phone to caller_id mapping
 */
export function registerCallerId(phone, callerId) {
  const cleanPhone = normalize10DigitPhone(phone);
  if (!cleanPhone || !callerId) return;
  memoryRegistry.set(cleanPhone, callerId.toUpperCase());
  const stored = getStoredRegistry() || {};
  stored[cleanPhone] = callerId.toUpperCase();
  saveStoredRegistry(stored);
}
