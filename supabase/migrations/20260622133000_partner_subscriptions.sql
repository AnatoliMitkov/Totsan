-- Partner Subscription v1: paid Stripe Billing access + manual founding campaign access.

create table if not exists public.partner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_profile_id uuid references public.profiles(id) on delete set null,
  plan_key text not null default 'active_partner_monthly',
  billing_interval text not null default 'monthly',
  status text not null default 'inactive' check (status in ('inactive','founding_free','trialing','active','past_due','canceled','expired')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_checkout_session_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  campaign_start timestamptz,
  campaign_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_partner_subscriptions_updated_at on public.partner_subscriptions;
create trigger set_partner_subscriptions_updated_at
before update on public.partner_subscriptions
for each row execute function public.set_updated_at();

alter table public.partner_subscriptions enable row level security;

create index if not exists idx_partner_subscriptions_user on public.partner_subscriptions (user_id, created_at desc);
create index if not exists idx_partner_subscriptions_profile on public.partner_subscriptions (partner_profile_id);
create index if not exists idx_partner_subscriptions_status on public.partner_subscriptions (status);
create index if not exists idx_partner_subscriptions_period_end on public.partner_subscriptions (current_period_end);
create unique index if not exists idx_partner_subscriptions_stripe_subscription
  on public.partner_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
create unique index if not exists idx_partner_subscriptions_checkout_session
  on public.partner_subscriptions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

drop policy if exists "users can read own partner subscriptions" on public.partner_subscriptions;
drop policy if exists "admins can manage partner subscriptions" on public.partner_subscriptions;

create policy "users can read own partner subscriptions"
  on public.partner_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "admins can manage partner subscriptions"
  on public.partner_subscriptions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.has_active_partner_access(check_user_id uuid, check_profile_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_subscriptions ps
    where ps.user_id = check_user_id
      and (
        check_profile_id is null
        or ps.partner_profile_id is null
        or ps.partner_profile_id = check_profile_id
      )
      and (
        (ps.status = 'founding_free' and ps.campaign_end > now())
        or (ps.status = 'trialing' and coalesce(ps.trial_end, ps.current_period_end) > now())
        or (ps.status = 'active' and (ps.current_period_end is null or ps.current_period_end > now()))
      )
  );
$$;

grant execute on function public.has_active_partner_access(uuid, uuid) to anon, authenticated;

create or replace function public.admin_grant_partner_campaign_access(
  p_user_id uuid,
  p_partner_profile_id uuid default null,
  p_campaign_start timestamptz default now()
)
returns public.partner_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := p_partner_profile_id;
  v_campaign_start timestamptz := coalesce(p_campaign_start, now());
  v_row public.partner_subscriptions;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_user_id is null then
    raise exception 'Partner user id is required.';
  end if;

  select *
    into v_row
  from public.partner_subscriptions
  where user_id = p_user_id
    and status = 'founding_free'
    and campaign_start is not null
  order by created_at asc
  limit 1;

  if found then
    return v_row;
  end if;

  if v_profile_id is null then
    select id
      into v_profile_id
    from public.profiles
    where user_id = p_user_id
    order by created_at asc
    limit 1;
  end if;

  insert into public.partner_subscriptions (
    user_id,
    partner_profile_id,
    plan_key,
    billing_interval,
    status,
    campaign_start,
    campaign_end,
    metadata
  )
  values (
    p_user_id,
    v_profile_id,
    'active_partner_monthly',
    'campaign',
    'founding_free',
    v_campaign_start,
    v_campaign_start + interval '6 months',
    jsonb_build_object('source', 'admin_campaign_grant', 'deadline', '2026-07-31')
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_grant_partner_campaign_access(uuid, uuid, timestamptz) to authenticated;

create or replace function public.partner_service_is_public(check_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_services s
    join public.profiles p on p.id = s.profile_id
    where s.id = check_service_id
      and s.is_published = true
      and s.moderation_status = 'approved'
      and p.is_published = true
      and public.has_active_partner_access(p.user_id, p.id)
  );
$$;

grant execute on function public.partner_service_is_public(uuid) to anon, authenticated;

drop policy if exists "public can read published profiles" on public.profiles;
drop policy if exists "public can read profiles with approved services" on public.profiles;

create policy "public can read published profiles"
  on public.profiles for select
  to anon, authenticated
  using (
    is_published = true
    and user_id is not null
    and public.has_active_partner_access(user_id, id)
  );

create policy "public can read profiles with approved services"
  on public.profiles for select
  to anon, authenticated
  using (
    is_published = true
    and user_id is not null
    and public.has_active_partner_access(user_id, id)
  );

drop policy if exists "public can read approved partner services" on public.partner_services;

create policy "public can read approved partner services"
  on public.partner_services for select
  to anon, authenticated
  using (
    is_published = true
    and moderation_status = 'approved'
    and exists (
      select 1
      from public.profiles p
      where p.id = partner_services.profile_id
        and p.is_published = true
        and public.has_active_partner_access(p.user_id, p.id)
    )
  );

drop policy if exists "anon can insert inquiries" on public.inquiries;

create policy "anon can insert inquiries"
  on public.inquiries for insert
  to anon, authenticated
  with check (
    nullif(trim(coalesce(target_slug, '')), '') is null
    or exists (
      select 1
      from public.profiles p
      where p.slug = inquiries.target_slug
        and p.is_published = true
        and public.has_active_partner_access(p.user_id, p.id)
    )
    or exists (
      select 1
      from public.partner_services s
      join public.profiles p on p.id = s.profile_id
      where s.slug = inquiries.target_slug
        and s.is_published = true
        and s.moderation_status = 'approved'
        and p.is_published = true
        and public.has_active_partner_access(p.user_id, p.id)
    )
  );
