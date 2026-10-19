/**
 * Edge Function: generate-plan
 * Specification: Neev_Complete_Supabase_First_Master_Implementation.md (Sections 7, 8, 35)
 *
 * Implements deterministic planning and constraint engine:
 * - Topological dependency sorting (Kahn's algorithm)
 * - Cycle detection and deadlock prevention
 * - Mathematical priority ranking (0 external LLM tokens)
 * - Caregiver workload capacity validation (> 360 mins/day threshold)
 */

import { corsHeaders } from "../_shared/cors.ts";
import { replyJson, replyError } from "../_shared/response.ts";
import { requireAuthUser } from "../_shared/auth.ts";

interface TaskInput {
  id: string;
  title: string;
  estimatedMinutes?: number;
  priority?: number; // 1 to 5
  dueAt?: string;
  dependsOn?: string[];
  assigneeId?: string;
  isDone?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return replyError(`Method ${req.method} not allowed`, 405);
  }

  try {
    await requireAuthUser(req);
    const body = await req.json();
    const { tasks, maxDailyMinutes = 360 } = body as {
      tasks: TaskInput[];
      maxDailyMinutes?: number;
    };

    if (!Array.isArray(tasks)) {
      return replyError("tasks array is required", 400);
    }

    const taskMap = new Map<string, TaskInput>();
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    tasks.forEach((t) => {
      taskMap.set(t.id, t);
      inDegree.set(t.id, 0);
      adj.set(t.id, []);
    });

    tasks.forEach((t) => {
      if (t.dependsOn) {
        t.dependsOn.forEach((depId) => {
          if (taskMap.has(depId)) {
            adj.get(depId)?.push(t.id);
            inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
          }
        });
      }
    });

    // Kahn's algorithm
    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topologicalOrder.push(u);

      adj.get(u)?.forEach((v) => {
        const newDeg = (inDegree.get(v) || 0) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) queue.push(v);
      });
    }

    const hasCycles = topologicalOrder.length !== tasks.length;

    // Calculate priority scores & workload
    const now = Date.now();
    const scoredTasks = tasks.map((t) => {
      let score = (t.priority || 3) * 20;

      if (t.dueAt) {
        const diffHours = (new Date(t.dueAt).getTime() - now) / (1000 * 60 * 60);
        if (diffHours < 0) score += 50;
        else if (diffHours <= 12) score += 40;
        else if (diffHours <= 24) score += 25;
        else if (diffHours <= 72) score += 10;
      }

      const dependentsCount = adj.get(t.id)?.length || 0;
      score += dependentsCount * 15;

      return {
        ...t,
        calculatedPriorityScore: score,
      };
    });

    // Workload evaluation
    const workload: Record<string, { totalMinutes: number; count: number; overloaded: boolean }> = {};
    tasks.forEach((t) => {
      if (t.assigneeId && !t.isDone) {
        if (!workload[t.assigneeId]) {
          workload[t.assigneeId] = { totalMinutes: 0, count: 0, overloaded: false };
        }
        workload[t.assigneeId].totalMinutes += t.estimatedMinutes || 30;
        workload[t.assigneeId].count += 1;
        workload[t.assigneeId].overloaded = workload[t.assigneeId].totalMinutes > maxDailyMinutes;
      }
    });

    return replyJson({
      hasCycles,
      topologicalOrder,
      scoredTasks,
      workload,
      tokensConsumed: 0,
      engine: "Neev Deterministic Heuristics Engine v2",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return replyError(msg, msg.includes("Unauthorized") ? 401 : 500);
  }
});
