-- Tracks what stage of school a student is in, self-reported at signup —
-- purely for our own usage stats (e.g. "how many high schoolers vs. college
-- students take this course"), not used for any access control.
alter table public.profiles
  add column if not exists education_level text;

alter table public.profiles drop constraint if exists profiles_education_level_check;
alter table public.profiles add constraint profiles_education_level_check
  check (education_level is null or education_level in ('middle_school', 'high_school', 'college', 'beyond'));

-- Safe to trust client-supplied raw_user_meta_data here, unlike is_admin
-- (see 0003) — this field carries no privilege, just a self-reported label.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, is_admin, education_level)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    false,
    new.raw_user_meta_data->>'education_level'
  );
  return new;
end;
$$;
