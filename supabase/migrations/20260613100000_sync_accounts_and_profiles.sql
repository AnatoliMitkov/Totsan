-- Trigger function to synchronize changes between accounts and profiles
create or replace function public.sync_accounts_and_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent infinite recursion
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_table_name = 'accounts' then
    update public.profiles
    set name = coalesce(new.full_name, new.display_name, ''),
        image_url = new.avatar_url,
        cover_url = new.cover_url,
        city = coalesce(new.city, ''),
        bio = new.bio,
        phone = new.phone
    where user_id = new.id;
  elsif tg_table_name = 'profiles' then
    if new.user_id is not null then
      update public.accounts
      set full_name = new.name,
          display_name = new.name,
          avatar_url = new.image_url,
          cover_url = new.cover_url,
          city = new.city,
          bio = new.bio,
          phone = new.phone
      where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

-- Prepopulate profiles from accounts on insert
create or replace function public.prepopulate_profile_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_acc record;
begin
  if new.user_id is not null then
    select * into user_acc from public.accounts where id = new.user_id;
    if found then
      new.name := coalesce(nullif(new.name, ''), user_acc.full_name, user_acc.display_name, '');
      new.image_url := coalesce(new.image_url, user_acc.avatar_url);
      new.cover_url := coalesce(new.cover_url, user_acc.cover_url);
      new.city := coalesce(nullif(new.city, ''), user_acc.city, '');
      new.bio := coalesce(new.bio, user_acc.bio);
      new.phone := coalesce(new.phone, user_acc.phone);
    end if;
  end if;
  return new;
end;
$$;

-- Recreate triggers on accounts
drop trigger if exists sync_accounts_on_update on public.accounts;
create trigger sync_accounts_on_update
after update on public.accounts
for each row
when (
  old.full_name is distinct from new.full_name or
  old.display_name is distinct from new.display_name or
  old.avatar_url is distinct from new.avatar_url or
  old.cover_url is distinct from new.cover_url or
  old.city is distinct from new.city or
  old.bio is distinct from new.bio or
  old.phone is distinct from new.phone
)
execute function public.sync_accounts_and_profiles();

-- Recreate triggers on profiles
drop trigger if exists sync_profiles_on_update on public.profiles;
create trigger sync_profiles_on_update
after update on public.profiles
for each row
when (
  old.name is distinct from new.name or
  old.image_url is distinct from new.image_url or
  old.cover_url is distinct from new.cover_url or
  old.city is distinct from new.city or
  old.bio is distinct from new.bio or
  old.phone is distinct from new.phone
)
execute function public.sync_accounts_and_profiles();

drop trigger if exists prepopulate_profile_on_insert on public.profiles;
create trigger prepopulate_profile_on_insert
before insert on public.profiles
for each row
execute function public.prepopulate_profile_from_account();

-- Backfill existing profiles info into accounts
update public.accounts a
set full_name = coalesce(nullif(p.name, ''), a.full_name),
    display_name = coalesce(nullif(p.name, ''), a.display_name),
    avatar_url = coalesce(p.image_url, a.avatar_url),
    cover_url = coalesce(p.cover_url, a.cover_url),
    city = coalesce(nullif(p.city, ''), a.city),
    bio = coalesce(p.bio, a.bio),
    phone = coalesce(p.phone, a.phone)
from public.profiles p
where a.id = p.user_id;
