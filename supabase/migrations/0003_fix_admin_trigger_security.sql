-- Security fix specific to the static-frontend architecture.
--
-- 0001's handle_new_user() trusted `raw_user_meta_data->>'is_admin'` at
-- signup time. That was safe in the Node/Express build: server.js computed
-- that value itself by checking the ADMIN_EMAILS env var (a private
-- server-side secret the browser never saw) before ever calling
-- supabase.auth.signUp(). With no server, signUp() is called directly from
-- the browser — if the trigger still trusted client-supplied metadata,
-- anyone could pass { data: { is_admin: true } } in their own signup
-- request and grant themselves admin instantly.
--
-- Fix: never trust client-supplied is_admin. Every new signup starts as a
-- regular user, full stop. The first admin account has to be promoted
-- manually, once, via the SQL Editor:
--
--   update public.profiles set is_admin = true where email = 'you@example.com';
--
-- After that, further admins can be promoted from the app's own admin
-- dashboard (gated by the profiles_update_admin_only policy from
-- 0002, which requires the actor to already be an admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    false
  );
  return new;
end;
$$;
