import { useRootStore } from "../src/stores/useRootStore"
import { useFamilyStore } from "../src/stores/useFamilyStore"
import { useScheduleStore } from "../src/stores/useScheduleStore"
import { useKnowledgeStore } from "../src/stores/useKnowledgeStore"
import { useRoutineStore } from "../src/stores/useRoutineStore"
import { useIntentionsStore } from "../src/stores/useIntentionsStore"
import { useSpacesStore } from "../src/stores/useSpacesStore"
import { neevHeuristicEngine } from "../src/services/ai/neevHeuristicEngine"
import { neevAiOrchestrator } from "../src/services/ai/neevAiOrchestrator"
import { notificationsService } from "../src/services/notifications/notificationsService"

import { DEMO_MEMBERS, DEMO_HOUSEHOLD } from "../src/stores/slices/createFamilySlice"
import { DEMO_FUNCTIONS } from "../src/stores/slices/createScheduleSlice"
import { DEMO_INTENTIONS } from "../src/stores/slices/createIntentionsSlice"
import { DEMO_ENTRIES } from "../src/stores/slices/createKnowledgeSlice"
import { DEMO_ROUTINES } from "../src/stores/slices/createRoutineSlice"
import { DEMO_TASKS } from "../src/stores/slices/createSpacesSlice"

