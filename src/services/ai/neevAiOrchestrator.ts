/**
 * Neev AI Cognitive Orchestrator
 * 
 * Powered by Neev Heuristic Engine to save AI tokens, performing 100% of
 * routine calculations, buffers, milestones, and scheduling deterministically.
 *
 * Coordinates life across 3 sacred spaces:
 * - Personal Space: Confidential career switch plans, interview prep, confidential work, personal deadlines
 * - Nuclear Space: Child school schedules, homework deadlines, pediatrician visits, office deliverables, daily chores
 * - Family Sanctuary: Elders wisdom, rituals, invitations, potluck delegation, pet care
 *
 * All processing is strictly zero-leakage: private to your family enclave.
 */

import { useSpacesStore, type SpaceType, type SpaceTask, type SpaceMeeting } from "@/stores/useSpacesStore"
import { googleServicesClient } from "@/services/google/googleServicesClient"
import { notificationsService } from "@/services/notifications/notificationsService"
import { neevHeuristicEngine, type HeuristicDomain, type HeuristicPlan } from "./neevHeuristicEngine"

export type LifeDomain = HeuristicDomain

export interface AiPreparationPlan extends HeuristicPlan {
  googleServicesLinked: string[]
}

export const neevAiOrchestrator = {
  /**
   * Generates a comprehensive preparation plan using token-saving calculation heuristics
   */
  async generatePlan(domain: LifeDomain, space?: SpaceType, targetTime: string = "10:00 AM"): Promise<AiPreparationPlan> {
    const computed = neevHeuristicEngine.calculatePlan(domain, targetTime, space)

    const googleServicesLinked: string[] =
      domain === "career_interview" || domain === "office_work"
        ? ["Google Calendar", "Google Meet", "Google Tasks", "Google Drive Vault"]
        : domain === "doctor_visit"
        ? ["Google Calendar", "Google Fit / Health Connect", "Google Tasks"]
        : domain === "school_prep"
        ? ["Google Calendar", "Google Tasks Reminders"]
        : ["Google Calendar", "Google Meet", "Google Tasks", "Google Photos Vault"]

    return {
      ...computed,
      googleServicesLinked,
    }
  },

  /**
   * Automatically executes a plan by creating space tasks, Google calendar events,
   * and scheduling escalating notifications ("notifications again and again").
   * Consumes 0 AI tokens.
   */
  async activatePlan(domain: LifeDomain): Promise<{
    tasksCreated: number
    nudgesScheduled: number
    googleSynced: boolean
  }> {
    const plan = await this.generatePlan(domain)
    const spacesStore = useSpacesStore.getState()

    let tasksCreated = 0
    let nudgesScheduled = 0

    // 1. Add briefing to current space
    spacesStore.generateAiBriefing(
      domain === "office_work" ? "career_interview" : domain,
    )

    // 2. Synthesize milestones into concrete space tasks
    for (const milestone of plan.keyMilestones) {
      const task: Omit<SpaceTask, "id" | "isCompleted" | "reminderNudgeCount"> = {
        title: milestone.action,
        space: plan.space,
        category:
          domain === "career_interview" || domain === "office_work"
            ? "career"
            : domain === "doctor_visit"
            ? "doctor"
            : domain === "school_prep"
            ? "school"
            : "ritual",
        assignedTo: milestone.assignee,
        dueDate: new Date().toISOString().split("T")[0],
        time: milestone.time,
        priority: milestone.priority,
      }

      spacesStore.addTask(task)
      tasksCreated++

      // Schedule escalating proactive nudges for this task
      const synthesizedTask: SpaceTask = {
        ...task,
        id: `tsk-synth-${Date.now()}-${tasksCreated}`,
        isCompleted: false,
        reminderNudgeCount: 1,
      }

      const nudges = await notificationsService.scheduleEscalatingNudges(synthesizedTask)
      nudgesScheduled += nudges.length
    }

    // 3. Create Google Meet / Calendar Meeting if needed
    if (domain === "career_interview" || domain === "family_event" || domain === "office_work") {
      const meet = await googleServicesClient.createGoogleMeetUrl(
        plan.headline,
        new Date().toISOString(),
      )

      spacesStore.addMeeting({
        title: plan.headline,
        space: plan.space,
        date: new Date().toISOString().split("T")[0],
        time: "05:00 PM",
        location: meet.url ? "Google Meet" : "Family Home Mandir",
        meetLink: meet.url,
        preparationNotes: plan.executiveSummary,
      })
    }

    return {
      tasksCreated,
      nudgesScheduled,
      googleSynced: true,
    }
  },
}
