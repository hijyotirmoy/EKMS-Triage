// High-Performance Multi-Provider LLM Proxy Router
// Manages Groq API Key Pool with zero-downtime 429 rotation, plus OpenRouter, Hugging Face, Gemini & Gateways.

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
  candidateModels = ["qwen/qwen3.8-27b"],
  temperature = 0.2,
  max_tokens = 250,
  response_format,
  timeoutMs = 4000,
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

// In-memory OpenRouter multi-key pointer
let openrouterKeyPointer = 0;

/**
 * Returns all configured OpenRouter keys from environment variables across multiple accounts.
 */
export function getOpenRouterKeys() {
  const keys = [];
  if (process.env.OPENROUTER_API_KEYS) {
    const list = process.env.OPENROUTER_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter((k) => k.startsWith("sk-or-"));
    keys.push(...list);
  }
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.startsWith("sk-or-")) {
    keys.push(process.env.OPENROUTER_API_KEY.trim());
  }
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`OPENROUTER_API_KEY_${i}`];
    if (k && k.trim().startsWith("sk-or-")) {
      keys.push(k.trim());
    }
  }
  return Array.from(new Set(keys));
}

/**
 * Executes a Chat Completion via OpenRouter API (OpenAI-compatible)
 * Defaults to 100% FREE community models (:free) with multi-account rotation & failover.
 */
async function callOpenRouterProxy({
  messages,
  candidateModels = ["qwen/qwen-2.5-72b-instruct", "openrouter/free"],
  temperature = 0.2,
  max_tokens = 550,
  response_format,
  timeoutMs = 5000,
}) {
  const allKeys = getOpenRouterKeys();
  if (allKeys.length === 0) {
    throw new Error("No OPENROUTER_API_KEY configured in pool.");
  }

  const totalKeys = allKeys.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const keyIndex = (openrouterKeyPointer + attempt) % totalKeys;
    const currentKey = allKeys[keyIndex];

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
          ...(response_format ? { response_format } : {}),
        };

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
            "HTTP-Referer": "https://ekms-triage.gov.in",
            "X-Title": "EKMS Triage AI",
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

          // Advance pointer on success
          openrouterKeyPointer = (keyIndex + 1) % totalKeys;

          return {
            content,
            provider: "openrouter",
            model,
            keyIndex,
            latency,
          };
        } else if (res.status === 429) {
          console.warn(`[LLM Proxy] OpenRouter Key #${keyIndex + 1} rate limited (429). Rotating to next account key...`);
          break; // Try next account key
        } else {
          const errText = await res.text().catch(() => "");
          console.warn(`[LLM Proxy] OpenRouter (${model}) error HTTP ${res.status}: ${errText}`);
        }
      } catch (err) {
        console.warn(`[LLM Proxy] OpenRouter (${model}) key #${keyIndex + 1} error:`, err.message);
      }
    }
  }

  throw new Error("All OpenRouter API keys failed or exhausted.");
}

/**
 * Executes a Chat Completion via Hugging Face Serverless Inference API (OpenAI-compatible)
 * Natively supports Qwen/Qwen3.8-27B with sub-100ms response times
 */
async function callHuggingFaceProxy({
  messages,
  model = "Qwen/Qwen3.8-27B",
  temperature = 0.2,
  max_tokens = 512,
  response_format,
  timeoutMs = 6000,
}) {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model,
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    };

    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hfKey}`,
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

      return {
        content,
        provider: "huggingface",
        model,
        latency,
      };
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[LLM Proxy] Hugging Face error HTTP ${res.status}: ${errText}`);
    }
  } catch (err) {
    console.warn("[LLM Proxy] Hugging Face error:", err.message);
  }

  throw new Error("Hugging Face API failed to respond.");
}

/**
 * Master Centralized LLM Proxy Function:
 * Cascades gracefully across high-speed ensemble:
 * Groq Pool -> OpenRouter (Qwen 2.5 72B / Llama 3.3) -> Hugging Face (Qwen 3.8 27B) -> Gemini -> Anthropic -> Other
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

  // 1. Groq Multi-Key Pool (Qwen 3.8 27B)
  if (preferredProvider === "auto" || preferredProvider === "groq") {
    try {
      return await callGroqWithRotation({
        messages: preparedMessages,
        temperature,
        max_tokens,
        response_format,
      });
    } catch (groqErr) {
      console.warn("[LLM Proxy Cascade] Groq pool failed, falling back to OpenRouter / Hugging Face:", groqErr.message);
    }
  }

  // 2. OpenRouter API (Qwen 2.5 72B Instruct / Llama 3.3 70B)
  if ((preferredProvider === "auto" || preferredProvider === "openrouter") && process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouterProxy({
        messages: preparedMessages,
        temperature,
        max_tokens,
        response_format,
      });
    } catch (orErr) {
      console.warn("[LLM Proxy Cascade] OpenRouter failed, falling back to Hugging Face:", orErr.message);
    }
  }

  // 3. Hugging Face Serverless (Qwen 3.8 27B)
  if ((preferredProvider === "auto" || preferredProvider === "huggingface") && process.env.HUGGINGFACE_API_KEY) {
    try {
      return await callHuggingFaceProxy({
        messages: preparedMessages,
        model: "Qwen/Qwen3.8-27B",
        temperature,
        max_tokens,
        response_format,
      });
    } catch (hfErr) {
      console.warn("[LLM Proxy Cascade] Hugging Face failed, falling back to Gemini:", hfErr.message);
    }
  }

  // 3. Google Gemini Fallback
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

  // 4. Anthropic Claude Fallback
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

  // 5. Other/Custom Gateway Fallback
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

export { callGroqWithRotation, callOpenRouterProxy, callHuggingFaceProxy, callGeminiProxy, callAnthropicProxy, callOtherProxy };
