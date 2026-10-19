import { deterministicEngine, type ConstraintTask } from "@/services/engine/deterministicEngine"

describe("Neev Deterministic Planning & Constraint Engine", () => {
  it("resolves dependency graph and orders tasks correctly without cycles", () => {
    const tasks: ConstraintTask[] = [
      { id: "t-1", title: "Book Hall", estimatedMinutes: 60, priority: 4 },
      { id: "t-2", title: "Print Invites", estimatedMinutes: 45, priority: 3, dependsOn: ["t-1"] },
      { id: "t-3", title: "Distribute Invites", estimatedMinutes: 90, priority: 4, dependsOn: ["t-2"] },
    ]

    const result = deterministicEngine.analyzeDependencies(tasks)
    expect(result.hasCycles).toBe(false)
    expect(result.topologicalOrder).toEqual(["t-1", "t-2", "t-3"])
    expect(result.readyTaskIds).toContain("t-1")
    expect(result.blockedTaskIds).toContain("t-2")
    expect(result.blockedTaskIds).toContain("t-3")
  })

  it("detects circular dependencies reliably", () => {
    const cyclicTasks: ConstraintTask[] = [
      { id: "a", title: "Task A", estimatedMinutes: 30, priority: 3, dependsOn: ["b"] },
      { id: "b", title: "Task B", estimatedMinutes: 30, priority: 3, dependsOn: ["a"] },
    ]

    const result = deterministicEngine.analyzeDependencies(cyclicTasks)
    expect(result.hasCycles).toBe(true)
  })

  it("calculates workload distribution and flags overloads", () => {
    const tasks: ConstraintTask[] = [
      { id: "1", title: "Cook Feast", estimatedMinutes: 240, priority: 4, assigneeId: "member_maa" },
      { id: "2", title: "Decorate Mandir", estimatedMinutes: 180, priority: 3, assigneeId: "member_maa" },
    ]

    const workload = deterministicEngine.calculateWorkload(tasks, 360)
    expect(workload["member_maa"].totalMinutes).toBe(420)
    expect(workload["member_maa"].overloaded).toBe(true)
  })

  it("escalates priority for imminent deadlines", () => {
    const normalTask: ConstraintTask = {
      id: "norm",
      title: "Relax",
      estimatedMinutes: 30,
      priority: 2,
    }

    const urgentTask: ConstraintTask = {
      id: "urg",
      title: "Submit Tax Forms",
      estimatedMinutes: 30,
      priority: 2,
      dueAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), // 6 hours away
    }

    const normalScore = deterministicEngine.calculatePriorityScore(normalTask, 0)
    const urgentScore = deterministicEngine.calculatePriorityScore(urgentTask, 0)

    expect(urgentScore).toBeGreaterThan(normalScore)
  })
})
