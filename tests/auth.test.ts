import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

// Exercise the actual protected layout and membership check with isolated auth
// responses. No real account, database mutation, or network request is needed.
const compiled = build({
  entryPoints: ["app/app/layout.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  define: {
    "process.env.APP_ENV": '"production"',
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "auth-boundaries",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(server-only|next\/navigation|@\/components\/provider|@\/lib\/supabase\/server|@\/lib\/auth-policy)$/,
          },
          (args) => ({ path: args.path, namespace: "auth-test" }),
        );
        builder.onLoad(
          { filter: /.*/, namespace: "auth-test" },
          ({ path }) => ({
            contents:
              path === "server-only"
                ? ""
                : path === "next/navigation"
                  ? 'export function redirect(url){throw Object.assign(new Error("redirect"),{destination:url})}'
                  : path === "@/components/provider"
                    ? "export const AppProvider = ({children}) => children;"
                    : path === "@/lib/auth-policy"
                      ? "export async function ensureAuthPolicy(){globalThis.policyCalls++; if(globalThis.policyFailure)throw new Error('policy unavailable')}"
                      : "export const configured=()=>globalThis.testConfigured;export const serverClient=async()=>globalThis.authClient;",
          }),
        );
      },
    },
  ],
});

const schoolUser = {
  email: "member@hafs.hs.kr",
  email_confirmed_at: "2026-11-07",
  identities: [{ provider: "google" }],
};
async function render({
  user = null,
  authError = null,
  allowed = true,
  rpcError = null,
  configured = true,
  policyFailure = false,
}: {
  user?: typeof schoolUser | null;
  authError?: unknown;
  allowed?: boolean;
  rpcError?: unknown;
  configured?: boolean;
  policyFailure?: boolean;
} = {}) {
  const compiledModule = { exports: {} };
  const context = {
    module: compiledModule,
    exports: compiledModule.exports,
    testConfigured: configured,
    policyFailure,
    policyCalls: 0,
    rpcCalls: 0,
    authClient: {
      auth: { getUser: async () => ({ data: { user }, error: authError }) },
      rpc: async () => {
        context.rpcCalls++;
        return { data: allowed, error: rpcError };
      },
    },
  };
  runInNewContext((await compiled).outputFiles[0].text, context);
  const layout = (
    compiledModule.exports as {
      default: (props: { children: string }) => Promise<unknown>;
    }
  ).default;
  try {
    return {
      output: await layout({ children: "private content" }),
      context,
      destination: null,
    };
  } catch (error) {
    if (!(error as { destination?: string }).destination) throw error;
    return {
      output: null,
      context,
      destination: (error as { destination: string }).destination,
    };
  }
}

test("fresh installed app without a session opens sign-in without an error", async () => {
  for (const authError of [
    null,
    { __isAuthError: true, name: "AuthSessionMissingError", status: 400 },
    { code: "refresh_token_not_found" },
  ]) {
    const result = await render({ authError });
    assert.equal(result.destination, "/");
    assert.equal(result.context.policyCalls, 0);
    assert.equal(result.context.rpcCalls, 0);
    assert.equal(result.output, null);
  }
});

test("unapproved accounts remain blocked with the school account notice", async () => {
  for (const user of [
    { ...schoolUser, email: "member@gmail.com" },
    { ...schoolUser, email_confirmed_at: "" },
    { ...schoolUser, identities: [{ provider: "email" }] },
  ])
    assert.equal((await render({ user })).destination, "/?error=school");
  assert.equal(
    (await render({ user: schoolUser, allowed: false })).destination,
    "/?error=school",
  );
});

test("valid school session still renders the private app", async () => {
  const result = await render({ user: schoolUser });
  assert.equal(result.destination, null);
  assert.ok(result.output);
  assert.equal(result.context.policyCalls, 1);
  assert.equal(result.context.rpcCalls, 1);
});

test("service failures are not misreported as a rejected school account", async () => {
  assert.equal(
    (await render({ authError: { code: "unexpected_failure" } })).destination,
    "/?error=login",
  );
  assert.equal(
    (
      await render({
        user: schoolUser,
        rpcError: { code: "connection_failed" },
      })
    ).destination,
    "/?error=login",
  );
  assert.equal(
    (await render({ user: schoolUser, policyFailure: true })).destination,
    "/?error=login",
  );
  assert.equal(
    (await render({ configured: false })).destination,
    "/?error=setup",
  );
});

test("auth policy resyncs after success and failure, coalescing only concurrent calls", async () => {
  const result = await build({
    entryPoints: ["lib/auth-policy.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    define: { "process.env.APP_ENV": '"development"' },
    plugins: [
      {
        name: "policy-boundaries",
        setup(builder) {
          builder.onResolve(
            { filter: /^(server-only|\.\/supabase\/server)$/ },
            (args) => ({ path: args.path, namespace: "policy-test" }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: "policy-test" },
            ({ path }) => ({
              contents:
                path === "server-only"
                  ? ""
                  : "export const storageAdmin = () => ({rpc: (...args) => globalThis.syncPolicy(...args)});",
            }),
          );
        },
      },
    ],
  });
  const compiledModule = { exports: {} };
  let calls = 0;
  let databaseEnvironment = "production";
  let failure = false;
  runInNewContext(result.outputFiles[0].text, {
    module: compiledModule,
    exports: compiledModule.exports,
    syncPolicy: async (
      name: string,
      { environment }: { environment: string },
    ) => {
      assert.equal(name, "set_app_environment");
      calls++;
      if (failure) return { error: { code: "unavailable" } };
      databaseEnvironment = environment;
      return { error: null };
    },
  });
  const { ensureAuthPolicy } = compiledModule.exports as {
    ensureAuthPolicy: () => Promise<void>;
  };
  await Promise.all([ensureAuthPolicy(), ensureAuthPolicy()]);
  assert.equal(calls, 1);
  assert.equal(databaseEnvironment, "development");
  databaseEnvironment = "production";
  await ensureAuthPolicy();
  assert.equal(calls, 2);
  assert.equal(databaseEnvironment, "development");
  failure = true;
  await assert.rejects(ensureAuthPolicy());
  failure = false;
  await ensureAuthPolicy();
  assert.equal(calls, 4);
});
