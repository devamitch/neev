/**
 * Edge Function: manage-provider-credential (BYOK vault)
 *
 * Keys are sealed with AES-256-GCM (see _shared/crypto.ts) and stored in
 * provider_credentials, which has no client grants: only this function and
 * ai-request (service role) can read it, and only for the caller's own user id.
 * Raw keys are never returned; responses carry a short preview only.
 *
 * Body: { action: "list" | "save" | "test" | "delete", provider?, apiKey?, label?, defaultModel? }
 */
import { corsHeaders } from "../_shared/cors.ts";
import { replyError, replyJson } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { openSecret, previewKey, sealSecret } from "../_shared/crypto.ts";
import { isProvider, testProviderKey } from "../_shared/providers.ts";

const PUBLIC_COLUMNS = "provider_id, label, key_preview, status, default_model, last_tested_at, safe_error_code, updated_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let user;
  try {
    user = await requireAuthUser(req);
  } catch {
    return replyError("Sign in to manage AI keys", 401);
  }

  try {
    const admin = getAdminClient();
    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => null);
    if (!body || typeof body !== "object") return replyError("Invalid JSON body", 400);
    const { action, provider, apiKey, label, defaultModel } = body as Record<string, unknown>;

    if (action === "list") {
      const { data, error } = await admin
        .from("provider_credentials")
        .select(PUBLIC_COLUMNS)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) return replyError("Couldn't load your keys", 500);
      return replyJson({ credentials: data ?? [] });
    }

    if (!isProvider(provider)) return replyError("Unknown provider", 400);

    if (action === "save") {
      if (typeof apiKey !== "string" || apiKey.trim().length < 16 || apiKey.trim().length > 400) {
        return replyError("That doesn't look like an API key", 400);
      }
      const key = apiKey.trim();
      // Check the key before keeping it, so a typo never silently "saves".
      const problem = await testProviderKey(provider, key);
      if (problem === "invalid_key") return replyError("The provider rejected this key", 422);

      const { data, error } = await admin
        .from("provider_credentials")
        .upsert(
          {
            user_id: user.id,
            provider_id: provider,
            label: typeof label === "string" && label.trim() ? label.trim().slice(0, 60) : "API key",
            encrypted_key: await sealSecret(key, user.id, provider),
            key_preview: previewKey(key),
            key_version: 1,
            status: problem ? (problem === "rate_limited" ? "rate_limited" : "invalid") : "active",
            default_model: typeof defaultModel === "string" ? defaultModel.slice(0, 80) : null,
            last_tested_at: new Date().toISOString(),
            safe_error_code: problem,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider_id" },
        )
        .select(PUBLIC_COLUMNS)
        .single();
      if (error) return replyError("Couldn't save the key", 500);

      await admin.from("audit_events").insert({
        actor_user_id: user.id,
        event_type: "byok.saved",
        resource_type: "provider_credential",
        resource_id: provider,
        payload: { status: data.status },
      });
      return replyJson({ credential: data });
    }

    if (action === "test") {
      const { data: row, error } = await admin
        .from("provider_credentials")
        .select("encrypted_key")
        .eq("user_id", user.id)
        .eq("provider_id", provider)
        .maybeSingle();
      if (error) return replyError("Couldn't load the key", 500);
      if (!row) return replyError("No key saved for this provider", 404);

      const problem = await testProviderKey(provider, await openSecret(row.encrypted_key, user.id, provider));
      const { data } = await admin
        .from("provider_credentials")
        .update({
          status: problem ? (problem === "rate_limited" ? "rate_limited" : "invalid") : "active",
          safe_error_code: problem,
          last_tested_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider_id", provider)
        .select(PUBLIC_COLUMNS)
        .single();
      return replyJson({ ok: problem === null, reason: problem, credential: data });
    }

    if (action === "delete") {
      const { error } = await admin
        .from("provider_credentials")
        .delete()
        .eq("user_id", user.id)
        .eq("provider_id", provider);
      if (error) return replyError("Couldn't remove the key", 500);
      await admin.from("audit_events").insert({
        actor_user_id: user.id,
        event_type: "byok.deleted",
        resource_type: "provider_credential",
        resource_id: provider,
      });
      return replyJson({ deleted: provider });
    }

    return replyError("Unknown action", 400);
  } catch (err) {
    console.error("[manage-provider-credential]", err instanceof Error ? err.message : err);
    return replyError("Something went wrong", 500);
  }
});
