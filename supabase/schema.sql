-- ============================================================================
-- TOTSAN V2 — Supabase Schema
-- Пейсни целия този файл в Supabase Dashboard → SQL Editor → Run.
-- Това създава таблиците + правилата за сигурност (Row Level Security).
-- ============================================================================

-- 1) Контактни запитвания от формата
create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  contact     text not null,                  -- email или телефон
  layer_slug  text,                            -- 01-05 или null
  message     text not null,
  source      text default 'contact_form',    -- contact_form | pro_inquiry | product_inquiry
  target_slug text,                            -- ако е насочено към специалист/продукт
  status      text not null default 'new'    -- new | seen | replied | closed
);

-- 2) Newsletter абонати (за бъдещ footer)
create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique
);

-- 3) Партньорски заявки (специалисти/фирми, които искат да влязат в Totsan)
create table if not exists public.partner_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  company     text,
  email       text not null,
  phone       text,
  layer_slug  text,
  about       text,
  status      text not null default 'pending'
);

-- 4) Публични профили на специалисти, които се редактират през /admin
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  slug          text not null unique,
  layer_slug    text not null,
  name          text not null,
  tag           text not null,
  city          text not null,
  since         integer not null,
  rating        numeric(3,1) not null default 5.0,
  projects      integer not null default 0,
  bio           text,
  image_url     text,
  image_zoom    numeric(4,2) not null default 1.0,
  image_x       numeric(5,2) not null default 50.0,
  image_y       numeric(5,2) not null default 50.0,
  is_published  boolean not null default true
);

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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security: позволяваме INSERT от анонимни (формите),
-- но НЕ позволяваме SELECT/UPDATE/DELETE от анонимни (само сервизният роля чете).
-- ============================================================================

alter table public.inquiries           enable row level security;
alter table public.subscribers         enable row level security;
alter table public.partner_applications enable row level security;
alter table public.profiles            enable row level security;

-- INSERT policies
drop policy if exists "anon can insert inquiries"    on public.inquiries;
drop policy if exists "anon can insert subscribers"  on public.subscribers;
drop policy if exists "anon can insert applications" on public.partner_applications;

create policy "anon can insert inquiries"
  on public.inquiries for insert
  to anon, authenticated with check (true);

create policy "anon can insert subscribers"
  on public.subscribers for insert
  to anon, authenticated with check (true);

create policy "anon can insert applications"
  on public.partner_applications for insert
  to anon, authenticated with check (true);

drop policy if exists "public can read published profiles" on public.profiles;
drop policy if exists "admins can read profiles" on public.profiles;
drop policy if exists "admins can insert profiles" on public.profiles;
drop policy if exists "admins can update profiles" on public.profiles;

create policy "public can read published profiles"
  on public.profiles for select
  to anon, authenticated
  using (is_published = true);

-- Admin policies: само тези имейли могат да четат и управляват данни през /admin.
drop policy if exists "admins can read inquiries"      on public.inquiries;
drop policy if exists "admins can update inquiries"    on public.inquiries;
drop policy if exists "admins can read subscribers"    on public.subscribers;
drop policy if exists "admins can read applications"   on public.partner_applications;
drop policy if exists "admins can update applications" on public.partner_applications;

create policy "admins can read inquiries"
  on public.inquiries for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can update inquiries"
  on public.inquiries for update
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can read subscribers"
  on public.subscribers for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can read applications"
  on public.partner_applications for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can update applications"
  on public.partner_applications for update
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can read profiles"
  on public.profiles for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can update profiles"
  on public.profiles for update
  to authenticated
  using ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check ((auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com'));

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('profile-images-optimized', 'profile-images-optimized', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can read profile images" on storage.objects;
drop policy if exists "admins can upload profile images" on storage.objects;
drop policy if exists "admins can update profile images" on storage.objects;

-- New optimized profile uploads go through the Edge Function with service-role access.
-- We keep the legacy bucket policies below for backward compatibility while the
-- browser flows migrate away from direct Storage writes.

create policy "admins can upload profile images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com')
  );

create policy "admins can update profile images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com')
  )
  with check (
    bucket_id = 'profile-images'
    and (auth.jwt() ->> 'email') in ('a.mitkov@totsan.com', 'manager@totsan.com')
  );

-- ============================================================================
-- Индекси за бързи заявки от админ панел в бъдеще
-- ============================================================================

create index if not exists idx_inquiries_created on public.inquiries (created_at desc);
create index if not exists idx_inquiries_status  on public.inquiries (status);
create index if not exists idx_profiles_layer    on public.profiles (layer_slug);
create index if not exists idx_profiles_visible  on public.profiles (is_published);

-- ============================================================================
-- АКАУНТ СИСТЕМА (Phase B)
-- Свързваме profiles и partner_applications с auth.users.
-- Позволяваме на специалистите да редактират собствения си профил.
-- ============================================================================

alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.profiles
  add column if not exists role text not null default 'pro';

create unique index if not exists idx_profiles_user on public.profiles (user_id) where user_id is not null;

alter table public.partner_applications
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.partner_applications
  add column if not exists role text not null default 'pro';

alter table public.partner_applications
  add column if not exists reviewed_at timestamptz;

alter table public.partner_applications
  add column if not exists decision_note text;

create index if not exists idx_applications_user   on public.partner_applications (user_id);
create index if not exists idx_applications_status on public.partner_applications (status);

-- Pro: чете и редактира собствения си профил (дори ако is_published = false).
drop policy if exists "pros can read own profile"   on public.profiles;
drop policy if exists "pros can update own profile" on public.profiles;

create policy "pros can read own profile"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "pros can update own profile"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Всеки логнат потребител може да създаде заявка за себе си и да чете своите.
drop policy if exists "users can insert own application" on public.partner_applications;
drop policy if exists "users can read own applications"  on public.partner_applications;

create policy "users can insert own application"
  on public.partner_applications for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "users can read own applications"
  on public.partner_applications for select
  to authenticated
  using (user_id = auth.uid());

-- Pro може да качва собствените си снимки в profile-images (папка = user.id).
drop policy if exists "pros can upload own profile image" on storage.objects;
drop policy if exists "pros can update own profile image" on storage.objects;

create policy "pros can upload own profile image"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pros can update own profile image"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- ACCOUNTS — единна таблица за роля и статус на потребителя
-- (id = auth.users.id, един ред на акаунт, авто-създаване при signup).
-- ============================================================================

create table if not exists public.accounts (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  full_name          text,
  display_name       text,
  role               text not null default 'user' check (role in ('user', 'specialist', 'admin')),
  specialist_status  text check (specialist_status in ('pending', 'approved', 'rejected')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

-- Auto-create account row when a new auth.users is inserted.
-- Чете role от user_metadata: ако е 'pro' / 'specialist' → role='specialist', specialist_status='pending'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'user'));
  resolved_role text := 'user';
  resolved_status text := null;
  resolved_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'user_name');
  resolved_display_name text := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1));
  admin_emails text[] := array['a.mitkov@totsan.com','manager@totsan.com'];
