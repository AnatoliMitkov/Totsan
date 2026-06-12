create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'specialist', 'admin')),
  specialist_status text check (specialist_status in ('pending', 'approved', 'rejected')),
  phone text,
  avatar_url text,
  city text,
  country text not null default 'BG',
  bio text,
  locale text not null default 'bg',
  marketing_opt_in boolean not null default false,
  account_status text not null default 'active' check (account_status in ('active', 'banned')),
  admin_note text,
  last_admin_action_at timestamptz,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.accounts
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  layer_slug text not null default 'ideya',
  role text not null default 'pro',
  name text not null default '',
  tag text not null default '',
  headline text,
  city text not null default '',
  since integer not null default extract(year from now())::integer,
  years_experience integer,
  projects integer not null default 0,
  rating numeric(3,1) not null default 5.0,
  bio text,
  description_long text,
  image_url text,
  image_zoom numeric(4,2) not null default 1.0,
  image_x numeric(5,2) not null default 50.0,
  image_y numeric(5,2) not null default 50.0,
  cover_url text,
  cover_y numeric(5,2) not null default 50.0,
  phone text,
  email_public text,
  website text,
  instagram text,
  facebook text,
  languages text[] not null default array['bg']::text[],
  service_areas text[] not null default array[]::text[],
  response_time_hours integer,
  accepts_remote boolean not null default false,
  pricing_note text,
  is_published boolean not null default true
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.profile_belongs_to_current_user(check_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_profile_id
      and p.user_id = auth.uid()
  );
$$;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  company text,
  email text not null,
  phone text,
  layer_slug text,
  about text,
  status text not null default 'pending',
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'pro',
  reviewed_at timestamptz,
  decision_note text
);

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  property_type text,
  area_sqm numeric(7,2),
  rooms_count integer,
  address_city text,
  address_region text,
  current_layer_slug text,
  desired_start_date date,
  budget_min integer,
  budget_max integer,
  budget_currency text not null default 'EUR',
  idea_description text,
  quiz_answers jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_client_projects_updated_at on public.client_projects;
create trigger set_client_projects_updated_at
before update on public.client_projects
for each row execute function public.set_updated_at();

create table if not exists public.client_project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'project-media',
  path text not null,
  public_url text,
  kind text not null default 'photo',
  caption text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile_id uuid references public.profiles(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  slug text not null default gen_random_uuid()::text,
  summary text,
  description text,
  cover_url text,
  media jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  delivery_areas text[] not null default '{}'::text[],
  is_published boolean not null default false,
  moderation_status text not null default 'draft'
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.client_projects(id) on delete set null,
  service_id uuid references public.partner_services(id) on delete set null,
  status text not null default 'open'
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.partner_services(id) on delete set null,
  title text not null default '',
  description text,
  amount_total integer,
  currency text not null default 'EUR',
  status text not null default 'draft'
);

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.partner_applications enable row level security;
alter table public.client_projects enable row level security;
alter table public.client_project_media enable row level security;
alter table public.partner_services enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;

create index if not exists idx_accounts_role on public.accounts (role);
create index if not exists idx_accounts_email on public.accounts (email);
create index if not exists idx_profiles_user on public.profiles (user_id) where user_id is not null;
create index if not exists idx_profiles_layer on public.profiles (layer_slug);
create index if not exists idx_client_projects_user on public.client_projects (user_id, updated_at desc);
create index if not exists idx_client_project_media_project on public.client_project_media (project_id, order_index, created_at);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);
create index if not exists idx_offers_conversation on public.offers (conversation_id, created_at desc);
