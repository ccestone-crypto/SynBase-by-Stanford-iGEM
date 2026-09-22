-- Lets the homepage show "Join N learners" to logged-out visitors, without
-- exposing anything from profiles itself — profiles' own SELECT policy
-- (profiles_select_own_or_admin, 0002) is intentionally own-row-or-admin
-- only, so a plain count(*) from the browser would just come back as 0 for
-- everyone else. This SECURITY DEFINER function returns only the count.
create or replace function public.get_user_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.profiles;
$$;

revoke all on function public.get_user_count() from public;
grant execute on function public.get_user_count() to anon, authenticated;