begin
  if lower(coalesce(new.email, '')) = any(admin_emails) then
    resolved_role := 'admin';
  elsif meta_role in ('specialist', 'pro') then
    resolved_role := 'specialist';
    resolved_status := 'pending';
  end if;

  insert into public.accounts (id, email, full_name, display_name, role, specialist_status)
  values (new.id, new.email, resolved_full_name, resolved_display_name, resolved_role, resolved_status)
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.accounts.full_name),
      display_name = coalesce(excluded.display_name, public.accounts.display_name),
      role = case
        when lower(coalesce(excluded.email, '')) = any(admin_emails) then 'admin'
        else public.accounts.role
      end,
      specialist_status = case
        when lower(coalesce(excluded.email, '')) = any(admin_emails) then null
        else coalesce(public.accounts.specialist_status, excluded.specialist_status)
      end;

  return new;
exception when others then
  -- Никога не позволяваме trigger да блокира създаването на auth.users.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.accounts enable row level security;

-- Потребителят чете само своя ред.
drop policy if exists "users can read own account"   on public.accounts;
drop policy if exists "users can update own account" on public.accounts;
drop policy if exists "admins can read all accounts" on public.accounts;
drop policy if exists "admins can update all accounts" on public.accounts;

create policy "users can read own account"
  on public.accounts for select
  to authenticated
  using (id = auth.uid());

-- Админите четат и редактират всички акаунти.
create policy "admins can read all accounts"
  on public.accounts for select
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can update all accounts"
  on public.accounts for update
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create index if not exists idx_accounts_role on public.accounts (role);
create index if not exists idx_accounts_email on public.accounts (email);

-- ============================================================================
-- Sync account state when a customer sends/updates a partner application.
create or replace function public.sync_account_from_partner_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    update public.accounts
    set role = 'specialist',
        specialist_status = 'pending'
    where id = new.user_id
      and role <> 'admin';
  elsif tg_op = 'UPDATE' then
    update public.accounts
    set role = case when new.status in ('pending', 'approved') then 'specialist' else role end,
        specialist_status = case
          when new.status in ('pending', 'approved', 'rejected') then new.status
          else specialist_status
        end
    where id = new.user_id
      and role <> 'admin';
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_account_from_partner_application() from public, anon, authenticated;

drop trigger if exists sync_account_from_partner_application on public.partner_applications;
create trigger sync_account_from_partner_application
after insert or update of status on public.partner_applications
for each row execute function public.sync_account_from_partner_application();

-- Backfill: sync accounts from existing auth users, including Google metadata names.
insert into public.accounts (id, email, full_name, display_name, role, specialist_status)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'user_name'),
  coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'user_name', split_part(u.email, '@', 1)),
  case when lower(coalesce(u.email, '')) in ('a.mitkov@totsan.com', 'manager@totsan.com') then 'admin' else 'user' end,
  null
from auth.users u
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(nullif(public.accounts.full_name, ''), excluded.full_name),
    display_name = coalesce(nullif(public.accounts.display_name, ''), excluded.display_name),
    role = case
      when lower(coalesce(excluded.email, '')) in ('a.mitkov@totsan.com', 'manager@totsan.com') then 'admin'
      else public.accounts.role
    end,
    specialist_status = case
      when lower(coalesce(excluded.email, '')) in ('a.mitkov@totsan.com', 'manager@totsan.com') then null
      else public.accounts.specialist_status
    end;

-- ВАЖНО: първите админи се задават автоматично
-- ============================================================================
-- Имейлите a.mitkov@totsan.com и manager@totsan.com стават admin при signup
-- и при backfill на вече съществуващи auth.users записи.
-- ============================================================================

-- ============================================================================
-- PHASE 1 — Клиентски профил v2: лични данни, активен проект и project media
-- ============================================================================

alter table public.accounts
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists city text,
  add column if not exists country text not null default 'BG',
  add column if not exists bio text,
  add column if not exists locale text not null default 'bg',
  add column if not exists marketing_opt_in boolean not null default false;