describe("Neev Family Operating System Stores & Intelligent Slices", () => {
  it("initializes fresh state cleanly without dummy data and can load demo fixtures on request", () => {
    const initialState = useFamilyStore.getState()
    // Fresh state must start completely clean for real accounts
    expect(initialState.household.name).toBe("")
    expect(initialState.members.length).toBe(0)

    // Load demo fixtures explicitly for subsequent store tests
    useRootStore.setState({
      household: DEMO_HOUSEHOLD,
      members: DEMO_MEMBERS,
      functions: DEMO_FUNCTIONS,
      intentions: DEMO_INTENTIONS,
      entries: DEMO_ENTRIES,
      routines: DEMO_ROUTINES,
      tasks: DEMO_TASKS,
    })

    const state = useFamilyStore.getState()
    expect(state.household.name).toBe("Chakraborty Family Sanctuary")
    expect(state.members.length).toBeGreaterThan(0)

    const elders = state.members.filter((m) => m.role === "elder")
    expect(elders.length).toBeGreaterThan(0)
    expect(elders[0].relationship).toBeDefined()

    const pets = state.members.filter((m) => m.role === "pet")
    expect(pets.length).toBeGreaterThan(0)
    expect(pets[0].name).toBe("Simba")
    expect(pets[0].superpower).toBeDefined()
  })

  it("can add a family member or pet to the sanctuary directory", () => {
    const store = useFamilyStore.getState()
    const initialCount = store.members.length

    store.addMember({
      name: "Milo",
      nickname: "Birbal",
      relationship: "Persian Kitten",
      role: "pet",
      avatarText: "🐱",
      avatarColor: "#8B6FC4",
      favoriteTreat: "Warm milk & salmon bites",
      superpower: "Purring people to sleep during afternoon reading",
    })

    const updated = useFamilyStore.getState()
    expect(updated.members.length).toBe(initialCount + 1)
    expect(updated.members.some((m) => m.name === "Milo")).toBe(true)
  })

  it("manages sacred spaces: Personal, Nuclear, and Family Sanctuary", () => {
    const spacesStore = useSpacesStore.getState()
    expect(spacesStore.currentSpace).toBeDefined()

    // Switch to Personal Space (Confidential)
    spacesStore.setSpace("personal")
    expect(useSpacesStore.getState().currentSpace).toBe("personal")

    // Add a confidential career milestone task
    const initialTaskCount = useSpacesStore.getState().tasks.length
    spacesStore.addTask({
      title: "Google Staff Software Engineer System Design Drill",
      space: "personal",
      category: "career",
      assignedTo: "Amit",
      dueDate: "2026-10-25",
      time: "08:00 PM",
      priority: "urgent",
    })

    const updatedTasks = useSpacesStore.getState().tasks
    expect(updatedTasks.length).toBe(initialTaskCount + 1)
    const personalTasks = updatedTasks.filter((t) => t.space === "personal")
    expect(personalTasks.some((t) => t.title.includes("Staff Software Engineer"))).toBe(true)

    // Switch to Nuclear Space
    spacesStore.setSpace("nuclear")
    expect(useSpacesStore.getState().currentSpace).toBe("nuclear")
  })

  it("schedules family functions and toggles preparation tasks", () => {
    const store = useScheduleStore.getState()
    expect(store.functions.length).toBeGreaterThan(0)

    const firstFunction = store.functions[0]
    expect(firstFunction.tasks.length).toBeGreaterThan(0)
    expect(firstFunction.invitationsCount).toBeGreaterThan(0)

    const firstTask = firstFunction.tasks[0]
    const initialStatus = firstTask.isDone

    store.toggleTask(firstFunction.id, firstTask.id)
    const updatedFunction = useScheduleStore.getState().functions.find((f) => f.id === firstFunction.id)
    const updatedTask = updatedFunction?.tasks.find((t) => t.id === firstTask.id)

    expect(updatedTask?.isDone).toBe(!initialStatus)
  })

  it("manages family intentions and pet projects with cheering", () => {
    const store = useIntentionsStore.getState()
    expect(store.intentions.length).toBeGreaterThan(0)

    const firstIntention = store.intentions[0]
    const initialCheers = firstIntention.cheerCount

    store.cheerIntention(firstIntention.id)
    const updated = useIntentionsStore.getState().intentions.find((i) => i.id === firstIntention.id)
    expect(updated?.cheerCount).toBe(initialCheers + 1)
  })

  it("adds and pins knowledge sanctuary entries", () => {
    const store = useKnowledgeStore.getState()
    expect(store.entries.length).toBeGreaterThan(0)

    const initialCount = store.entries.length
    store.addEntry({
      title: "Family Mango Chutney Tradition",
      category: "recipe",
      authorName: "Aparna Chakraborty",
      authorRole: "Grandmother (Dida)",
      excerpt: "Sun-dried raw mango relish prepared every summer with panch phoron.",
      body: "Slice raw green mangoes with mustard oil, fennel seeds, and jaggery. Dry on terracotta plates under the terrace sun.",
      tags: ["Summer", "Mango", "Traditional"],
      isPinned: false,
    })

    const updated = useKnowledgeStore.getState()
    expect(updated.entries.length).toBe(initialCount + 1)

    const added = updated.entries.find((e) => e.title === "Family Mango Chutney Tradition")
    expect(added).toBeDefined()

    if (added) {
      store.togglePin(added.id)
      const pinned = useKnowledgeStore.getState().entries.find((e) => e.id === added.id)
      expect(pinned?.isPinned).toBe(true)
    }
  })

  it("tracks and completes daily household rhythms", () => {
    const store = useRoutineStore.getState()
    expect(store.routines.length).toBeGreaterThan(0)

    const routine = store.routines[0]
    const initialCompleted = routine.isCompleted

    store.toggleRoutine(routine.id)
    const updated = useRoutineStore.getState().routines.find((r) => r.id === routine.id)
    expect(updated?.isCompleted).toBe(!initialCompleted)
  })

  it("verifies single unified RootStore instance across all slice stores", () => {
    const rootState = useRootStore.getState()
    const familyState = useFamilyStore.getState()
    const scheduleState = useScheduleStore.getState()
    const spacesState = useSpacesStore.getState()

    // All slices must point to the same state in useRootStore
    expect(familyState.household.name).toBe(rootState.household.name)
    expect(scheduleState.functions.length).toBe(rootState.functions.length)
    expect(spacesState.currentSpace).toBe(rootState.currentSpace)
  })

  it("computes deterministic preparation plans with 0 AI tokens", () => {
    const schoolPlan = neevHeuristicEngine.calculatePlan("school_prep", "08:10 AM", "nuclear")
    expect(schoolPlan.tokensConsumed).toBe(0)
    expect(schoolPlan.keyMilestones.length).toBeGreaterThanOrEqual(3)
    expect(schoolPlan.transitBufferMinutes).toBe(20)

    const interviewPlan = neevHeuristicEngine.calculatePlan("career_interview", "05:00 PM", "personal")
    expect(interviewPlan.tokensConsumed).toBe(0)
    expect(interviewPlan.space).toBe("personal")
    expect(interviewPlan.keyMilestones.some((m) => m.action.includes("Google Meet"))).toBe(true)
  })

  it("calculates family chore load balancing mathematically", () => {
    const tasks = useSpacesStore.getState().tasks
    const members = useFamilyStore.getState().members

    const loadBalances = neevHeuristicEngine.computeFamilyLoadBalance(tasks, members)
    expect(loadBalances.length).toBe(members.length)
    expect(loadBalances[0].loadLevel).toBeDefined()
    expect(["light", "balanced", "heavy"]).toContain(loadBalances[0].loadLevel)
  })

  it("activates life plan, synthesizes space tasks, and dispatches escalating nudges", async () => {
    const result = await neevAiOrchestrator.activatePlan("school_prep")
    expect(result.tasksCreated).toBeGreaterThan(0)
    expect(result.nudgesScheduled).toBeGreaterThan(0)
    expect(result.googleSynced).toBe(true)

    // Verify escalating nudges registered
    const activeNudges = notificationsService.getActiveNudges()
    expect(activeNudges.length).toBeGreaterThan(0)
    expect(activeNudges.some((n) => n.tier === 1)).toBe(true)
    expect(activeNudges.some((n) => n.tier === 3)).toBe(true)
  })
})
