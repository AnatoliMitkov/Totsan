create index if not exists idx_orders_chat_attachment_retention
  on public.orders (conversation_id, completed_at, updated_at)
  where status = 'completed' and conversation_id is not null;

comment on column public.messages.attachments is
  'Chat attachment metadata. Image objects may be removed from storage by the 14-day post-completion retention job; entries stay in JSON with deleted_at/retention.deleted so the UI can show a placeholder.';
