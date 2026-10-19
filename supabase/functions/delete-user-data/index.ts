import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { replyError, replyJson } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

interface DeleteUserDataPayload {
  confirmation: "PERMANENTLY_DELETE_MY_DATA";
  scope?: "all" | "personal_space_only";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return replyError("Method not allowed. Use POST.", 405);
  }

  try {
    const authResult = await requireAuthUser(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    const user = authResult.user;
    const admin = getAdminClient();

    let body: DeleteUserDataPayload;
    try {
      body = await req.json();
    } catch {
      return replyError("Invalid JSON body", 400);
    }

    if (body.confirmation !== "PERMANENTLY_DELETE_MY_DATA") {
      return replyError(
        'Explicit confirmation string "PERMANENTLY_DELETE_MY_DATA" is required to prevent accidental data loss.',
        400
      );
    }

    const scope = body.scope || "all";
    const auditLog: Record<string, unknown> = {
      action: "delete_user_data",
      userId: user.id,
      scope,
      timestamp: new Date().toISOString(),
    };

    if (scope === "personal_space_only") {
      // Purge personal tasks, journals, and private knowledge
      await admin.from("space_tasks").delete().eq("user_id", user.id).eq("space_type", "personal");
      await admin.from("knowledge_items").delete().eq("user_id", user.id).eq("is_private", true);
      auditLog.purged = "personal_space_items";
    } else {
      // Purge credentials
      await admin.from("encrypted_provider_credentials").delete().eq("user_id", user.id);
      // Clean up claim invitations created by user
      await admin.from("claim_invitations").delete().eq("inviter_user_id", user.id);
      // Revoke any bridges where user is primary contact
      await admin
        .from("bilateral_bridges")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("created_by", user.id);

      auditLog.purged = "full_account_records";
    }

    // Record audit event safely
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "data_deletion_requested",
      details: auditLog,
      created_at: new Date().toISOString(),
    });

    return replyJson({
      status: "success",
      message: "Data deletion staged and executed in accordance with sanctuary privacy policies.",
      audit: auditLog,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(message, 500);
  }
});