create or replace function public.update_own_account_profile(
  p_full_name text default null,
  p_display_name text default null,
  p_phone text default null,
  p_avatar_url text default null,
  p_city text default null,
  p_country text default 'BG',
  p_bio text default null,
  p_locale text default 'bg',
  p_marketing_opt_in boolean default false
)
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_account public.accounts;
begin
  update public.accounts
  set full_name = nullif(btrim(coalesce(p_full_name, '')), ''),
      display_name = nullif(btrim(coalesce(p_display_name, p_full_name, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''),
      city = nullif(btrim(coalesce(p_city, '')), ''),
      country = coalesce(nullif(upper(btrim(coalesce(p_country, ''))), ''), 'BG'),
      bio = nullif(btrim(coalesce(p_bio, '')), ''),
      locale = coalesce(nullif(lower(btrim(coalesce(p_locale, ''))), ''), 'bg'),
      marketing_opt_in = coalesce(p_marketing_opt_in, false)
  where id = auth.uid()
  returning * into updated_account;

  if updated_account.id is null then
    raise exception 'Account not found for current user.';
  end if;

  return updated_account;
end;
$$;

revoke execute on function public.update_own_account_profile(text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_own_account_profile(text, text, text, text, text, text, text, text, boolean) to authenticated;

create table if not exists public.client_projects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text,
  property_type      text check (property_type is null or property_type in ('apartment','house','office','commercial','outdoor','other')),
  area_sqm           numeric(7,2) check (area_sqm is null or area_sqm > 0),
  rooms_count        integer check (rooms_count is null or rooms_count >= 0),
  address_city       text,
  address_region     text,
  current_layer_slug text check (current_layer_slug is null or current_layer_slug in ('ideya','postroyka','materiali','obzavezhdane','dekoraciya')),
  desired_start_date date,
  budget_min         integer check (budget_min is null or budget_min >= 0),
  budget_max         integer check (budget_max is null or budget_max >= 0),
  budget_currency    text not null default 'EUR',
  idea_description   text,
  quiz_answers       jsonb not null default '{}'::jsonb,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists set_client_projects_updated_at on public.client_projects;
create trigger set_client_projects_updated_at
before update on public.client_projects
for each row execute function public.set_updated_at();

create table if not exists public.client_project_media (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.client_projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  bucket      text not null default 'project-media',
  path        text not null,
  public_url  text,
  kind        text not null default 'photo' check (kind in ('photo','plan','inspiration','document')),
  caption     text,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.client_projects enable row level security;
alter table public.client_project_media enable row level security;

create index if not exists idx_client_projects_user_active on public.client_projects (user_id, is_active, updated_at desc);
create index if not exists idx_client_projects_layer on public.client_projects (current_layer_slug);
create index if not exists idx_client_project_media_project on public.client_project_media (project_id, order_index, created_at);
create index if not exists idx_client_project_media_user on public.client_project_media (user_id);

drop policy if exists "users can read own client projects" on public.client_projects;
drop policy if exists "users can insert own client projects" on public.client_projects;
drop policy if exists "users can update own client projects" on public.client_projects;
drop policy if exists "users can delete own client projects" on public.client_projects;
drop policy if exists "admins can manage client projects" on public.client_projects;

create policy "users can read own client projects"
  on public.client_projects for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert own client projects"
  on public.client_projects for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own client projects"
  on public.client_projects for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete own client projects"
  on public.client_projects for delete
  to authenticated
  using (user_id = auth.uid());

create policy "admins can manage client projects"
  on public.client_projects for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

drop policy if exists "users can read own project media" on public.client_project_media;
drop policy if exists "users can insert own project media" on public.client_project_media;
drop policy if exists "users can update own project media" on public.client_project_media;
drop policy if exists "users can delete own project media" on public.client_project_media;
drop policy if exists "admins can manage project media" on public.client_project_media;

create policy "users can read own project media"
  on public.client_project_media for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert own project media"
  on public.client_project_media for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.client_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "users can update own project media"
  on public.client_project_media for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.client_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "users can delete own project media"
  on public.client_project_media for delete
  to authenticated
  using (user_id = auth.uid());

create policy "admins can manage project media"
  on public.client_project_media for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "users can read own project media objects" on storage.objects;

create policy "users can read own project media objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = 'projects'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================================
-- PHASE 2 — Партньорски профил v2: разширени полета, портфолио и статистики
-- ============================================================================

alter table public.profiles
  add column if not exists headline text,
  add column if not exists description_long text,
  add column if not exists phone text,
  add column if not exists email_public text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists languages text[] not null default array['bg'],
  add column if not exists service_areas text[] not null default array[]::text[],
  add column if not exists years_experience integer check (years_experience is null or years_experience >= 0),
  add column if not exists response_time_hours integer check (response_time_hours is null or response_time_hours >= 0),
  add column if not exists accepts_remote boolean not null default false,
  add column if not exists pricing_note text;

create table if not exists public.profile_portfolio (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text,
  cover_url    text,
  media        jsonb not null default '[]'::jsonb,
  layer_slug   text check (layer_slug is null or layer_slug in ('ideya','postroyka','materiali','obzavezhdane','dekoraciya')),
  year         integer check (year is null or year between 1900 and 2100),
  city         text,
  budget_band  text,
  order_index  integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_profile_portfolio_updated_at on public.profile_portfolio;
create trigger set_profile_portfolio_updated_at
before update on public.profile_portfolio
for each row execute function public.set_updated_at();

alter table public.profile_portfolio enable row level security;

create index if not exists idx_profile_portfolio_profile on public.profile_portfolio (profile_id, order_index, created_at desc);
create index if not exists idx_profile_portfolio_visible on public.profile_portfolio (is_published);
create index if not exists idx_profile_portfolio_layer on public.profile_portfolio (layer_slug);

drop policy if exists "public can read published portfolio" on public.profile_portfolio;
drop policy if exists "pros can read own portfolio" on public.profile_portfolio;
drop policy if exists "pros can insert own portfolio" on public.profile_portfolio;
drop policy if exists "pros can update own portfolio" on public.profile_portfolio;
drop policy if exists "pros can delete own portfolio" on public.profile_portfolio;
drop policy if exists "admins can manage portfolio" on public.profile_portfolio;

create policy "public can read published portfolio"
  on public.profile_portfolio for select
  to anon, authenticated
  using (is_published = true);

create policy "pros can read own portfolio"
  on public.profile_portfolio for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

create policy "pros can insert own portfolio"
  on public.profile_portfolio for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

create policy "pros can update own portfolio"
  on public.profile_portfolio for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

create policy "pros can delete own portfolio"
  on public.profile_portfolio for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

create policy "admins can manage portfolio"
  on public.profile_portfolio for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can read portfolio media objects" on storage.objects;

create or replace view public.vw_profile_stats as
select
  p.id as profile_id,
  p.user_id,
  p.created_at as member_since,
  coalesce(p.projects, 0) + coalesce(portfolio_counts.portfolio_count, 0) as total_projects,
  0::integer as active_orders,
  0::integer as completed_orders,
  coalesce(p.rating, 0)::numeric(3,1) as avg_rating,
  0::integer as reviews_count,
  p.response_time_hours
from public.profiles p
left join (
  select profile_id, count(*)::integer as portfolio_count
  from public.profile_portfolio
  where is_published = true
  group by profile_id
) portfolio_counts on portfolio_counts.profile_id = p.id;

alter view public.vw_profile_stats set (security_invoker = true);

-- ============================================================================
-- PHASE 3 — Админ панел v2: audit trail, account status and dashboard KPIs
-- ============================================================================

alter table public.accounts
  add column if not exists account_status text not null default 'active' check (account_status in ('active','banned')),
  add column if not exists admin_note text,
  add column if not exists last_admin_action_at timestamptz;

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create index if not exists idx_audit_log_created on public.audit_log (created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log (actor_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists idx_accounts_status on public.accounts (account_status);
create index if not exists idx_accounts_created on public.accounts (created_at desc);

drop policy if exists "admins can read audit log" on public.audit_log;

create policy "admins can read audit log"
  on public.audit_log for select
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create or replace view public.vw_admin_dashboard as
select
  (select count(*)::integer from public.accounts where created_at >= now() - interval '24 hours') as new_registrations_24h,
  (select count(*)::integer from public.accounts) as total_accounts,
  (select count(*)::integer from public.accounts where role = 'admin') as admin_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist') as specialist_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'pending') as pending_specialists,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'approved') as approved_specialists,
  (select count(*)::integer from public.accounts where account_status = 'banned') as banned_accounts,
  (select count(*)::integer from public.inquiries where status = 'new') as new_inquiries,
  (select count(*)::integer from public.inquiries where status in ('new','seen')) as open_inquiries,
  (select count(*)::integer from public.partner_applications where status = 'pending') as pending_applications,
  (select count(*)::integer from public.profiles where is_published = true) as published_profiles,
  (select count(*)::integer from public.profiles where is_published = false) as hidden_profiles,
  (select count(*)::integer from public.profile_portfolio) as portfolio_items,
  (select count(*)::integer from public.audit_log where created_at >= now() - interval '24 hours') as audit_events_24h,
  0::integer as open_disputes,
  0::integer as pending_services,
  0::integer as payments_attention,
  0::integer as published_services;

alter view public.vw_admin_dashboard set (security_invoker = true);
grant select on public.vw_admin_dashboard to authenticated;

-- Phase 7 — Verified reviews and trust
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.partner_services(id) on delete set null,
  rating_overall integer not null check (rating_overall between 1 and 5),
  rating_communication integer not null check (rating_communication between 1 and 5),
  rating_quality integer not null check (rating_quality between 1 and 5),
  rating_value integer not null check (rating_value between 1 and 5),
  body text,
  partner_reply text,
  partner_reply_at timestamptz,
  moderation_status text not null default 'visible' check (moderation_status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews add column if not exists service_id uuid references public.partner_services(id) on delete set null;
alter table public.reviews add column if not exists rating_communication integer not null default 5 check (rating_communication between 1 and 5);
alter table public.reviews add column if not exists rating_quality integer not null default 5 check (rating_quality between 1 and 5);
alter table public.reviews add column if not exists rating_value integer not null default 5 check (rating_value between 1 and 5);
alter table public.reviews add column if not exists partner_reply text;
alter table public.reviews add column if not exists partner_reply_at timestamptz;
alter table public.reviews add column if not exists moderation_status text not null default 'visible' check (moderation_status in ('visible','hidden'));

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

create index if not exists idx_reviews_partner_visible on public.reviews (partner_id, moderation_status, created_at desc);
create index if not exists idx_reviews_service_visible on public.reviews (service_id, moderation_status, created_at desc);
create index if not exists idx_reviews_order on public.reviews (order_id);
create index if not exists idx_reviews_client on public.reviews (client_id);
create index if not exists idx_review_reports_review on public.review_reports (review_id, status, created_at desc);
create index if not exists idx_review_reports_reporter on public.review_reports (reporter_id);

create or replace function public.guard_review_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_admin boolean := lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com');
begin
  if is_admin then
    return new;
  end if;

  if (select auth.uid()) = old.partner_id then
    if old.partner_reply is not null then
      raise exception 'Партньорът вече е отговорил на този отзив.';
    end if;

    if new.id is distinct from old.id
      or new.order_id is distinct from old.order_id
      or new.client_id is distinct from old.client_id
      or new.partner_id is distinct from old.partner_id
      or new.service_id is distinct from old.service_id
      or new.rating_overall is distinct from old.rating_overall
      or new.rating_communication is distinct from old.rating_communication
      or new.rating_quality is distinct from old.rating_quality
      or new.rating_value is distinct from old.rating_value
      or new.body is distinct from old.body
      or new.moderation_status is distinct from old.moderation_status
      or new.created_at is distinct from old.created_at then
      raise exception 'Партньорът може да добави само отговор към отзива.';
    end if;

    if nullif(trim(coalesce(new.partner_reply, '')), '') is null then
      raise exception 'Отговорът не може да е празен.';
    end if;

    new.partner_reply := trim(new.partner_reply);
    new.partner_reply_at := coalesce(new.partner_reply_at, now());
    return new;
  end if;

  raise exception 'Нямаш право да редактираш този отзив.';
end;
$$;

drop trigger if exists guard_review_update_before_update on public.reviews;
create trigger guard_review_update_before_update
before update on public.reviews
for each row execute function public.guard_review_update();

create or replace function public.recalculate_profile_rating(target_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_partner_id is null then
    return;
  end if;

  update public.profiles p
  set rating = coalesce((
    select round(avg(r.rating_overall)::numeric, 1)::numeric(3,1)
    from public.reviews r
    where r.partner_id = target_partner_id and r.moderation_status = 'visible'
  ), 5.0)
  where p.user_id = target_partner_id;
end;
$$;

revoke all on function public.recalculate_profile_rating(uuid) from public, anon, authenticated;

create or replace function public.sync_profile_rating_from_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_profile_rating(old.partner_id);
    return old;
  end if;

  perform public.recalculate_profile_rating(new.partner_id);
  if tg_op = 'UPDATE' and old.partner_id is not null and old.partner_id <> new.partner_id then
    perform public.recalculate_profile_rating(old.partner_id);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_rating_from_reviews() from public, anon, authenticated;

drop trigger if exists sync_profile_rating_after_reviews on public.reviews;
create trigger sync_profile_rating_after_reviews
after insert or update or delete on public.reviews
for each row execute function public.sync_profile_rating_from_reviews();

drop policy if exists "public can read visible reviews" on public.reviews;
drop policy if exists "participants can read own reviews" on public.reviews;
drop policy if exists "clients can insert verified reviews" on public.reviews;
drop policy if exists "partners can reply to own reviews" on public.reviews;
drop policy if exists "admins can manage reviews" on public.reviews;
drop policy if exists "reviews select access" on public.reviews;
drop policy if exists "reviews insert verified or admin" on public.reviews;
drop policy if exists "reviews partner reply or admin update" on public.reviews;
drop policy if exists "admins can delete reviews" on public.reviews;

create policy "reviews select access"
  on public.reviews for select
  to anon, authenticated
  using (
    moderation_status = 'visible'
    or (select auth.uid()) in (client_id, partner_id)
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
  );

create policy "reviews insert verified or admin"
  on public.reviews for insert
  to authenticated
  with check (
    lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
    or (
      client_id = (select auth.uid())
      and partner_id <> (select auth.uid())
      and moderation_status = 'visible'
      and partner_reply is null
      and partner_reply_at is null
      and exists (
        select 1 from public.orders o
        where o.id = reviews.order_id
          and o.client_id = (select auth.uid())
          and o.partner_id = reviews.partner_id
          and o.status = 'completed'
          and reviews.service_id is not distinct from o.service_id
      )
    )
  );

create policy "reviews partner reply or admin update"
  on public.reviews for update
  to authenticated
  using (
    lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
    or (partner_id = (select auth.uid()) and moderation_status = 'visible' and partner_reply is null)
  )
  with check (
    lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
    or (partner_id = (select auth.uid()) and moderation_status = 'visible')
  );

create policy "admins can delete reviews"
  on public.reviews for delete
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

drop policy if exists "users can report visible reviews" on public.review_reports;
drop policy if exists "users can read own review reports" on public.review_reports;
drop policy if exists "admins can manage review reports" on public.review_reports;
drop policy if exists "review reports select access" on public.review_reports;
drop policy if exists "review reports insert access" on public.review_reports;
drop policy if exists "admins can update review reports" on public.review_reports;
drop policy if exists "admins can delete review reports" on public.review_reports;

create policy "review reports insert access"
  on public.review_reports for insert
  to authenticated
  with check (
    lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
    or (
      reporter_id = (select auth.uid())
      and status = 'open'
      and resolution_note is null
      and resolved_at is null
      and exists (
        select 1 from public.reviews r
        where r.id = review_id and r.moderation_status = 'visible'
      )
    )
  );

create policy "review reports select access"
  on public.review_reports for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com')
  );

create policy "admins can update review reports"
  on public.review_reports for update
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "admins can delete review reports"
  on public.review_reports for delete
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create or replace view public.vw_profile_stats as
select
  p.id as profile_id,
  p.user_id,
  p.created_at as member_since,
  coalesce(p.projects, 0) + coalesce(portfolio_counts.portfolio_count, 0) as total_projects,
  coalesce(order_counts.active_orders, 0) as active_orders,
  coalesce(order_counts.completed_orders, 0) as completed_orders,
  coalesce(review_stats.avg_rating, p.rating, 0)::numeric(3,1) as avg_rating,
  coalesce(review_stats.reviews_count, 0)::integer as reviews_count,
  p.response_time_hours
from public.profiles p
left join (
  select profile_id, count(*)::integer as portfolio_count
  from public.profile_portfolio
  where is_published = true
  group by profile_id
) portfolio_counts on portfolio_counts.profile_id = p.id
left join (
  select
    partner_id as user_id,
    count(*) filter (where status in ('paid','in_progress','delivered'))::integer as active_orders,
    count(*) filter (where status = 'completed')::integer as completed_orders
  from public.orders
  group by partner_id
) order_counts on order_counts.user_id = p.user_id
left join (
  select
    partner_id as user_id,
    round(avg(rating_overall)::numeric, 1)::numeric(3,1) as avg_rating,
    count(*)::integer as reviews_count
  from public.reviews
  where moderation_status = 'visible'
  group by partner_id
) review_stats on review_stats.user_id = p.user_id;

alter view public.vw_profile_stats set (security_invoker = true);
grant select on public.vw_profile_stats to anon, authenticated;

create or replace view public.vw_admin_dashboard as
select
  (select count(*)::integer from public.accounts where created_at >= now() - interval '24 hours') as new_registrations_24h,
  (select count(*)::integer from public.accounts) as total_accounts,
  (select count(*)::integer from public.accounts where role = 'admin') as admin_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist') as specialist_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'pending') as pending_specialists,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'approved') as approved_specialists,
  (select count(*)::integer from public.accounts where account_status = 'banned') as banned_accounts,
  (select count(*)::integer from public.inquiries where status = 'new') as new_inquiries,
  (select count(*)::integer from public.inquiries where status in ('new','seen')) as open_inquiries,
  (select count(*)::integer from public.partner_applications where status = 'pending') as pending_applications,
  (select count(*)::integer from public.profiles where is_published = true) as published_profiles,
  (select count(*)::integer from public.profiles where is_published = false) as hidden_profiles,
  (select count(*)::integer from public.profile_portfolio) as portfolio_items,
  (select count(*)::integer from public.audit_log where created_at >= now() - interval '24 hours') as audit_events_24h,
  (select count(*)::integer from public.orders where status = 'disputed') as open_disputes,
  0::integer as pending_services,
  (select count(*)::integer from public.orders where status in ('pending_payment','disputed','refunded')) as payments_attention,
  (select count(*)::integer from public.orders where status = 'pending_payment') as pending_orders,
  (select count(*)::integer from public.orders where status in ('paid','in_progress','delivered')) as active_orders,
  (select count(*)::integer from public.orders where status = 'completed') as completed_orders,
  (select count(*)::integer from public.partner_services where is_published = true and moderation_status = 'approved') as published_services,
  (select count(*)::integer from public.review_reports where status = 'open') as open_review_reports,
  (select count(*)::integer from public.reviews where moderation_status = 'visible') as visible_reviews,
  (select count(*)::integer from public.reviews where moderation_status = 'hidden') as hidden_reviews;

alter view public.vw_admin_dashboard set (security_invoker = true);
grant select on public.vw_admin_dashboard to authenticated;

-- ============================================================================
-- PHASE 4 — Чат + оферти в чата
-- ============================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.client_projects(id) on delete set null,
  subject text,
  status text not null default 'open' check (status in ('open','closed','blocked')),
  last_message_at timestamptz,
  last_message_preview text,
  is_read_by_client boolean not null default true,
  is_read_by_partner boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> partner_id)
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.client_projects(id) on delete set null,
  title text not null,
  description text,
  deliverables jsonb not null default '[]'::jsonb,
  price_amount integer check (price_amount is null or price_amount >= 0),
  currency text not null default 'EUR',
  delivery_days integer check (delivery_days is null or delivery_days >= 0),
  revisions integer check (revisions is null or revisions >= 0),
  status text not null default 'sent' check (status in ('draft','sent','accepted','declined','withdrawn','expired')),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','offer','system','attachment')),
  body text,
  attachments jsonb not null default '[]'::jsonb,
  offer_id uuid references public.offers(id) on delete set null,
  was_masked boolean not null default false,
  created_at timestamptz not null default now()
);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_offers_updated_at on public.offers;
create trigger set_offers_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;

create index if not exists idx_conversations_client on public.conversations (client_id, last_message_at desc nulls last, created_at desc);
create index if not exists idx_conversations_partner on public.conversations (partner_id, last_message_at desc nulls last, created_at desc);
create index if not exists idx_conversations_project on public.conversations (project_id);
create unique index if not exists idx_conversations_active_unique
  on public.conversations (client_id, partner_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists idx_messages_sender_created on public.messages (sender_id, created_at desc);
create index if not exists idx_offers_conversation on public.offers (conversation_id, created_at desc);
create index if not exists idx_offers_status on public.offers (status);

drop policy if exists "participants can read conversations" on public.conversations;
drop policy if exists "participants can update conversations" on public.conversations;
drop policy if exists "admins can manage conversations" on public.conversations;
drop policy if exists "participants can read messages" on public.messages;
drop policy if exists "participants can update messages" on public.messages;
drop policy if exists "admins can manage messages" on public.messages;
drop policy if exists "participants can read offers" on public.offers;
drop policy if exists "clients can update own offers" on public.offers;
drop policy if exists "partners can update own offers" on public.offers;
drop policy if exists "admins can manage offers" on public.offers;

create policy "participants can read conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() in (client_id, partner_id));

create policy "participants can update conversations"
  on public.conversations for update
  to authenticated
  using (auth.uid() in (client_id, partner_id))
  with check (auth.uid() in (client_id, partner_id));

create policy "admins can manage conversations"
  on public.conversations for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "participants can update messages"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.client_id, c.partner_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.client_id, c.partner_id)
    )
  );

create policy "admins can manage messages"
  on public.messages for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "participants can read offers"
  on public.offers for select
  to authenticated
  using (auth.uid() in (client_id, partner_id));

create policy "clients can update own offers"
  on public.offers for update
  to authenticated
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "partners can update own offers"
  on public.offers for update
  to authenticated
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

create policy "admins can manage offers"
  on public.offers for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
end $$;

-- ============================================================================
-- PHASE 5 — Партньорски услуги / публикации
-- ============================================================================

create table if not exists public.partner_services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  layer_slug text not null,
  title text not null,
  subtitle text,
  description_md text,
  cover_url text,
  media jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  delivery_areas text[] not null default '{}'::text[],
  is_published boolean not null default false,
  moderation_status text not null default 'draft' check (moderation_status in ('draft','pending','approved','rejected')),
  moderation_note text
);

create table if not exists public.partner_service_packages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_id uuid not null references public.partner_services(id) on delete cascade,
  tier text not null check (tier in ('basic','standard','premium')),
  title text not null,
  description text,
  features jsonb not null default '[]'::jsonb,
  price_amount integer,
  currency text not null default 'EUR',
  delivery_days integer,
  revisions integer,
  is_active boolean not null default true,
  unique (service_id, tier)
);

create table if not exists public.partner_service_faq (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_id uuid not null references public.partner_services(id) on delete cascade,
  question text not null,
  answer text not null,
  order_index integer not null default 0
);

drop trigger if exists set_partner_services_updated_at on public.partner_services;
create trigger set_partner_services_updated_at
before update on public.partner_services
for each row execute function public.set_updated_at();

drop trigger if exists set_partner_service_packages_updated_at on public.partner_service_packages;
create trigger set_partner_service_packages_updated_at
before update on public.partner_service_packages
for each row execute function public.set_updated_at();

drop trigger if exists set_partner_service_faq_updated_at on public.partner_service_faq;
create trigger set_partner_service_faq_updated_at
before update on public.partner_service_faq
for each row execute function public.set_updated_at();

alter table public.partner_services enable row level security;
alter table public.partner_service_packages enable row level security;
alter table public.partner_service_faq enable row level security;

create table if not exists public.app_private_secrets (
  name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_app_private_secrets_updated_at on public.app_private_secrets;
create trigger set_app_private_secrets_updated_at
before update on public.app_private_secrets
for each row execute function public.set_updated_at();

alter table public.app_private_secrets enable row level security;
revoke all on public.app_private_secrets from anon, authenticated;
drop policy if exists "clients cannot read private secrets" on public.app_private_secrets;
create policy "clients cannot read private secrets"
  on public.app_private_secrets for select
  to anon, authenticated
  using (false);

create index if not exists idx_partner_services_public on public.partner_services (is_published, moderation_status, layer_slug, created_at desc);
create index if not exists idx_partner_services_partner on public.partner_services (partner_id, created_at desc);
create index if not exists idx_partner_services_profile on public.partner_services (profile_id, created_at desc);
create index if not exists idx_partner_service_packages_service on public.partner_service_packages (service_id, tier);
create index if not exists idx_partner_service_faq_service on public.partner_service_faq (service_id, order_index);

create or replace function public.profile_belongs_to_current_user(check_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = check_profile_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.partner_service_belongs_to_current_user(check_service_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.partner_services s
    where s.id = check_service_id and s.partner_id = (select auth.uid())
  );
$$;

create or replace function public.partner_service_is_public(check_service_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.partner_services s
    where s.id = check_service_id and s.is_published = true and s.moderation_status = 'approved'
  );
$$;

grant execute on function public.profile_belongs_to_current_user(uuid) to authenticated;
grant execute on function public.partner_service_belongs_to_current_user(uuid) to authenticated;
grant execute on function public.partner_service_is_public(uuid) to anon, authenticated;
drop function if exists public.profile_belongs_to_user(uuid, uuid);
drop function if exists public.partner_service_belongs_to_user(uuid, uuid);

drop policy if exists "public can read approved partner services" on public.partner_services;
drop policy if exists "owners can read own partner services" on public.partner_services;
drop policy if exists "owners can insert own partner services" on public.partner_services;
drop policy if exists "owners can update own partner services" on public.partner_services;
drop policy if exists "owners can delete own partner services" on public.partner_services;
drop policy if exists "admins can manage partner services" on public.partner_services;

create policy "public can read approved partner services"
  on public.partner_services for select
  to anon, authenticated
  using (is_published = true and moderation_status = 'approved');

drop policy if exists "public can read profiles with approved services" on public.profiles;

create policy "owners can read own partner services"
  on public.partner_services for select
  to authenticated
  using (partner_id = (select auth.uid()));

create policy "owners can insert own partner services"
  on public.partner_services for insert
  to authenticated
  with check (
    partner_id = (select auth.uid())
    and moderation_status in ('draft','approved')
    and is_published = (moderation_status = 'approved')
    and public.profile_belongs_to_current_user(profile_id)
  );

create policy "owners can update own partner services"
  on public.partner_services for update
  to authenticated
  using (partner_id = (select auth.uid()))
  with check (
    partner_id = (select auth.uid())
    and moderation_status in ('draft','approved')
    and is_published = (moderation_status = 'approved')
    and public.profile_belongs_to_current_user(profile_id)
  );

create policy "owners can delete own partner services"
  on public.partner_services for delete
  to authenticated
  using (partner_id = (select auth.uid()));

create policy "admins can manage partner services"
  on public.partner_services for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

drop policy if exists "public can read approved partner service packages" on public.partner_service_packages;
drop policy if exists "owners can manage own partner service packages" on public.partner_service_packages;
drop policy if exists "admins can manage partner service packages" on public.partner_service_packages;

create policy "public can read approved partner service packages"
  on public.partner_service_packages for select
  to anon, authenticated
  using (public.partner_service_is_public(service_id));

create policy "owners can manage own partner service packages"
  on public.partner_service_packages for all
  to authenticated
  using (public.partner_service_belongs_to_current_user(service_id))
  with check (public.partner_service_belongs_to_current_user(service_id));

create policy "admins can manage partner service packages"
  on public.partner_service_packages for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

drop policy if exists "public can read approved partner service faq" on public.partner_service_faq;
drop policy if exists "owners can manage own partner service faq" on public.partner_service_faq;
drop policy if exists "admins can manage partner service faq" on public.partner_service_faq;

create policy "public can read approved partner service faq"
  on public.partner_service_faq for select
  to anon, authenticated
  using (public.partner_service_is_public(service_id));

create policy "owners can manage own partner service faq"
  on public.partner_service_faq for all
  to authenticated
  using (public.partner_service_belongs_to_current_user(service_id))
  with check (public.partner_service_belongs_to_current_user(service_id));

create policy "admins can manage partner service faq"
  on public.partner_service_faq for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

insert into storage.buckets (id, name, public)
values ('service-media', 'service-media', true)
on conflict (id) do update set public = excluded.public;

create or replace view public.vw_admin_dashboard as
select
  (select count(*)::integer from public.accounts where created_at >= now() - interval '24 hours') as new_registrations_24h,
  (select count(*)::integer from public.accounts) as total_accounts,
  (select count(*)::integer from public.accounts where role = 'admin') as admin_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist') as specialist_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'pending') as pending_specialists,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'approved') as approved_specialists,
  (select count(*)::integer from public.accounts where account_status = 'banned') as banned_accounts,
  (select count(*)::integer from public.inquiries where status = 'new') as new_inquiries,
  (select count(*)::integer from public.inquiries where status in ('new','seen')) as open_inquiries,
  (select count(*)::integer from public.partner_applications where status = 'pending') as pending_applications,
  (select count(*)::integer from public.profiles where is_published = true) as published_profiles,
  (select count(*)::integer from public.profiles where is_published = false) as hidden_profiles,
  (select count(*)::integer from public.profile_portfolio) as portfolio_items,
  (select count(*)::integer from public.audit_log where created_at >= now() - interval '24 hours') as audit_events_24h,
  0::integer as open_disputes,
  0::integer as pending_services,
  0::integer as payments_attention,
  (select count(*)::integer from public.partner_services where is_published = true and moderation_status = 'approved') as published_services;

alter view public.vw_admin_dashboard set (security_invoker = true);
grant select on public.vw_admin_dashboard to authenticated;

-- ============================================================================
-- PHASE 6 — Поръчки и плащания (Stripe sandbox + mock fallback)
-- ============================================================================

alter table public.accounts
  add column if not exists stripe_account_id text;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  service_id uuid references public.partner_services(id) on delete set null,
  service_package_id uuid references public.partner_service_packages(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  title text not null,
  description text,
  deliverables jsonb not null default '[]'::jsonb,
  amount_total integer not null check (amount_total >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  partner_payout integer not null default 0 check (partner_payout >= 0),
  currency text not null default 'EUR',
  payment_provider text not null default 'stripe' check (payment_provider in ('mock','stripe')),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','in_progress','delivered','completed','disputed','refunded','cancelled')),
  delivery_due_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_transfer_id text
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  from_status text,
  to_status text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null check (type in ('charge','payout','refund')),
  provider text not null default 'stripe' check (provider in ('mock','stripe')),
  amount integer not null check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_transactions enable row level security;

create index if not exists idx_orders_client on public.orders (client_id, created_at desc);
create index if not exists idx_orders_partner on public.orders (partner_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at desc);
create index if not exists idx_orders_conversation on public.orders (conversation_id, created_at desc);
create index if not exists idx_orders_service on public.orders (service_id, service_package_id);
create index if not exists idx_orders_offer on public.orders (offer_id);
create unique index if not exists idx_orders_active_offer_unique on public.orders (offer_id) where offer_id is not null and status <> 'cancelled';
create unique index if not exists idx_orders_stripe_session_unique on public.orders (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index if not exists idx_order_events_order on public.order_events (order_id, created_at desc);
create index if not exists idx_payment_transactions_order on public.payment_transactions (order_id, created_at desc);

drop policy if exists "participants can read orders" on public.orders;
drop policy if exists "admins can manage orders" on public.orders;
drop policy if exists "participants can read order events" on public.order_events;
drop policy if exists "admins can manage order events" on public.order_events;
drop policy if exists "participants can read payment transactions" on public.payment_transactions;
drop policy if exists "admins can manage payment transactions" on public.payment_transactions;

create policy "participants can read orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) in (client_id, partner_id));

create policy "admins can manage orders"
  on public.orders for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "participants can read order events"
  on public.order_events for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (select auth.uid()) in (o.client_id, o.partner_id)
  ));

create policy "admins can manage order events"
  on public.order_events for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

create policy "participants can read payment transactions"
  on public.payment_transactions for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (select auth.uid()) in (o.client_id, o.partner_id)
  ));

create policy "admins can manage payment transactions"
  on public.payment_transactions for all
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'))
  with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) in ('a.mitkov@totsan.com', 'manager@totsan.com'));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events') then
    alter publication supabase_realtime add table public.order_events;
  end if;
end $$;

create or replace view public.vw_profile_stats as
select
  p.id as profile_id,
  p.user_id,
  p.created_at as member_since,
  coalesce(p.projects, 0) + coalesce(portfolio_counts.portfolio_count, 0) as total_projects,
  coalesce(order_counts.active_orders, 0) as active_orders,
  coalesce(order_counts.completed_orders, 0) as completed_orders,
  coalesce(p.rating, 0)::numeric(3,1) as avg_rating,
  0::integer as reviews_count,
  p.response_time_hours
from public.profiles p
left join (
  select profile_id, count(*)::integer as portfolio_count
  from public.profile_portfolio
  where is_published = true
  group by profile_id
) portfolio_counts on portfolio_counts.profile_id = p.id
left join (
  select
    partner_id as user_id,
    count(*) filter (where status in ('paid','in_progress','delivered'))::integer as active_orders,
    count(*) filter (where status = 'completed')::integer as completed_orders
  from public.orders
  group by partner_id
) order_counts on order_counts.user_id = p.user_id;

alter view public.vw_profile_stats set (security_invoker = true);

create or replace view public.vw_admin_dashboard as
select
  (select count(*)::integer from public.accounts where created_at >= now() - interval '24 hours') as new_registrations_24h,
  (select count(*)::integer from public.accounts) as total_accounts,
  (select count(*)::integer from public.accounts where role = 'admin') as admin_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist') as specialist_accounts,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'pending') as pending_specialists,
  (select count(*)::integer from public.accounts where role = 'specialist' and specialist_status = 'approved') as approved_specialists,
  (select count(*)::integer from public.accounts where account_status = 'banned') as banned_accounts,
  (select count(*)::integer from public.inquiries where status = 'new') as new_inquiries,
  (select count(*)::integer from public.inquiries where status in ('new','seen')) as open_inquiries,
  (select count(*)::integer from public.partner_applications where status = 'pending') as pending_applications,
  (select count(*)::integer from public.profiles where is_published = true) as published_profiles,
  (select count(*)::integer from public.profiles where is_published = false) as hidden_profiles,
  (select count(*)::integer from public.profile_portfolio) as portfolio_items,
  (select count(*)::integer from public.audit_log where created_at >= now() - interval '24 hours') as audit_events_24h,
  (select count(*)::integer from public.orders where status = 'disputed') as open_disputes,
  0::integer as pending_services,
  (select count(*)::integer from public.orders where status in ('pending_payment','disputed','refunded')) as payments_attention,
  (select count(*)::integer from public.orders where status = 'pending_payment') as pending_orders,
  (select count(*)::integer from public.orders where status in ('paid','in_progress','delivered')) as active_orders,
  (select count(*)::integer from public.orders where status = 'completed') as completed_orders,
  (select count(*)::integer from public.partner_services where is_published = true and moderation_status = 'approved') as published_services;

alter view public.vw_admin_dashboard set (security_invoker = true);
grant select on public.vw_admin_dashboard to authenticated;
