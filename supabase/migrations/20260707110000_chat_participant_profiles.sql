create or replace function public.get_chat_participant_profiles(p_user_ids uuid[])
returns table (
  user_id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  city text
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
    a.id as user_id,
    coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(a.full_name), ''), nullif(split_part(a.email, '@', 1), '')) as display_name,
    coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(a.display_name), ''), nullif(split_part(a.email, '@', 1), '')) as full_name,
    a.avatar_url,
    a.city
  from public.accounts a
  where a.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and exists (
      select 1
      from public.conversations c
      where auth.uid() in (c.client_id, c.partner_id)
        and a.id in (c.client_id, c.partner_id)
    );
end;
$$;

revoke execute on function public.get_chat_participant_profiles(uuid[]) from public, anon;
grant execute on function public.get_chat_participant_profiles(uuid[]) to authenticated;
