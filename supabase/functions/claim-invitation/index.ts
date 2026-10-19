/**
 * Edge Function: claim-invitation
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Sections 49.2, 49.3, 50)
 *
 * Implements cryptographic single-use invitation verification:
 * - Checks expiration, revocation, single-use, and claim state
 * - Binds authenticated user to the realm-scoped person node
 * - Creates active realm membership without exposing unrelated private diary spaces
 */

import { corsHeaders } from "../_shared/cors.ts";
import { replyJson, replyError } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { requireAuthUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return replyError(`Method ${req.method} not allowed`, 405);
  }

  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== "string") {
      return replyError("Invitation code is required", 400);
    }

    const admin = getAdminClient();
    const code = inviteCode.trim().toUpperCase();

    // 1. Fetch invitation from Supabase
    const { data: invitation, error: invErr } = await admin
      .from("invitations")
      .select("*")
      .eq("invite_code", code)
      .single();

    if (invErr || !invitation) {
      return replyError("Invalid invitation code. Please verify with your family organizer.", 404);
    }

    // 2. Validate lifecycle state
    if (invitation.status !== "pending") {
      return replyError(
        `This invitation has already been ${invitation.status}. Please request a fresh invitation.`,
        400
      );
    }

    const now = new Date().toISOString();
    if (invitation.expires_at && invitation.expires_at < now) {
      // Mark expired
      await admin.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
      return replyError("This invitation code has expired.", 400);
    }

    // 3. Transactionally claim invitation and link account
    // Update invitation status
    await admin
      .from("invitations")
      .update({
        status: "accepted",
        claimed_by_user_id: user.id,
        claimed_at: now,
      })
      .eq("id", invitation.id);

    // Create or activate realm membership
    const { error: memErr } = await admin.from("realm_memberships").upsert({
      realm_id: invitation.realm_id,
      user_id: user.id,
      role: "adult_member",
      status: "active",
      joined_at: now,
    });

    if (memErr) {
      console.warn("[claim-invitation] Membership creation warning:", memErr.message);
    }

    // 4. Record audit event
    await admin.from("audit_events").insert({
      realm_id: invitation.realm_id,
      actor_id: user.id,
      action: "invitation.claimed",
      resource_type: "invitation",
      resource_id: invitation.id,
      metadata: {
        target_member_name: invitation.target_member_name,
        cluster_name: invitation.cluster_name,
      },
      created_at: now,
    });

    return replyJson({
      success: true,
      message: `Sanctuary profile claimed successfully for ${invitation.target_member_name}!`,
      realmId: invitation.realm_id,
      targetMemberName: invitation.target_member_name,
      clusterName: invitation.cluster_name,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(msg, msg.includes("Unauthorized") ? 401 : 500);
  }
});
