/**
 * Calls to the user's own AI provider (BYOK). Nothing here is simulated: a key test
 * hits the provider's model-list endpoint, and generation returns the provider's text.
 */

export type ProviderId = "google" | "openai" | "groq" | "anthropic";

export const PROVIDERS: readonly ProviderId[] = ["google", "openai", "groq", "anthropic"];

/** Low-cost defaults; a user's saved default_model overrides them. */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-haiku-5-5",
};

export function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

const TIMEOUT_MS = 25_000;

function withTimeout(init: RequestInit = {}): RequestInit {
  return { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) };
}

/** Returns null when the key works, otherwise a short, safe reason. */
export async function testProviderKey(provider: ProviderId, key: string): Promise<string | null> {
  let res: Response;
  switch (provider) {
    case "google":
      res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
        withTimeout({ headers: { "x-goog-api-key": key } }),
      );
      break;
    case "openai":
      res = await fetch("https://api.openai.com/v1/models", withTimeout({ headers: { Authorization: `Bearer ${key}` } }));
      break;
    case "groq":
      res = await fetch("https://api.groq.com/openai/v1/models", withTimeout({ headers: { Authorization: `Bearer ${key}` } }));
      break;
    case "anthropic":
      res = await fetch(
        "https://api.anthropic.com/v1/models?limit=1",
        withTimeout({ headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }),
      );
      break;
  }
  await res.body?.cancel();
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return "invalid_key";
  if (res.status === 429) return "rate_limited";
  return `provider_http_${res.status}`;
}

export class ProviderError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function generateText(
  provider: ProviderId,
  key: string,
  model: string,
  prompt: string,
  system: string,
  maxTokens = 800,
): Promise<string> {
  let res: Response;
  if (provider === "google") {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      withTimeout({
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }),
    );
    if (!res.ok) throw new ProviderError(`provider_http_${res.status}`, res.status);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
  }

  if (provider === "anthropic") {
    res = await fetch(
      "https://api.anthropic.com/v1/messages",
      withTimeout({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    );
    if (!res.ok) throw new ProviderError(`provider_http_${res.status}`, res.status);
    const data = await res.json();
    return (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
  }

  const base = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
  res = await fetch(
    `${base}/chat/completions`,
    withTimeout({
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    }),
  );
  if (!res.ok) throw new ProviderError(`provider_http_${res.status}`, res.status);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}
