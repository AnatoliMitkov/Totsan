
-- 3. Добавяне на RLS политика за вмъкване на чатове от партньори
create policy "participants can insert conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() in (client_id, partner_id));
