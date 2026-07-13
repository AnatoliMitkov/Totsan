create table if not exists public.message_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned boolean not null default false,
  starred boolean not null default false,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_flags_unique unique (message_id, user_id),
  constraint message_flags_color_check check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

create index if not exists idx_message_flags_message on public.message_flags (message_id);
create index if not exists idx_message_flags_user on public.message_flags (user_id);
create index if not exists idx_message_flags_updated on public.message_flags (updated_at desc);

alter table public.message_flags enable row level security;

drop policy if exists "participants can read own message flags" on public.message_flags;
drop policy if exists "participants can upsert own message flags" on public.message_flags;
drop policy if exists "participants can update own message flags" on public.message_flags;
drop policy if exists "users can delete own message flags" on public.message_flags;

create policy "participants can read own message flags"
  on public.message_flags for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "participants can upsert own message flags"
  on public.message_flags for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "participants can update own message flags"
  on public.message_flags for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "users can delete own message flags"
  on public.message_flags for delete
  to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_flags'
  ) then
    alter publication supabase_realtime add table public.message_flags;
  end if;
end $$;
