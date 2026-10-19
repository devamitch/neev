/**
 * Neev Deterministic Planning & Constraint Engine
 * Specification: Neev_Complete_Supabase_First_Master_Implementation.md (Section 8)
 *
 * Provides 100% mathematical, offline-capable verification and scheduling logic
 * without requiring expensive or unverified LLM token consumption.
 */

export interface ConstraintTask {
  id: string
  title: string
  estimatedMinutes: number
  dueAt?: string // ISO date string
  priority: number // 1 (lowest) to 5 (highest/critical)
  dependsOn?: string[] // task IDs that must complete first
  assigneeId?: string
  isDone?: boolean
}

export interface DependencyAnalysis {
  hasCycles: boolean
  cyclePath?: string[]
  topologicalOrder: string[] // order of task IDs ready to execute
  blockedTaskIds: string[]
  readyTaskIds: string[]
}

export interface WorkloadDistribution {
  assigneeId: string
  totalMinutes: number
  taskCount: number
  overloaded: boolean // exceeds daily capacity (e.g., 360 mins)
}

export interface ScheduleCalculationResult {
  orderedTasks: ConstraintTask[]
  dependencyAnalysis: DependencyAnalysis
  workload: Record<string, WorkloadDistribution>
  conflicts: string[]
  totalEffortMinutes: number
  calculatedAt: string
}

export const deterministicEngine = {
  /**
   * Analyzes dependencies between tasks, checks for recursive cycles,
   * and produces a topologically sorted execution order.
   */
  analyzeDependencies(tasks: ConstraintTask[]): DependencyAnalysis {
    const taskMap = new Map<string, ConstraintTask>()
    tasks.forEach((t) => taskMap.set(t.id, t))

    const inDegree = new Map<string, number>()
    const adj = new Map<string, string[]>()

    tasks.forEach((t) => {
      inDegree.set(t.id, 0)
      adj.set(t.id, [])
    })

    // Build directed graph: dependency -> dependent task
    tasks.forEach((t) => {
      if (t.dependsOn) {
        t.dependsOn.forEach((depId) => {
          if (taskMap.has(depId)) {
            adj.get(depId)?.push(t.id)
            inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1)
          }
        })
      }
    })

    // Kahn's algorithm for topological sorting
    const queue: string[] = []
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id)
    })

    const topologicalOrder: string[] = []
    while (queue.length > 0) {
      const u = queue.shift()!
      topologicalOrder.push(u)

      adj.get(u)?.forEach((v) => {
        const newDeg = (inDegree.get(v) || 0) - 1
        inDegree.set(v, newDeg)
        if (newDeg === 0) queue.push(v)
      })
    }

    const hasCycles = topologicalOrder.length !== tasks.length

    const readyTaskIds: string[] = []
    const blockedTaskIds: string[] = []

    tasks.forEach((t) => {
      if (t.isDone) return
      const unfinishedDeps = (t.dependsOn || []).filter((depId) => {
        const depTask = taskMap.get(depId)
        return depTask && !depTask.isDone
      })
      if (unfinishedDeps.length === 0) {
        readyTaskIds.push(t.id)
      } else {
        blockedTaskIds.push(t.id)
      }
    })

    return {
      hasCycles,
      topologicalOrder,
      readyTaskIds,
      blockedTaskIds,
    }
  },

  /**
   * Calculates deterministic priority score based on Section 8.3:
   * - User-declared priority (1-5)
   * - Deadline proximity (hours until due)
   * - Blocking impact (how many other tasks depend on this)
   */
  calculatePriorityScore(task: ConstraintTask, dependentCount: number, now: Date = new Date()): number {
    let score = task.priority * 20 // 20 - 100 base score

    // Deadline proximity weight
    if (task.dueAt) {
      const dueTime = new Date(task.dueAt).getTime()
      const diffHours = (dueTime - now.getTime()) / (1000 * 60 * 60)

      if (diffHours < 0) {
        score += 50 // Overdue escalation
      } else if (diffHours <= 12) {
        score += 40
      } else if (diffHours <= 24) {
        score += 25
      } else if (diffHours <= 72) {
        score += 10
      }
    }

    // Dependency blocker weight (unblocks other tasks)
    score += Math.min(dependentCount * 8, 32)

    return Math.round(score)
  },

  /**
   * Calculates workload distribution per family member to prevent caregiver burnout.
   */
  calculateWorkload(tasks: ConstraintTask[], dailyCapMinutes: number = 360): Record<string, WorkloadDistribution> {
    const distribution: Record<string, WorkloadDistribution> = {}

    tasks.forEach((t) => {
      if (t.isDone) return
      const assignee = t.assigneeId || "unassigned"
      if (!distribution[assignee]) {
        distribution[assignee] = {
          assigneeId: assignee,
          totalMinutes: 0,
          taskCount: 0,
          overloaded: false,
        }
      }
      distribution[assignee].totalMinutes += t.estimatedMinutes || 30
      distribution[assignee].taskCount += 1
    })

    Object.values(distribution).forEach((w) => {
      w.overloaded = w.totalMinutes > dailyCapMinutes
    })

    return distribution
  },

  /**
   * Complete deterministic plan scheduling calculation
   */
  computeSchedule(tasks: ConstraintTask[]): ScheduleCalculationResult {
    const depAnalysis = this.analyzeDependencies(tasks)
    const workload = this.calculateWorkload(tasks)
    const conflicts: string[] = []

    if (depAnalysis.hasCycles) {
      conflicts.push("Circular task dependency detected. Please review task prerequisites.")
    }

    Object.values(workload).forEach((w) => {
      if (w.overloaded && w.assigneeId !== "unassigned") {
        conflicts.push(`Workload warning: ${w.assigneeId} is assigned ${w.totalMinutes} mins (exceeds 360m limit).`)
      }
    })

    // Rank tasks by dependency readiness then calculated priority
    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const orderedTasks = [...tasks].sort((a, b) => {
      const aReady = depAnalysis.readyTaskIds.includes(a.id) ? 1 : 0
      const bReady = depAnalysis.readyTaskIds.includes(b.id) ? 1 : 0
      if (aReady !== bReady) return bReady - aReady

      const aScore = this.calculatePriorityScore(a, 0)
      const bScore = this.calculatePriorityScore(b, 0)
      return bScore - aScore
    })

    const totalEffortMinutes = tasks.reduce((sum, t) => sum + (t.isDone ? 0 : t.estimatedMinutes || 30), 0)

    return {
      orderedTasks,
      dependencyAnalysis: depAnalysis,
      workload,
      conflicts,
      totalEffortMinutes,
      calculatedAt: new Date().toISOString(),
    }
  },
}
