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
