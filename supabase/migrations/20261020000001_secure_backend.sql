-- ==============================================================================
-- Neev — secure backend (RLS lock-down, realm membership, BYOK vault)
-- Spec: Neev_Complete_Supabase_First_Master_Implementation.md §§ 2, 32, 34
--   "RLS on every exposed table; deny by default."
--
-- The earlier migrations granted `anon` and `authenticated` USING (true) on nearly
-- every table, so anyone holding the publishable key could read and write every
-- family's data. This migration replaces those policies with membership-scoped ones.
-- Idempotent: safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop every permissive policy created by the earlier migrations
-- ------------------------------------------------------------------------------
drop policy if exists "household access" on public.households;
drop policy if exists "household members access" on public.household_members;
drop policy if exists "spaces visible to authorized members" on public.spaces;
drop policy if exists "spaces writable to authorized members" on public.spaces;
drop policy if exists "spaces updatable to authorized members" on public.spaces;
drop policy if exists "space members access" on public.space_members;
drop policy if exists "goals access" on public.goals;
drop policy if exists "plans access" on public.plans;
drop policy if exists "plan versions access" on public.plan_versions;
drop policy if exists "tasks access" on public.tasks;
drop policy if exists "task dependencies access" on public.task_dependencies;
drop policy if exists "approvals access" on public.approvals;
drop policy if exists "users manage own provider credentials" on public.provider_credentials;
drop policy if exists "memory records access" on public.memory_records;
drop policy if exists "memory chunks access" on public.memory_chunks;
drop policy if exists "functions access" on public.family_functions;
drop policy if exists "knowledge access" on public.knowledge_entries;
drop policy if exists "routines access" on public.family_routines;
drop policy if exists "Public access to family_realms" on public.family_realms;
drop policy if exists "Public access to kinship_edges" on public.kinship_edges;
drop policy if exists "Public access to clusters" on public.clusters;
drop policy if exists "Public access to family_bridges" on public.family_bridges;
drop policy if exists "Public access to invitations" on public.invitations;
drop policy if exists "Public access to resource_sharing_grants" on public.resource_sharing_grants;

-- Nothing in the app is meant to be readable without a session.
revoke all on all tables in schema public from anon;

-- ------------------------------------------------------------------------------
-- 2. Realm membership (used by family-realms, kinship-graph, family-bridge,
--    claim-invitation and ai-request; it was referenced but never created)
-- ------------------------------------------------------------------------------
create table if not exists public.realm_memberships (
  realm_id text not null references public.family_realms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'adult_member'
    check (role in ('realm_owner','adult_member','caregiver','tutor','child','guest')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (realm_id, user_id)
);
create index if not exists idx_realm_memberships_user on public.realm_memberships(user_id, status);
alter table public.realm_memberships enable row level security;

-- Invitation lifecycle columns used by claim-invitation.
alter table public.invitations add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null;
alter table public.invitations add column if not exists claimed_at timestamptz;
alter table public.invitations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.invitations drop constraint if exists invitations_status_check;
alter table public.invitations add constraint invitations_status_check
  check (status in ('pending','accepted','revoked','expired'));

-- ------------------------------------------------------------------------------
-- 3. Helper functions (security definer, fixed search_path, no dynamic SQL)
-- ------------------------------------------------------------------------------
create or replace function public.is_realm_member(p_realm_id text)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.realm_memberships rm
    where rm.realm_id = p_realm_id
      and rm.user_id = (select auth.uid())
      and rm.status = 'active'
  ) or exists (
    select 1 from public.family_realms fr
    where fr.id = p_realm_id and fr.owner_id = (select auth.uid())::text
  );
$$;

create or replace function public.is_realm_admin(p_realm_id text)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_realms fr
    where fr.id = p_realm_id and fr.owner_id = (select auth.uid())::text
  ) or exists (
    select 1 from public.realm_memberships rm
    where rm.realm_id = p_realm_id
      and rm.user_id = (select auth.uid())
      and rm.status = 'active'
      and rm.role = 'realm_owner'
  );
$$;

