// High-Performance Multi-Provider LLM Proxy Router
// Manages 21 Groq API keys with zero-downtime 429 rotation, plus Gemini, Claude & Custom Gateways.

import { getGroqKeys, maskKey } from "./groqPool.js";

// In-memory key health state and cooldown map
const keyCooldownMap = new Map(); // key -> cooldown timestamp (ms)
let groqKeyPointer = 0;

/**
 * Mark an API key as rate-limited or exhausted
 */
export function markKeyCooldown(key, durationMs = 60000) {
  if (key) keyCooldownMap.set(key, Date.now() + durationMs);
}

/**
 * Check if an API key is available (not in cooldown)
 */
export function isKeyAvailable(key) {
  const expiry = keyCooldownMap.get(key);
  if (!expiry) return true;
  if (Date.now() >= expiry) {
    keyCooldownMap.delete(key);
    return true;
  }
  return false;
}

/**
 * Reset all key cooldowns on demand
 */
export function resetAllCooldowns() {
  keyCooldownMap.clear();
}

/**
 * Executes a Chat Completion via Groq with multi-key round-robin rotation & instant 429 failover
 */
async function callGroqWithRotation({
  messages,
  candidateModels = ["qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "mixtral-8x7b-32768"],
  temperature = 0.3,
  max_tokens = 512,
  response_format,
  timeoutMs = 7000,
}) {
  const allKeys = getGroqKeys();
  if (allKeys.length === 0) {
    throw new Error("No Groq API keys available in pool.");
  }

  const totalKeys = allKeys.length;
  let attempts = 0;
  const maxAttempts = totalKeys;

  while (attempts < maxAttempts) {
    const keyIndex = (groqKeyPointer + attempts) % totalKeys;
    const currentKey = allKeys[keyIndex];

    if (!isKeyAvailable(currentKey) && attempts < totalKeys - 1) {
      attempts++;
      continue;
    }

    for (const model of candidateModels) {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const payload = {
          model,
          messages,
          temperature,
          max_tokens,
        };
        if (response_format) {
          payload.response_format = response_format;
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const latency = Date.now() - startTime;
          const choice = data.choices?.[0];
          const content = choice?.message?.content || "";

          // Advance global pointer for round-robin balancing
          groqKeyPointer = (keyIndex + 1) % totalKeys;

          return {
            content,
            provider: "groq",
            model,
            keyMasked: maskKey(currentKey),
            latency,
          };
        }

        // Handle HTTP 429 Rate Limit
        if (res.status === 429) {
          console.warn(`[LLM Proxy] Groq Key (${maskKey(currentKey)}) hit 429 on ${model}. Rotating to next key...`);
          markKeyCooldown(currentKey, 60000);
          break; // Switch to next key in pool
        }

        if (res.status === 401) {
          console.warn(`[LLM Proxy] Groq Key (${maskKey(currentKey)}) unauthorized. Disabling key for 24h.`);
          markKeyCooldown(currentKey, 86400000);
          break;
        }
      } catch (fetchErr) {
        console.warn(`[LLM Proxy] Groq error on ${model} with ${maskKey(currentKey)}:`, fetchErr.message);
      }
    }

    attempts++;
  }

  throw new Error("All Groq API keys in pool currently exhausted or rate-limited.");
}

/**
 * Executes a Chat Completion via Google Gemini
 */
async function callGeminiProxy({
  messages,
  candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"],
  temperature = 0.3,
  max_tokens = 512,
  timeoutMs = 7000,
}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));

  for (const model of candidateModels) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: max_tokens,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const latency = Date.now() - startTime;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return {
          content: text,
          provider: "gemini",
          model,
          latency,
        };
      }
    } catch (err) {
      console.warn(`[LLM Proxy] Gemini (${model}) error:`, err.message);
    }
  }

  throw new Error("Gemini models failed to respond.");
}

/**
 * Executes a Chat Completion via Anthropic Claude
 */
async function callAnthropicProxy({
  messages,
  model = "claude-3-5-sonnet-20241022",
  system,
  max_tokens = 600,
  temperature = 0.3,
  timeoutMs = 8000,
}) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const formattedMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        system: system || messages.find((m) => m.role === "system")?.content,
        messages: formattedMessages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const latency = Date.now() - startTime;
      const text = data.content?.[0]?.text || "";

      return {
        content: text,
        provider: "claude",
        model,
        latency,
      };
    }
  } catch (err) {
    console.warn("[LLM Proxy] Anthropic Claude error:", err.message);
  }

  throw new Error("Anthropic Claude API failed to respond.");
}

