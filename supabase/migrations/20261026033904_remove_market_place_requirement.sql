-- The place column is still used by lost/found posts.
alter table public.posts drop constraint posts_place_check;
alter table public.posts add constraint posts_place_check check(char_length(btrim(place)) <= 60);
alter table public.posts alter column place set default '';
