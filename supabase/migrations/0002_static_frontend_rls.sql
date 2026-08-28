-- RLS policies for the static-frontend rewrite (static-no-backend branch).
--
-- With no Express server, there is no requireAuth/requireAdmin middleware
-- and no course-config.js validation left running anywhere — the browser
-- calls Supabase directly with the publishable/anon key, so these policies
-- are now the ONLY access control and business-rule enforcement in the
-- whole app. Every check that used to live in server.js is reproduced here
-- as SQL. Run this after 0001_initial_schema.sql, on the same project.

-- ============================================================
-- Helper functions (SECURITY DEFINER where they need to read a
-- table the calling user's own RLS policy isn't allowed to read,
-- e.g. checking your OWN is_admin flag without recursing into
-- profiles' own SELECT policy).
-- ============================================================

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create or replace function public.is_ta_eligible(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select ta_eligible from public.profiles where id = uid), false);
$$;

-- Mirrors server.js's windowStatus(): open only if now() is within
-- [opens_at, closes_at], treating a null bound as "no restriction" on
-- that side. No row for the kind at all also means "open" (matches the
-- old code's `store.getApplicationWindow` default of {opensAt:null,closesAt:null}).
create or replace function public.is_application_window_open(p_kind text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select (opens_at is null or now() >= opens_at)
         and (closes_at is null or now() <= closes_at)
      from public.application_windows
      where kind = p_kind
    ),
    true
  );
$$;

-- ============================================================
-- module_sections — lookup table used to (a) reject bogus section IDs via
-- a foreign key on progress_sections, and (b) let is_course_complete()
-- know what "every section" means. Generated directly from
-- server/course-config.js's MODULE_SECTION_IDS, not hand-transcribed.
-- ============================================================
create table if not exists public.module_sections (
  module_id text not null,
  section_id text not null,
  primary key (module_id, section_id)
);
alter table public.module_sections enable row level security;

