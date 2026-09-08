-- Fixes "infinite recursion detected in policy for relation
-- free_responses" — reported by QA testing.
--
-- 0002's free_responses_select_own_or_after_posting policy checked "has
-- this user already posted for this (module, section)" with a subquery
-- that selects from free_responses itself. Postgres re-applies a table's
-- own RLS policy to every row a policy's subquery touches, so this
-- self-referencing subquery made the policy depend on evaluating itself —
-- Postgres detects that and refuses with a recursion error instead of
-- ever returning rows, breaking the discussion board entirely.
--
-- Fix: move that same check into a SECURITY DEFINER function (same
-- pattern as is_admin/is_ta_eligible/is_application_window_open below it
-- in 0002) — the function body runs with elevated privilege and skips
-- free_responses' own RLS, so the policy no longer depends on itself.
create or replace function public.has_posted_free_response(p_module_id text, p_section_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.free_responses
    where user_id = auth.uid()
      and module_id = p_module_id
      and section_id = p_section_id
  );
$$;

drop policy if exists "free_responses_select_own_or_after_posting" on public.free_responses;
create policy "free_responses_select_own_or_after_posting" on public.free_responses
  for select using (
    auth.uid() = user_id
    or public.has_posted_free_response(module_id, section_id)
    or public.is_admin(auth.uid())
  );
