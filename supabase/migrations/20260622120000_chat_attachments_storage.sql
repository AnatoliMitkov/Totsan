insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "chat participants can read attachments" on storage.objects;
drop policy if exists "chat participants can upload attachments" on storage.objects;
drop policy if exists "chat senders can update own attachments" on storage.objects;
drop policy if exists "chat senders can delete own attachments" on storage.objects;

create policy "chat participants can read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = 'conversations'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = (storage.foldername(name))[2]
        and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "chat participants can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = 'conversations'
    and (storage.foldername(name))[3] = auth.uid()::text
    and exists (
      select 1
      from public.conversations c
      where c.id::text = (storage.foldername(name))[2]
        and c.status = 'open'
        and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "chat senders can update own attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = 'conversations'
    and (storage.foldername(name))[3] = auth.uid()::text
  )
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = 'conversations'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

create policy "chat senders can delete own attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = 'conversations'
    and (storage.foldername(name))[3] = auth.uid()::text
  );
