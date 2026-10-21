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
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text); alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;`);
  for (const migration of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
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
  for (const uid of [seller, buyer, stranger])
    await mutate(uid, "profile.save", { nickname: "학교친구" });
  assert.equal(
    (
      await as(unverified, (tx) =>
        tx.query<{ allowed: boolean }>("select public.is_member() allowed"),
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    mutate(unverified, "profile.save", { nickname: "거짓인증" }),
    /학교 계정/,
  );
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
    place: "직접 정하기",
    occurred_on: null,
    custody: "",
    image_ids: [image],
  };
  const post = await mutate(seller, "post.save", payload);
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
  await mutate(external, "profile.save", { nickname: "개발계정" });
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
  await assert.rejects(
    mutate(external, "profile.save", { nickname: "차단확인" }),
    /학교 계정/,
  );
  await assert.rejects(environment("invalid"), /check constraint/);
  await db.close();
});
