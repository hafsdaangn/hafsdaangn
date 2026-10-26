import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const testId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("Postgres schema enforces membership, ownership, media and private chat", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema auth, storage to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
    create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb,last_sign_in_at timestamptz default now(),unique(user_id,provider));
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text); alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;`);
  for (const migration of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (migration.endsWith("_google_account_names.sql")) {
      await db.query(
        "insert into auth.users values($1,'legacy@hafs.hs.kr',now(),'{\"provider\":\"google\"}')",
        [testId(90)],
      );
      await db.query(
        "update public.profiles set nickname='옛닉네임' where id=$1",
        [testId(90)],
      );
      await db.query(
        "insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2)",
        [
          testId(90),
          { full_name: "Google에서 가져온 기존 회원의 긴 이름입니다" },
        ],
      );
    }
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  }
  assert.equal(
    (
      await db.query<{ display_name: string }>(
        "select display_name from public.profiles where id=$1",
        [testId(90)],
      )
    ).rows[0].display_name,
    "Google에서 가져온 기존 회원의 긴 이름입니다",
  );
  const seller = testId(1),
    buyer = testId(2),
    stranger = testId(3),
    unverified = testId(4);
  for (const id of [seller, buyer, stranger, unverified])
    await db.query("insert into auth.users values($1,$2,$3,$4)", [
      id,
      `${id}@hafs.hs.kr`,
      id === unverified ? null : new Date().toISOString(),
      { provider: "google" },
    ]);
  await assert.rejects(
    db.query(
      "insert into auth.users values($1,'outsider@gmail.com',now(),'{\"provider\":\"google\"}')",
      [testId(5)],
    ),
    /학교 Google/,
  );
  await assert.rejects(
    db.query(
      "insert into auth.users values($1,'bad@hafs.hs.kr',now(),'{\"provider\":\"email\"}')",
      [testId(6)],
    ),
    /학교 Google/,
  );
  async function as<T>(
    uid: string,
    fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid,
      ]);
      return fn(tx);
    });
  }
  async function mutate(
    uid: string,
    op: string,
    payload: Record<string, unknown>,
  ) {
    return as(
      uid,
      async (tx) =>
        (
          await tx.query<{ result: Record<string, unknown> }>(
            "select public.mutate($1,$2::jsonb) result",
            [op, JSON.stringify(payload)],
          )
        ).rows[0].result,
    );
  }
  // New members skip onboarding; Google names have no old 2–16 character limit.
  for (const [uid, name] of [
    [seller, "이"],
    [buyer, "긴 Google 계정 이름을 그대로 표시합니다"],
    [stranger, "박 지수"],
  ]) {
    await db.query(
      "insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2)",
      [uid, { name, full_name: "이전 값" }],
    );
    assert.equal(
      (
        await as(uid, (tx) =>
          tx.query<{ display_name: string }>(
            "select display_name from public.profiles where id=$1",
            [uid],
          ),
        )
      ).rows[0].display_name,
      name,
    );
  }
  await assert.rejects(
    mutate(seller, "profile.save", { nickname: "임의 이름" }),
    /알 수 없는 요청/,
  );
  await assert.rejects(
    as(seller, (tx) =>
      tx.query(
        "update public.profiles set display_name='임의 이름' where id=$1",
        [seller],
      ),
    ),
    /permission denied/,
  );
  await db.query(
    "update auth.identities set identity_data=$2 where user_id=$1 and provider='google'",
    [seller, { name: "변경된 Google 이름" }],
  );
  assert.equal(
    (
      await db.query<{ display_name: string }>(
        "select display_name from public.profiles where id=$1",
        [seller],
      )
    ).rows[0].display_name,
    "변경된 Google 이름",
  );
  await db.query(
    "insert into auth.identities(user_id,provider,identity_data) values($1,'email',$2)",
    [seller, { name: "다른 공급자 이름" }],
  );
  assert.equal(
    (
      await db.query<{ display_name: string }>(
        "select display_name from public.profiles where id=$1",
        [seller],
      )
    ).rows[0].display_name,
    "변경된 Google 이름",
  );
  assert.equal(
    (
      await as(unverified, (tx) =>
        tx.query<{ allowed: boolean }>("select public.is_member() allowed"),
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(mutate(unverified, "upload.consume", {}), /학교 계정/);
  const image = testId(10),
    foreignImage = testId(11),
    postId = testId(20);
  await db.query(
    "insert into public.media(id,owner_id,path) values($1,$2,'seller.webp'),($3,$4,'buyer.webp')",
    [image, seller, foreignImage, buyer],
  );
  const payload = {
    id: postId,
    kind: "sale",
    title: "테스트 상품",
    body: "정상적인 상품 설명",
    price: 1000,
    category: "기타",
    place: "도서관 앞 벤치",
    occurred_on: null,
    custody: "",
    image_ids: [image],
  };
  const post = (await mutate(seller, "post.save", payload)) as {
    place: string;
    updated_at: string;
  };
  assert.equal(post.place, "도서관 앞 벤치");
  for (const [index, kind] of ["lost", "found"].entries()) {
    const minimal = {
      ...payload,
      id: testId(100 + index),
      kind,
      body: "",
      place: "",
      price: 0,
      image_ids: [],
    };
    const saved = await mutate(seller, "post.save", minimal);
    assert.equal(saved.body, "");
    assert.equal(saved.place, "");
    assert.equal(saved.occurred_on, null);
    assert.equal(saved.custody, "");
    const edited = await mutate(seller, "post.save", {
      ...minimal,
      body: "펜",
      place: "본관 3층 홈베이스 앞",
    });
    assert.equal(edited.place, "본관 3층 홈베이스 앞");
    await assert.rejects(
      mutate(seller, "post.save", { ...minimal, title: " " }),
      /check constraint/,
    );
    await assert.rejects(
      db.query("update public.posts set status='reserved' where id=$1", [
        minimal.id,
      ]),
      /check constraint/,
    );
    await mutate(seller, "post.delete", { id: minimal.id });
  }
  await assert.rejects(
    mutate(seller, "post.save", { ...payload, body: "" }),
    /check constraint/,
  );
  await db.query(
    "insert into public.media(id,owner_id,path) values($1,$2,'giveaway.webp')",
    [testId(103), seller],
  );
  const giveaway = {
    ...payload,
    id: testId(102),
    image_ids: [testId(103)],
    kind: "giveaway",
    price: 0,
    place: "",
  };
  assert.equal((await mutate(seller, "post.save", giveaway)).place, "");
  assert.equal(
    (
      await mutate(seller, "post.save", {
        ...giveaway,
        title: "장소 없는 나눔 수정",
      })
    ).place,
    "",
  );
  await mutate(seller, "post.delete", { id: giveaway.id });
  await assert.rejects(
    mutate(buyer, "post.save", { ...payload, title: "타인 수정" }),
    /수정할 수/,
  );
  await assert.rejects(
    mutate(seller, "post.save", { ...payload, image_ids: [foreignImage] }),
    /사진/,
  );
  await assert.rejects(
    mutate(seller, "post.save", { ...payload, price: 0 }),
    /check constraint/,
  );
  await assert.rejects(
    as(buyer, (tx) => tx.exec("update public.posts set price=1")),
    /permission denied/,
  );
  await db.query(
    "insert into public.media(id,owner_id,path) values($1,$2,'barter.webp'),($3,$2,'extra.webp')",
    [testId(70), seller, testId(71)],
  );
  const barterPayload = {
    ...payload,
    id: testId(21),
    image_ids: [testId(70)],
    kind: "barter",
    price: 0,
    wanted: "문제집",
  };
  const barter = (await mutate(seller, "post.save", barterPayload)) as {
    kind: string;
    wanted: string;
  };
  assert.equal(barter.kind, "barter");
  assert.equal(barter.wanted, "문제집");
  await assert.rejects(
    mutate(seller, "post.save", { ...barterPayload, wanted: "" }),
    /check constraint/,
  );
  await assert.rejects(
    mutate(seller, "post.save", {
      ...payload,
      id: testId(22),
      image_ids: [testId(71)],
      wanted: "x요",
    }),
    /check constraint/,
  );
  await mutate(seller, "post.delete", { id: testId(21) });
  const room = await mutate(buyer, "conversation.create", { post_id: postId });
  assert.equal(
    (await mutate(buyer, "conversation.create", { post_id: postId })).id,
    room.id,
  );
  assert.equal(
    (await as(stranger, (tx) => tx.query("select * from public.conversations")))
      .rows.length,
    0,
  );
  const message = {
    conversation_id: room.id,
    client_id: testId(30),
    body: "거래 가능한가요?",
    image_id: null,
  };
  const sent = await mutate(buyer, "message.send", message);
  assert.equal((await mutate(buyer, "message.send", message)).id, sent.id);
  const device = testId(80);
  await db.query(
    "insert into public.push_subscriptions(endpoint,device_id,user_id,keys) values($1,$2,$3,$4)",
    [
      "https://web.push.apple.com/test",
      device,
      seller,
      { p256dh: "key", auth: "secret" },
    ],
  );
  for (const uid of [seller, buyer, stranger]) {
    await assert.rejects(
      as(uid, (tx) => tx.query("select * from public.push_subscriptions")),
      /permission denied/,
    );
    await assert.rejects(
      as(uid, (tx) => tx.query("delete from public.push_subscriptions")),
      /permission denied/,
    );
    await assert.rejects(
      as(uid, (tx) => tx.query("select * from public.push_deliveries")),
      /permission denied/,
    );
  }
  await db.query(
    "insert into public.push_deliveries(message_id,device_id) values($1,$2)",
    [sent.id, device],
  );
  await assert.rejects(
    db.query(
      "insert into public.push_deliveries(message_id,device_id) values($1,$2)",
      [sent.id, device],
    ),
    /duplicate key/,
  );
  await db.query("update private.members set active=false where id=$1", [
    seller,
  ]);
  assert.equal(
    (await db.query("select * from public.push_subscriptions")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.push_deliveries")).rows.length,
    0,
  );
  await db.query("update private.members set active=true where id=$1", [
    seller,
  ]);
  await assert.rejects(
    mutate(stranger, "message.send", { ...message, client_id: testId(31) }),
    /접근/,
  );
  assert.equal(
    (await as(stranger, (tx) => tx.query("select * from public.messages"))).rows
      .length,
    0,
  );
  await mutate(seller, "message.read", {
    conversation_id: room.id,
    seq: sent.seq,
  });
  await mutate(seller, "message.read", { conversation_id: room.id, seq: 0 });
  assert.equal(
    Number(
      (
        await db.query<{ seller_read_seq: number }>(
          "select seller_read_seq from public.conversations",
        )
      ).rows[0].seller_read_seq,
    ),
    Number(sent.seq),
  );
  await mutate(seller, "post.status", {
    id: postId,
    status: "completed",
    updated_at: post.updated_at,
  });
  await assert.rejects(
    mutate(stranger, "conversation.create", { post_id: postId }),
    /새 문의/,
  );
  const chatPhoto = testId(12);
  await db.query(
    "insert into public.media(id,owner_id,path,conversation_id) values($1,$2,'chat.webp',$3)",
    [chatPhoto, buyer, room.id],
  );
  await mutate(buyer, "message.send", {
    ...message,
    client_id: testId(32),
    image_id: chatPhoto,
  });
  assert.equal(
    (
      await as(stranger, (tx) =>
        tx.query("select * from public.media where id=$1", [chatPhoto]),
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(seller, (tx) =>
        tx.query("select * from public.media where id=$1", [chatPhoto]),
      )
    ).rows.length,
    1,
  );
  await mutate(seller, "post.delete", { id: postId });
  assert.equal(
    (await as(buyer, (tx) => tx.query("select * from public.posts"))).rows
      .length,
    0,
  );
  assert.equal(
    (await as(buyer, (tx) => tx.query("select * from public.messages"))).rows
      .length,
    2,
  );
  assert.equal(
    (
      await as(buyer, (tx) =>
        tx.query("select * from public.media where id=$1", [image]),
      )
    ).rows.length,
    0,
  );
  await mutate(buyer, "account.delete", {});
  await db.query(
    "update auth.identities set identity_data=$2 where user_id=$1",
    [buyer, { name: "복원하면 안 되는 이름" }],
  );
  assert.equal(
    (
      await db.query<{ display_name: string }>(
        "select display_name from public.profiles where id=$1",
        [buyer],
      )
    ).rows[0].display_name,
    "탈퇴한 사용자",
  );
  assert.equal(
    (await as(buyer, (tx) => tx.query("select * from public.messages"))).rows
      .length,
    0,
  );
  await assert.rejects(
    mutate(seller, "message.send", { ...message, client_id: testId(40) }),
    /탈퇴/,
  );
  await db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    await assert.rejects(
      tx.query("select * from public.posts"),
      /permission denied/,
    );
  });

  for (const role of ["anon", "authenticated"])
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.exec("set local role " + role);
        await tx.query("select public.set_app_environment('development')");
      }),
      /permission denied/,
    );
  async function environment(value: string) {
    await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      await tx.query("select public.set_app_environment($1)", [value]);
    });
  }
  await environment("development");
  const external = testId(99);
  await db.query("insert into auth.users values($1,$2,now(),$3)", [
    external,
    "outside@gmail.com",
    { provider: "google" },
  ]);
  assert.equal(
    (
      await as(external, (tx) =>
        tx.query<{ allowed: boolean }>("select public.is_member() allowed"),
      )
    ).rows[0].allowed,
    true,
  );
  await mutate(external, "upload.consume", {});
  assert.equal(
    (
      await as(unverified, (tx) =>
        tx.query<{ allowed: boolean }>("select public.is_member() allowed"),
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    db.query("insert into auth.users values($1,$2,now(),$3)", [
      testId(98),
      "outside@gmail.com",
      { provider: "email" },
    ]),
    /학교 Google/,
  );
  await environment("production");
  assert.equal(
    (
      await as(external, (tx) =>
        tx.query<{ allowed: boolean }>("select public.is_member() allowed"),
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (await as(external, (tx) => tx.query("select * from public.profiles"))).rows
      .length,
    0,
  );
  await assert.rejects(mutate(external, "upload.consume", {}), /학교 계정/);
  await assert.rejects(environment("invalid"), /check constraint/);
  await db.close();
});
