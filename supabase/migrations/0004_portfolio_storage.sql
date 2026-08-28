-- Replaces multer's local-disk upload path (assets/img/portfolio/uploads/,
-- written by server.js) with a Supabase Storage bucket — there's no server
-- left to receive a multipart upload and write it to disk, so the browser
-- uploads directly to Storage instead, using the same admin-only rule.
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do nothing;

drop policy if exists "portfolio_images_public_read" on storage.objects;
create policy "portfolio_images_public_read" on storage.objects
  for select using (bucket_id = 'portfolio-images');

drop policy if exists "portfolio_images_admin_write" on storage.objects;
create policy "portfolio_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'portfolio-images' and public.is_admin(auth.uid()));

drop policy if exists "portfolio_images_admin_update" on storage.objects;
create policy "portfolio_images_admin_update" on storage.objects
  for update using (bucket_id = 'portfolio-images' and public.is_admin(auth.uid()));

drop policy if exists "portfolio_images_admin_delete" on storage.objects;
create policy "portfolio_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'portfolio-images' and public.is_admin(auth.uid()));
