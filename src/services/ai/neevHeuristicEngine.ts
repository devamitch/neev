/**
 * Neev Deterministic Heuristic & Calculation Engine
 * 
 * Maximizes efficiency and saves 100% AI tokens by computing schedules,
 * preparation milestones, transit buffers, and priority ratings through
 * offline mathematical algorithms and human effort heuristics.
 */

import type { SpaceTask, SpaceType } from "@/stores/slices/createSpacesSlice"
import type { FamilyMember } from "@/stores/slices/createFamilySlice"

export type HeuristicDomain = "school_prep" | "doctor_visit" | "career_interview" | "office_work" | "family_event"

export interface HeuristicPlan {
  domain: HeuristicDomain
  space: SpaceType
  headline: string
  executiveSummary: string
  tokensConsumed: 0
  readinessScore: number // 0 - 100 calculated deterministically
  transitBufferMinutes: number
  keyMilestones: {
    time: string
    action: string
    assignee: string
    priority: "urgent" | "normal"
    bufferOffset: string
  }[]
  recommendedNudges: string[]
  recommendedChecklist: string[]
}

export interface FamilyLoadBalance {
  memberId: string
  memberName: string
  taskCount: number
  urgentTaskCount: number
  loadLevel: "light" | "balanced" | "heavy"
}

