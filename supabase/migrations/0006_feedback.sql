-- Free-form student feedback ("this question is worded weirdly", bug
-- reports, etc.), submitted from the small feedback widget on every
-- logged-in page. Visible only to admins.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page text not null default '',
  message text not null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_select_admin_only" on public.feedback;
create policy "feedback_select_admin_only" on public.feedback
  for select using (public.is_admin(auth.uid()));

drop policy if exists "feedback_update_admin_only" on public.feedback;
create policy "feedback_update_admin_only" on public.feedback
  for update using (public.is_admin(auth.uid()));

drop policy if exists "feedback_delete_admin_only" on public.feedback;
create policy "feedback_delete_admin_only" on public.feedback
  for delete using (public.is_admin(auth.uid()));
