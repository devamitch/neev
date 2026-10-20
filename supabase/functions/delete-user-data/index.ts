/**
 * Edge Function: delete-user-data
 *
 * scope "personal_space_only": deletes the caller's personal spaces (and, by cascade,
 *   their goals/tasks/approvals) and private memories.
 * scope "all": deletes realms the caller owns, then the auth user itself — profiles,
 *   memberships, AI keys and other user-owned rows cascade from auth.users.
 * Requires the literal confirmation string so it can't be triggered by accident.
 */
import { corsHeaders } from "../_shared/cors.ts";
import { replyError, replyJson } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return replyError("Use POST", 405);

  let user;
  try {
    user = await requireAuthUser(req);
  } catch {
    return replyError("Sign in to delete your data", 401);
  }

  const body = await req.json().catch(() => null);
  if (body?.confirmation !== "PERMANENTLY_DELETE_MY_DATA") {
    return replyError('Send confirmation "PERMANENTLY_DELETE_MY_DATA" to continue', 400);
  }
  const scope = body?.scope === "personal_space_only" ? "personal_space_only" : "all";
  const admin = getAdminClient();

  try {
    if (scope === "personal_space_only") {
      const spaces = await admin
        .from("spaces")
        .delete()
        .eq("owner_user_id", user.id)
        .eq("space_type", "personal");
      if (spaces.error) throw spaces.error;
      const memories = await admin
        .from("memory_records")
        .delete()
        .eq("owner_user_id", user.id)
        .eq("visibility", "private");
      if (memories.error) throw memories.error;

      await admin.from("audit_events").insert({
        actor_user_id: user.id,
        event_type: "data.deleted",
        resource_type: "user",
        resource_id: user.id,
        payload: { scope },
      });
      return replyJson({ deleted: scope });
    }

    // Families this person created are removed with them; families they only joined
    // just lose this member (membership rows cascade with the auth user).
    const realms = await admin.from("family_realms").delete().eq("owner_id", user.id);
    if (realms.error) throw realms.error;

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return replyJson({ deleted: scope });
  } catch (err) {
    console.error("[delete-user-data]", err instanceof Error ? err.message : err);
    return replyError("Couldn't delete your data. Nothing was reported as deleted.", 500);
  }
});
