create or replace function public.ensure_own_account()
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user auth.users;
  ensured_account public.accounts;
  resolved_full_name text;
  resolved_display_name text;
begin
  select * into auth_user
  from auth.users
  where id = auth.uid();

  if auth_user.id is null then
    raise exception 'Not authenticated.';
  end if;

  resolved_full_name := coalesce(
    auth_user.raw_user_meta_data->>'full_name',
    auth_user.raw_user_meta_data->>'name',
    auth_user.raw_user_meta_data->>'user_name'
  );

  resolved_display_name := coalesce(
    auth_user.raw_user_meta_data->>'display_name',
    auth_user.raw_user_meta_data->>'name',
    auth_user.raw_user_meta_data->>'user_name',
    split_part(auth_user.email, '@', 1)
  );

  insert into public.accounts (id, email, full_name, display_name, role, specialist_status)
  values (auth_user.id, auth_user.email, resolved_full_name, resolved_display_name, 'user', null)
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(public.accounts.full_name, ''), excluded.full_name),
      display_name = coalesce(nullif(public.accounts.display_name, ''), excluded.display_name),
      role = public.accounts.role,
      specialist_status = public.accounts.specialist_status
  returning * into ensured_account;

  return ensured_account;
end;
$$;

revoke execute on function public.ensure_own_account() from public, anon;
grant execute on function public.ensure_own_account() to authenticated;
