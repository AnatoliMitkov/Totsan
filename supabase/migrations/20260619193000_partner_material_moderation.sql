alter table public.partner_material_capabilities
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderation_note text,
  add column if not exists reviewed_at timestamptz;

alter table public.partner_material_capabilities
  drop constraint if exists partner_material_capabilities_moderation_status_check;

alter table public.partner_material_capabilities
  add constraint partner_material_capabilities_moderation_status_check
  check (moderation_status in ('pending','approved','rejected','hidden'));

update public.partner_material_capabilities
set moderation_status = 'approved'
where moderation_status is null;

drop index if exists idx_partner_material_capabilities_public_match;
create index if not exists idx_partner_material_capabilities_public_match
  on public.partner_material_capabilities (is_public, moderation_status, layer_slug, category_slug, brand_slug);

drop policy if exists "public can read public partner material capabilities" on public.partner_material_capabilities;
create policy "public can read public partner material capabilities"
  on public.partner_material_capabilities for select
  to anon, authenticated
  using (is_public = true and moderation_status = 'approved');
