import type { ImmerStateCreator } from "../types"

export type KnowledgeCategory = "wisdom" | "recipe" | "story" | "tradition" | "project"

export interface KnowledgeEntry {
  id: string
  title: string
  category: KnowledgeCategory
  authorName: string
  authorRole: string
  excerpt: string
  body: string
  tags: string[]
  isPinned: boolean
  createdAt: string
  photoUri?: string
  photoFrame?: "ivory" | "pista" | "terracotta" | "vintage"
}

export interface KnowledgeSlice {
  entries: KnowledgeEntry[]
  selectedCategory: KnowledgeCategory | "all"
  addEntry: (entry: Omit<KnowledgeEntry, "id" | "createdAt">) => void
  removeEntry: (id: string) => void
  togglePin: (id: string) => void
  setCategory: (cat: KnowledgeCategory | "all") => void
  resetKnowledgeToClean: () => void
}

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_ENTRIES: KnowledgeEntry[] = [
  {
    id: "k-1",
    title: "Dida's Authentic Chhanar Payesh",
    category: "recipe",
    authorName: "Aparna Chakraborty",
    authorRole: "Grandmother (Dida)",
    excerpt: "Delicate Bengali cottage cheese dessert prepared on birthdays and auspicious gatherings.",
    body: "Use full cream milk boiled slowly on a heavy cast iron kadai until thickened to a fragrant rabri consistency. Freshly knead soft chenna with cardamom powder and saffron strands soaked in warm milk. Do not boil chenna; drop small hand-shaped pearls into hot simmering milk and let it rest for two hours before serving chilled.",
    tags: ["Celebration", "Sweet", "Dessert", "Heritage"],
    isPinned: true,
    createdAt: "2026-10-12",
  },
  {
    id: "k-2",
    title: "On Family Harmony & Gentle Listening",
    category: "wisdom",
    authorName: "Shyamal Chakraborty",
    authorRole: "Grandfather (Dadu)",
    excerpt: "Words written after our 1992 home relocation on preserving peace and laughter among family.",
    body: "When misunderstandings or differing opinions create silence in a room, let the elders speak last and listen first. A house made of bricks can be repaired in a week; the trust and warmth nurtured among generations takes thirty years to blossom. Never go to sleep without clearing an unspoken worry or giving a gentle hug.",
    tags: ["Elder Wisdom", "Family Values", "Peace", "Ancestry"],
    isPinned: true,
    createdAt: "2026-10-14",
  },
  {
    id: "k-3",
    title: "How Dadu & Dida First Met in Shantiniketan (1968)",
    category: "story",
    authorName: "Shyamal Chakraborty",
    authorRole: "Grandfather (Dadu)",
    excerpt: "A bicycle puncture near the kopai river, handwritten Tagore poems, and a 56-year bond.",
    body: "It was autumn during the Poush Mela of 1968. Dadu was riding a borrowed Atlas bicycle which got punctured near the Kopai river embankment. Dida was carrying sketches from Kala Bhavana with her friends. Dadu offered his umbrella during a sudden cloudburst, and in return Dida shared freshly fried telebhaja. We wrote 42 letters over the next two years before our wedding.",
    tags: ["LoveStory", "Ancestry", "Folklore", "Shantiniketan"],
    isPinned: true,
    createdAt: "2026-10-15",
  },
  {
    id: "k-4",
    title: "Shubh Muhurat Rules for Home Mandir Deepam",
    category: "tradition",
    authorName: "Aparna Chakraborty",
    authorRole: "Grandmother (Dida)",
    excerpt: "Proper morning and dusk oil lamp lighting traditions passed down from our ancestral village.",
    body: "Always wipe the brass diya with dry cloth and lemon before dusk. Face the wick towards east for happiness and harmony, or north for prosperity. Never blow out the sacred flame directly with breath; use a gentle wave of a betel leaf or hand to invite tranquility into every corner of the house.",
    tags: ["Rituals", "Mandir", "Traditions", "Diyas"],
    isPinned: false,
    createdAt: "2026-10-16",
  },
  {
    id: "k-5",
    title: "Simba's Healthy Peanut Butter & Oat Drops",
    category: "recipe",
    authorName: "Pooja Chakraborty",
    authorRole: "Mother (Maa)",
    excerpt: "Crunchy homemade oven treats for our beloved pup Simba without artificial preservatives.",
    body: "Mix 2 cups rolled oats, 1/2 cup natural unsalted peanut butter (xylitol-free), 1 ripe mashed banana, and 2 tablespoons of flaxseed powder. Form into small round biscuits using a fork for texture. Bake at 175°C for 18 minutes until golden and crisp. Simba's tail will wag non-stop!",
    tags: ["Simba", "PetTreats", "Homemade", "HealthyPup"],
    isPinned: false,
    createdAt: "2026-10-18",
  },
]


export const createKnowledgeSlice: ImmerStateCreator<KnowledgeSlice> = (set) => ({
  entries: [],
  selectedCategory: "all",

  addEntry: (entry) =>
    set((state) => {
      state.entries.unshift({
        ...entry,
        id: `k-${Date.now()}`,
        createdAt: new Date().toISOString().split("T")[0],
      })
    }),

  removeEntry: (id) =>
    set((state) => {
      state.entries = state.entries.filter((e) => e.id !== id)
    }),

  togglePin: (id) =>
    set((state) => {
      const entry = state.entries.find((e) => e.id === id)
      if (entry) {
        entry.isPinned = !entry.isPinned
      }
    }),

  setCategory: (cat) =>
    set((state) => {
      state.selectedCategory = cat
    }),

  resetKnowledgeToClean: () =>
    set((state) => {
      state.entries = []
    }),
})
