import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { SignJWT, generateKeyPair, exportJWK, jwtVerify } from "jose";

async function load(
  entry: string,
  globals: Record<string, unknown> = {},
  fixtures: Record<string, string> = {},
) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "auth-boundaries",
        setup(b) {
          b.onResolve({ filter: /.*/ }, ({ path }) =>
            path === "server-only" || Object.hasOwn(fixtures, path)
              ? { path, namespace: "fixture" }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents: fixtures[path] ?? "",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const compiledModule = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: createRequire(import.meta.url),
    Buffer,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    AbortSignal,
    crypto: webcrypto,
    Uint8Array,
    Headers,
    Request,
    Response,
    structuredClone,
    atob,
    btoa,
    CryptoKey: webcrypto.CryptoKey,
    setTimeout,
    clearTimeout,
    fetch,
    console,
    process: {
      env: {
        APP_ENV: "production",
        APP_URL: "https://school.example",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        AUTH_SECRET: "x".repeat(64),
        ...(globals.env as object),
      },
    },
    ...globals,
  });
  return compiledModule.exports as typeof import("../lib/google-oauth") &
    typeof import("../lib/database-token") & {
      default: (props: {
        children?: string;
        searchParams?: Promise<{ error?: string }>;
      }) => Promise<unknown>;
    };
}

