alter table public.inquiries
  add column if not exists assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_partner_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null;

create index if not exists idx_inquiries_assigned_partner
  on public.inquiries (assigned_partner_id, created_at desc)
  where assigned_partner_id is not null;

create index if not exists idx_inquiries_assigned_profile
  on public.inquiries (assigned_profile_id, created_at desc)
  where assigned_profile_id is not null;

update public.inquiries as inquiry
set
  assigned_profile_id = profile.id,
  assigned_partner_id = profile.user_id,
  assigned_at = coalesce(inquiry.assigned_at, inquiry.created_at)
from public.profiles as profile
where inquiry.assigned_partner_id is null
  and inquiry.target_slug = profile.slug
  and profile.user_id is not null;

update public.inquiries as inquiry
set
  assigned_profile_id = profile.id,
  assigned_partner_id = service.partner_id,
  assigned_at = coalesce(inquiry.assigned_at, inquiry.created_at)
from public.partner_services as service
join public.profiles as profile on profile.id = service.profile_id
where inquiry.assigned_partner_id is null
  and inquiry.target_slug = service.slug;

drop policy if exists "partners can read their own inquiries" on public.inquiries;
create policy "partners can read their own inquiries"
  on public.inquiries for select
  to authenticated
  using (
    assigned_partner_id = auth.uid()
    or target_slug in (
      select profile.slug
      from public.profiles as profile
      where profile.user_id = auth.uid()
    )
    or target_slug in (
      select service.slug
      from public.partner_services as service
      where service.partner_id = auth.uid()
    )
  );

drop policy if exists "partners can update their own inquiries" on public.inquiries;
create policy "partners can update their own inquiries"
  on public.inquiries for update
  to authenticated
  using (
    assigned_partner_id = auth.uid()
    or target_slug in (
      select profile.slug
      from public.profiles as profile
      where profile.user_id = auth.uid()
    )
    or target_slug in (
      select service.slug
      from public.partner_services as service
      where service.partner_id = auth.uid()
    )
  )
  with check (
    assigned_partner_id = auth.uid()
    or target_slug in (
      select profile.slug
      from public.profiles as profile
      where profile.user_id = auth.uid()
    )
    or target_slug in (
      select service.slug
      from public.partner_services as service
      where service.partner_id = auth.uid()
    )
  );
