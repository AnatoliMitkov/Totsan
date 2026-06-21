-- Project location/access privacy.
-- Rough location remains in client_projects; exact address data is stored inside
-- quiz_answers->'locationAccess' and is redacted from public/shared reads.

alter table public.client_projects
  drop constraint if exists client_projects_property_type_check;

alter table public.client_projects
  add constraint client_projects_property_type_check
  check (
    property_type is null
    or property_type in ('apartment','house','office','commercial','building','outdoor','roof','other')
  );

create or replace function public.project_public_quiz_answers(p_quiz_answers jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_quiz_answers, '{}'::jsonb) ? 'locationAccess' then
      (coalesce(p_quiz_answers, '{}'::jsonb) - 'locationAccess')
      || jsonb_build_object(
        'locationAccess',
        jsonb_strip_nulls(jsonb_build_object(
          'parkingAvailability', p_quiz_answers->'locationAccess'->>'parkingAvailability',
          'materialStorage', p_quiz_answers->'locationAccess'->>'materialStorage',
          'wasteSpace', p_quiz_answers->'locationAccess'->>'wasteSpace',
          'workTimeRestrictions', p_quiz_answers->'locationAccess'->>'workTimeRestrictions',
          'specialAccess', coalesce(p_quiz_answers->'locationAccess'->'specialAccess', '[]'::jsonb),
          'floorLevel', p_quiz_answers->'locationAccess'->>'floorLevel',
          'elevator', p_quiz_answers->'locationAccess'->>'elevator',
          'elevatorForMaterials', p_quiz_answers->'locationAccess'->>'elevatorForMaterials',
          'entranceAccess', p_quiz_answers->'locationAccess'->>'entranceAccess',
          'vehicleAccess', p_quiz_answers->'locationAccess'->>'vehicleAccess',
          'roofAccess', p_quiz_answers->'locationAccess'->>'roofAccess',
          'roofPermissionNeeded', p_quiz_answers->'locationAccess'->>'roofPermissionNeeded',
          'businessHoursWork', p_quiz_answers->'locationAccess'->>'businessHoursWork',
          'loadingAccess', p_quiz_answers->'locationAccess'->>'loadingAccess'
        ))
      )
    else coalesce(p_quiz_answers, '{}'::jsonb)
  end;
$$;

revoke execute on function public.project_public_quiz_answers(jsonb) from public, anon, authenticated;
grant execute on function public.project_public_quiz_answers(jsonb) to anon, authenticated;

create or replace function public.get_order_project_location(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_project public.client_projects;
  v_viewer uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_can_read_order boolean := false;
  v_can_view_exact boolean := false;
  v_location jsonb := '{}'::jsonb;
begin
  if v_viewer is null then
    return null;
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  limit 1;

  if v_order.id is null then
    return null;
  end if;

  v_can_read_order := v_is_admin or v_viewer in (v_order.client_id, v_order.partner_id);
  if not v_can_read_order then
    return null;
  end if;

  select cp.* into v_project
  from public.orders o
  left join public.offers f on f.id = o.offer_id
  left join public.conversations c on c.id = o.conversation_id
  left join public.client_projects cp on cp.id = coalesce(f.project_id, c.project_id)
  where o.id = p_order_id
  limit 1;

  if v_project.id is null then
    return null;
  end if;

  v_location := coalesce(v_project.quiz_answers->'locationAccess', '{}'::jsonb);
  v_can_view_exact := v_is_admin
    or v_viewer = v_order.client_id
    or (
      v_viewer = v_order.partner_id
      and v_order.status in ('paid','in_progress','delivered','completed')
    );

  return jsonb_build_object(
    'projectId', v_project.id,
    'canViewExact', v_can_view_exact,
    'city', v_project.address_city,
    'district', v_project.address_region,
    'objectType', v_project.property_type,
    'access', case
      when v_can_view_exact then v_location
      else coalesce(public.project_public_quiz_answers(jsonb_build_object('locationAccess', v_location))->'locationAccess', '{}'::jsonb)
    end,
    'exact', case
      when v_can_view_exact then jsonb_strip_nulls(jsonb_build_object(
        'exactAddress', v_location->>'exactAddress',
        'googleMapsUrl', v_location->>'googleMapsUrl',
        'entrance', v_location->>'entrance',
        'floor', v_location->>'floor',
        'unitNumber', v_location->>'unitNumber',
        'accessInstructions', v_location->>'accessInstructions',
        'visitPhone', v_location->>'visitPhone'
      ))
      else null
    end
  );
end;
$$;

revoke execute on function public.get_order_project_location(uuid) from public, anon, authenticated;
grant execute on function public.get_order_project_location(uuid) to authenticated;

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
