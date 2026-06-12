alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create index if not exists idx_messages_reply_to_message on public.messages (reply_to_message_id);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint message_reactions_unique unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message on public.message_reactions (message_id);
create index if not exists idx_message_reactions_user on public.message_reactions (user_id);
create index if not exists idx_message_reactions_created on public.message_reactions (created_at desc);

alter table public.message_reactions enable row level security;

drop policy if exists "participants can read message reactions" on public.message_reactions;
drop policy if exists "participants can insert own message reactions" on public.message_reactions;
drop policy if exists "users can delete own message reactions" on public.message_reactions;

create policy "participants can read message reactions"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "participants can insert own message reactions"
  on public.message_reactions for insert
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

create policy "users can delete own message reactions"
  on public.message_reactions for delete
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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
