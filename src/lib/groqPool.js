// High-Speed Multi-Groq API Key Pool & Instant Failover Manager
// Provides seamless rate-limit (429) detection, instant key rotation,
// round-robin load distribution, and strict key secrecy (server-side only).

// In-memory runtime state for round-robin pointer & cooldown timestamps
let currentKeyIndex = 0;
const keyCooldowns = new Map(); // key -> timestamp (ms) until cooldown expires

/**
 * Mask key for logs so full API keys are never exposed in logs or console
 */
export function maskKey(key) {
  if (!key || typeof key !== "string") return "unknown";
  if (key.length <= 12) return "gsk_***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * Returns all configured Groq keys from environment variables.
 * De-duplicates keys while preserving order.
 */
export function getGroqKeys() {
  const keys = [];

  // 1. Check comma-delimited GROQ_API_KEYS
  if (process.env.GROQ_API_KEYS) {
    const list = process.env.GROQ_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter((k) => k.startsWith("gsk_"));
    keys.push(...list);
  }

  // 2. Check GROQ_API_KEY
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith("gsk_")) {
    keys.push(process.env.GROQ_API_KEY.trim());
  }

  // 3. Check numbered env vars GROQ_API_KEY_1 through GROQ_API_KEY_30
  for (let i = 1; i <= 30; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k && k.trim().startsWith("gsk_")) {
      keys.push(k.trim());
    }
  }

  // De-duplicate
  const uniqueKeys = Array.from(new Set(keys));
  return uniqueKeys;
}

/**
 * Marks a key as rate-limited for a duration (default 60 seconds).
 */
export function markKeyRateLimited(key, durationMs = 60000) {
  keyCooldowns.set(key, Date.now() + durationMs);
}

/**
 * Checks if a key is currently cooled down / available.
 */
export function isKeyAvailable(key) {
  const cd = keyCooldowns.get(key);
  if (!cd) return true;
  if (Date.now() >= cd) {
    keyCooldowns.delete(key);
    return true;
  }
  return false;
}

/**
 * Executes an async operation with rapid automatic failover across the Groq key pool.
 * On HTTP 429, immediately marks the key on cooldown and tries the next key with ZERO delay.
 */
export async function executeGroqWithFailover(fn, { label = "Groq", maxAttempts } = {}) {
  const allKeys = getGroqKeys();
  if (allKeys.length === 0) {
    throw new Error("No Groq API keys configured in pool.");
  }

  const totalKeys = allKeys.length;
  const attemptsLimit = Math.min(maxAttempts || totalKeys, totalKeys);

  // Find next healthy key starting from current pointer
  let startIndex = currentKeyIndex % totalKeys;
  let chosenKey = null;
  let chosenIndex = startIndex;

  // Try finding a key not in cooldown
  for (let offset = 0; offset < totalKeys; offset++) {
    const candidateIdx = (startIndex + offset) % totalKeys;
    const candidateKey = allKeys[candidateIdx];
    if (isKeyAvailable(candidateKey)) {
      chosenKey = candidateKey;
      chosenIndex = candidateIdx;
      break;
    }
  }

  // If all keys are in cooldown, pick the one with earliest cooldown expiry
  if (!chosenKey) {
    let earliestExpiry = Infinity;
    for (let i = 0; i < totalKeys; i++) {
      const exp = keyCooldowns.get(allKeys[i]) || 0;
      if (exp < earliestExpiry) {
        earliestExpiry = exp;
        chosenIndex = i;
        chosenKey = allKeys[i];
      }
    }
    // Reset its cooldown
    if (chosenKey) keyCooldowns.delete(chosenKey);
  }

  // Advance pointer for next call to distribute load evenly
  currentKeyIndex = (chosenIndex + 1) % totalKeys;

  // Attempt requests across the pool starting from chosenIndex
  for (let attempt = 0; attempt < attemptsLimit; attempt++) {
    const activeIdx = (chosenIndex + attempt) % totalKeys;
    const activeKey = allKeys[activeIdx];

    // If candidate is in cooldown and not the first attempt, skip immediately
    if (attempt > 0 && !isKeyAvailable(activeKey)) {
      continue;
    }

    try {
      const result = await fn(activeKey, {
        keyIndex: activeIdx,
        maskedKey: maskKey(activeKey),
        totalKeys,
      });

      // If the caller returned a response object or data
      if (result) {
        if (result.status === 429) {
          markKeyRateLimited(activeKey, 60000);
          console.warn(
            `[GroqPool:${label}] Key #${activeIdx + 1} (${maskKey(activeKey)}) rate limited (429). Switching instantly to next key...`
          );
          currentKeyIndex = (activeIdx + 1) % totalKeys;
          continue; // Zero delay, instant retry with next key
        }

        if (result.ok === false && (result.status === 401 || result.status === 403)) {
          markKeyRateLimited(activeKey, 300000); // 5 min cooldown for auth errors
          console.warn(
            `[GroqPool:${label}] Key #${activeIdx + 1} (${maskKey(activeKey)}) auth issue (${result.status}). Switching to next key...`
          );
          currentKeyIndex = (activeIdx + 1) % totalKeys;
          continue;
        }

        return result;
      }
    } catch (err) {
      console.warn(
        `[GroqPool:${label}] Key #${activeIdx + 1} (${maskKey(activeKey)}) network/fetch exception: ${err.message}. Switching...`
      );
      // Mark temporary cooldown for network failure
      markKeyRateLimited(activeKey, 15000);
      currentKeyIndex = (activeIdx + 1) % totalKeys;
      continue;
    }
  }

  throw new Error(`[GroqPool:${label}] All available Groq keys in pool failed or exhausted.`);
}

