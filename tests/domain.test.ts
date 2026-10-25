import { test } from "node:test";
import assert from "node:assert/strict";
import { isSchoolEmail, postSchema, searchKeywords } from "../lib/domain";
const testId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("school email requires exact domain and one @", () => {
  for (const email of ["a@hafs.hs.kr", "A@HAFS.HS.KR"])
    assert.equal(isSchoolEmail(email), true);
  for (const email of [
    "a@gmail.com",
    "a@hafs.hs.kr.evil.com",
    "a@sub.hafs.hs.kr",
    "a@@hafs.hs.kr",
    "a @hafs.hs.kr",
  ])
    assert.equal(isSchoolEmail(email), false);
});
test("search splits keywords, dedupes and strips filter syntax", () => {
  assert.deepEqual(searchKeywords("  파란  노트 Notebook notebook "), [
    "파란",
    "노트",
    "notebook",
  ]);
  assert.deepEqual(searchKeywords('a,b) c.d "e"'), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(searchKeywords("100%"), ["100"]);
  assert.deepEqual(searchKeywords("a b c d e f g"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(searchKeywords(null), []);
  assert.deepEqual(searchKeywords(" ,() "), []);
});
test("post rules enforce prices, images and lost dates", () => {
  const base = {
    kind: "sale",
    title: "판매 테스트",
    body: "상태가 좋은 물건입니다.",
    price: 1000,
    category: "기타",
    place: "직접 정하기",
    occurred_on: null,
    custody: "",
    image_ids: [testId(999)],
  };
  assert.equal(postSchema.safeParse(base).success, true);
  assert.equal(postSchema.safeParse({ ...base, price: 0 }).success, false);
  assert.equal(postSchema.safeParse({ ...base, image_ids: [] }).success, false);
  const barter = { ...base, kind: "barter", price: 0, wanted: "문제집" };
  assert.equal(postSchema.safeParse(barter).success, true);
  assert.equal(postSchema.safeParse({ ...barter, wanted: "" }).success, false);
  assert.equal(
    postSchema.safeParse({ ...base, wanted: "문제집" }).success,
    false,
  );
  assert.equal(
    postSchema.safeParse({ ...base, kind: "giveaway", price: 1000 }).success,
    false,
  );
  assert.equal(
    postSchema.safeParse({ ...base, kind: "lost", price: 0, image_ids: [] })
      .success,
    false,
  );
  assert.equal(
    postSchema.safeParse({
      ...base,
      kind: "found",
      price: 0,
      occurred_on: "2020-01-01",
    }).success,
    false,
  );
});

test("environment controls email restriction", async () => {
  const { appEnvironment, allowedEmail } = await import("../lib/environment");
  assert.equal(appEnvironment("production"), "production");
  assert.equal(appEnvironment("development"), "development");
  assert.throws(() => appEnvironment("staging"));
  assert.equal(allowedEmail("person@gmail.com", "development"), true);
  assert.equal(allowedEmail("person@gmail.com", "production"), false);
  assert.equal(allowedEmail("person@Hafs.hs.kr", "production"), true);
  assert.equal(allowedEmail(undefined, "development"), false);
});