insert into public.module_sections (module_id, section_id) values
  ('module0', '0.1r'),
  ('module1', '1.1r'),
  ('module1', '1.2s'),
  ('module1', '1.3r'),
  ('module1', '1.4m'),
  ('module1', '1.5r'),
  ('module1', '1.6r'),
  ('module1', '1.7r'),
  ('module1', '1.8o'),
  ('module1', '1.9r'),
  ('module1', '1.10r'),
  ('module1', '1.11r'),
  ('module1', '1.12m'),
  ('module1', '1.13r'),
  ('module1', '1.14r'),
  ('module2', '2.1r'),
  ('module2', '2.2r'),
  ('module2', '2.3r'),
  ('module2', '2.4p'),
  ('module2', '2.5r'),
  ('module2', '2.6r'),
  ('module2', '2.7p'),
  ('module2', '2.8m'),
  ('module2', '2.9r'),
  ('module2', '2.10r'),
  ('module2', '2.11r'),
  ('module2', '2.12p'),
  ('module2', '2.13r'),
  ('module2', '2.14r'),
  ('module2', '2.15r'),
  ('module2', '2.16s'),
  ('module2', '2.17p'),
  ('module2', '2.18r'),
  ('module2', '2.19r'),
  ('module2', '2.20r'),
  ('module2', '2.21p'),
  ('module2', '2.22r'),
  ('module2', '2.23p'),
  ('module2', '2.24r'),
  ('module2', '2.25r'),
  ('module2', '2.26p'),
  ('module2', '2.27o'),
  ('module2', '2.28r'),
  ('module2', '2.29r'),
  ('module2', '2.30p'),
  ('module2', '2.31r'),
  ('module2', '2.32r'),
  ('module2', '2.33p'),
  ('module2', '2.34r'),
  ('module2', '2.35r'),
  ('module2', '2.36r'),
  ('module2', '2.37p'),
  ('module2', '2.38r'),
  ('module2', '2.39p'),
  ('module2', '2.40f'),
  ('module2', '2.41r'),
  ('module2', '2.42r'),
  ('module2', '2.43r'),
  ('module2', '2.44p'),
  ('module2', '2.45r'),
  ('module2', '2.46r'),
  ('module2', '2.47p'),
  ('module2', '2.48m'),
  ('module3', '3.1r'),
  ('module3', '3.2f'),
  ('module3', '3.3r'),
  ('module3', '3.4r'),
  ('module3', '3.5f'),
  ('module3', '3.6p'),
  ('module3', '3.7f'),
  ('module3', '3.8r'),
  ('module3', '3.9m'),
  ('module3', '3.10r'),
  ('module3', '3.11f'),
  ('module3', '3.12f'),
  ('module3', '3.13f'),
  ('module3', '3.14r'),
  ('module3', '3.15f'),
  ('module3', '3.16r'),
  ('module3', '3.17m'),
  ('module3', '3.18f'),
  ('module3', '3.19r'),
  ('module3', '3.20r'),
  ('module3', '3.21r'),
  ('module3', '3.22m'),
  ('module3', '3.23r'),
  ('module3', '3.24f'),
  ('module3', '3.25f'),
  ('module3', '3.26f'),
  ('module3', '3.27r'),
  ('module3', '3.28p'),
  ('module3', '3.29s'),
  ('module3', '3.30r'),
  ('module3', '3.31p'),
  ('module3', '3.32r'),
  ('module3', '3.33r'),
  ('module3', '3.34o'),
  ('module3', '3.35f'),
  ('module4', '4.1r'),
  ('module4', '4.2r'),
  ('module4', '4.3r'),
  ('module4', '4.4s'),
  ('module4', '4.5s'),
  ('module4', '4.6r'),
  ('module4', '4.7r'),
  ('module4', '4.8p'),
  ('module4', '4.9p'),
  ('module4', '4.10p'),
  ('module4', '4.11p'),
  ('module4', '4.12f'),
  ('module4', '4.13r'),
  ('module4', '4.14r'),
  ('module4', '4.15p'),
  ('module4', '4.16p'),
  ('module4', '4.17p'),
  ('module4', '4.18r'),
  ('module4', '4.19r'),
  ('module4', '4.20r'),
  ('module4', '4.21p'),
  ('module4', '4.22r'),
  ('module4', '4.23p'),
  ('module4', '4.24r'),
  ('module4', '4.25p'),
  ('module4', '4.26m'),
  ('module4', '4.27o'),
  ('module4', '4.28f'),
  ('module5', '5.1r'),
  ('module5', '5.2r'),
  ('module5', '5.3r'),
  ('module5', '5.4r'),
  ('module5', '5.5r'),
  ('module5', '5.6p'),
  ('module5', '5.7r'),
  ('module5', '5.8r'),
  ('module5', '5.9p'),
  ('module5', '5.10r'),
  ('module5', '5.11p'),
  ('module5', '5.12p'),
  ('module5', '5.13r'),
  ('module5', '5.14r'),
  ('module5', '5.15s'),
  ('module5', '5.16p'),
  ('module5', '5.17p'),
  ('module5', '5.18f'),
  ('module5', '5.19r'),
  ('module5', '5.20p'),
  ('module5', '5.21r'),
  ('module5', '5.22r'),
  ('module5', '5.23o'),
  ('module5', '5.24p'),
  ('module5', '5.25r'),
  ('module5', '5.26r'),
  ('module5', '5.27r'),
  ('module5', '5.28m'),
  ('module5', '5.29f'),
  ('module6', '6.1r'),
  ('module6', '6.2r'),
  ('module6', '6.3r'),
  ('module6', '6.4p'),
  ('module6', '6.5r'),
  ('module6', '6.6p'),
  ('module6', '6.7p'),
  ('module6', '6.8r'),
  ('module6', '6.9r'),
  ('module6', '6.10r'),
  ('module6', '6.11m'),
  ('module6', '6.12p'),
  ('module6', '6.13r'),
  ('module6', '6.14p'),
  ('module6', '6.15r'),
  ('module6', '6.16p'),
  ('module6', '6.17r'),
  ('module6', '6.18s'),
  ('module6', '6.19r'),
  ('module6', '6.20p'),
  ('module6', '6.21p'),
  ('module6', '6.22o'),
  ('module6', '6.23f'),
  ('module7', '7.1r'),
  ('module7', '7.2r'),
  ('module7', '7.3p'),
  ('module7', '7.4r'),
  ('module7', '7.5f'),
  ('module7', '7.6r'),
  ('module7', '7.7f'),
  ('module7', '7.8r'),
  ('module7', '7.9r'),
  ('module7', '7.10m'),
  ('module7', '7.11r'),
  ('module7', '7.12r'),
  ('module7', '7.13s'),
  ('module7', '7.14r'),
  ('module7', '7.15m'),
  ('module7', '7.16f'),
  ('module7', '7.17r'),
  ('module7', '7.18r'),
  ('module7', '7.19r'),
  ('module7', '7.20o'),
  ('module7', '7.21r'),
  ('module7', '7.22p'),
  ('module7', '7.23f'),
  ('module8', '8.1r'),
  ('module8', '8.2m'),
  ('module8', '8.3r'),
  ('module8', '8.4m'),
  ('module8', '8.5s'),
  ('module8', '8.6r'),
  ('module8', '8.7p'),
  ('module8', '8.8r'),
  ('module8', '8.9p'),
  ('module8', '8.10r'),
  ('module8', '8.11p'),
  ('module8', '8.12r'),
  ('module8', '8.13p'),
  ('module8', '8.14r'),
  ('module8', '8.15f'),
  ('module8', '8.16r'),
  ('module8', '8.17r'),
  ('module8', '8.18p'),
  ('module8', '8.19f'),
  ('module8', '8.20r'),
  ('module8', '8.21r'),
  ('module8', '8.22f'),
  ('module8', '8.23r'),
  ('module8', '8.24r'),
  ('module8', '8.25m'),
  ('module8', '8.26r'),
  ('module8', '8.27r'),
  ('module8', '8.28r'),
  ('module8', '8.29m'),
  ('module8', '8.30r'),
  ('module8', '8.31r'),
  ('module8', '8.32m'),
  ('module8', '8.33r'),
  ('module8', '8.34f')
