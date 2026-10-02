// Centralized Case ID Generator & Formatter for EKMS Triage
// Format: CA + 4 digits (0001-9999) + 2 letters (AB-ZZ) + 2 digits (01-99)
// Example progression:
// CA0001AB01 -> CA0002AB01 ... -> CA9999AB01 -> CA0001AC01 ... -> CA9999ZZ01 -> CA0001AB02

// Generate 2-letter combos starting from 'AB' to 'ZZ'
export const TWO_LETTER_COMBOS = [];
for (let c1 = 65; c1 <= 90; c1++) {
  for (let c2 = 65; c2 <= 90; c2++) {
    if (c1 === 65 && c2 === 65) continue; // Skip AA to start with AB
    TWO_LETTER_COMBOS.push(String.fromCharCode(c1) + String.fromCharCode(c2));
  }
}

export const LETTER_COMBO_TO_INDEX = new Map();
TWO_LETTER_COMBOS.forEach((combo, idx) => {
  LETTER_COMBO_TO_INDEX.set(combo, idx);
});
LETTER_COMBO_TO_INDEX.set("AA", 0); // Graceful fallback for AA

export const CASE_ID_REGEX = /^CA(\d{4})([A-Z]{2})(\d{2})$/i;

export function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Converts a 0-based serial index to a Case ID string.
 * Index 0 -> CA0001AB01
 * Index 1 -> CA0002AB01
 * Index 9998 -> CA9999AB01
 * Index 9999 -> CA0001AC01
 */
export function globalIndexToCaseId(index) {
  const safeIndex = Math.max(0, Number(index) || 0);
  const num = (safeIndex % 9999) + 1; // 1 to 9999
  const rem = Math.floor(safeIndex / 9999);
  const l_idx = rem % TWO_LETTER_COMBOS.length;
  const rem2 = Math.floor(rem / TWO_LETTER_COMBOS.length);
  const suffix = (rem2 % 99) + 1; // 1 to 99

  const numStr = String(num).padStart(4, "0");
  const letters = TWO_LETTER_COMBOS[l_idx] || "AB";
  const suffixStr = String(suffix).padStart(2, "0");
  return `CA${numStr}${letters}${suffixStr}`;
}

/**
 * Parses a Case ID string back into its 0-based serial index.
 * Returns null if the Case ID does not match the canonical format.
 */
export function caseIdToGlobalIndex(caseId) {
  if (!caseId) return null;
  const match = String(caseId).trim().toUpperCase().match(CASE_ID_REGEX);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const letters = match[2];
  const suffix = parseInt(match[3], 10);

  const l_idx = LETTER_COMBO_TO_INDEX.get(letters);
  if (l_idx === undefined || num < 1 || num > 9999 || suffix < 1 || suffix > 99) {
    return null;
  }

  return ((suffix - 1) * TWO_LETTER_COMBOS.length + l_idx) * 9999 + (num - 1);
}

/**
 * Generates the appropriate Case ID:
 * 1. If callerPhone matches any existing case, returns that existing caller's case_ref.
 * 2. Otherwise finds the highest sequential Case ID in existing cases and returns the next serial ID.
 */
export function generateNextCaseRef(existingCases = [], callerPhone = null) {
  const queryPhone = normalizePhone(callerPhone);

  // 1. Phone number match rule: same phone number retains the same Case ID
  if (queryPhone && queryPhone.length >= 6 && Array.isArray(existingCases)) {
    const existingCallerCase = existingCases.find((c) => {
      const p = normalizePhone(c.intake?.phone || c.phone);
      return p && p === queryPhone && (c.case_ref || c.case_id);
    });

    if (existingCallerCase) {
      return existingCallerCase.case_ref || existingCallerCase.case_id;
    }
  }

  // 2. Sequential serial generation
  let maxIndex = -1;

  if (Array.isArray(existingCases)) {
    for (const c of existingCases) {
      const ref = c.case_ref || c.case_id || "";
      const idx = caseIdToGlobalIndex(ref);
      if (idx !== null && idx > maxIndex) {
        maxIndex = idx;
      }
    }
  }

  const nextIndex = maxIndex + 1;
  return globalIndexToCaseId(nextIndex);
}
