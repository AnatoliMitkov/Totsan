alter table public.profiles
  add column if not exists layer01_meta jsonb not null default '{}'::jsonb;

comment on column public.profiles.layer01_meta is
  'Structured metadata for Layer 01 specialists: specialist_type, specific_services, target_objects, deliverables, process_steps, consultation_fee, consultation_note.';
