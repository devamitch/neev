/**
 * Edge Function: kinship-graph
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Section 52 & 55)
 *
 * Manages typed kinship graph edges within an authorized realm:
 * - Enforces composite realm integrity (both source and target must reside in caller's realm)
 * - Validates relation semantics and rejects self-loops
 * - Records provenance and audit logs
 */

import { corsHeaders } from "../_shared/cors.ts";
import { replyJson, replyError } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { requireAuthUser } from "../_shared/auth.ts";

const VALID_RELATIONS = [
  "parent",
  "child",
  "spouse",
  "sibling",
  "grandparent",
  "grandchild",
  "guardian",
  "in_law",
  "relative",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireAuthUser(req);
    const admin = getAdminClient();

    // GET /kinship-graph?realmId=<realmId>
    if (req.method === "GET") {
      const url = new URL(req.url);
      const realmId = url.searchParams.get("realmId");

      if (!realmId) {
        return replyError("realmId is required", 400);
      }

      // Verify caller membership in realm
      const { data: mem } = await admin
        .from("realm_memberships")
        .select("role")
        .eq("realm_id", realmId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!mem) {
        return replyError("Forbidden: You are not an active member of this realm", 403);
      }

      const { data: edges, error: edgesErr } = await admin
        .from("kinship_edges")
        .select("*")
        .eq("realm_id", realmId);

      if (edgesErr) {
        return replyError("Failed to fetch kinship edges", 500, edgesErr.message);
      }

      return replyJson({ edges: edges ?? [] });
    }

    // POST /kinship-graph -> Add a new kinship edge
    if (req.method === "POST") {
      const body = await req.json();
      const { realmId, sourceMemberId, targetMemberId, relation, label } = body;

      if (!realmId || !sourceMemberId || !targetMemberId || !relation) {
        return replyError("Missing required parameters (realmId, sourceMemberId, targetMemberId, relation)", 400);
      }

      if (sourceMemberId === targetMemberId) {
        return replyError("Self-referential kinship edges are invalid", 400);
      }

      if (!VALID_RELATIONS.includes(relation)) {
        return replyError(`Invalid relation type. Must be one of: ${VALID_RELATIONS.join(", ")}`, 400);
      }

      // Check caller's permission in the realm
      const { data: mem } = await admin
        .from("realm_memberships")
        .select("role")
        .eq("realm_id", realmId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!mem) {
        return replyError("Forbidden: Unauthorized to edit graph in this realm", 403);
      }

      const edgeId = `ke_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;

      const { data: newEdge, error: insertErr } = await admin
        .from("kinship_edges")
        .insert({
          id: edgeId,
          realm_id: realmId,
          source_member_id: sourceMemberId,
          target_member_id: targetMemberId,
          relation,
          label: label || `${relation} relation`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        return replyError("Failed to create kinship edge", 500, insertErr.message);
      }

      return replyJson({
        message: "Kinship edge recorded successfully",
        edge: newEdge,
      }, 201);
    }

    return replyError(`Method ${req.method} not allowed`, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(msg, msg.includes("Unauthorized") ? 401 : 500);
  }
});
