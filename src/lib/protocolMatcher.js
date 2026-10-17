import clinicalProtocols from "./clinicalProtocolsData.js";

/**
 * Searches and matches clinical protocols from the 82-condition database
 * based on caller utterances, complaints, and conversational context.
 */
export function matchProtocols(text, maxMatches = 2) {
  if (!text || typeof text !== "string") return [];
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = clean.split(/\s+/).filter((w) => w.length >= 3);

  const scored = [];

  for (const protocol of clinicalProtocols) {
    let score = 0;
    const matchedKeywords = [];

    // Check trigger keywords
    for (const kw of protocol.trigger_keywords) {
      const cleanKw = kw.toLowerCase();
      if (clean.includes(cleanKw)) {
        score += cleanKw.length > 8 ? 6 : 4;
        matchedKeywords.push(kw);
      } else {
        // Partial word match
        const kwWords = cleanKw.split(/\s+/).filter((w) => w.length >= 3);
        const allPresent = kwWords.length > 1 && kwWords.every((w) => words.includes(w));
        if (allPresent) {
          score += 3;
          matchedKeywords.push(kw);
        }
      }
    }

    // Check condition name
    const condWords = protocol.condition_name.toLowerCase().split(/[\s/()]+/).filter((w) => w.length >= 4);
    for (const cw of condWords) {
      if (words.includes(cw)) {
        score += 2;
      }
    }

    // Check red flags keywords
    if (protocol.red_flags) {
      for (const rf of protocol.red_flags) {
        const cleanRf = rf.toLowerCase();
        if (clean.includes(cleanRf)) {
          score += 3;
          matchedKeywords.push(rf);
        }
      }
    }

    if (score > 0) {
      scored.push({
        protocol,
        score,
        matchedKeywords: Array.from(new Set(matchedKeywords)),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMatches);
}

/**
 * Builds an adaptive clinical intelligence prompt block for the LLM.
 * Gives the LLM high-priority red-flag probing anchors, differential diagnoses,
 * and adaptive rules while instructing it to respond to the caller's actual latest words.
 */
export function buildAdaptiveProtocolPromptSnippet(latestInput, fullHistoryText = "", currentClinicalState = {}) {
  const combinedText = `${latestInput || ""} ${fullHistoryText || ""} ${currentClinicalState.suspectedCondition || ""} ${currentClinicalState.initialChiefComplaint || ""}`;

  const latestMatches = matchProtocols(latestInput, 1);
  const overallMatches = matchProtocols(combinedText, 1);

  const topMatches = [];
  const seenIds = new Set();

  for (const m of [...latestMatches, ...overallMatches]) {
    if (!seenIds.has(m.protocol.group_id)) {
      seenIds.add(m.protocol.group_id);
      topMatches.push(m);
    }
    if (topMatches.length >= 1) break;
  }

  if (topMatches.length === 0) {
    return "";
  }

  const { protocol } = topMatches[0];
  const redFlagsList = (protocol.red_flags || []).slice(0, 4).join(", ");
  const rawLvl = String(protocol.urgency_level || "").toLowerCase();
  const normBaseline = rawLvl.includes("emerg") || rawLvl.includes("sev") ? "Severe" : (rawLvl.includes("urg") || rawLvl.includes("mod") ? "Moderate" : "Mild");

  return `CLINICAL PROTOCOL FOCUS: ${protocol.condition_name} (Baseline Urgency: ${normBaseline})
Key Red Flags to screen: ${redFlagsList}`;
}

