-- Allow custom typed places up to 60 characters (instead of fixed enum)
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.posts'::regclass and contype='c'
    and (pg_get_constraintdef(oid) like '%직접 정하기%' or conname = 'posts_place_check') loop
    execute format('alter table public.posts drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.posts add constraint posts_place_check check(char_length(btrim(place)) between 1 and 60);
