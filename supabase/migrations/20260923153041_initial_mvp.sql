-- No remote database is changed by this file. Apply to a dedicated project.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id),
  nickname text not null default '' check (nickname = '' or char_length(nickname) between 2 and 16),
  created_at timestamptz not null default now()
);
create table private.members (
  id uuid primary key references auth.users(id), active boolean not null default true
);
create table private.rate_limits (
  user_id uuid not null references auth.users(id), action text not null,
  window_start timestamptz not null, hits int not null, primary key(user_id, action)
);
create table public.posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
  kind text not null check(kind in ('sale','giveaway','lost','found')),
  title text not null check(char_length(btrim(title)) between 2 and 60),
  body text not null check(char_length(btrim(body)) between 5 and 3000),
  price integer not null default 0 check(price between 0 and 100000000),
  category text not null check(category in ('교재·도서','문구·학습용품','전자기기','의류·잡화','생활용품','기타')),
  place text not null check(place in ('직접 정하기','도서관 앞','급식실 앞','교실','기숙사 앞','기타·모름')),
  occurred_on date, custody text not null default '' check(char_length(custody) <= 100),
  status text not null default 'active' check(status in ('active','reserved','completed')),
  image_ids uuid[] not null default '{}' check(cardinality(image_ids) <= 5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check((kind = 'sale' and price > 0) or (kind <> 'sale' and price = 0)),
  check(kind in ('sale','giveaway') or (occurred_on is not null and status <> 'reserved')),
  check(kind <> 'found' or char_length(btrim(custody)) > 0),
  check(kind in ('lost','found') or cardinality(image_ids) > 0)
);
create index posts_feed on public.posts(created_at desc, id desc) where deleted_at is null;
create index posts_author on public.posts(author_id);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id),
  seller_id uuid not null references public.profiles(id), buyer_id uuid not null references public.profiles(id),
  title text not null, price integer not null, kind text not null,
  seller_read_seq bigint not null default 0, buyer_read_seq bigint not null default 0,
  last_message_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique(post_id, buyer_id), check(seller_id <> buyer_id)
);
create index conversations_seller on public.conversations(seller_id, last_message_at desc);
create index conversations_buyer on public.conversations(buyer_id, last_message_at desc);
create table public.media (
  id uuid primary key, owner_id uuid not null references public.profiles(id),
  path text unique not null, post_id uuid references public.posts(id), conversation_id uuid references public.conversations(id),
  created_at timestamptz not null default now(), check(post_id is null or conversation_id is null)
);
create index media_owner on public.media(owner_id);
create index media_post on public.media(post_id);
create index media_conversation on public.media(conversation_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(), seq bigint generated always as identity unique,
  conversation_id uuid not null references public.conversations(id), sender_id uuid not null references public.profiles(id),
  body text not null default '' check(char_length(body) <= 2000), image_id uuid references public.media(id),
  client_id uuid not null, created_at timestamptz not null default now(), unique(sender_id,client_id),
  check(char_length(btrim(body)) > 0 or image_id is not null)
);
create index messages_room_seq on public.messages(conversation_id, seq desc);
create index messages_image on public.messages(image_id) where image_id is not null;

-- Membership uses provider-owned claims, confirmed email and a live DB flag,
-- never user_metadata. Definer helpers are private and narrowly granted.
create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join private.members m on m.id=u.id
    where u.id=auth.uid() and m.active and u.email_confirmed_at is not null
    and lower(u.email) ~ '^[^[:space:]@]+@hafs[.]hs[.]kr$'
    and u.raw_app_meta_data->>'provider' = 'google');
