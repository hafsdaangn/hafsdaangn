import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import sharp from "sharp";

async function load(entry: string, globals: Record<string, unknown> = {}) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["sharp"],
    plugins: [
      {
        name: "boundaries",
        setup(builder) {
          builder.onResolve(
            { filter: /^(server-only|@\/lib\/auth)$/ },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path }) => ({
              contents:
                path === "server-only"
                  ? ""
                  : "export const member=()=>globalThis.authenticate();",
            }),
          );
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
    Uint8Array,
    Response,
    Request,
    URL,
    performance,
    console,
    ...globals,
  });
  return compiledModule.exports as {
    GET: (
      request: Request,
      context?: { params: Promise<{ id: string }> },
    ) => Promise<Response>;
    mediaBytes: (
      path: string,
      width: number,
      download: () => Promise<Buffer>,
    ) => Promise<Buffer>;
  };
}

test("initial data scopes names to inbox participants and avoids global message history", async () => {
  const calls: {
    table: string;
    column?: string;
    ids?: string[];
    limit?: number;
  }[] = [];
  const room = "00000000-0000-4000-8000-000000000001";
  const client = {
    rpc: async () => ({
      data: [
        {
          id: room,
          seller_id: "me",
          buyer_id: "other",
          post_id: "post",
          unread_count: 2,
          last_body: "preview",
        },
      ],
      error: null,
    }),
    from: (table: string) => {
      const q = {
        select: () => q,
        in: (column: string, ids: string[]) => {
          calls.push({ table, column, ids });
          return Promise.resolve({
            data:
              table === "profiles"
                ? [{ id: "me", display_name: "Tester" }]
                : [],
            error: null,
          });
        },
        eq: (column: string, id: string) => {
          calls.push({ table, column, ids: [id] });
          return q;
        },
        order: () => q,
        limit: (limit: number) => {
          calls.push({ table, limit });
          return Promise.resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
  const { GET } = await load("app/api/data/route.ts", {
    authenticate: async () => ({ client, user: { id: "me" } }),
  });
  const initial = await GET(new Request("http://app.test/api/data"));
  assert.equal(initial.status, 200);
  assert.deepEqual(
    [...(calls.find((call) => call.table === "profiles")?.ids ?? [])],
    ["me", "other"],
  );
  assert.equal(
    calls.some((call) => call.table === "messages"),
    false,
  );
  calls.length = 0;
  const active = await GET(
    new Request(`http://app.test/api/data?conversation=${room}`),
  );
  assert.equal(active.status, 200);
  assert.equal(
    calls.find((call) => call.table === "messages" && call.column)?.ids?.[0],
    room,
  );
  assert.equal(
    calls.find((call) => call.table === "messages" && call.limit)?.limit,
    50,
  );
});

test("unauthenticated initial data stays private", async () => {
  const { GET } = await load("app/api/data/route.ts", {
    authenticate: async () => {
      throw new Error("login required");
    },
  });
  const response = await GET(new Request("http://app.test/api/data"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("thumbnail requests share one source download and reduce transfer size", async (t) => {
  const { mediaBytes } = await load("lib/media-cache.ts");
  const source = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#ff6800" },
  })
    .webp({ quality: 82 })
    .toBuffer();
  let downloads = 0;
  const download = async () => {
    downloads++;
    return source;
  };
  const [small, duplicate, large] = await Promise.all([
    mediaBytes("private/test.webp", 320, download),
    mediaBytes("private/test.webp", 320, download),
    mediaBytes("private/test.webp", 640, download),
  ]);
  assert.equal(downloads, 1);
  assert.equal(small, duplicate);
  assert.equal((await sharp(small).metadata()).width, 320);
  assert.equal((await sharp(large).metadata()).width, 640);
  assert.ok(small.length < source.length);
  t.diagnostic(
    `Synthetic 1600px image: ${source.length} bytes → 320px thumbnail: ${small.length} bytes`,
  );
});

test("a cached image cannot bypass media row authorization", async () => {
  const bytes = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
  let allowed = true,
    downloads = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: allowed ? { path: "private/test.webp" } : null,
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: async () => {
          downloads++;
          return { data: new Blob([new Uint8Array(bytes)]), error: null };
        },
      }),
    },
  };
  const { GET } = await load("app/api/media/[id]/route.ts", {
    authenticate: async () => ({ client }),
    Blob,
  });
  const params = {
    params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
  };
  assert.equal(
    (await GET(new Request("http://app.test/image?w=320"), params)).status,
    200,
  );
  allowed = false;
  const denied = await GET(new Request("http://app.test/image?w=320"), params);
  assert.equal(denied.status, 404);
  assert.equal(downloads, 1);
  assert.equal(denied.headers.get("cache-control"), "private, no-store");
});
