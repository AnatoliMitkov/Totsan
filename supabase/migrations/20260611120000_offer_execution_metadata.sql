alter table public.offers
  add column if not exists execution_mode text not null default 'single',
  add column if not exists stages jsonb not null default '[]'::jsonb;

alter table public.offers
  drop constraint if exists offers_execution_mode_check;

alter table public.offers
  add constraint offers_execution_mode_check
  check (execution_mode in ('single', 'staged'));
