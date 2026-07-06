alter table public.partner_services
  add column if not exists moderation_attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-moderation-feedback',
  'service-moderation-feedback',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists admins_manage_service_moderation_feedback on storage.objects;
drop policy if exists service_owners_read_moderation_feedback on storage.objects;

create policy admins_manage_service_moderation_feedback
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'service-moderation-feedback'
    and public.is_admin()
  )
  with check (
    bucket_id = 'service-moderation-feedback'
    and public.is_admin()
  );

create policy service_owners_read_moderation_feedback
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'service-moderation-feedback'
    and exists (
      select 1
      from public.partner_services service
      where service.id::text = (storage.foldername(name))[1]
        and service.partner_id = (select auth.uid())
    )
  );