on conflict (module_id, section_id) do nothing;

-- Anyone (even logged out) can read this — it's just a static list of valid
-- IDs, no user data, needed by the client for its own display purposes too.
drop policy if exists "module_sections_read_all" on public.module_sections;
create policy "module_sections_read_all" on public.module_sections
  for select using (true);

-- Enforce isValidSection() at the database level for every new write, same
-- as the old Express route did — but NOT VALID so it isn't checked against
-- rows that already exist. Module content gets renamed/reorganized between
-- student visits (see js/progress.js's moduleProgress() comment on exactly
-- this), which can leave old, no-longer-existing section ids sitting in
-- historical rows — the app already tolerates that by clamping on read,
-- so a retroactive check here would be stricter than the app ever was and
-- would block this migration on real historical data.
alter table public.progress_sections
  drop constraint if exists progress_sections_valid_section_fkey;
alter table public.progress_sections
  add constraint progress_sections_valid_section_fkey
  foreign key (module_id, section_id) references public.module_sections(module_id, section_id)
  not valid;

-- Mirrors server/course-config.js's isModuleComplete/isCourseComplete: true
-- only if the user has a completed progress_sections row for every single
-- section in module_sections (must come after that table is created above).
create or replace function public.is_course_complete(uid uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.module_sections ms
    where not exists (
      select 1 from public.progress_sections ps
      where ps.user_id = uid
        and ps.module_id = ms.module_id
        and ps.section_id = ms.section_id
        and ps.completed = true
    )
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

-- Only admins can change is_admin/ta_eligible on any profile (including
-- their own — matches server.js's "you can't remove your own admin access"
-- rule being a business check on top of this, still worth adding client-side,
-- but the DB-level guarantee is just "you must already be an admin to change
-- any of these flags").
drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only" on public.profiles
  for update using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- No client-side INSERT policy — rows are created exclusively by the
-- handle_new_user trigger (SECURITY DEFINER, bypasses RLS) from 0001.

-- ============================================================
-- progress_sections / progress_video
-- ============================================================
drop policy if exists "progress_sections_select_own_or_admin" on public.progress_sections;
create policy "progress_sections_select_own_or_admin" on public.progress_sections
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "progress_sections_upsert_own" on public.progress_sections;
create policy "progress_sections_upsert_own" on public.progress_sections
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_sections_update_own" on public.progress_sections;
create policy "progress_sections_update_own" on public.progress_sections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress_sections_delete_admin" on public.progress_sections;
create policy "progress_sections_delete_admin" on public.progress_sections
  for delete using (public.is_admin(auth.uid()));

drop policy if exists "progress_video_select_own_or_admin" on public.progress_video;
create policy "progress_video_select_own_or_admin" on public.progress_video
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "progress_video_upsert_own" on public.progress_video;
create policy "progress_video_upsert_own" on public.progress_video
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_video_update_own" on public.progress_video;
create policy "progress_video_update_own" on public.progress_video
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress_video_delete_admin" on public.progress_video;
create policy "progress_video_delete_admin" on public.progress_video
  for delete using (public.is_admin(auth.uid()));

-- ============================================================
-- application_questions — readable by any signed-in user, admin-managed
-- ============================================================
drop policy if exists "application_questions_select_authenticated" on public.application_questions;
create policy "application_questions_select_authenticated" on public.application_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "application_questions_write_admin" on public.application_questions;
create policy "application_questions_write_admin" on public.application_questions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- applications — the real business-rule enforcement point
-- ============================================================
drop policy if exists "applications_select_own_or_admin" on public.applications;
create policy "applications_select_own_or_admin" on public.applications
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Mirrors server.js's POST /api/application and /api/ta-application checks:
-- sibrp requires isCourseComplete(); ta requires the admin-granted
-- ta_eligible flag. Both require their application window to currently be
-- open. The one-application-per-(user,kind) rule is already enforced by the
-- table's primary key.
drop policy if exists "applications_insert_eligible_own" on public.applications;
create policy "applications_insert_eligible_own" on public.applications
  for insert with check (
    auth.uid() = user_id
    and public.is_application_window_open(kind)
    and (
      (kind = 'sibrp' and public.is_course_complete(auth.uid()))
      or (kind = 'ta' and public.is_ta_eligible(auth.uid()))
    )
  );

drop policy if exists "applications_delete_admin" on public.applications;
create policy "applications_delete_admin" on public.applications
  for delete using (public.is_admin(auth.uid()));

-- ============================================================
-- application_windows — readable by any signed-in user, admin-managed
-- ============================================================
drop policy if exists "application_windows_select_authenticated" on public.application_windows;
create policy "application_windows_select_authenticated" on public.application_windows
  for select using (auth.role() = 'authenticated');

drop policy if exists "application_windows_write_admin" on public.application_windows;
create policy "application_windows_write_admin" on public.application_windows
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- speaker_talks — readable by any signed-in user, admin-managed
-- ============================================================
drop policy if exists "speaker_talks_select_authenticated" on public.speaker_talks;
create policy "speaker_talks_select_authenticated" on public.speaker_talks
  for select using (auth.role() = 'authenticated');

drop policy if exists "speaker_talks_write_admin" on public.speaker_talks;
create policy "speaker_talks_write_admin" on public.speaker_talks
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- portfolio_projects — publicly readable (matches the old unauthenticated
-- GET /api/portfolio-projects), admin-managed
-- ============================================================
drop policy if exists "portfolio_projects_select_public" on public.portfolio_projects;
create policy "portfolio_projects_select_public" on public.portfolio_projects
  for select using (true);

drop policy if exists "portfolio_projects_write_admin" on public.portfolio_projects;
create policy "portfolio_projects_write_admin" on public.portfolio_projects
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- free_responses — the discussion-board visibility rule from server.js:
-- you can always see your own answer; you can see the rest of the board
-- only for a (module, section) where you've already posted your own.
-- ============================================================
drop policy if exists "free_responses_select_own_or_after_posting" on public.free_responses;
create policy "free_responses_select_own_or_after_posting" on public.free_responses
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.free_responses mine
      where mine.user_id = auth.uid()
        and mine.module_id = free_responses.module_id
        and mine.section_id = free_responses.section_id
    )
    or public.is_admin(auth.uid())
  );

drop policy if exists "free_responses_upsert_own" on public.free_responses;
create policy "free_responses_upsert_own" on public.free_responses
  for insert with check (auth.uid() = user_id);

drop policy if exists "free_responses_update_own" on public.free_responses;
create policy "free_responses_update_own" on public.free_responses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
