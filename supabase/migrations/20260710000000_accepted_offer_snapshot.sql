-- Offer lifecycle v2: immutable agreement snapshots and executable milestones.

alter table public.offers
  add column if not exists accepted_offer_snapshot jsonb;

alter table public.orders
  add column if not exists accepted_offer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists payment_method text not null default 'platform';

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('platform', 'staged_platform', 'custom'));

alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('mock', 'stripe', 'manual'));

alter table public.payment_transactions drop constraint if exists payment_transactions_provider_check;
alter table public.payment_transactions
  add constraint payment_transactions_provider_check
  check (provider in ('mock', 'stripe', 'manual'));

create table if not exists public.order_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  position integer not null check (position > 0),
  title text not null,
  description text,
  amount integer not null check (amount >= 0),
  currency text not null default 'EUR',
  duration_days integer check (duration_days is null or duration_days >= 0),
  start_condition text,
  payment_note text,
  status text not null default 'pending'
    check (status in (
      'pending', 'ready', 'in_progress', 'submitted', 'revision_requested',
      'accepted', 'payment_pending', 'paid', 'disputed', 'cancelled'
    )),
  evidence jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  due_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, position)
);

drop trigger if exists set_order_milestones_updated_at on public.order_milestones;
create trigger set_order_milestones_updated_at
before update on public.order_milestones
for each row execute function public.set_updated_at();

alter table public.order_milestones enable row level security;

create index if not exists idx_order_milestones_order
  on public.order_milestones (order_id, position);
create index if not exists idx_order_milestones_status
  on public.order_milestones (status, created_at);