create or replace function public.is_household_admin(p_household_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role in ('owner','adult')
  );
$$;

-- family_functions / knowledge_entries / family_routines keep household_id as text.
create or replace function public.can_access_household_text(p_household_id text)
returns boolean language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_household_id is null
     or p_household_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_active_household_member(p_household_id::uuid);
end;
$$;

revoke all on function public.is_realm_member(text) from public;
revoke all on function public.is_realm_admin(text) from public;
revoke all on function public.is_household_admin(uuid) from public;
revoke all on function public.can_access_household_text(text) from public;
grant execute on function public.is_realm_member(text) to authenticated;
grant execute on function public.is_realm_admin(text) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.can_access_household_text(text) to authenticated;
revoke execute on function public.is_active_household_member(uuid) from anon;
revoke execute on function public.can_access_space(uuid) from anon;
revoke execute on function public.can_edit_space(uuid) from anon;

-- ------------------------------------------------------------------------------
-- 4. Profiles: create one per new auth user (Google or anonymous guest)
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. Households & spaces
-- ------------------------------------------------------------------------------
drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select to authenticated
  using (public.is_active_household_member(id) or created_by = (select auth.uid()));
drop policy if exists "users create household they own" on public.households;
create policy "users create household they own" on public.households
  for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "admins update household" on public.households;
create policy "admins update household" on public.households
  for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));

drop policy if exists "members read roster" on public.household_members;
create policy "members read roster" on public.household_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_active_household_member(household_id));
drop policy if exists "creator joins as owner or admin adds member" on public.household_members;
create policy "creator joins as owner or admin adds member" on public.household_members
  for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    or (
      user_id = (select auth.uid()) and role = 'owner'
      and exists (
        select 1 from public.households h
        where h.id = household_id and h.created_by = (select auth.uid())
      )
    )
  );
drop policy if exists "admins update roster" on public.household_members;
create policy "admins update roster" on public.household_members
  for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
drop policy if exists "admins remove members or members leave" on public.household_members;
create policy "admins remove members or members leave" on public.household_members
  for delete to authenticated
  using (public.is_household_admin(household_id) or user_id = (select auth.uid()));

drop policy if exists "read accessible spaces" on public.spaces;
create policy "read accessible spaces" on public.spaces
  for select to authenticated
  using (
    public.can_access_space(id)
    or (household_id is not null and public.is_active_household_member(household_id))
  );
drop policy if exists "create own or household space" on public.spaces;
create policy "create own or household space" on public.spaces
  for insert to authenticated
  with check (
    (space_type = 'personal' and owner_user_id = (select auth.uid()))
    or (household_id is not null and public.is_active_household_member(household_id))
  );
drop policy if exists "editors update space" on public.spaces;
create policy "editors update space" on public.spaces
  for update to authenticated
  using (public.can_edit_space(id)) with check (public.can_edit_space(id));

drop policy if exists "read memberships of accessible spaces" on public.space_members;
create policy "read memberships of accessible spaces" on public.space_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_access_space(space_id));
drop policy if exists "editors manage space members" on public.space_members;
create policy "editors manage space members" on public.space_members
  for all to authenticated
  using (public.can_edit_space(space_id)) with check (public.can_edit_space(space_id));

-- ------------------------------------------------------------------------------
-- 6. Goals, plans, tasks, approvals (space scoped)
-- ------------------------------------------------------------------------------
drop policy if exists "read goals in accessible spaces" on public.goals;
create policy "read goals in accessible spaces" on public.goals
  for select to authenticated using (public.can_access_space(space_id));
drop policy if exists "edit goals in editable spaces" on public.goals;
create policy "edit goals in editable spaces" on public.goals
  for all to authenticated
  using (public.can_edit_space(space_id)) with check (public.can_edit_space(space_id));

drop policy if exists "read plans via goal" on public.plans;
create policy "read plans via goal" on public.plans
  for select to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and public.can_access_space(g.space_id)));
drop policy if exists "edit plans via goal" on public.plans;
create policy "edit plans via goal" on public.plans
  for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and public.can_edit_space(g.space_id)))
  with check (exists (select 1 from public.goals g where g.id = goal_id and public.can_edit_space(g.space_id)));