/**
 * Executes a Chat Completion via Custom / Other LLM Gateway
 */
async function callOtherProxy({
  messages,
  model = "custom-llm-gateway",
  temperature = 0.3,
  max_tokens = 512,
  response_format,
  timeoutMs = 7000,
}) {
  const otherKey =
    process.env.OTHER_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.API_KEY ||
    process.env.CUSTOM_LLM_KEY ||
    process.env.NEXT_PUBLIC_API_KEY;

  if (!otherKey) {
    throw new Error("Other/Custom LLM API key is not configured.");
  }

  const endpoint =
    process.env.OTHER_LLM_ENDPOINT ||
    (process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1/chat/completions"
      : "https://esicdemotriage.dhwaniris.in/api/triage");

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const isDirectOpenAi = endpoint.includes("openai.com") || endpoint.includes("/v1/chat/completions");
    const payload = isDirectOpenAi
      ? {
          model: model === "custom-llm-gateway" ? "gpt-4o-mini" : model,
          messages,
          temperature,
          max_tokens,
          ...(response_format ? { response_format } : {}),
        }
      : {
          symptom_notes: messages[messages.length - 1]?.content || "",
          messages,
        };

    const headers = {
      "Content-Type": "application/json",
      ...(isDirectOpenAi
        ? { Authorization: `Bearer ${otherKey}` }
        : { "X-API-Key": otherKey }),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const latency = Date.now() - startTime;
      const content =
        data.choices?.[0]?.message?.content ||
        (data.triage ? JSON.stringify(data.triage) : typeof data === "string" ? data : JSON.stringify(data));

      return {
        content,
        provider: "other",
        model,
        latency,
      };
    }
  } catch (err) {
    console.warn("[LLM Proxy] Other/Custom Gateway error:", err.message);
  }

  throw new Error("Other/Custom LLM Gateway failed to respond.");
}

/**
 * Master Centralized LLM Proxy Function:
 * Cascades gracefully: Groq (21 Keys) -> Gemini -> Anthropic -> Other/Custom Gateway
 */
export async function executeCentralizedLlmProxy({
  messages = [],
  system = "",
  temperature = 0.3,
  max_tokens = 512,
  response_format = { type: "json_object" },
  preferredProvider = "auto",
}) {
  const preparedMessages = system
    ? [{ role: "system", content: system }, ...messages.filter((m) => m.role !== "system")]
    : messages;

  // 1. Groq (21 Keys Pool)
  if (preferredProvider === "auto" || preferredProvider === "groq") {
    try {
      return await callGroqWithRotation({
        messages: preparedMessages,
        temperature,
        max_tokens,
        response_format,
      });
    } catch (groqErr) {
      console.warn("[LLM Proxy Cascade] Groq pool failed, falling back to Gemini:", groqErr.message);
    }
  }

  // 2. Google Gemini Fallback
  if (preferredProvider === "auto" || preferredProvider === "gemini") {
    try {
      return await callGeminiProxy({
        messages: preparedMessages,
        temperature,
        max_tokens,
      });
    } catch (geminiErr) {
      console.warn("[LLM Proxy Cascade] Gemini failed, falling back to Anthropic:", geminiErr.message);
    }
  }

  // 3. Anthropic Claude Fallback
  if (preferredProvider === "auto" || preferredProvider === "claude") {
    try {
      return await callAnthropicProxy({
        messages: preparedMessages,
        system,
        max_tokens,
        temperature,
      });
    } catch (claudeErr) {
      console.warn("[LLM Proxy Cascade] Anthropic failed, falling back to Other:", claudeErr.message);
    }
  }

  // 4. Other/Custom Gateway Fallback
  if (preferredProvider === "auto" || preferredProvider === "other") {
    try {
      return await callOtherProxy({
        messages: preparedMessages,
        temperature,
        max_tokens,
        response_format,
      });
    } catch (otherErr) {
      console.warn("[LLM Proxy Cascade] Other gateway failed:", otherErr.message);
    }
  }

  throw new Error("All centralized LLM proxy providers failed.");
}

export { callGroqWithRotation, callGeminiProxy, callAnthropicProxy, callOtherProxy };