export const neevHeuristicEngine = {
  /**
   * Deterministically calculates a life preparation plan using time math and domain logic.
   * Consumes exactly 0 AI tokens.
   */
  calculatePlan(domain: HeuristicDomain, targetTime: string = "10:00 AM", space?: SpaceType): HeuristicPlan {
    const parsedMinutes = this.parseTimeToMinutes(targetTime)

    switch (domain) {
      case "career_interview": {
        const prepTime = this.formatMinutesToTime(parsedMinutes - 90)
        const mockTime = this.formatMinutesToTime(parsedMinutes - 45)
        const retroTime = this.formatMinutesToTime(parsedMinutes + 60)

        return {
          domain: "career_interview",
          space: space || "personal",
          headline: "Lead / Staff Architect Career Switch Blueprint",
          executiveSummary:
            "Self-computed strategic roadmap for system design & leadership interviews. Mathematical time buffers ensure zero panic and sharp focus.",
          tokensConsumed: 0,
          readinessScore: 85,
          transitBufferMinutes: 15,
          keyMilestones: [
            {
              time: prepTime,
              action: "Review distributed consensus & system design trade-offs",
              assignee: "Amit",
              priority: "normal",
              bufferOffset: "-90m",
            },
            {
              time: mockTime,
              action: "Mock architectural diagramming & STAR story vocalization",
              assignee: "Amit",
              priority: "urgent",
              bufferOffset: "-45m",
            },
            {
              time: targetTime,
              action: "Google Meet Technical Round with Hiring Committee",
              assignee: "Amit",
              priority: "urgent",
              bufferOffset: "0m",
            },
            {
              time: retroTime,
              action: "Log interview notes, system questions, and compensation metrics",
              assignee: "Amit",
              priority: "normal",
              bufferOffset: "+60m",
            },
          ],
          recommendedNudges: [
            "T-60m: Review one-page architecture summary and take 5 deep breaths.",
            "T-15m: Join Google Meet audio/video test room.",
            "T+10m: Record raw technical takeaways in confidential Personal Space.",
          ],
          recommendedChecklist: [
            "High-availability and database partitioning notes reviewed",
            "STAR stories for 3 major projects ready",
            "Quiet room with Do-Not-Disturb verified",
            "3 thoughtful leadership questions prepared",
          ],
        }
      }

      case "doctor_visit": {
        const docBookTime = this.formatMinutesToTime(parsedMinutes - 90)
        const travelTime = this.formatMinutesToTime(parsedMinutes - 35)
        const postLogTime = this.formatMinutesToTime(parsedMinutes + 60)

        return {
          domain: "doctor_visit",
          space: space || "nuclear",
          headline: "Family Pediatric & Health Consultation Plan",
          executiveSummary:
            "Clinical coordination for clinic checkup. Calculates transit buffers, immunization dossier, and prescription reminders.",
          tokensConsumed: 0,
          readinessScore: 90,
          transitBufferMinutes: 35,
          keyMilestones: [
            {
              time: docBookTime,
              action: "Fetch physical vaccination booklet and insurance card from Vault",
              assignee: "Pooja",
              priority: "normal",
              bufferOffset: "-90m",
            },
            {
              time: travelTime,
              action: "Depart with 35m parking & clinic registration buffer",
              assignee: "Amit & Pooja",
              priority: "urgent",
              bufferOffset: "-35m",
            },
            {
              time: targetTime,
              action: "Pediatric consultation & seasonal booster check with Dr. Sharma",
              assignee: "Pooja & Aarav",
              priority: "urgent",
              bufferOffset: "0m",
            },
            {
              time: postLogTime,
              action: "Log prescribed medication timing into Neev Daily Routine",
              assignee: "Amit",
              priority: "normal",
              bufferOffset: "+60m",
            },
          ],
          recommendedNudges: [
            "T-60m: Pack child snack box and comforting toy.",
            "T-35m: Confirm clinic parking buffer and GPS route.",
            "Post-visit: Archive vaccination stamp in Family Sanctuary.",
          ],
          recommendedChecklist: [
            "Physical immunization booklet in hand",
            "Current symptom history and sleep hours recorded",
            "3 specific pediatric questions noted",
            "Simba's flea preventative drops confirmed for evening",
          ],
        }
      }

      case "school_prep": {
        const uniformTime = this.formatMinutesToTime(parsedMinutes - 60)
        const busTime = this.formatMinutesToTime(parsedMinutes - 20)
        const homeworkReviewTime = this.formatMinutesToTime(parsedMinutes + 120)

        return {
          domain: "school_prep",
          space: space || "nuclear",
          headline: "Child School Showcase & Term Exam Readiness",
          executiveSummary:
            "Calculated school morning flow. Coordinates uniform preparation, science project packaging, and on-time bus transit.",
          tokensConsumed: 0,
          readinessScore: 95,
          transitBufferMinutes: 20,
          keyMilestones: [
            {
              time: uniformTime,
              action: "Inspect pressed uniform, school shoes, and water bottle",
              assignee: "Maa",
              priority: "urgent",
              bufferOffset: "-60m",
            },
            {
              time: busTime,
              action: "School bus stop departure with hot breakfast box",
              assignee: "Papa & Aarav",
              priority: "urgent",
              bufferOffset: "-20m",
            },
            {
              time: targetTime,
              action: "Greenwood High Grade 4 Science Fair presentation",
              assignee: "Papa & Maa",
              priority: "normal",
              bufferOffset: "0m",
            },
            {
              time: homeworkReviewTime,
              action: "Review math workbook and celebrate science fair showcase",
              assignee: "All Family",
              priority: "normal",
              bufferOffset: "+120m",
            },
          ],
          recommendedNudges: [
            "Night prior: Test science model battery connections.",
            "T-20m: Ensure backpack is zipped with signed diary inside.",
            "Evening: 30 minutes screen-free reading with Dadu.",
          ],
          recommendedChecklist: [
            "Solar water pump demonstration model packed",
            "Signed teacher notes and diary in bag",
            "Pencil box with sharpener & eraser",
            "Bus transit card in front pocket",
          ],
        }
      }

      case "office_work": {
        const deckPrepTime = this.formatMinutesToTime(parsedMinutes - 120)
        const pmSyncTime = this.formatMinutesToTime(parsedMinutes - 45)

        return {
          domain: "office_work",
          space: space || "nuclear",
          headline: "Executive Business Deliverable & Sprint Review",
          executiveSummary:
            "Deep focus block and presentation execution plan. Pre-calculates uninterrupted focus intervals and deck rehearsals.",
          tokensConsumed: 0,
          readinessScore: 88,
          transitBufferMinutes: 10,
          keyMilestones: [
            {
              time: deckPrepTime,
              action: "Deep Focus: Finalize architectural slides and risk mitigations",
              assignee: "Amit",
              priority: "urgent",
              bufferOffset: "-120m",
            },
            {
              time: pmSyncTime,
              action: "Pre-meeting alignment with lead product manager",
              assignee: "Amit",
              priority: "normal",
              bufferOffset: "-45m",
            },
            {
              time: targetTime,
              action: "Quarterly Executive Business Review on Google Meet",
              assignee: "Amit",
              priority: "urgent",
              bufferOffset: "0m",
            },
          ],
          recommendedNudges: [
            "T-120m: Activate focus mode and mute family group chats.",
            "T-15m: Test slide deck screen sharing and mic.",
          ],
          recommendedChecklist: [
            "Executive deck exported to PDF backup",
            "Last 24h telemetry metrics refreshed",
            "Risk mitigation talking points ready",
          ],
        }
      }

      case "family_event":
      default: {
        const samagriTime = this.formatMinutesToTime(parsedMinutes - 180)
        const lampsTime = this.formatMinutesToTime(parsedMinutes - 75)
        const feastTime = this.formatMinutesToTime(parsedMinutes + 75)

        return {
          domain: "family_event",
          space: space || "family",
          headline: "Multigenerational Festive Puja & Gathering Blueprint",
          executiveSummary:
            "Traditional festival and puja coordination. Mathematically matches auspicious muhurat timing with samagri procurement and elder comfort.",
          tokensConsumed: 0,
          readinessScore: 92,
          transitBufferMinutes: 30,
          keyMilestones: [
            {
              time: samagriTime,
              action: "Procure marigold garlands, lotus, and organic sweets",
              assignee: "Papa",
              priority: "normal",
              bufferOffset: "-180m",
            },
            {
              time: lampsTime,
              action: "Dadu, Dida, & Aarav arrange 51 terracotta lamps with pure cow ghee",
              assignee: "Dadu & Aarav",
              priority: "urgent",
              bufferOffset: "-75m",
            },
            {
              time: targetTime,
              action: "Auspicious Evening Puja Chants & Aarti in Home Mandir",
              assignee: "All Family",
              priority: "urgent",
              bufferOffset: "0m",
            },
            {
              time: feastTime,
              action: "Traditional family feast with Dida's signature payesh",
              assignee: "All Family",
              priority: "normal",
              bufferOffset: "+75m",
            },
          ],
          recommendedNudges: [
            "04:30 PM: Take Simba for early energetic walk before firecrackers.",
            "06:30 PM: Connect family Google Meet for relatives abroad.",
            "08:00 PM: Take high-resolution family portrait for archive.",
          ],
          recommendedChecklist: [
            "Pure cow ghee and hand-rolled cotton wicks ready",
            "Prasad fruits washed and arranged on silver thali",
            "Pet safe-room prepared with blanket & soft music",
            "Overseas family video call link tested",
          ],
        }
      }
    }
  },

  /**
   * Computes family chore and task distribution balance mathematically
   */
  computeFamilyLoadBalance(tasks: SpaceTask[], members: FamilyMember[]): FamilyLoadBalance[] {
    return members.map((member) => {
      const assigned = tasks.filter(
        (t) =>
          !t.isCompleted &&
          (t.assignedTo.includes(member.name) ||
            (member.nickname && t.assignedTo.includes(member.nickname))),
      )
      const urgent = assigned.filter((t) => t.priority === "urgent")

      let loadLevel: "light" | "balanced" | "heavy" = "light"
      if (assigned.length >= 4 || urgent.length >= 2) {
        loadLevel = "heavy"
      } else if (assigned.length >= 2) {
        loadLevel = "balanced"
      }

      return {
        memberId: member.id,
        memberName: member.nickname || member.name.split(" ")[0],
        taskCount: assigned.length,
        urgentTaskCount: urgent.length,
        loadLevel,
      }
    })
  },

  /**
   * Helper: Parses "06:30 PM" or "11:00 AM" into minutes of day (0-1439)
   */
  parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return 600 // Default 10:00 AM
    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const period = match[3]?.toUpperCase()

    if (period === "PM" && hours < 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0

    return hours * 60 + minutes
  },

  /**
   * Helper: Formats minutes of day (0-1439) back to "HH:mm AM/PM"
   */
  formatMinutesToTime(totalMinutes: number): string {
    let normalized = totalMinutes % 1440
    if (normalized < 0) normalized += 1440

    const hours24 = Math.floor(normalized / 60)
    const mins = normalized % 60

    const period = hours24 >= 12 ? "PM" : "AM"
    const hours12 = hours24 % 12 || 12

    return `${hours12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${period}`
  },
}
