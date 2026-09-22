-- Lets a student pick a profile picture from a fixed set of icons shipped
-- with the site (assets/img/profile-pics/, listed in js/avatar-data.js) —
-- not a photo upload, so there's no Storage bucket involved, just a short
-- id stored on the profile.
alter table public.profiles add column if not exists avatar text;

alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar is null or avatar in (
    '101','102','103','104','105','201','203','204','205','206','207','208','209','210'
  ));

-- profiles' own UPDATE policy is admin-only (profiles_update_admin_only,
-- 0002) — right so a student can't grant themselves is_admin/ta_eligible by
-- just calling .update() on their own row. A SECURITY DEFINER function that
-- touches only the avatar column, gated to the caller's own id, lets
-- students change their avatar anytime without loosening that policy.
create or replace function public.set_my_avatar(p_avatar text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set avatar = p_avatar where id = auth.uid();
end;
$$;

revoke all on function public.set_my_avatar(text) from public;
revoke all on function public.set_my_avatar(text) from anon;
grant execute on function public.set_my_avatar(text) to authenticated;
