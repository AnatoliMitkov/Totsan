create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  service_id uuid not null references public.partner_services(id) on delete cascade,
  service_package_id uuid references public.partner_service_packages(id) on delete set null,
  client_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'negotiating', 'declined', 'converted', 'cancelled')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> partner_id)
);

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
before update on public.service_requests
for each row execute function public.set_updated_at();

alter table public.service_requests enable row level security;

create index if not exists idx_service_requests_conversation
  on public.service_requests (conversation_id, created_at desc);
create index if not exists idx_service_requests_participants
  on public.service_requests (client_id, partner_id, status);
create unique index if not exists idx_service_requests_one_active_per_conversation
  on public.service_requests (conversation_id)
  where status in ('requested', 'negotiating');

drop policy if exists service_request_participants_read on public.service_requests;
drop policy if exists admins_manage_service_requests on public.service_requests;

create policy service_request_participants_read
  on public.service_requests for select
  to authenticated
  using ((select auth.uid()) in (client_id, partner_id));

create policy admins_manage_service_requests
  on public.service_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.messages
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'offer', 'system', 'attachment', 'service_request'));

create index if not exists idx_messages_service_request
  on public.messages (service_request_id)
  where service_request_id is not null;

alter table public.offers
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null,
  add column if not exists service_id uuid references public.partner_services(id) on delete set null,
  add column if not exists service_package_id uuid references public.partner_service_packages(id) on delete set null;

create index if not exists idx_offers_service_request
  on public.offers (service_request_id)
  where service_request_id is not null;

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
  if v_offer.service_request_id is null then
    raise exception 'Офертата не е свързана със заявка за услуга.';
  end if;

  v_amount := greatest(0, coalesce(v_offer.price_amount, 0));
  if v_amount = 0 then
    raise exception 'Финалната оферта трябва да има цена преди приемане.';
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
      status,
      delivery_due_at
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
      0,
      v_amount,
      v_offer.currency,
      'mock',
      'pending_payment',
      case
        when coalesce(v_offer.delivery_days, 0) > 0
          then now() + make_interval(days => v_offer.delivery_days)
        else null
      end
    )
    returning * into v_order;

    insert into public.order_events (
      order_id,
      actor_id,
      type,
      from_status,
      to_status,
      message,
      payload
    )
    values (
      v_order.id,
      p_client_id,
      'offer_accepted',
      null,
      'pending_payment',
      'Клиентът прие финалната оферта. Поръчката очаква директно плащане към партньора.',
      jsonb_build_object('service_request_id', v_offer.service_request_id)
    );
  end if;

  update public.offers
  set status = 'accepted',
      accepted_at = now()
  where id = v_offer.id
  returning * into v_offer;

  update public.service_requests
  set status = 'converted'
  where id = v_offer.service_request_id;

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
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end $$;
