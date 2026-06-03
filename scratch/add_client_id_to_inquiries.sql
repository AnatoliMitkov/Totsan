-- 1. Добавяне на колона client_id към inquiries
alter table public.inquiries
add column if not exists client_id uuid references auth.users(id) on delete set null;

-- 2. Добавяне на RLS политика, която позволява на партньор да чете проекта на клиент, 
-- АКО този клиент е изпратил запитване до този партньор.
create policy "partners can read client projects if inquired"
  on public.client_projects for select
  to authenticated
  using (
    exists (
      select 1 from public.inquiries
      where inquiries.client_id = client_projects.user_id
      and inquiries.target_slug in (
        select slug from public.profiles where user_id = auth.uid()
      )
    )
  );

-- 3. Добавяне на RLS политика за вмъкване на чатове от партньори
create policy "participants can insert conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() in (client_id, partner_id));
