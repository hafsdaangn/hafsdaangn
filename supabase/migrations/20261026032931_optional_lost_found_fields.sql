-- Lost/found posts only require a title; keep market post requirements.
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check check(
  char_length(btrim(body)) between case when kind in ('lost','found') then 0 else 5 end and 3000);

alter table public.posts drop constraint posts_place_check;
alter table public.posts add constraint posts_place_check check(
  char_length(btrim(place)) between case when kind in ('lost','found') then 0 else 1 end and 60);

alter table public.posts drop constraint posts_occurred_check;
alter table public.posts add constraint posts_occurred_check check(
  kind in ('sale','giveaway','barter') or status <> 'reserved');

-- The original custody requirement was created with an auto-generated name.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.posts'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%found%' and pg_get_constraintdef(oid) like '%custody%' loop
    execute format('alter table public.posts drop constraint %I', c.conname);
  end loop;
end $$;