drop policy if exists "read plan versions via plan" on public.plan_versions;
create policy "read plan versions via plan" on public.plan_versions
  for select to authenticated
  using (exists (
    select 1 from public.plans p join public.goals g on g.id = p.goal_id
    where p.id = plan_id and public.can_access_space(g.space_id)
  ));
drop policy if exists "add plan versions via plan" on public.plan_versions;
create policy "add plan versions via plan" on public.plan_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.plans p join public.goals g on g.id = p.goal_id
    where p.id = plan_id and public.can_edit_space(g.space_id)
  ));

drop policy if exists "read tasks in accessible spaces" on public.tasks;
create policy "read tasks in accessible spaces" on public.tasks
  for select to authenticated using (public.can_access_space(space_id));
drop policy if exists "edit tasks in editable spaces" on public.tasks;
create policy "edit tasks in editable spaces" on public.tasks
  for all to authenticated
  using (public.can_edit_space(space_id)) with check (public.can_edit_space(space_id));

drop policy if exists "read task dependencies" on public.task_dependencies;
create policy "read task dependencies" on public.task_dependencies
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.can_access_space(t.space_id)));
drop policy if exists "edit task dependencies" on public.task_dependencies;
create policy "edit task dependencies" on public.task_dependencies
  for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_space(t.space_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_space(t.space_id)));

drop policy if exists "read approvals in accessible spaces" on public.approvals;
create policy "read approvals in accessible spaces" on public.approvals
  for select to authenticated using (public.can_access_space(space_id));
drop policy if exists "request approvals in editable spaces" on public.approvals;
create policy "request approvals in editable spaces" on public.approvals
  for insert to authenticated
  with check (public.can_edit_space(space_id) and requested_by = (select auth.uid()));
drop policy if exists "approver decides" on public.approvals;
create policy "approver decides" on public.approvals
  for update to authenticated
  using (approver_user_id = (select auth.uid())) with check (approver_user_id = (select auth.uid()));

-- execution_jobs and audit_events: server-side only (no client policies = denied).

-- ------------------------------------------------------------------------------
-- 7. Memory (private by default; vector index is never anonymously readable)
-- ------------------------------------------------------------------------------
drop policy if exists "read own or shared memory" on public.memory_records;
create policy "read own or shared memory" on public.memory_records
  for select to authenticated
  using (
    deleted_at is null and (
      owner_user_id = (select auth.uid())
      or (visibility in ('space','household') and space_id is not null and public.can_access_space(space_id))
    )
  );
drop policy if exists "owners write memory" on public.memory_records;
create policy "owners write memory" on public.memory_records
  for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

drop policy if exists "read chunks of readable memory" on public.memory_chunks;
create policy "read chunks of readable memory" on public.memory_chunks
  for select to authenticated
  using (exists (
    select 1 from public.memory_records m
    where m.id = memory_id and m.deleted_at is null and (
      m.owner_user_id = (select auth.uid())
      or (m.visibility in ('space','household') and m.space_id is not null and public.can_access_space(m.space_id))
    )
  ));

-- ------------------------------------------------------------------------------
-- 8. Household records stored with text household ids
-- ------------------------------------------------------------------------------
drop policy if exists "household members use functions" on public.family_functions;
create policy "household members use functions" on public.family_functions
  for all to authenticated
  using (public.can_access_household_text(household_id))
  with check (public.can_access_household_text(household_id));
drop policy if exists "household members use knowledge" on public.knowledge_entries;
create policy "household members use knowledge" on public.knowledge_entries
  for all to authenticated
  using (public.can_access_household_text(household_id))
  with check (public.can_access_household_text(household_id));
drop policy if exists "household members use routines" on public.family_routines;
create policy "household members use routines" on public.family_routines
  for all to authenticated
  using (public.can_access_household_text(household_id))
  with check (public.can_access_household_text(household_id));

-- ------------------------------------------------------------------------------
-- 9. Family network (realm scoped)
-- ------------------------------------------------------------------------------
drop policy if exists "members read realm" on public.family_realms;
create policy "members read realm" on public.family_realms
  for select to authenticated using (public.is_realm_member(id));
