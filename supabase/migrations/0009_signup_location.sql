-- Tracks where a student is signing up from, self-reported at signup —
-- purely for our own usage stats (e.g. "how many countries/states are
-- represented"), not used for any access control. Same pattern as 0005's
-- education_level: country is a free-text pick from a client-side dropdown
-- (too large a list to usefully enforce with a check constraint), and
-- us_state only applies when country is "United States".
alter table public.profiles
  add column if not exists country text,
  add column if not exists us_state text;

-- Safe to trust client-supplied raw_user_meta_data here, unlike is_admin
-- (see 0003) — these fields carry no privilege, just self-reported labels.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, is_admin, education_level, country, us_state)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    false,
    new.raw_user_meta_data->>'education_level',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'us_state'
  );
  return new;
end;
$$;
