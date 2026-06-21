-- Add optional desired project end date.

alter table public.client_projects
  add column if not exists desired_end_date date;

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
  from public.client_projects
  where public_share_id = p_share_id
    and is_shareable = true
    and is_active = true
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

revoke execute on function public.get_shared_client_project(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_client_project(uuid) to anon, authenticated;
