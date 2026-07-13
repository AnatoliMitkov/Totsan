-- A participant may react with more than one emoji to the same message.
do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select constraints.constraint_name
    from information_schema.table_constraints as constraints
    where constraints.table_schema = 'public'
      and constraints.table_name = 'message_reactions'
      and constraints.constraint_type = 'UNIQUE'
      and constraints.constraint_name <> 'message_reactions_unique'
  loop
    execute format('alter table public.message_reactions drop constraint %I', v_constraint_name);
  end loop;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_reactions'::regclass
      and conname = 'message_reactions_unique'
      and contype = 'u'
      and pg_get_constraintdef(oid) <> 'UNIQUE (message_id, user_id, emoji)'
  ) then
    alter table public.message_reactions drop constraint message_reactions_unique;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_reactions'::regclass
      and conname = 'message_reactions_unique'
      and contype = 'u'
  ) then
    alter table public.message_reactions
      add constraint message_reactions_unique unique (message_id, user_id, emoji);
  end if;
end $$;
