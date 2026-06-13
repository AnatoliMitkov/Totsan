# Quick Start: Advanced Image Management Setup

## Step 1: Copy & Paste SQL into Supabase

1. Open **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. **Copy the entire content below** and paste it into the editor
4. Click **Run**

---

```sql
-- ============================================================================
-- IMAGE METADATA TABLE
-- ============================================================================

create table if not exists public.image_metadata (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  bucket              text not null,
  path                text not null unique,
  category            text not null check (category in ('profile', 'banner', 'portfolio', 'service', 'project', 'temp')),
  type                text,
  reference_id        uuid,
  reference_type      text check (reference_type is null or reference_type in ('portfolio', 'service', 'project')),
  variant             text,
  version_number      integer,
  original_filename   text,
  file_size           integer,
  dimensions          text,
  mime_type           text not null default 'image/jpeg',
  hash                text unique,
  is_current          boolean not null default true,
  is_deleted_from_db  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists idx_image_metadata_profile_category 
  on public.image_metadata(profile_id, category, is_current);

create index if not exists idx_image_metadata_user_created 
  on public.image_metadata(user_id, created_at desc);

create index if not exists idx_image_metadata_reference 
  on public.image_metadata(reference_type, reference_id);

create index if not exists idx_image_metadata_path 
  on public.image_metadata(path);

create index if not exists idx_image_metadata_hash 
  on public.image_metadata(hash);

create index if not exists idx_image_metadata_deleted 
  on public.image_metadata(is_deleted_from_db, deleted_at);

create index if not exists idx_image_metadata_version 
  on public.image_metadata(profile_id, category, version_number desc);

-- ============================================================================
-- IMAGE CLEANUP LOG TABLE
-- ============================================================================

create table if not exists public.image_cleanup_log (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles(id) on delete set null,
  action      text not null check (action in ('delete', 'replace', 'cleanup_old_version', 'cleanup_temp', 'cleanup_orphaned')),
  path        text,
  reason      text,
  freed_bytes integer,
  created_at  timestamptz not null default now()
);

create index if not exists idx_image_cleanup_log_profile_date 
  on public.image_cleanup_log(profile_id, created_at desc);

create index if not exists idx_image_cleanup_log_action_date 
  on public.image_cleanup_log(action, created_at desc);

-- ============================================================================
-- VIEWS
-- ============================================================================

create or replace view public.vw_image_stats as
select
  p.id as profile_id,
  p.user_id,
  p.name as profile_name,
  count(*) filter (where im.is_current and not im.is_deleted_from_db)::integer as active_images,
  count(*) filter (where im.is_current and im.is_deleted_from_db)::integer as deleted_images,
  count(*) filter (where not im.is_current)::integer as archived_versions,
  coalesce(sum(im.file_size) filter (where im.is_current and not im.is_deleted_from_db), 0)::integer as storage_bytes_active,
  coalesce(sum(im.file_size) filter (where not im.is_current), 0)::integer as storage_bytes_versions,
  coalesce(sum(im.file_size), 0)::integer as storage_bytes_total,
  round(coalesce(sum(im.file_size), 0) / 1024.0 / 1024.0, 2)::numeric as storage_mb_total,
  max(im.created_at) as last_image_upload,
  count(distinct im.category) as categories_used
from public.profiles p
left join public.image_metadata im on im.profile_id = p.id
group by p.id, p.user_id, p.name;

alter view public.vw_image_stats set (security_invoker = true);
grant select on public.vw_image_stats to authenticated;

create or replace view public.vw_image_storage_by_category as
select
  profile_id,
  category,
  count(*) filter (where is_current and not is_deleted_from_db)::integer as active_files,
  count(*) filter (where not is_current)::integer as archived_files,
  round(coalesce(sum(file_size) filter (where is_current and not is_deleted_from_db), 0) / 1024.0 / 1024.0, 2) as storage_mb_active,
  round(coalesce(sum(file_size) filter (where not is_current), 0) / 1024.0 / 1024.0, 2) as storage_mb_archived,
  round(coalesce(sum(file_size), 0) / 1024.0 / 1024.0, 2) as storage_mb_total,
  max(created_at) as last_upload
from public.image_metadata
where not is_deleted_from_db
group by profile_id, category;

alter view public.vw_image_storage_by_category set (security_invoker = true);
grant select on public.vw_image_storage_by_category to authenticated;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

alter table public.image_metadata enable row level security;
alter table public.image_cleanup_log enable row level security;

drop policy if exists "users can read own image metadata" on public.image_metadata;
create policy "users can read own image metadata"
  on public.image_metadata for select
  to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = image_metadata.profile_id and p.user_id = auth.uid()
  ));

drop policy if exists "admins can manage image metadata" on public.image_metadata;
create policy "admins can manage image metadata"
  on public.image_metadata for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "users can read own cleanup log" on public.image_cleanup_log;
create policy "users can read own cleanup log"
  on public.image_cleanup_log for select
  to authenticated
  using (profile_id is null or exists (
    select 1 from public.profiles p
    where p.id = image_cleanup_log.profile_id and p.user_id = auth.uid()
  ));

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

create or replace function public.get_profile_images(p_profile_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'profile_picture', json_build_object(
      'main', (select path from image_metadata where profile_id = p_profile_id and category = 'profile' and variant = 'main' and is_current and not is_deleted_from_db limit 1),
      'thumb', (select path from image_metadata where profile_id = p_profile_id and category = 'profile' and variant = 'thumb' and is_current and not is_deleted_from_db limit 1),
      'og', (select path from image_metadata where profile_id = p_profile_id and category = 'profile' and variant = 'og' and is_current and not is_deleted_from_db limit 1)
    ),
    'banner', json_build_object(
      'main', (select path from image_metadata where profile_id = p_profile_id and category = 'banner' and variant = 'main' and is_current and not is_deleted_from_db limit 1),
      'blur', (select path from image_metadata where profile_id = p_profile_id and category = 'banner' and variant = 'blur' and is_current and not is_deleted_from_db limit 1),
      'tablet', (select path from image_metadata where profile_id = p_profile_id and category = 'banner' and variant = 'tablet' and is_current and not is_deleted_from_db limit 1),
      'mobile', (select path from image_metadata where profile_id = p_profile_id and category = 'banner' and variant = 'mobile' and is_current and not is_deleted_from_db limit 1)
    ),
    'portfolio_count', (select count(distinct reference_id) from image_metadata where profile_id = p_profile_id and category = 'portfolio' and is_current and not is_deleted_from_db),
    'service_count', (select count(distinct reference_id) from image_metadata where profile_id = p_profile_id and category = 'service' and is_current and not is_deleted_from_db)
  )
$$;

grant execute on function public.get_profile_images(uuid) to authenticated;

create or replace function public.get_profile_storage_usage(p_profile_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'active_files', count(*) filter (where is_current and not is_deleted_from_db)::integer,
    'archived_versions', count(*) filter (where not is_current)::integer,
    'active_mb', round(coalesce(sum(file_size) filter (where is_current and not is_deleted_from_db), 0) / 1024.0 / 1024.0, 2),
    'archived_mb', round(coalesce(sum(file_size) filter (where not is_current), 0) / 1024.0 / 1024.0, 2),
    'total_mb', round(coalesce(sum(file_size), 0) / 1024.0 / 1024.0, 2),
    'by_category', (
      select json_object_agg(category, category_stats)
      from (
        select
          category,
          json_build_object(
            'files', count(*) filter (where is_current and not is_deleted_from_db),
            'mb', round(coalesce(sum(file_size) filter (where is_current and not is_deleted_from_db), 0) / 1024.0 / 1024.0, 2)
          ) as category_stats
        from image_metadata
        where profile_id = p_profile_id
        group by category
      ) stats
    )
  )
  from image_metadata
  where profile_id = p_profile_id
$$;

grant execute on function public.get_profile_storage_usage(uuid) to authenticated;
```

---

## Step 2: Verify Tables Created

Run this query to confirm:

```sql
SELECT 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('image_metadata', 'image_cleanup_log');
```

Should return 2 rows.

---

## Step 3: Use in Your Code

```javascript
import { uploadProfileImage } from '@/lib/advanced-image-manager.js'

// Upload profile picture
const result = await uploadProfileImage(
  file,
  'john-doe',
  userId,
  'profile'
)

console.log(result.main.publicUrl) // Use this URL in your profile
```

---

## Step 4: Check Storage Usage

```sql
-- View all profiles and their storage usage
SELECT * FROM vw_image_stats 
ORDER BY storage_mb_total DESC;

-- View cleanup history
SELECT * FROM image_cleanup_log 
ORDER BY created_at DESC 
LIMIT 20;
```

---

Done! The system is ready to use.