$$;
create function public.is_member() returns boolean language sql stable security invoker set search_path = '' as $$ select private.is_member(); $$;
create function private.in_room(room uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists(select 1 from public.conversations c where c.id=room and auth.uid() in (c.seller_id,c.buyer_id));
$$;
create function private.can_read_media(media_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists(select 1 from public.media m where m.id=media_id and
    (m.owner_id=auth.uid() or exists(select 1 from public.posts p where p.id=m.post_id and p.deleted_at is null and m.id=any(p.image_ids))
      or (private.in_room(m.conversation_id) and exists(select 1 from public.messages x where x.image_id=m.id))));
$$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'provider' is distinct from 'google' or lower(coalesce(new.email,'')) !~ '^[^[:space:]@]+@hafs[.]hs[.]kr$' then
    raise exception '학교 Google 계정만 가입할 수 있어요.';
  end if;
  insert into public.profiles(id) values(new.id);
  insert into private.members(id) values(new.id);
  return new;
end; $$;
create trigger on_hafs_signup after insert on auth.users for each row execute function private.on_signup();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.media enable row level security;
alter table private.members enable row level security;
alter table private.rate_limits enable row level security;
revoke all on public.profiles, public.posts, public.conversations, public.messages, public.media from anon, authenticated;
grant select on public.profiles, public.posts, public.conversations, public.messages, public.media to authenticated;
grant all on public.profiles, public.posts, public.conversations, public.messages, public.media to service_role;
create policy profiles_read on public.profiles for select to authenticated using ((select private.is_member()));
create policy posts_read on public.posts for select to authenticated using ((select private.is_member()) and deleted_at is null);
create policy conversations_read on public.conversations for select to authenticated using ((select private.is_member()) and (select auth.uid()) in (seller_id,buyer_id));
create policy messages_read on public.messages for select to authenticated using (private.in_room(conversation_id));
create policy media_read on public.media for select to authenticated using (private.can_read_media(id));

create function private.throttle(action_name text, max_hits int) returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into private.rate_limits(user_id,action,window_start,hits) values(auth.uid(),action_name,clock_timestamp(),1)
  on conflict(user_id,action) do update set
    hits=case when private.rate_limits.window_start < clock_timestamp()-interval '1 minute' then 1 else private.rate_limits.hits+1 end,
    window_start=case when private.rate_limits.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else private.rate_limits.window_start end
  returning hits into n;
  if n > max_hits then raise exception '잠시 후 다시 시도해 주세요.'; end if;
end; $$;

create function private.mutate(op text, payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.posts; c public.conversations; msg public.messages; pid uuid; images uuid[]; image uuid; read_seq bigint;
begin
  if uid is null or not private.is_member() then raise exception '학교 계정으로 로그인해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if op='profile.save' then
    perform private.throttle(op,10);
    if char_length(btrim(payload->>'nickname')) not between 2 and 16 then raise exception '닉네임은 2~16자로 입력해 주세요.'; end if;
    update public.profiles set nickname=btrim(payload->>'nickname') where id=uid;
    return jsonb_build_object('id',uid,'nickname',btrim(payload->>'nickname'));
  elsif op='account.delete' then
    update private.members set active=false where id=uid;
    update public.profiles set nickname='탈퇴한 사용자' where id=uid;
    update public.posts set deleted_at=now(), updated_at=now() where author_id=uid and deleted_at is null;
    return jsonb_build_object('ok',true);
  end if;
  if not exists(select 1 from public.profiles where id=uid and nickname <> '') then raise exception '먼저 닉네임을 설정해 주세요.'; end if;
  if op='post.save' then
    perform private.throttle(op,10);
    pid := coalesce((payload->>'id')::uuid,gen_random_uuid());
    select * into p from public.posts where id=pid for update;
    if found and (p.author_id<>uid or p.deleted_at is not null) then raise exception '글을 수정할 수 없어요.'; end if;
    if p.id is not null and p.kind <> payload->>'kind' then raise exception '글 유형은 변경할 수 없어요.'; end if;
    select coalesce(array_agg(value::uuid),'{}') into images from jsonb_array_elements_text(payload->'image_ids');
    if cardinality(images) <> (select count(distinct x) from unnest(images) x) then raise exception '중복 사진입니다.'; end if;
    foreach image in array images loop
      if not exists(select 1 from public.media m where m.id=image and m.owner_id=uid and m.conversation_id is null and (m.post_id is null or m.post_id=pid)) then raise exception '사용할 수 없는 사진입니다.'; end if;
    end loop;
    if (payload->>'occurred_on')::date > (now() at time zone 'Asia/Seoul')::date then raise exception '미래 날짜는 선택할 수 없어요.'; end if;
    insert into public.posts(id,author_id,kind,title,body,price,category,place,occurred_on,custody,image_ids)
    values(pid,uid,payload->>'kind',btrim(payload->>'title'),btrim(payload->>'body'),(payload->>'price')::int,payload->>'category',payload->>'place',(payload->>'occurred_on')::date,coalesce(payload->>'custody',''),images)
    on conflict(id) do update set title=excluded.title,body=excluded.body,price=excluded.price,category=excluded.category,place=excluded.place,occurred_on=excluded.occurred_on,custody=excluded.custody,image_ids=excluded.image_ids,updated_at=now()
    returning * into p;
    update public.media set post_id=pid where id=any(images);
    return to_jsonb(p);
  elsif op in ('post.status','post.delete') then
    select * into p from public.posts where id=(payload->>'id')::uuid and author_id=uid and deleted_at is null for update;
    if not found then raise exception '글을 찾을 수 없어요.'; end if;
    if op='post.delete' then update public.posts set deleted_at=now(),updated_at=now() where id=p.id;
    else
      if p.updated_at <> (payload->>'updated_at')::timestamptz or payload->>'updated_at' is null then raise exception '글 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.'; end if;
      update public.posts set status=payload->>'status',updated_at=now() where id=p.id returning * into p;
    end if;
    return to_jsonb(p);
  elsif op='conversation.create' then
    perform private.throttle(op,15);
    select * into p from public.posts where id=(payload->>'post_id')::uuid for update;
    if not found then raise exception '게시글을 찾을 수 없어요.'; end if;
    select * into c from public.conversations where post_id=p.id and buyer_id=uid;
    if found then return to_jsonb(c); end if;
    if p.author_id=uid or p.deleted_at is not null or p.status='completed' or not exists(select 1 from private.members where id=p.author_id and active) then raise exception '이 글에는 새 문의를 보낼 수 없어요.'; end if;
    insert into public.conversations(post_id,seller_id,buyer_id,title,price,kind) values(p.id,p.author_id,uid,p.title,p.price,p.kind) returning * into c;
    return to_jsonb(c);
  elsif op in ('message.send','message.read') then
    if not private.in_room((payload->>'conversation_id')::uuid) then raise exception '대화에 접근할 수 없어요.'; end if;
    select * into c from public.conversations where id=(payload->>'conversation_id')::uuid for update;
    if op='message.read' then
      select coalesce(max(seq),0) into read_seq from public.messages where conversation_id=c.id and seq <= (payload->>'seq')::bigint;
      update public.conversations set seller_read_seq=case when seller_id=uid then greatest(seller_read_seq,read_seq) else seller_read_seq end,
        buyer_read_seq=case when buyer_id=uid then greatest(buyer_read_seq,read_seq) else buyer_read_seq end where id=c.id;
      return jsonb_build_object('ok',true);
    end if;
    select * into msg from public.messages where sender_id=uid and client_id=(payload->>'client_id')::uuid;
    if found then
      if msg.conversation_id<>c.id then raise exception '중복 요청 ID입니다.'; end if;
      return to_jsonb(msg);
    end if;
    if not exists(select 1 from private.members where id=case when c.seller_id=uid then c.buyer_id else c.seller_id end and active) then raise exception '탈퇴한 사용자에게 메시지를 보낼 수 없어요.'; end if;
    perform private.throttle(op,40);
    image := (payload->>'image_id')::uuid;
    if image is not null and not exists(select 1 from public.media m where m.id=image and m.owner_id=uid and m.conversation_id=c.id) then raise exception '사용할 수 없는 사진입니다.'; end if;
    insert into public.messages(conversation_id,sender_id,body,image_id,client_id) values(c.id,uid,btrim(coalesce(payload->>'body','')),image,(payload->>'client_id')::uuid) returning * into msg;
    update public.conversations set last_message_at=msg.created_at where id=c.id;
    return to_jsonb(msg);
  elsif op='upload.consume' then
    perform private.throttle(op,15);
    if payload->>'conversation_id' is not null and not private.in_room((payload->>'conversation_id')::uuid) then raise exception '대화에 접근할 수 없어요.'; end if;
    return jsonb_build_object('ok',true);
  end if;
  raise exception '알 수 없는 요청입니다.';
end; $$;
create function public.mutate(op text, payload jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.mutate(op,payload); $$;

-- Count on the server: loading only the recent message window must not undercount.
create function public.inbox() returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(c) || jsonb_build_object(
    'unread_count',(select count(*) from public.messages m where m.conversation_id=c.id and m.sender_id<>auth.uid() and m.seq>case when c.seller_id=auth.uid() then c.seller_read_seq else c.buyer_read_seq end),
    'last_body',(select case when m.body='' and m.image_id is not null then '사진을 보냈어요' else m.body end from public.messages m where m.conversation_id=c.id order by m.seq desc limit 1))
  from public.conversations c order by c.last_message_at desc limit 500;
$$;
revoke all on function public.inbox() from public,anon;
grant execute on function public.inbox() to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(), private.in_room(uuid), private.can_read_media(uuid), private.mutate(text,jsonb) to authenticated;
revoke all on function public.is_member(), public.mutate(text,jsonb) from public, anon;
grant execute on function public.is_member(), public.mutate(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('images','images',false,10485760,array['image/webp']) on conflict(id) do nothing;
create policy images_read on storage.objects for select to authenticated using (bucket_id='images' and exists(select 1 from public.media m where m.path=name and private.can_read_media(m.id)));
-- Uploads/registration only happen in the validated server route using the secret key.
-- Deliberately no browser INSERT/UPDATE/DELETE Storage policies.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations;
  end if;
end $$;
