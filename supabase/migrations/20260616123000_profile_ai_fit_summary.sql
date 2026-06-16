alter table public.profiles
  add column if not exists ai_fit_summary jsonb not null default '{}'::jsonb,
  add column if not exists ai_fit_summary_status text not null default 'stale',
  add column if not exists ai_fit_summary_generated_at timestamptz,
  add column if not exists ai_fit_summary_source_hash text,
  add column if not exists ai_fit_summary_error text;

alter table public.profiles
  drop constraint if exists profiles_ai_fit_summary_status_check;

alter table public.profiles
  add constraint profiles_ai_fit_summary_status_check
  check (ai_fit_summary_status in ('stale', 'ready', 'error', 'skipped'));

comment on column public.profiles.ai_fit_summary is
  'Cached AI-generated public fit summary for specialist profiles. Rendered publicly with deterministic fallback.';

comment on column public.profiles.ai_fit_summary_source_hash is
  'Hash of the profile/service/portfolio source payload used to generate ai_fit_summary.';
