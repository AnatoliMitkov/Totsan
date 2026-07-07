create or replace function public.get_chat_project_context(p_conversation_ids uuid[])
returns table (
  conversation_id uuid,
  project_id uuid,
  share_id uuid,
  title text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    c.id as conversation_id,
    cp.id as project_id,
    cp.public_share_id as share_id,
    cp.title
  from public.conversations c
  join public.client_projects cp on cp.id = c.project_id
  where c.id = any(coalesce(p_conversation_ids, array[]::uuid[]))
    and auth.uid() in (c.client_id, c.partner_id)
    and cp.is_active = true;
end;
$$;

revoke execute on function public.get_chat_project_context(uuid[]) from public, anon;
grant execute on function public.get_chat_project_context(uuid[]) to authenticated;

alter table public.offers
  add column if not exists offer_type text not null default 'final',
  add column if not exists summary text,
  add column if not exists price_type text not null default 'fixed',
  add column if not exists offer_details jsonb not null default '{}'::jsonb;

alter table public.offers
  drop constraint if exists offers_offer_type_check,
  add constraint offers_offer_type_check check (offer_type in ('final','estimate','staged'));

alter table public.offers
  drop constraint if exists offers_price_type_check,
  add constraint offers_price_type_check check (price_type in ('fixed','estimate','hourly','staged'));

alter table public.offers
  drop constraint if exists offers_status_check,
  add constraint offers_status_check check (status in ('draft','sent','viewed','question','accepted','declined','withdrawn','expired','change_requested'));

create or replace function public.get_shared_client_project(p_share_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.client_projects;
  v_account public.accounts;
  v_media json;
begin
  select * into v_project
  from public.client_projects cp
  where cp.public_share_id = p_share_id
    and cp.is_active = true
    and (
      cp.is_shareable = true
      or exists (
        select 1
        from public.conversations c
        where c.project_id = cp.id
          and auth.uid() in (c.client_id, c.partner_id)
      )
    )
  limit 1;

  if v_project.id is null then
    return null;
  end if;

  select * into v_account
  from public.accounts
  where id = v_project.user_id;

  select json_agg(
    json_build_object(
      'id', m.id,
      'project_id', m.project_id,
      'bucket', m.bucket,
      'path', m.path,
      'public_url', m.public_url,
      'kind', m.kind,
      'caption', m.caption,
      'order_index', m.order_index,
      'created_at', m.created_at
    )
    order by m.order_index, m.created_at
  ) into v_media
  from public.client_project_media m
  where m.project_id = v_project.id;

  return json_build_object(
    'project', json_build_object(
      'id', v_project.id,
      'user_id', v_project.user_id,
      'title', v_project.title,
      'property_type', v_project.property_type,
      'area_sqm', v_project.area_sqm,
      'rooms_count', v_project.rooms_count,
      'address_city', v_project.address_city,
      'address_region', v_project.address_region,
      'current_layer_slug', v_project.current_layer_slug,
      'desired_start_date', v_project.desired_start_date,
      'desired_end_date', v_project.desired_end_date,
      'budget_min', v_project.budget_min,
      'budget_max', v_project.budget_max,
      'budget_currency', v_project.budget_currency,
      'idea_description', v_project.idea_description,
      'quiz_answers', public.project_public_quiz_answers(v_project.quiz_answers),
      'is_active', v_project.is_active,
      'public_share_id', v_project.public_share_id,
      'is_shareable', v_project.is_shareable,
      'created_at', v_project.created_at,
      'updated_at', v_project.updated_at
    ),
    'account', json_build_object(
      'full_name', v_account.full_name,
      'display_name', v_account.display_name,
      'avatar_url', v_account.avatar_url,
      'city', v_account.city,
      'bio', v_account.bio,
      'interests', v_account.interests,
      'style_preferences', v_account.style_preferences
    ),
    'media', coalesce(v_media, '[]'::json)
  );
end;
$$;

revoke execute on function public.get_shared_client_project(uuid) from public;
grant execute on function public.get_shared_client_project(uuid) to anon, authenticated;
