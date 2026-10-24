-- Display names come exclusively from the linked Google identity, never a custom profile edit.
-- Membership authorization still uses provider-owned app metadata and private.members.
alter table public.profiles rename column nickname to display_name;
alter table public.profiles drop constraint profiles_nickname_check;

-- Replace existing custom names, including members who have not signed in again yet.
update public.profiles p set display_name = coalesce((
  select coalesce(nullif(i.identity_data->>'name', ''), nullif(i.identity_data->>'full_name', ''))
  from auth.identities i where i.user_id = p.id and i.provider = 'google'
  order by i.last_sign_in_at desc nulls last, i.id limit 1
), '') where exists(select 1 from private.members m where m.id = p.id and m.active);

create function private.sync_google_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider = 'google' then
    update public.profiles set display_name = coalesce(
      nullif(new.identity_data->>'name', ''), nullif(new.identity_data->>'full_name', ''), ''
    ) where id = new.user_id
      and exists(select 1 from private.members m where m.id = new.user_id and m.active);
  end if;
  return new;
end; $$;
revoke all on function private.sync_google_profile_name() from public, anon, authenticated;
create trigger on_google_identity_name after insert or update of identity_data on auth.identities
for each row execute function private.sync_google_profile_name();

-- Keep all trading/chat rules, removing the custom-name endpoint and onboarding gate.
create or replace function private.mutate(op text, payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.posts; c public.conversations; msg public.messages; pid uuid; images uuid[]; image uuid; read_seq bigint;
begin
  if uid is null or not private.is_member() then raise exception '학교 계정으로 로그인해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if op='account.delete' then
    update private.members set active=false where id=uid;
    update public.profiles set display_name='탈퇴한 사용자' where id=uid;
    update public.posts set deleted_at=now(), updated_at=now() where author_id=uid and deleted_at is null;
    return jsonb_build_object('ok',true);
  end if;
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
    insert into public.posts(id,author_id,kind,title,body,price,category,place,occurred_on,custody,wanted,image_ids)
    values(pid,uid,payload->>'kind',btrim(payload->>'title'),btrim(payload->>'body'),(payload->>'price')::int,payload->>'category',payload->>'place',(payload->>'occurred_on')::date,coalesce(payload->>'custody',''),btrim(coalesce(payload->>'wanted','')),images)
    on conflict(id) do update set title=excluded.title,body=excluded.body,price=excluded.price,category=excluded.category,place=excluded.place,occurred_on=excluded.occurred_on,custody=excluded.custody,wanted=excluded.wanted,image_ids=excluded.image_ids,updated_at=now()
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
