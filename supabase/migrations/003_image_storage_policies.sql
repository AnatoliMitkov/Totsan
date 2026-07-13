-- supabase/migrations/003_image_storage_policies.sql
-- Schema fixes for client uploads, and write policies for image metadata, cleanup logs, and storage objects

-- ============================================================================
-- SCHEMA FIXES (to support client uploads since clients do not have profiles)
-- ============================================================================

-- Drop the foreign key constraint referencing public.profiles(id) so clients (who only have accounts) can save images
alter table public.image_metadata drop constraint if exists image_metadata_profile_id_fkey;
alter table public.image_cleanup_log drop constraint if exists image_cleanup_log_profile_id_fkey;

-- Drop check constraint on action to allow 'upload_new_version' logs
alter table public.image_cleanup_log drop constraint if exists image_cleanup_log_action_check;

-- ============================================================================
-- 1. RLS POLICIES FOR public.image_metadata
-- ============================================================================

-- Drop restrictive select policy and make metadata public-readable (so banners/avatars load for guests)
drop policy if exists "users can read own image metadata" on public.image_metadata;
drop policy if exists "anyone can read active image metadata" on public.image_metadata;
create policy "anyone can read active image metadata"
  on public.image_metadata for select
  to public
  using (not is_deleted_from_db);

-- Allow authenticated users to insert metadata if they own the profile or if it's their user ID
drop policy if exists "users can insert own image metadata" on public.image_metadata;
drop policy if exists "users can insert own image metadata" on public.image_metadata;
create policy "users can insert own image metadata"
  on public.image_metadata for insert
  to authenticated
  with check (user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = image_metadata.profile_id and p.user_id = auth.uid()
  ));

-- Allow authenticated users to update their own metadata
drop policy if exists "users can update own image metadata" on public.image_metadata;
create policy "users can update own image metadata"
  on public.image_metadata for update
  to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = image_metadata.profile_id and p.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = image_metadata.profile_id and p.user_id = auth.uid()
  ));

-- Allow authenticated users to delete their own metadata
drop policy if exists "users can delete own image metadata" on public.image_metadata;
create policy "users can delete own image metadata"
  on public.image_metadata for delete
  to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = image_metadata.profile_id and p.user_id = auth.uid()
  ));

-- ============================================================================
-- 2. RLS POLICIES FOR public.image_cleanup_log
-- ============================================================================

-- Allow authenticated users to log cleanup actions for their own profile
drop policy if exists "users can insert own cleanup log" on public.image_cleanup_log;
create policy "users can insert own cleanup log"
  on public.image_cleanup_log for insert
  to authenticated
  with check (profile_id is null or exists (
    select 1 from public.profiles p
    where p.id = image_cleanup_log.profile_id and p.user_id = auth.uid()
  ) or profile_id = auth.uid());

-- ============================================================================
-- 3. STORAGE POLICIES FOR 'profile-images' BUCKET (storage.objects)
-- ============================================================================

-- Allow public read access to all objects in the public 'profile-images' bucket
drop policy if exists "Public read access for profile-images" on storage.objects;
create policy "Public read access for profile-images"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-images');

-- Allow authenticated users to upload/insert to their own folder in 'profile-images'
drop policy if exists "Authenticated users can upload to profile-images" on storage.objects;
create policy "Authenticated users can upload to profile-images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()
      )
    )
  );

-- Allow authenticated users to update their own objects in 'profile-images'
drop policy if exists "Authenticated users can update profile-images" on storage.objects;
create policy "Authenticated users can update profile-images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()
      )
    )
  );

-- Allow authenticated users to delete their own objects in 'profile-images'
drop policy if exists "Authenticated users can delete from profile-images" on storage.objects;
create policy "Authenticated users can delete from profile-images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()
      )
    )
  );
