import { useFamilyStore } from "../src/stores/useFamilyStore"
import { useScheduleStore } from "../src/stores/useScheduleStore"
import { useKnowledgeStore } from "../src/stores/useKnowledgeStore"
import { useRoutineStore } from "../src/stores/useRoutineStore"

describe("Neev Family Operating System Stores", () => {
  it("initializes family household and multigenerational members", () => {
    const state = useFamilyStore.getState()
    expect(state.household.name).toBe("Chakraborty Family Sanctuary")
    expect(state.members.length).toBeGreaterThan(0)

    const elders = state.members.filter((m) => m.role === "elder")
    expect(elders.length).toBeGreaterThan(0)
    expect(elders[0].relationship).toBeDefined()
  })

  it("can add a family member to the sanctuary directory", () => {
    const store = useFamilyStore.getState()
    const initialCount = store.members.length

    store.addMember({
      name: "Radha Sharma",
      relationship: "Cousin",
      role: "youth",
      avatarText: "RS",
      avatarColor: "#5A7A64",
      bloodGroup: "O+",
    })

    const updated = useFamilyStore.getState()
    expect(updated.members.length).toBe(initialCount + 1)
    expect(updated.members.some((m) => m.name === "Radha Sharma")).toBe(true)
  })

  it("schedules family functions and toggles preparation tasks", () => {
    const store = useScheduleStore.getState()
    expect(store.functions.length).toBeGreaterThan(0)

    const firstFunction = store.functions[0]
    expect(firstFunction.tasks.length).toBeGreaterThan(0)

    const firstTask = firstFunction.tasks[0]
    const initialStatus = firstTask.isDone

    store.toggleTask(firstFunction.id, firstTask.id)
    const updatedFunction = useScheduleStore.getState().functions.find((f) => f.id === firstFunction.id)
    const updatedTask = updatedFunction?.tasks.find((t) => t.id === firstTask.id)

    expect(updatedTask?.isDone).toBe(!initialStatus)
  })

  it("adds and pins knowledge sanctuary entries", () => {
    const store = useKnowledgeStore.getState()
    expect(store.entries.length).toBeGreaterThan(0)

    const initialCount = store.entries.length
    store.addEntry({
      title: "Family Ayurvedic Kadha",
      category: "recipe",
      authorName: "Aparna Chakraborty",
      authorRole: "Grandmother (Dida)",
      excerpt: "Boil ginger, tulsi, black pepper, and clove with jaggery.",
      body: "Full preparation steps for monsoon and seasonal wellness.",
      tags: ["immunity", "winter", "herbal"],
      isPinned: false,
    })

    const updated = useKnowledgeStore.getState()
    expect(updated.entries.length).toBe(initialCount + 1)

    const added = updated.entries.find((e) => e.title === "Family Ayurvedic Kadha")
    expect(added).toBeDefined()

    if (added) {
      store.togglePin(added.id)
      const pinned = useKnowledgeStore.getState().entries.find((e) => e.id === added.id)
      expect(pinned?.isPinned).toBe(true)
    }
  })

  it("tracks and completes daily household routines", () => {
    const store = useRoutineStore.getState()
    expect(store.routines.length).toBeGreaterThan(0)

    const routine = store.routines[0]
    const initialCompleted = routine.isCompleted

    store.toggleRoutine(routine.id)
    const updated = useRoutineStore.getState().routines.find((r) => r.id === routine.id)
    expect(updated?.isCompleted).toBe(!initialCompleted)
  })
})