/**
 * Ultra-fast Groq Chat Completions wrapper with multi-key pool failover.
 * Defaults to "qwen/qwen3.8-27b", which provides sub-500ms responses with high clinical accuracy.
 */
export async function groqChatCompletion({
  messages,
  model = "qwen/qwen3.8-27b",
  candidateModels = ["qwen/qwen3.8-27b"],
  response_format = { type: "json_object" },
  temperature = 0.3,
  max_tokens = 400,
  timeoutMs = 7000,
}) {
  const modelsToTry = candidateModels.length > 0 ? candidateModels : [model];

  return executeGroqWithFailover(
    async (activeKey, { keyIndex, maskedKey }) => {
      for (const m of modelsToTry) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${activeKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: m,
              messages,
              response_format,
              temperature,
              max_tokens,
            }),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (res.status === 429) {
            return res; // Signal to executeGroqWithFailover to rotate keys immediately
          }

          if (res.ok) {
            const data = await res.json();
            return {
              ok: true,
              data,
              content: data.choices?.[0]?.message?.content || null,
              model: m,
              keyIndex,
              maskedKey,
            };
          }
        } catch (fetchErr) {
          // If aborted or network dropped, continue to next model/key
          if (fetchErr.name === "AbortError") {
            console.warn(`[GroqPool] Timeout (${timeoutMs}ms) on model ${m} with key #${keyIndex + 1}`);
          }
        }
      }

      return null;
    },
    { label: "ChatCompletions" }
  );
}

/**
 * Ultra-fast Groq Whisper Audio Transcription wrapper with multi-key pool failover.
 */
export async function groqWhisperTranscription({
  audioFile,
  model = "whisper-large-v3",
  prompt = "",
  language = null,
  timeoutMs = 8000,
}) {
  return executeGroqWithFailover(
    async (activeKey, { keyIndex, maskedKey }) => {
      const formData = new FormData();
      formData.append("file", audioFile, "audio.webm");
      formData.append("model", model);
      if (prompt) formData.append("prompt", prompt);
      if (language && ["en", "hi"].includes(language)) {
        formData.append("language", language);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 429) {
        return res; // Triggers key rotation in executeGroqWithFailover
      }

      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          text: data.text || "",
          keyIndex,
          maskedKey,
        };
      }

      return res;
    },
    { label: "Whisper" }
  );
}
