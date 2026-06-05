-- Phase 1 partner material/brand capabilities.
-- Standalone migration: creates only public.partner_material_capabilities and
-- its indexes, trigger, grants, and RLS policies.

create table if not exists public.partner_material_capabilities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  layer_slug text not null,
  category_slug text not null,
  brand_slug text null,
  relation_types text[] not null default array[]::text[],
  note text null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_material_capabilities_layer_check
    check (layer_slug in ('ideya','postroyka','materiali','obzavezhdane','dekoraciya')),
  constraint partner_material_capabilities_category_check
    check (category_slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint partner_material_capabilities_brand_check
    check (brand_slug is null or brand_slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint partner_material_capabilities_relation_types_check
    check (
      coalesce(array_length(relation_types, 1), 0) between 1 and 5
      and relation_types <@ array['uses','installs','sells','consults','recommends']::text[]
    )
);

drop trigger if exists set_partner_material_capabilities_updated_at on public.partner_material_capabilities;
create trigger set_partner_material_capabilities_updated_at
before update on public.partner_material_capabilities
for each row execute function public.set_updated_at();

alter table public.partner_material_capabilities enable row level security;

create unique index if not exists idx_partner_material_capabilities_unique
  on public.partner_material_capabilities (partner_id, layer_slug, category_slug, coalesce(brand_slug, ''));

create index if not exists idx_partner_material_capabilities_public_match
  on public.partner_material_capabilities (is_public, layer_slug, category_slug, brand_slug);

create index if not exists idx_partner_material_capabilities_category
  on public.partner_material_capabilities (layer_slug, category_slug);

create index if not exists idx_partner_material_capabilities_brand
  on public.partner_material_capabilities (brand_slug)
  where brand_slug is not null;

create index if not exists idx_partner_material_capabilities_profile
  on public.partner_material_capabilities (profile_id, created_at desc);

create index if not exists idx_partner_material_capabilities_partner
  on public.partner_material_capabilities (partner_id, created_at desc);

revoke insert, update, delete, truncate, references, trigger on public.partner_material_capabilities from anon;
revoke truncate, references, trigger on public.partner_material_capabilities from authenticated;
grant select on public.partner_material_capabilities to anon, authenticated;
grant insert, update, delete on public.partner_material_capabilities to authenticated;

drop policy if exists "public can read public partner material capabilities" on public.partner_material_capabilities;
drop policy if exists "owners can read own partner material capabilities" on public.partner_material_capabilities;
drop policy if exists "owners can insert own partner material capabilities" on public.partner_material_capabilities;
drop policy if exists "owners can update own partner material capabilities" on public.partner_material_capabilities;
drop policy if exists "owners can delete own partner material capabilities" on public.partner_material_capabilities;
drop policy if exists "admins can manage partner material capabilities" on public.partner_material_capabilities;

create policy "public can read public partner material capabilities"
  on public.partner_material_capabilities for select
  to anon, authenticated
  using (is_public = true);

create policy "owners can read own partner material capabilities"
  on public.partner_material_capabilities for select
  to authenticated
  using (partner_id = (select auth.uid()));

create policy "owners can insert own partner material capabilities"
  on public.partner_material_capabilities for insert
  to authenticated
  with check (
    partner_id = (select auth.uid())
    and public.profile_belongs_to_current_user(profile_id)
  );

create policy "owners can update own partner material capabilities"
  on public.partner_material_capabilities for update
  to authenticated
  using (partner_id = (select auth.uid()))
  with check (
    partner_id = (select auth.uid())
    and public.profile_belongs_to_current_user(profile_id)
  );

create policy "owners can delete own partner material capabilities"
  on public.partner_material_capabilities for delete
  to authenticated
  using (partner_id = (select auth.uid()));

create policy "admins can manage partner material capabilities"
  on public.partner_material_capabilities for all
  to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = (select auth.uid())
        and a.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = (select auth.uid())
        and a.role = 'admin'
    )
  );