test("Google login uses our callback, S256 PKCE, state and nonce", async () => {
  const oauth = await load("lib/google-oauth.ts");
  const first = await oauth.beginGoogleLogin();
  const second = await oauth.beginGoogleLogin();
  const url = new URL(first.url);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://school.example/auth/callback",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("hd"), "hafs.hs.kr");
  assert.notEqual(first.cookie, second.cookie);
  const state = url.searchParams.get("state")!;
  const transaction = await oauth.readGoogleTransaction(first.cookie, state);
  assert.equal(transaction.nonce, url.searchParams.get("nonce"));
  await assert.rejects(oauth.readGoogleTransaction(first.cookie, "wrong"));
  await assert.rejects(oauth.readGoogleTransaction(first.cookie + "x", state));
  const expired = await new SignJWT({ state, nonce: "n", verifier: "v" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("https://school.example")
    .setAudience("google-login")
    .setExpirationTime(1)
    .sign(new TextEncoder().encode("x".repeat(64)));
  await assert.rejects(oauth.readGoogleTransaction(expired, state));
});

test("Google claims reject unverified, non-school, wrong hosted domain and nonce", async () => {
  const oauth = await load("lib/google-oauth.ts");
  const valid = {
    sub: "google-sub",
    email: "student@hafs.hs.kr",
    email_verified: true,
    hd: "hafs.hs.kr",
    nonce: "n",
  };
  assert.equal(oauth.validateGoogleClaims(valid, "n").sub, "google-sub");
  for (const patch of [
    { email_verified: false },
    { email: "x@gmail.com" },
    { hd: undefined },
    { hd: "other.school" },
    { nonce: "wrong" },
    { sub: "" },
    { azp: "other-client" },
  ])
    assert.throws(() =>
      oauth.validateGoogleClaims({ ...valid, ...patch }, "n"),
    );
  const dev = await load("lib/google-oauth.ts", {
    env: { APP_ENV: "development" },
  });
  assert.equal(
    dev.validateGoogleClaims(
      { ...valid, hd: undefined, email: "x@gmail.com" },
      "n",
    ).email,
    "x@gmail.com",
  );
});

test("Google token signatures, issuer and audience are verified before account data is trusted", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const issue = (
    issuer = "https://accounts.google.com",
    audience = "client-id",
    expires: string | number = "5m",
    key = privateKey,
  ) =>
    new SignJWT({
      nonce: "n",
      email: "student@hafs.hs.kr",
      email_verified: true,
      hd: "hafs.hs.kr",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("google-sub")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(key);
  let token = await issue();
  let sent: URLSearchParams | undefined;
  const oauth = await load(
    "lib/google-oauth.ts",
    {
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "https://oauth2.googleapis.com/token");
        sent = init.body as URLSearchParams;
        return Response.json({ id_token: token });
      },
    },
    {
      // Use a local public JWKS to exercise actual jose verification without network.
      jose: `export { jwtVerify, SignJWT } from "jose-local"; import { createLocalJWKSet } from "jose-local";
      export const createRemoteJWKSet=()=>createLocalJWKSet(${JSON.stringify({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] })});`,
      "jose-local": `export * from "${process.cwd().replaceAll("\\", "/")}/node_modules/jose/dist/webapi/index.js";`,
    },
  );
  assert.equal(
    (await oauth.finishGoogleLogin("code", { nonce: "n", verifier: "v" })).sub,
    "google-sub",
  );
  assert.equal(sent!.get("code_verifier"), "v");
  await assert.rejects(
    oauth.finishGoogleLogin("code", { nonce: "wrong", verifier: "v" }),
  );
  const attacker = await generateKeyPair("RS256");
  for (const invalid of [
    await issue("https://attacker.example"),
    await issue("https://accounts.google.com", "other-client"),
    await issue("https://accounts.google.com", "client-id", 1),
    await issue(
      "https://accounts.google.com",
      "client-id",
      "5m",
      attacker.privateKey,
    ),
  ]) {
    token = invalid;
    await assert.rejects(
      oauth.finishGoogleLogin("code", { nonce: "n", verifier: "v" }),
    );
  }
});

test("private layouts reject absent, revoked and disallowed sessions", async () => {
  for (const scenario of [
    "missing",
    "revoked",
    "external",
    "valid",
    "database-error",
    "setup",
  ] as const) {
    let policyCalls = 0;
    const rendered = await load(
      "app/app/layout.tsx",
      {
        lookup: async () => ({
          data:
            scenario === "revoked"
              ? null
              : {
                  id: "id",
                  email:
                    scenario === "external" ? "x@gmail.com" : "x@hafs.hs.kr",
                  session_id: "session",
                },
          error: scenario === "database-error" ? {} : null,
        }),
        getCookie: () =>
          scenario === "missing" ? undefined : { value: "x".repeat(43) },
        syncPolicy: () => {
          policyCalls++;
        },
      },
      {
        "next/navigation":
          'export function redirect(destination){throw Object.assign(new Error("redirect"),{destination})}',
        "next/headers":
          "export const cookies=async()=>({get:()=>globalThis.getCookie()});",
        "@/components/provider":
          "export const AppProvider=({children})=>children;",
        "@/lib/supabase/server": `export const configured=()=>${scenario !== "setup"}; export const storageAdmin=()=>({rpc:()=>globalThis.lookup()}); export const databaseClient=()=>({});`,
        "@/lib/auth-policy":
          "export const ensureAuthPolicy=async()=>globalThis.syncPolicy();",
        "@/lib/google-oauth":
          'export const sessionCookie=()=>"session";export const tokenHash=(v)=>v;',
        "@/lib/database-token":
          'export const databaseToken=async()=>"scoped-token";',
      },
    );
    const destinations = {
      missing: "/?error=session",
      revoked: "/?error=session",
      external: "/?error=school",
      "database-error": "/?error=connection",
      setup: "/?error=setup",
    };
    if (scenario === "valid")
      assert.ok(await rendered.default({ children: "private" }));
    else
      await assert.rejects(
        rendered.default({ children: "private" }),
        (e: unknown) =>
          (e as { destination?: string }).destination ===
          destinations[scenario],
      );
    if (scenario === "missing") assert.equal(policyCalls, 0);
  }
});

test("landing restores a valid session even with an old error URL and distinguishes connection failures", async () => {
  for (const scenario of ["valid", "missing", "offline"] as const) {
    const page = await load(
      "app/page.tsx",
      { scenario },
      {
        "next/navigation":
          'export function redirect(destination){throw Object.assign(new Error("redirect"),{destination})}',
        "@/lib/supabase/server": "export const configured=()=>true;",
        "@/lib/auth": `export class MembershipError extends Error {}
        export async function member(){
          if(globalThis.scenario==='missing') throw new MembershipError();
          if(globalThis.scenario==='offline') throw new Error('Database unavailable');
          return {user:{id:'existing-user'}};
        }`,
        "@/components/brand": "export const Brand=()=>null;",
        "@/components/install-entry": "export const InstallEntry=()=>null;",
      },
    );
    const props = { searchParams: Promise.resolve({ error: "school" }) };
    if (scenario === "valid") {
      await assert.rejects(
        page.default(props),
        (e: unknown) => (e as { destination?: string }).destination === "/app",
      );
    } else {
      const rendered = JSON.stringify(await page.default(props));
      if (scenario === "offline") {
        assert.ok(rendered.includes("잠시 후 새로고침해 주세요."));
        assert.ok(!rendered.includes("선택한 계정은 이용할 수 없어요."));
      } else {
        assert.ok(rendered.includes("학교 Google 계정을 선택해 주세요."));
      }
    }
  }
});

test("database JWT is short-lived and contains user and revocable session IDs", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(privateKey)), kid: "test" };
  const db = await load("lib/database-token.ts", {
    env: { SUPABASE_SIGNING_JWK: JSON.stringify(jwk) },
  });
  const token = await db.databaseToken("user-id", "session-id");
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["ES256"],
    audience: "authenticated",
  });
  assert.equal(payload.sub, "user-id");
  assert.equal(payload.role, "authenticated");
  assert.equal(payload.app_session_id, "session-id");
  assert.equal(payload.exp! - payload.iat!, 300);
});
