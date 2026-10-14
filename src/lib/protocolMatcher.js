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
  
  // Also specifically match latestInput to detect sudden pivots / new symptoms
  const latestMatches = matchProtocols(latestInput, 2);
  const overallMatches = matchProtocols(combinedText, 2);

  // Prioritize latest input matches if caller introduced something new
  const topMatches = [];
  const seenIds = new Set();

  for (const m of [...latestMatches, ...overallMatches]) {
    if (!seenIds.has(m.protocol.group_id)) {
      seenIds.add(m.protocol.group_id);
      topMatches.push(m);
    }
    if (topMatches.length >= 2) break;
  }

  if (topMatches.length === 0) {
    return "";
  }

  const sections = topMatches.map(({ protocol, matchedKeywords }) => {
    const probingSample = (protocol.probing_questions || []).slice(0, 4).map((q) => `   - "${q}"`).join("\n");
    const redFlagsList = (protocol.red_flags || []).slice(0, 5).join(", ");
    const patterns = (protocol.condition_mapping || []).map((m) => `   * When "${m.pattern}" -> Suspect: "${m.suspected}"`).join("\n");

    const rawLvl = String(protocol.urgency_level || "").toLowerCase();
    const normBaseline = rawLvl.includes("emerg") || rawLvl.includes("sev") ? "Severe" : (rawLvl.includes("urg") || rawLvl.includes("mod") ? "Moderate" : "Mild");
    const routingTarget = normBaseline === "Severe" ? "108 Ambulance" : (normBaseline === "Moderate" ? "ESIC Hospital & Govt District Hospital" : "ESIS Dispensary & 104 Health Helpline");

    return `### CLINICAL INTELLIGENCE ANCHOR: ${protocol.condition_name} [${protocol.group_name}]
- Matched Caller Signals: ${matchedKeywords.join(", ") || "Clinical symptoms"}
- Urgency Baseline: ${normBaseline} -> Recommended Routing: ${routingTarget}
- Red-Flag Danger Signs to Watch: ${redFlagsList}
- Relevant Probing Questions from Clinical Protocol:
${probingSample}
- Differential Mapping:
${patterns}
- Clinical Management Note: ${protocol.notes || "None"}`;
  }).join("\n\n");

  return `
=== DYNAMIC CLINICAL PROTOCOL KNOWLEDGE (ADAPTIVE AI GUIDANCE) ===
${sections}

ADAPTIVE PROBING DIRECTIVE:
1. LISTEN CAREFULLY TO THE CALLER'S EXACT LATEST RESPONSE:
   - The caller might answer your previous question, or they might introduce a NEW symptom, complain of sudden worsening, or mention an unexpected problem.
   - ALWAYS acknowledge and prioritize what the caller just reported.
2. DYNAMIC PIVOTING:
   - If the caller pivots or introduces a new, higher-severity symptom (e.g. bleeding, severe breathlessness, fainting, severe pain, eye changes), IMMEDIATELY pivot your clinical focus to assess that danger!
   - Do NOT stubbornly stick to a scripted sequence if the patient's condition changes or if they bring up an acute red flag.
3. ADAPTIVE QUESTION FORMULATION:
   - Use the clinical protocol questions above as medical inspiration, but tailor your single question dynamically to the patient's actual words and situation.
   - Frame your question with empathy: Ask the IP: "<English Question>" (Hinglish: "<Romanized Hinglish Question>")
   - Update suspectedCondition and severity dynamically reflecting the cumulative findings!
==================================================================`;
}
