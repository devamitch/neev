-- ==============================================================================
-- Neev Family Operating System — Supabase Database Schema
-- Optimized according to Supabase Postgres Best Practices
-- ==============================================================================

-- 1. Households Table (Family Hub)
CREATE TABLE IF NOT EXISTS public.households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  motto TEXT DEFAULT '',
  city TEXT DEFAULT '',
  established_year INTEGER DEFAULT 2026,
  admin_user_id TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  members_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Family Members Table
CREATE TABLE IF NOT EXISTS public.family_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  relationship TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_text TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  phone TEXT,
  date_of_birth TEXT,
  favorite_treat TEXT,
  superpower TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Family Functions & Muhurats
CREATE TABLE IF NOT EXISTS public.family_functions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'gathering',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT,
  description TEXT,
  vibe TEXT,
  invitations_count INTEGER DEFAULT 0,
  rsvp_confirmed INTEGER DEFAULT 0,
  tasks JSONB DEFAULT '[]'::jsonb,
  reminder_set BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Family Intentions & Pet Projects
CREATE TABLE IF NOT EXISTS public.family_intentions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  champion_member_id TEXT,
  target_date TEXT,
  progress INTEGER DEFAULT 0,
  cheer_count INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Shared Knowledge Vault (Heirloom recipes, wisdom, traditions)
CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Daily Family Routines & Rhythms
CREATE TABLE IF NOT EXISTS public.family_routines (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  category TEXT NOT NULL,
  assigned_member TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Indexes for High Query Performance (rule: query-missing-indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_family_members_household_id ON public.family_members(household_id);
CREATE INDEX IF NOT EXISTS idx_family_functions_household_id ON public.family_functions(household_id, date);
CREATE INDEX IF NOT EXISTS idx_family_intentions_household_id ON public.family_intentions(household_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_household_id ON public.knowledge_entries(household_id);
CREATE INDEX IF NOT EXISTS idx_family_routines_household_id ON public.family_routines(household_id);

-- ==============================================================================
-- Row Level Security (RLS) Configuration (rule: security-rls)
-- ==============================================================================
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_routines ENABLE ROW LEVEL SECURITY;

-- Allow access to households for authenticated and anon users
DROP POLICY IF EXISTS "Public access to households" ON public.households;
CREATE POLICY "Public access to households" ON public.households
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to members
DROP POLICY IF EXISTS "Public access to family_members" ON public.family_members;
CREATE POLICY "Public access to family_members" ON public.family_members
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to functions
DROP POLICY IF EXISTS "Public access to family_functions" ON public.family_functions;
CREATE POLICY "Public access to family_functions" ON public.family_functions
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to intentions
DROP POLICY IF EXISTS "Public access to family_intentions" ON public.family_intentions;
CREATE POLICY "Public access to family_intentions" ON public.family_intentions
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to knowledge
DROP POLICY IF EXISTS "Public access to knowledge_entries" ON public.knowledge_entries;
CREATE POLICY "Public access to knowledge_entries" ON public.knowledge_entries
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to routines
DROP POLICY IF EXISTS "Public access to family_routines" ON public.family_routines;
CREATE POLICY "Public access to family_routines" ON public.family_routines
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);