drop policy if exists "users create realm they own" on public.family_realms;
create policy "users create realm they own" on public.family_realms
  for insert to authenticated with check (owner_id = (select auth.uid())::text);
drop policy if exists "admins update realm" on public.family_realms;
create policy "admins update realm" on public.family_realms
  for update to authenticated using (public.is_realm_admin(id)) with check (public.is_realm_admin(id));
drop policy if exists "owner deletes realm" on public.family_realms;
create policy "owner deletes realm" on public.family_realms
  for delete to authenticated using (owner_id = (select auth.uid())::text);

drop policy if exists "members read memberships" on public.realm_memberships;
create policy "members read memberships" on public.realm_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_realm_member(realm_id));
drop policy if exists "admins manage memberships" on public.realm_memberships;
create policy "admins manage memberships" on public.realm_memberships
  for all to authenticated
  using (public.is_realm_admin(realm_id)) with check (public.is_realm_admin(realm_id));
drop policy if exists "members leave realm" on public.realm_memberships;
create policy "members leave realm" on public.realm_memberships
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read kinship" on public.kinship_edges;
create policy "members read kinship" on public.kinship_edges
  for select to authenticated using (public.is_realm_member(realm_id));
drop policy if exists "admins edit kinship" on public.kinship_edges;
create policy "admins edit kinship" on public.kinship_edges
  for all to authenticated
  using (public.is_realm_admin(realm_id)) with check (public.is_realm_admin(realm_id));

drop policy if exists "members read clusters" on public.clusters;
create policy "members read clusters" on public.clusters
  for select to authenticated using (public.is_realm_member(realm_id));
drop policy if exists "admins edit clusters" on public.clusters;
create policy "admins edit clusters" on public.clusters
  for all to authenticated
  using (public.is_realm_admin(realm_id)) with check (public.is_realm_admin(realm_id));

drop policy if exists "members read bridges" on public.family_bridges;
create policy "members read bridges" on public.family_bridges
  for select to authenticated using (public.is_realm_member(from_realm_id));
drop policy if exists "admins edit bridges" on public.family_bridges;
create policy "admins edit bridges" on public.family_bridges
  for all to authenticated
  using (public.is_realm_admin(from_realm_id)) with check (public.is_realm_admin(from_realm_id));

-- Invitations are claimed only through the claim-invitation function (by code).
drop policy if exists "admins read invitations" on public.invitations;
create policy "admins read invitations" on public.invitations
  for select to authenticated using (public.is_realm_admin(realm_id));
drop policy if exists "admins create invitations" on public.invitations;
create policy "admins create invitations" on public.invitations
  for insert to authenticated
  with check (public.is_realm_admin(realm_id) and created_by = (select auth.uid()));
drop policy if exists "admins revoke invitations" on public.invitations;
create policy "admins revoke invitations" on public.invitations
  for update to authenticated
  using (public.is_realm_admin(realm_id)) with check (public.is_realm_admin(realm_id));

drop policy if exists "members read grants" on public.resource_sharing_grants;
create policy "members read grants" on public.resource_sharing_grants
  for select to authenticated using (public.is_realm_member(realm_id));
drop policy if exists "admins edit grants" on public.resource_sharing_grants;
create policy "admins edit grants" on public.resource_sharing_grants
  for all to authenticated
  using (public.is_realm_admin(realm_id)) with check (public.is_realm_admin(realm_id));

-- ------------------------------------------------------------------------------
-- 10. BYOK vault: ciphertext only, reachable only by the manage-provider-credential
--     and ai-request functions (service role). No client policy, no client grants.
-- ------------------------------------------------------------------------------
alter table public.provider_credentials alter column label set default 'API key';
alter table public.provider_credentials add column if not exists key_preview text;
create unique index if not exists provider_credentials_user_provider_key
  on public.provider_credentials(user_id, provider_id);
alter table public.provider_credentials enable row level security;
revoke all on public.provider_credentials from anon, authenticated;
