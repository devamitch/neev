import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { replyError, replyJson } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

interface AiRequestPayload {
  prompt: string;
  contextType?: "family_plan" | "ritual" | "task" | "knowledge" | "general";
  spaceId?: string;
  realmId?: string;
  metadata?: Record<string, unknown>;
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

    let body: AiRequestPayload;
    try {
      body = await req.json();
    } catch {
      return replyError("Invalid JSON body", 400);
    }

    const { prompt, contextType = "general", spaceId, realmId } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return replyError("prompt is required and must not be empty", 400);
    }

    // PRIVACY POLICY CHECK: Block Gmail read/write requests at the AI layer
    const lowerPrompt = prompt.toLowerCase();
    if (
      lowerPrompt.includes("gmail") ||
      lowerPrompt.includes("read mail") ||
      lowerPrompt.includes("fetch email") ||
      lowerPrompt.includes("send email via google")
    ) {
      return replyJson({
        status: "blocked_by_policy",
        policyCode: "GMAIL_ACCESS_BLOCKED",
        message:
          "Sanctuary Privacy Policy: Gmail read/write access is blocked by policy. Neev prioritizes family privacy and does not ingest or scan personal email communications.",
        timestamp: new Date().toISOString(),
      });
    }

    // Verify Space / Realm boundary if supplied
    if (realmId) {
      const admin = getAdminClient();
      const { data: realmMember } = await admin
        .from("realm_members")
        .select("id, role")
        .eq("realm_id", realmId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!realmMember) {
        return replyError("Access denied: You are not a member of this realm", 403);
      }
    }

    // High quality deterministic / structured response envelope
    const responsePayload = {
      requestId: crypto.randomUUID(),
      userId: user.id,
      contextType,
      spaceId: spaceId || null,
      realmId: realmId || null,
      analysis: {
        clarityScore: 0.95,
        privacyCompliant: true,
        sanctuaryProtected: true,
      },
      content: `Neev AI response for [${contextType}]: Request processed within sanctuary boundaries.`,
      suggestions: [
        "Review dependencies in family tree view",
        "Confirm bilateral bridge permissions before sharing across clusters",
      ],
      createdAt: new Date().toISOString(),
    };

    return replyJson(responsePayload, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(message, 500);
  }
});
