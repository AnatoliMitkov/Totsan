-- Client profile preferences.
-- Safe to run independently from supabase/schema.sql.

alter table public.accounts
  add column if not exists interests text[] not null default array[]::text[],
  add column if not exists style_preferences text[] not null default array[]::text[],
  add column if not exists preferred_contact_method text,
  add column if not exists age_group text,
  add column if not exists gender text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_preferred_contact_method_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    execute $constraint$
    alter table public.accounts
      add constraint accounts_preferred_contact_method_check
      check (
        preferred_contact_method is null
        or preferred_contact_method in ('Чат', 'Телефон', 'Имейл', 'Нямам предпочитание')
      ) not valid
    $constraint$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_age_group_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    execute $constraint$
    alter table public.accounts
      add constraint accounts_age_group_check
      check (
        age_group is null
        or age_group in ('18–24', '25–34', '35–44', '45–54', '55+', 'Предпочитам да не казвам')
      ) not valid
    $constraint$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_gender_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    execute $constraint$
    alter table public.accounts
      add constraint accounts_gender_check
      check (
        gender is null
        or gender in ('Жена', 'Мъж', 'Друго', 'Предпочитам да не казвам')
      ) not valid
    $constraint$;
  end if;
end;
$$;

-- Keep the existing 9-argument update_own_account_profile RPC for older callers.
-- This 14-argument overload intentionally has no argument defaults, so 9-argument
-- RPC calls resolve to the old function and full preference updates resolve here.
drop function if exists public.update_own_account_profile(
  text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
);

create or replace function public.update_own_account_profile(
  p_full_name text,
  p_display_name text,
  p_phone text,
  p_avatar_url text,
  p_city text,
  p_country text,
  p_bio text,
  p_locale text,
  p_marketing_opt_in boolean,
  p_interests text[],
  p_style_preferences text[],
  p_preferred_contact_method text,
  p_age_group text,
  p_gender text
)
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_account public.accounts;
begin
  update public.accounts
  set full_name = nullif(btrim(coalesce(p_full_name, '')), ''),
      display_name = nullif(btrim(coalesce(p_display_name, p_full_name, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''),
      city = nullif(btrim(coalesce(p_city, '')), ''),
      country = coalesce(nullif(upper(btrim(coalesce(p_country, ''))), ''), 'BG'),
      bio = nullif(btrim(coalesce(p_bio, '')), ''),
      locale = coalesce(nullif(lower(btrim(coalesce(p_locale, ''))), ''), 'bg'),
      marketing_opt_in = coalesce(p_marketing_opt_in, false),
      interests = coalesce(p_interests, array[]::text[]),
      style_preferences = coalesce(p_style_preferences, array[]::text[]),
      preferred_contact_method = nullif(btrim(coalesce(p_preferred_contact_method, '')), ''),
      age_group = nullif(btrim(coalesce(p_age_group, '')), ''),
      gender = nullif(btrim(coalesce(p_gender, '')), '')
  where id = auth.uid()
  returning * into updated_account;

  if updated_account.id is null then
    raise exception 'Account not found for current user.';
  end if;

  return updated_account;
end;
$$;

revoke execute on function public.update_own_account_profile(
  text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
) from public, anon;

grant execute on function public.update_own_account_profile(
  text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
) to authenticated;
