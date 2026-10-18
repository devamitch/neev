import { create } from "zustand"

export type KnowledgeCategory = "wisdom" | "recipe" | "health" | "tradition" | "records"

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
}

interface KnowledgeState {
  entries: KnowledgeEntry[]
  selectedCategory: KnowledgeCategory | "all"
  addEntry: (entry: Omit<KnowledgeEntry, "id" | "createdAt">) => void
  removeEntry: (id: string) => void
  togglePin: (id: string) => void
  setCategory: (cat: KnowledgeCategory | "all") => void
}

const INITIAL_ENTRIES: KnowledgeEntry[] = [
  {
    id: "k-1",
    title: "Dida's Golden Turmeric-Ginger Kashayam",
    category: "recipe",
    authorName: "Aparna Chakraborty",
    authorRole: "Grandmother (Dida)",
    excerpt: "Ancient home brew for seasonal cough, chest congestion, and immunity building.",
    body: "Crush fresh ginger (2 inches) with 1 tsp whole black peppercorns, 4 tulsi leaves, and 1 tsp raw wild turmeric. Simmer in 2 cups of pure spring water until reduced by half. Stir in a teaspoon of wild forest honey after taking off heat. Give half cup warm before bed.",
    tags: ["Immunity", "Ayurveda", "Cold Remedy", "Winter"],
    isPinned: true,
    createdAt: "2026-10-12",
  },
  {
    id: "k-2",
    title: "On Family Harmony During Difficult Decisions",
    category: "wisdom",
    authorName: "Shyamal Chakraborty",
    authorRole: "Grandfather (Dadu)",
    excerpt: "Words written after our 1992 home relocation on preserving peace among brothers.",
    body: "When money or property creates silence in a room, let the elders speak last and listen first. A home made of bricks can be rebuilt in six months; the trust nurtured between brothers takes thirty years to grow. Never go to sleep without clearing an unspoken grievance.",
    tags: ["Elder Wisdom", "Family Values", "Peace", "Ancestry"],
    isPinned: true,
    createdAt: "2026-10-14",
  },
  {
    id: "k-3",
    title: "Family Emergency Lifeline & Blood Donors Network",
    category: "health",
    authorName: "Amit Chakraborty",
    authorRole: "Father (Papa)",
    excerpt: "Critical contacts, blood groups, insurance policy numbers, and primary care doctors.",
    body: "• Family Doctor: Dr. S. K. Mukherjee (+91 98311 00000)\n• Dadu's Cardiologist: Dr. N. Sengupta, Fortis Hospital\n• Health Insurance Policy: Star Health Family Card #SH-88492019\n• Trusted local chemist (24/7): Apollo Pharmacy Indiranagar",
    tags: ["Emergency", "Doctor", "Insurance", "Lifeline"],
    isPinned: true,
    createdAt: "2026-10-15",
  },
  {
    id: "k-4",
    title: "Shubh Muhurat Rules for Home Mandir Deepam",
    category: "tradition",
    authorName: "Aparna Chakraborty",
    authorRole: "Grandmother (Dida)",
    excerpt: "Proper morning and dusk oil lamp lighting traditions passed from our ancestral village.",
    body: "Always wipe the brass diya with dry cloth and lemon before dusk. Face the wick towards east for health, or north for prosperity. Never blow out the sacred flame directly with breath; use a gentle wave of a betel leaf or hand.",
    tags: ["Rituals", "Mandir", "Traditions", "Diyas"],
    isPinned: false,
    createdAt: "2026-10-16",
  },
  {
    id: "k-5",
    title: "Authentic Chhanar Payesh Recipe",
    category: "recipe",
    authorName: "Aparna Chakraborty",
    authorRole: "Grandmother (Dida)",
    excerpt: "Delicate Bengali cottage cheese dessert prepared on birthdays and auspicious gatherings.",
    body: "Use full cream milk boiled slowly on cast iron kadai until thickened to rabri consistency. Freshly kneaded soft chenna with cardamom powder and saffron strands soaked in warm milk. Do not boil chenna; drop small pearls into hot simmering milk and rest.",
    tags: ["Celebration", "Sweet", "Dessert", "Heritage"],
    isPinned: false,
    createdAt: "2026-10-18",
  },
]

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  entries: INITIAL_ENTRIES,
  selectedCategory: "all",
  addEntry: (entry) =>
    set((state) => ({
      entries: [
        {
          ...entry,
          id: `k-${Date.now()}`,
          createdAt: new Date().toISOString().split("T")[0],
        },
        ...state.entries,
      ],
    })),
  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),
  togglePin: (id) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, isPinned: !e.isPinned } : e)),
    })),
  setCategory: (cat) => set({ selectedCategory: cat }),
}))
