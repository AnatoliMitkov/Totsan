alter table public.conversations
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_after timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_conversations_not_deleted_client
  on public.conversations (client_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_conversations_not_deleted_partner
  on public.conversations (partner_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_conversations_delete_after
  on public.conversations (delete_after)
  where deleted_at is not null;

create or replace function public.delete_conversation_for_everyone(p_conversation_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  if auth.uid() is null or p_conversation_id is null then
    raise exception 'Conversation access denied.';
  end if;

  select * into v_conversation
  from public.conversations c
  where c.id = p_conversation_id
    and auth.uid() in (c.client_id, c.partner_id)
  limit 1;

  if v_conversation.id is null then
    raise exception 'Conversation access denied.';
  end if;

  update public.conversations
  set
    status = 'closed',
    hidden_by_client_at = coalesce(hidden_by_client_at, now()),
    hidden_by_partner_at = coalesce(hidden_by_partner_at, now()),
    deleted_at = coalesce(deleted_at, now()),
    delete_after = coalesce(delete_after, now() + interval '21 days'),
    deleted_by = coalesce(deleted_by, auth.uid()),
    updated_at = now()
  where id = p_conversation_id
  returning * into v_conversation;

  return v_conversation;
end;
$$;

revoke execute on function public.delete_conversation_for_everyone(uuid) from public, anon;
grant execute on function public.delete_conversation_for_everyone(uuid) to authenticated;

create or replace function public.cleanup_deleted_conversations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
begin
  delete from public.conversations
  where deleted_at is not null
    and delete_after is not null
    and delete_after <= now();

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke execute on function public.cleanup_deleted_conversations() from public, anon, authenticated;

create or replace function public.handle_conversation_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set hidden_by_client_at = null,
      hidden_by_partner_at = null
  where id = new.conversation_id
    and deleted_at is null;
  return new;
end;
$$;

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
    and c.deleted_at is null
    and cp.is_active = true;
end;
$$;

revoke execute on function public.get_chat_project_context(uuid[]) from public, anon;
grant execute on function public.get_chat_project_context(uuid[]) to authenticated;

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
          and c.deleted_at is null
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

create or replace function public.get_chat_client_profile(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_account public.accounts;
  v_project public.client_projects;
  v_media jsonb;
begin
  if auth.uid() is null or p_conversation_id is null then
    return null;
  end if;

  select * into v_conversation
  from public.conversations c
  where c.id = p_conversation_id
    and c.partner_id = auth.uid()
    and c.deleted_at is null
  limit 1;

  if v_conversation.id is null then
    return null;
  end if;

  select * into v_account
  from public.accounts a
  where a.id = v_conversation.client_id
  limit 1;

  if v_account.id is null then
    return null;
  end if;

  if v_conversation.project_id is not null then
    select * into v_project
    from public.client_projects cp
    where cp.id = v_conversation.project_id
      and cp.user_id = v_conversation.client_id
    limit 1;
  end if;

  if v_project.id is null then
    select * into v_project
    from public.client_projects cp
    where cp.user_id = v_conversation.client_id
      and cp.is_active = true
    order by cp.updated_at desc nulls last, cp.created_at desc
    limit 1;
  end if;

  if v_project.id is not null then
    select jsonb_agg(
      jsonb_build_object(
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
  end if;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'client_id', v_conversation.client_id,
      'partner_id', v_conversation.partner_id,
      'project_id', v_conversation.project_id,
      'status', v_conversation.status,
      'subject', v_conversation.subject,
      'created_at', v_conversation.created_at,
      'last_message_at', v_conversation.last_message_at
    ),
    'account', jsonb_build_object(
      'id', v_account.id,
      'full_name', v_account.full_name,
      'display_name', v_account.display_name,
      'avatar_url', v_account.avatar_url,
      'cover_url', v_account.cover_url,
      'city', v_account.city,
      'country', v_account.country,
      'bio', v_account.bio,
      'interests', coalesce(v_account.interests, array[]::text[]),
      'style_preferences', coalesce(v_account.style_preferences, array[]::text[]),
      'preferred_contact_method', v_account.preferred_contact_method
    ),
    'project',
      case when v_project.id is null then null else jsonb_build_object(
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
      ) end,
    'media', coalesce(v_media, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_chat_client_profile(uuid) from public, anon;
grant execute on function public.get_chat_client_profile(uuid) to authenticated;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null
    and to_regclass('cron.job') is not null
    and not exists (
      select 1
      from cron.job
      where jobname = 'cleanup-deleted-conversations-daily'
    )
  then
    perform cron.schedule(
      'cleanup-deleted-conversations-daily',
      '17 3 * * *',
      'select public.cleanup_deleted_conversations();'
    );
  end if;
exception
  when invalid_schema_name or undefined_table or insufficient_privilege then
    null;
end;
$$;
