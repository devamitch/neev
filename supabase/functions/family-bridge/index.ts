/**
 * Edge Function: family-bridge
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Section 51)
 *
 * Governs bilateral, consented cross-family bridges:
 * - Scopes access strictly to shared categories (e.g. functions, rituals)
 * - Explicitly prevents leaking private Personal Space diaries, health metrics, or finances
 * - Supports active, paused, and revoked lifecycle states with immediate authorization revocation
 */

import { corsHeaders } from "../_shared/cors.ts";
import { replyJson, replyError } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { requireAuthUser } from "../_shared/auth.ts";

const ALLOWED_CATEGORIES = ["functions", "rituals", "celebrations", "gatherings"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireAuthUser(req);
    const admin = getAdminClient();

    // GET /family-bridge?realmId=<realmId>
    if (req.method === "GET") {
      const url = new URL(req.url);
      const realmId = url.searchParams.get("realmId");

      if (!realmId) {
        return replyError("realmId is required", 400);
      }

      // Check membership
      const { data: mem } = await admin
        .from("realm_memberships")
        .select("role")
        .eq("realm_id", realmId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!mem) {
        return replyError("Forbidden: Unauthorized realm access", 403);
      }

      const { data: bridges, error: bridgeErr } = await admin
        .from("family_bridges")
        .select("*")
        .eq("from_realm_id", realmId);

      if (bridgeErr) {
        return replyError("Failed to fetch bridges", 500, bridgeErr.message);
      }

      return replyJson({ bridges: bridges ?? [] });
    }

    // POST /family-bridge -> Establish a new bridge
    if (req.method === "POST") {
      const body = await req.json();
      const { fromRealmId, targetRealmName, purpose, sharedCategories } = body;

      if (!fromRealmId || !targetRealmName) {
        return replyError("fromRealmId and targetRealmName are required", 400);
      }

      // Check caller's permission
      const { data: mem } = await admin
        .from("realm_memberships")
        .select("role")
        .eq("realm_id", fromRealmId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!mem || !["realm_owner", "realm_admin"].includes(mem.role)) {
        return replyError("Forbidden: Only realm owners or administrators can establish bilateral bridges", 403);
      }

      // Validate shared categories: MUST NOT contain personal, health, finance, or diary
      const safeCategories = (sharedCategories || ["functions", "rituals"]).filter(
        (c: string) => ALLOWED_CATEGORIES.includes(c)
      );

      const bridgeId = `bridge_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;

      const { data: bridge, error: insertErr } = await admin
        .from("family_bridges")
        .insert({
          id: bridgeId,
          from_realm_id: fromRealmId,
          target_realm_name: targetRealmName.trim(),
          purpose: purpose?.trim() || "Wedding & Festival Logistics",
          shared_categories: safeCategories,
          status: "active",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        return replyError("Failed to create bridge", 500, insertErr.message);
      }

      // Audit event
      await admin.from("audit_events").insert({
        realm_id: fromRealmId,
        actor_id: user.id,
        action: "bridge.established",
        resource_type: "family_bridge",
        resource_id: bridgeId,
        metadata: {
          target_realm_name: targetRealmName,
          shared_categories: safeCategories,
        },
        created_at: new Date().toISOString(),
      });

      return replyJson({
        message: "Bilateral bridge established with scoped privacy boundary",
        bridge,
      }, 201);
    }

    // PATCH /family-bridge -> Pause, Resume, or Revoke
    if (req.method === "PATCH") {
      const body = await req.json();
      const { bridgeId, action } = body; // action: 'pause' | 'resume' | 'revoke'

      if (!bridgeId || !action) {
        return replyError("bridgeId and action ('pause' | 'resume' | 'revoke') are required", 400);
      }

      if (action === "revoke") {
        await admin.from("family_bridges").delete().eq("id", bridgeId);
        return replyJson({ success: true, message: "Bridge revoked. Cross-realm data access terminated immediately." });
      }

      const nextStatus = action === "pause" ? "paused" : "active";
      const { data: updated, error: patchErr } = await admin
        .from("family_bridges")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bridgeId)
        .select()
        .single();

      if (patchErr) {
        return replyError("Failed to update bridge", 500, patchErr.message);
      }

      return replyJson({ success: true, bridge: updated });
    }

    return replyError(`Method ${req.method} not allowed`, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(msg, msg.includes("Unauthorized") ? 401 : 500);
  }
});
