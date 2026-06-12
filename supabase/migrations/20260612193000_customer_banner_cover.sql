alter table public.accounts
  add column if not exists cover_url text;

drop function if exists public.update_own_account_profile(
  text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
);

create or replace function public.update_own_account_profile(
  p_full_name text,
  p_display_name text,
  p_phone text,
  p_avatar_url text,
  p_cover_url text,
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
      cover_url = nullif(btrim(coalesce(p_cover_url, '')), ''),
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
  text, text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
) from public, anon;

grant execute on function public.update_own_account_profile(
  text, text, text, text, text, text, text, text, text, boolean, text[], text[], text, text, text
) to authenticated;
