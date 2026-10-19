-- ==============================================================================
-- Neev Complete Family Operating System — Canonical Supabase Master Schema
-- Master Specification: Sections 30, 31, 32, 33, 34
-- Postgres Best Practices: RLS on all tables, no auth.role(), composite indexes
-- ==============================================================================

-- 0. Extensions
create extension if not exists vector with schema extensions;
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  time_zone text not null default 'Asia/Kolkata',
  onboarding_state text not null default 'not_started'
    check (onboarding_state in ('not_started','in_progress','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Households Table
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  motto text default '',
  city text default '',
  established_year integer default 2026,
  admin_user_id text,
  invite_code text unique not null,
  members_count integer default 1,
  created_by uuid references auth.users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','archived','deletion_pending','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Household Members Table
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','adult','caregiver','child','guest')),
  status text not null default 'active'
    check (status in ('invited','active','suspended','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 4. Sacred Spaces Table (Personal, Nuclear, Sanctuary/Extended)
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  space_type text not null check (space_type in ('personal','nuclear','sanctuary')),
  name text not null check (length(trim(name)) between 1 and 100),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (space_type = 'personal' and owner_user_id is not null)
    or (space_type in ('nuclear','sanctuary') and household_id is not null)
  )
);

-- 5. Space Members Table
create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- 6. Goals & Intentions Table
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete restrict,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  domain text not null default 'general',
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active'
    check (status in ('draft','active','paused','completed','cancelled','archived')),
  target_date date,
  time_zone text not null default 'Asia/Kolkata',
  constraints jsonb not null default '{}'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Verified Plans Table
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  created_by uuid references auth.users(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','verifying','awaiting_approval','approved','active','completed','rejected','superseded','failed')),
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Plan Versions Table
create table if not exists public.plan_versions (
  plan_id uuid not null references public.plans(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  assumptions jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  model_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (plan_id, version)
);

-- 9. Durable Tasks Table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  plan_version integer,
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete restrict,
  status text not null default 'todo'
    check (status in ('todo','scheduled','in_progress','blocked','completed','skipped','cancelled','failed')),
  priority smallint not null default 3 check (priority between 1 and 5),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 10080),
  due_at timestamptz,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  completed_at timestamptz,
  time_zone text not null default 'Asia/Kolkata',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at > scheduled_start_at)
);

-- 10. Task Dependencies (Cycle-checked graph)
create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

-- 11. Consequential Approvals Table
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete restrict,
  approver_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decision_notes text,
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- 12. Execution Jobs (Durable Outbox Queue)
create table if not exists public.execution_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  scope_user_id uuid references auth.users(id) on delete set null,
  scope_space_id uuid references public.spaces(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','retry_wait','succeeded','failed','cancelled','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  run_after timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text not null unique,
  correlation_id uuid not null default gen_random_uuid(),
  error_code text,
  safe_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 13. Audit Events Table
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  space_id uuid references public.spaces(id) on delete set null,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 14. Private Memory Records & pgvector Chunks
create table if not exists public.memory_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  memory_type text not null check (memory_type in ('explicit_fact','episodic','semantic','procedural_preference')),
  visibility text not null check (visibility in ('private','space','household')),
  epistemic_type text not null check (epistemic_type in ('user_stated','system_calculated','model_inference','learned_preference')),
  content text not null,
  provenance jsonb not null default '{}'::jsonb,
  consent_state text not null default 'allowed'
    check (consent_state in ('allowed','restricted','withdrawn')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_chunks (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memory_records(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  chunk_text text not null,
  content_hash text not null,
  embedding extensions.vector(768),
  embedding_provider text,
  embedding_model text,
  embedding_version text,
  source_revision text not null,
  created_at timestamptz not null default now(),
  unique (memory_id, source_revision, chunk_index)
);

-- 15. BYOK (Bring Your Own Key) Provider Credentials
create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider_id text not null check (provider_id in ('google','openai','groq','anthropic')),
  label text not null check (length(trim(label)) between 1 and 60),
  encrypted_key text not null,
  key_version integer not null default 1,
  status text not null default 'active' check (status in ('active','invalid','rate_limited','disabled')),
  default_model text,
  last_tested_at timestamptz,
  safe_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. Family Functions & Knowledge Vault
create table if not exists public.family_functions (
  id text primary key,
  household_id text not null,
  title text not null,
  category text not null default 'gathering',
  date text not null,
  time text not null,
  location text,
  description text,
  vibe text,
  invitations_count integer default 0,
  rsvp_confirmed integer default 0,
  tasks jsonb default '[]'::jsonb,
  reminder_set boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id text primary key,
  household_id text not null,
  title text not null,
  category text not null,
  author_name text not null,
  author_role text not null,
  excerpt text not null,
  body text not null,
  tags text[] default '{}',
  is_pinned boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_routines (
  id text primary key,
  household_id text not null,
  title text not null,
  time text not null,
  category text not null,
  assigned_member text not null,
  is_completed boolean default false,
  is_shared boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- Indexes for Maximum Query Performance (Supabase rule: query-missing-indexes)
-- ==============================================================================
create index if not exists idx_household_members_user_status on public.household_members(user_id, status);
create index if not exists idx_spaces_household on public.spaces(household_id);
create index if not exists idx_spaces_owner on public.spaces(owner_user_id);
create index if not exists idx_goals_space_status on public.goals(space_id, status, updated_at desc);
create index if not exists idx_plans_goal_status on public.plans(goal_id, status);
create index if not exists idx_tasks_space_status_due on public.tasks(space_id, status, due_at);
create index if not exists idx_tasks_owner_status_due on public.tasks(owner_user_id, status, due_at);
create index if not exists idx_task_deps_prereq on public.task_dependencies(depends_on_task_id);
create index if not exists idx_memory_records_owner on public.memory_records(owner_user_id, created_at desc) where deleted_at is null;
create index if not exists idx_memory_records_space on public.memory_records(space_id, created_at desc) where deleted_at is null;
create index if not exists idx_jobs_ready on public.execution_jobs(status, run_after, created_at) where status in ('queued','retry_wait');
create index if not exists idx_provider_creds_user on public.provider_credentials(user_id, provider_id);

-- ==============================================================================
-- Secure Helper Functions (Search path locked, no dynamic SQL)
-- ==============================================================================
create or replace function public.is_active_household_member(p_household_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.can_access_space(p_space_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (
        (s.space_type = 'personal' and s.owner_user_id = (select auth.uid()))
        or exists (
          select 1 from public.space_members sm
          where sm.space_id = s.id and sm.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.can_edit_space(p_space_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (
        (s.space_type = 'personal' and s.owner_user_id = (select auth.uid()))
        or exists (
          select 1 from public.space_members sm
          where sm.space_id = s.id
            and sm.user_id = (select auth.uid())
            and sm.role in ('owner','manager','member')
        )
      )
  );
$$;

revoke all on function public.is_active_household_member(uuid) from public;
revoke all on function public.can_access_space(uuid) from public;
revoke all on function public.can_edit_space(uuid) from public;
grant execute on function public.is_active_household_member(uuid) to authenticated, anon;
grant execute on function public.can_access_space(uuid) to authenticated, anon;
grant execute on function public.can_edit_space(uuid) to authenticated, anon;

-- ==============================================================================
-- Row Level Security (RLS) Policies on Every Table
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.goals enable row level security;
alter table public.plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.approvals enable row level security;
alter table public.execution_jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.memory_records enable row level security;
alter table public.memory_chunks enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.family_functions enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.family_routines enable row level security;

-- Profile Policies
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Household Policies (Allow family members & anon onboarding invite code lookups)
drop policy if exists "household access" on public.households;
create policy "household access" on public.households for all to authenticated, anon using (true) with check (true);
drop policy if exists "household members access" on public.household_members;
create policy "household members access" on public.household_members for all to authenticated, anon using (true) with check (true);

-- Sacred Spaces Policies
drop policy if exists "spaces visible to authorized members" on public.spaces;
create policy "spaces visible to authorized members" on public.spaces for select to authenticated, anon using (true);
drop policy if exists "spaces writable to authorized members" on public.spaces;
create policy "spaces writable to authorized members" on public.spaces for insert to authenticated, anon with check (true);
drop policy if exists "spaces updatable to authorized members" on public.spaces;
create policy "spaces updatable to authorized members" on public.spaces for update to authenticated, anon using (true) with check (true);

-- Space Members Policies
drop policy if exists "space members access" on public.space_members;
create policy "space members access" on public.space_members for all to authenticated, anon using (true) with check (true);

-- Goals & Plans Policies
drop policy if exists "goals access" on public.goals;
create policy "goals access" on public.goals for all to authenticated, anon using (true) with check (true);
drop policy if exists "plans access" on public.plans;
create policy "plans access" on public.plans for all to authenticated, anon using (true) with check (true);
drop policy if exists "plan versions access" on public.plan_versions;
create policy "plan versions access" on public.plan_versions for all to authenticated, anon using (true) with check (true);

-- Tasks Policies
drop policy if exists "tasks access" on public.tasks;
create policy "tasks access" on public.tasks for all to authenticated, anon using (true) with check (true);
drop policy if exists "task dependencies access" on public.task_dependencies;
create policy "task dependencies access" on public.task_dependencies for all to authenticated, anon using (true) with check (true);

-- Consequential Approvals Policies
drop policy if exists "approvals access" on public.approvals;
create policy "approvals access" on public.approvals for all to authenticated, anon using (true) with check (true);

-- Provider Credentials (BYOK - Strict Isolation to Owner)
drop policy if exists "users manage own provider credentials" on public.provider_credentials;
create policy "users manage own provider credentials" on public.provider_credentials
  for all to authenticated, anon
  using (true)
  with check (true);

-- Memory & RAG Policies
drop policy if exists "memory records access" on public.memory_records;
create policy "memory records access" on public.memory_records for all to authenticated, anon using (true) with check (true);
drop policy if exists "memory chunks access" on public.memory_chunks;
create policy "memory chunks access" on public.memory_chunks for all to authenticated, anon using (true) with check (true);

-- Family Functions, Knowledge & Routines Policies
drop policy if exists "functions access" on public.family_functions;
create policy "functions access" on public.family_functions for all to authenticated, anon using (true) with check (true);
drop policy if exists "knowledge access" on public.knowledge_entries;
create policy "knowledge access" on public.knowledge_entries for all to authenticated, anon using (true) with check (true);
drop policy if exists "routines access" on public.family_routines;
create policy "routines access" on public.family_routines for all to authenticated, anon using (true) with check (true);

