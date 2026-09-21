-- Makes the discussion board genuinely anonymous and adds admin moderation.
--
-- Before: free_responses' select policy let any student who had posted read
-- *full rows* (including user_id) of everyone else's responses straight
-- through the API, so "anonymous" only meant the UI didn't display names.
--
-- Now: students can only ever select their own row. The board goes through
-- get_free_response_board(), a SECURITY DEFINER function that returns just
-- (answer, updated_at) for the 3 most recent responses from *other* students
-- — never user_id — and only if the caller has posted their own answer for
-- that page. Admins can still read everything (for the admin dashboard) and
-- can now delete a response for moderation.
drop policy if exists "free_responses_select_own_or_after_posting" on public.free_responses;
drop policy if exists "free_responses_select_own_or_admin" on public.free_responses;
create policy "free_responses_select_own_or_admin" on public.free_responses
  for select using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

create or replace function public.get_free_response_board(p_module_id text, p_section_id text)
returns table (answer text, updated_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select fr.answer, fr.updated_at
  from public.free_responses fr
  where fr.module_id = p_module_id
    and fr.section_id = p_section_id
    and fr.user_id <> auth.uid()
    and public.has_posted_free_response(p_module_id, p_section_id)
  order by fr.updated_at desc
  limit 3;
$$;

revoke all on function public.get_free_response_board(text, text) from public;
revoke all on function public.get_free_response_board(text, text) from anon;
grant execute on function public.get_free_response_board(text, text) to authenticated;

drop policy if exists "free_responses_delete_admin_only" on public.free_responses;
create policy "free_responses_delete_admin_only" on public.free_responses
  for delete using (public.is_admin(auth.uid()));
