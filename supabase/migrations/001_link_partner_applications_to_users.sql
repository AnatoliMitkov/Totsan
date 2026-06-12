-- supabase/migrations/001_link_partner_applications_to_users.sql
-- Auto-link partner_applications rows to newly created auth.users
-- Run this in Supabase SQL Editor → run

create or replace function public.link_partner_applications_to_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When a new auth.users is created, find any unlinked partner_applications
  -- with matching email and link them
  update public.partner_applications
  set user_id = new.id
  where email = new.email
    and user_id is null
    and status != 'rejected'
  limit 1;
  
  return new;
end;
$$;

drop trigger if exists link_partner_applications_to_new_user on auth.users;
create trigger link_partner_applications_to_new_user
after insert on auth.users
for each row execute function public.link_partner_applications_to_new_user();

-- Backfill: link existing unlinked applications to existing users
update public.partner_applications pa
set user_id = (
  select id from auth.users u where u.email = pa.email limit 1
)
where pa.user_id is null
  and pa.status != 'rejected'
  and exists (
    select 1 from auth.users u where u.email = pa.email
  );
