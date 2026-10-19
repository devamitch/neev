-- ==============================================================================
-- Neev Family Network & Privacy Graph Addendum
-- Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Sections 45-62)
-- "Family Is a Privacy Graph, Not a Group Chat"
-- ==============================================================================

-- 1. Family Realms (Independent Privacy Enclaves)
CREATE TABLE IF NOT EXISTS public.family_realms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  motto TEXT DEFAULT '',
  established_year INTEGER DEFAULT 1950,
  city TEXT DEFAULT '',
  owner_id TEXT,
  is_primary BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Kinship Edges (Typed Relationship Graph between family members)
CREATE TABLE IF NOT EXISTS public.kinship_edges (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL REFERENCES public.family_realms(id) ON DELETE CASCADE,
  source_member_id TEXT NOT NULL,
  target_member_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild', 'guardian', 'in_law', 'relative')),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Family Clusters (Overlapping Collaborative Subgroups)
CREATE TABLE IF NOT EXISTS public.clusters (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL REFERENCES public.family_realms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cluster_type TEXT NOT NULL CHECK (cluster_type IN ('nuclear', 'care_circle', 'puja_tradition', 'siblings', 'extended', 'in_laws_bridge', 'custom')),
  description TEXT,
  member_ids TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Family Bridges (Bilateral Consented Cross-Realm Bridges)
CREATE TABLE IF NOT EXISTS public.family_bridges (
  id TEXT PRIMARY KEY,
  from_realm_id TEXT NOT NULL REFERENCES public.family_realms(id) ON DELETE CASCADE,
  target_realm_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  shared_categories TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'paused')),
  connected_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Family Invitations (Secure Non-Spam Token-Based Invites)
CREATE TABLE IF NOT EXISTS public.invitations (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL REFERENCES public.family_realms(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  target_member_name TEXT NOT NULL,
  cluster_name TEXT,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Resource Sharing Grants (Granular Scoped Grants)
CREATE TABLE IF NOT EXISTS public.resource_sharing_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  grant_scope TEXT NOT NULL CHECK (grant_scope IN ('only_me', 'selected_people', 'selected_cluster', 'selected_family', 'realm')),
  permitted_actions TEXT[] DEFAULT '{read}',
  granted_by TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Fast Graph Traversal
CREATE INDEX IF NOT EXISTS idx_kinship_edges_realm ON public.kinship_edges(realm_id);
CREATE INDEX IF NOT EXISTS idx_kinship_edges_source ON public.kinship_edges(source_member_id);
CREATE INDEX IF NOT EXISTS idx_kinship_edges_target ON public.kinship_edges(target_member_id);
CREATE INDEX IF NOT EXISTS idx_clusters_realm ON public.clusters(realm_id);
CREATE INDEX IF NOT EXISTS idx_bridges_from_realm ON public.family_bridges(from_realm_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(invite_code);

-- Enable RLS
ALTER TABLE public.family_realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kinship_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_sharing_grants ENABLE ROW LEVEL SECURITY;

-- Allow policies for authenticated & anon clients
DROP POLICY IF EXISTS "Public access to family_realms" ON public.family_realms;
CREATE POLICY "Public access to family_realms" ON public.family_realms FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access to kinship_edges" ON public.kinship_edges;
CREATE POLICY "Public access to kinship_edges" ON public.kinship_edges FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access to clusters" ON public.clusters;
CREATE POLICY "Public access to clusters" ON public.clusters FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access to family_bridges" ON public.family_bridges;
CREATE POLICY "Public access to family_bridges" ON public.family_bridges FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access to invitations" ON public.invitations;
CREATE POLICY "Public access to invitations" ON public.invitations FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access to resource_sharing_grants" ON public.resource_sharing_grants;
CREATE POLICY "Public access to resource_sharing_grants" ON public.resource_sharing_grants FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

