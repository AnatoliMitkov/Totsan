-- ============================================================================
-- ADD SAFE ARCHIVE/HIDE COLUMNS FOR CONVERSATIONS
-- ============================================================================

-- Add archive/hide columns to conversations
alter table public.conversations
  add column if not exists hidden_by_client_at timestamptz,
  add column if not exists hidden_by_partner_at timestamptz;

-- Index for querying active (non-hidden) conversations quickly
create index if not exists idx_conversations_hidden_client 
  on public.conversations (client_id) 
  where hidden_by_client_at is null;

create index if not exists idx_conversations_hidden_partner 
  on public.conversations (partner_id) 
  where hidden_by_partner_at is null;

-- Trigger function to un-hide conversations when a new message is inserted
create or replace function public.handle_conversation_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set hidden_by_client_at = null,
      hidden_by_partner_at = null
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted_reappear on public.messages;
create trigger on_message_inserted_reappear
  after insert on public.messages
  for each row
  execute function public.handle_conversation_message_insert();