create unique index if not exists idx_order_milestones_checkout_session
  on public.order_milestones (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

drop policy if exists participants_read_order_milestones on public.order_milestones;
create policy participants_read_order_milestones
  on public.order_milestones for select
  to authenticated
  using (exists (
    select 1
    from public.orders o
    where o.id = order_id
      and auth.uid() in (o.client_id, o.partner_id)
  ));

drop policy if exists admins_manage_order_milestones on public.order_milestones;
create policy admins_manage_order_milestones
  on public.order_milestones for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.order_events
  add column if not exists milestone_id uuid references public.order_milestones(id) on delete set null;

alter table public.payment_transactions
  add column if not exists milestone_id uuid references public.order_milestones(id) on delete set null;

create index if not exists idx_order_events_milestone
  on public.order_events (milestone_id, created_at desc)
  where milestone_id is not null;
create index if not exists idx_payment_transactions_milestone
  on public.payment_transactions (milestone_id, created_at desc)
  where milestone_id is not null;

create or replace function public.accept_service_offer(
  p_offer_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_order public.orders%rowtype;
  v_amount integer;
  v_stage_total integer := 0;
  v_snapshot jsonb;
  v_details jsonb;
  v_stages jsonb;
  v_payment_method text;
  v_accepted_at timestamptz := now();
begin
  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if v_offer.id is null then
    raise exception 'Офертата не беше намерена.';
  end if;
  if v_offer.client_id <> p_client_id then
    raise exception 'Само клиентът може да приеме офертата.';
  end if;
  if v_offer.status <> 'sent' then
    raise exception 'Офертата вече е обработена.';
  end if;
  if v_offer.offer_type = 'estimate' then
    raise exception 'Предварителната оценка трябва да бъде заменена с финална или поетапна оферта преди приемане.';
  end if;

  v_amount := greatest(0, coalesce(v_offer.price_amount, 0));
  if v_amount = 0 and v_offer.offer_type <> 'estimate' then
    raise exception 'Офертата трябва да има цена преди приемане.';
  end if;

  v_details := coalesce(v_offer.offer_details, '{}'::jsonb);
  v_stages := coalesce(v_offer.stages, v_details->'stages', '[]'::jsonb);
  v_payment_method := coalesce(
    nullif(v_details #>> '{payment,method}', ''),
    case when v_offer.offer_type = 'staged' then 'staged_platform' else 'platform' end
  );
  if v_payment_method not in ('platform', 'staged_platform', 'custom') then
    v_payment_method := case when v_offer.offer_type = 'staged' then 'staged_platform' else 'platform' end;
  end if;

  v_snapshot := v_details || jsonb_build_object(
    'schemaVersion', 2,
    'offerId', v_offer.id,
    'conversationId', v_offer.conversation_id,
    'projectId', v_offer.project_id,
    'serviceRequestId', v_offer.service_request_id,
    'serviceId', v_offer.service_id,
    'servicePackageId', v_offer.service_package_id,
    'partnerId', v_offer.partner_id,
    'clientId', v_offer.client_id,
    'title', v_offer.title,
    'offerType', v_offer.offer_type,
    'priceType', v_offer.price_type,
    'summary', coalesce(v_offer.summary, v_details->>'summary', v_offer.description, ''),
    'description', coalesce(v_offer.description, v_offer.summary, ''),
    'priceAmount', v_amount,
    'currency', v_offer.currency,
    'deliveryDays', coalesce(v_offer.delivery_days, 0),
    'deliverables', coalesce(v_offer.deliverables, '[]'::jsonb),
    'includedItems', coalesce(v_details->'includedItems', v_offer.deliverables, '[]'::jsonb),
    'excludedItems', coalesce(v_details->'excludedItems', v_details->'notIncluded', '[]'::jsonb),
    'clientRequirements', coalesce(v_details->'clientRequirements', v_details->'clientProvides', '[]'::jsonb),
    'validUntil', coalesce(v_details->>'validUntil', v_offer.expires_at::text, ''),
    'acceptedAt', v_accepted_at,
    'executionMode', v_offer.execution_mode,
    'stages', v_stages,
    'payment', coalesce(v_details->'payment', '{}'::jsonb) || jsonb_build_object('method', v_payment_method)
  );

  if v_offer.offer_type = 'staged' then
    if jsonb_array_length(v_stages) < 2 then
      raise exception 'Поетапната оферта трябва да има поне два етапа.';
    end if;

    select coalesce(sum(greatest(0, round(coalesce(nullif(stage->>'priceAmount', ''), '0')::numeric)::integer)), 0)
    into v_stage_total
    from jsonb_array_elements(v_stages) as stage;

    if v_stage_total <> v_amount then
      raise exception 'Сборът на етапите трябва да е равен на общата цена.';
    end if;
  end if;

  select *
  into v_order
  from public.orders
  where offer_id = v_offer.id
    and status <> 'cancelled'
  limit 1;

  if v_order.id is null then
    insert into public.orders (
      client_id,
      partner_id,
      conversation_id,
      service_id,
      service_package_id,
      offer_id,
      title,
      description,
      deliverables,
      amount_total,
      platform_fee,
      partner_payout,
      currency,
      payment_provider,
      payment_method,
      status,
      delivery_due_at,
      accepted_offer_snapshot
    )
    values (
      v_offer.client_id,
      v_offer.partner_id,
      v_offer.conversation_id,
      v_offer.service_id,
      v_offer.service_package_id,
      v_offer.id,
      v_offer.title,
      v_offer.description,
      coalesce(v_offer.deliverables, '[]'::jsonb),
      v_amount,
      case when v_payment_method = 'custom' then 0 else round(v_amount * 0.02)::integer end,
      case when v_payment_method = 'custom' then v_amount else v_amount - round(v_amount * 0.02)::integer end,
      v_offer.currency,
      case when v_payment_method = 'custom' then 'manual' else 'stripe' end,
      v_payment_method,
      'pending_payment',
      case
        when coalesce(v_offer.delivery_days, 0) > 0
          then v_accepted_at + make_interval(days => v_offer.delivery_days)
        else null
      end,
      v_snapshot
    )
    returning * into v_order;

    insert into public.order_events (
      order_id, actor_id, type, from_status, to_status, message, payload
    )
    values (
      v_order.id,
      p_client_id,
      'offer_accepted',
      null,
      'pending_payment',
      'Клиентът прие офертата. Поръчката очаква плащане според договорения метод.',
      jsonb_strip_nulls(jsonb_build_object(
        'service_request_id', v_offer.service_request_id,
        'offer_snapshot_version', 2,
        'payment_method', v_payment_method
      ))
    );
  else
    update public.orders
    set accepted_offer_snapshot = case
          when accepted_offer_snapshot = '{}'::jsonb then v_snapshot
          else accepted_offer_snapshot
        end,
        payment_method = v_payment_method
    where id = v_order.id
    returning * into v_order;
  end if;

  if v_offer.offer_type = 'staged' then
    insert into public.order_milestones (
      order_id,
      offer_id,
      position,
      title,
      description,
      amount,
      currency,
      duration_days,
      start_condition,
      payment_note,
      status
    )
    select
      v_order.id,
      v_offer.id,
      coalesce(nullif(stage->>'order', '')::integer, ordinality::integer),
      coalesce(nullif(stage->>'title', ''), 'Етап ' || ordinality),
      nullif(stage->>'description', ''),
      greatest(0, round(coalesce(nullif(stage->>'priceAmount', ''), '0')::numeric)::integer),
      v_offer.currency,
      greatest(0, round(coalesce(nullif(stage->>'durationDays', ''), '0')::numeric)::integer),
      nullif(stage->>'startCondition', ''),
      nullif(stage->>'payment', ''),
      case when ordinality = 1 then 'ready' else 'pending' end
    from jsonb_array_elements(v_stages) with ordinality as items(stage, ordinality)
    on conflict (order_id, position) do nothing;
  end if;

  update public.offers
  set status = 'accepted',
      accepted_at = v_accepted_at,
      accepted_offer_snapshot = v_snapshot
  where id = v_offer.id
  returning * into v_offer;

  if v_offer.service_request_id is not null then
    update public.service_requests
    set status = 'converted'
    where id = v_offer.service_request_id;
  end if;

  return jsonb_build_object(
    'offer', to_jsonb(v_offer),
    'order', to_jsonb(v_order)
  );
end;
$$;

revoke all on function public.accept_service_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_service_offer(uuid, uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_milestones'
  ) then
    alter publication supabase_realtime add table public.order_milestones;
  end if;
end $$;
