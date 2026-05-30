-- SQL скрипт за добавяне на RLS права за партньори към таблицата `inquiries`
-- Изпълни този скрипт в SQL Editor-а на Supabase

create policy "partners can read their own inquiries"
  on public.inquiries for select
  to authenticated
  using (
    target_slug in (
      select slug from public.profiles where user_id = auth.uid()
    )
  );

create policy "partners can update their own inquiries"
  on public.inquiries for update
  to authenticated
  using (
    target_slug in (
      select slug from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    target_slug in (
      select slug from public.profiles where user_id = auth.uid()
    )
  );
