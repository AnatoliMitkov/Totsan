-- Migration: Fix partner_services RLS policies to allow moderation_status 'pending'
drop policy if exists "owners can insert own partner services" on public.partner_services;
drop policy if exists "owners can update own partner services" on public.partner_services;

create policy "owners can insert own partner services"
  on public.partner_services for insert
  to authenticated
  with check (
    partner_id = (select auth.uid())
    and moderation_status in ('draft', 'pending')
    and is_published = false
    and public.profile_belongs_to_current_user(profile_id)
  );

create policy "owners can update own partner services"
  on public.partner_services for update
  to authenticated
  using (partner_id = (select auth.uid()))
  with check (
    partner_id = (select auth.uid())
    and moderation_status in ('draft', 'pending')
    and is_published = false
    and public.profile_belongs_to_current_user(profile_id)
  );
