alter table public.partner_applications
  add column if not exists details jsonb not null default '{}'::jsonb;
