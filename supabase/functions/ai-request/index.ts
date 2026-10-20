/**
 * Edge Function: ai-request (BYOK only)
 *
 * Runs a prompt with the caller's own provider key from the vault. Neev pays for no
 * model calls: with no saved key the function answers 409 `no_provider_key` and the
 * app keeps using its on-device logic. Prompts and outputs are not stored; only a
 * metadata audit row (provider, model, sizes) is kept for the hourly limit.
 *
 * Body: { prompt: string, system?: string, provider?: ProviderId, realmId?: string, maxTokens?: number }
 */
import { corsHeaders } from "../_shared/cors.ts";
import { replyError, replyJson } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { openSecret } from "../_shared/crypto.ts";
import { DEFAULT_MODELS, generateText, isProvider, ProviderError } from "../_shared/providers.ts";

const MAX_PROMPT_CHARS = 8000;
const HOURLY_LIMIT = 40;
const DEFAULT_SYSTEM =
  "You help a family organise their home life: schedules, chores, events and notes. " +
  "Be brief, practical and kind. Never invent facts about the family; say when you don't know.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return replyError("Use POST", 405);

  let user;
  try {
    user = await requireAuthUser(req);
  } catch {
    return replyError("Sign in to use AI features", 401);
  }

  try {
    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return replyError("prompt is required", 400);
    if (prompt.length > MAX_PROMPT_CHARS) return replyError("prompt is too long", 413);

    // Policy: Neev never reads or sends email.
    if (/\bgmail\b|read (my )?mail|fetch email|send email/i.test(prompt)) {
      return replyJson({ status: "blocked_by_policy", code: "GMAIL_ACCESS_BLOCKED" }, 403);
    }

    const admin = getAdminClient();

    if (typeof body?.realmId === "string") {
      const { data: member } = await admin
        .from("realm_memberships")
        .select("role")
        .eq("realm_id", body.realmId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!member) return replyError("You're not a member of this family", 403);
    }

    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", user.id)
      .eq("event_type", "ai.request")
      .gte("created_at", since);
    if ((count ?? 0) >= HOURLY_LIMIT) return replyError("Hourly AI limit reached", 429);

    let query = admin
      .from("provider_credentials")
      .select("provider_id, encrypted_key, default_model")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (isProvider(body?.provider)) query = query.eq("provider_id", body.provider);
    const { data: creds, error } = await query;
    if (error) return replyError("Couldn't load your AI key", 500);
    const cred = creds?.[0];
    if (!cred || !isProvider(cred.provider_id)) {
      return replyJson({ code: "no_provider_key" }, 409);
    }

    const model = cred.default_model || DEFAULT_MODELS[cred.provider_id];
    const key = await openSecret(cred.encrypted_key, user.id, cred.provider_id);
    const maxTokens = Math.min(Math.max(Number(body?.maxTokens) || 800, 64), 2000);
    const system = typeof body?.system === "string" ? body.system.slice(0, 2000) : DEFAULT_SYSTEM;

    let text: string;
    try {
      text = await generateText(cred.provider_id, key, model, prompt, system, maxTokens);
    } catch (e) {
      if (e instanceof ProviderError && (e.status === 401 || e.status === 403)) {
        await admin
          .from("provider_credentials")
          .update({ status: "invalid", safe_error_code: "invalid_key" })
          .eq("user_id", user.id)
          .eq("provider_id", cred.provider_id);
        return replyError("Your AI key was rejected by the provider", 422);
      }
      if (e instanceof ProviderError && e.status === 429) return replyError("Provider rate limit reached", 429);
      throw e;
    }

    await admin.from("audit_events").insert({
      actor_user_id: user.id,
      event_type: "ai.request",
      resource_type: "provider",
      resource_id: cred.provider_id,
      payload: { model, prompt_chars: prompt.length, output_chars: text.length },
    });

    return replyJson({ text, provider: cred.provider_id, model });
  } catch (err) {
    console.error("[ai-request]", err instanceof Error ? err.message : err);
    return replyError("AI request failed", 502);
  }
});
