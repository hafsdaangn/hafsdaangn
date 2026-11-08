import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import {useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {AppProvider,useApp} from './components/provider';
        function Controls(){const app=useApp();const [result,setResult]=useState('');
          return <><h1>{app.state?.viewer.display_name??'loading'}</h1>
            <button onClick={()=>Promise.all([app.refresh(),app.refresh(),app.refresh()]).then(()=>setResult('refreshed'))}>Refresh</button>
            <button onClick={async()=>{app.cacheFeed('market',[],false);await app.mutate('post.status',{id:'post',status:'completed'});setResult(app.getFeed('market')?'cached':'saved')}}>Save</button>
            <button onClick={()=>Promise.all([app.loadPosts('type=market'),app.loadPosts('type=market'),app.loadPosts('type=market')]).then(pages=>setResult(pages[0].posts[0]?.status??'posts loaded'))}>Posts</button>
            <button onClick={()=>app.mutate('message.read',{conversation_id:'room',seq:5}).then(()=>setResult('read'))}>Read</button>
            <button onClick={()=>app.mutate('message.send',{conversation_id:'room',body:'hello'}).then(()=>setResult('sent'))}>Send</button>
            <aside>{app.state?.conversations[0]?.unread_count}:{app.state?.conversations[0]?.last_body}</aside>
            <output>{result}</output><p>{app.state?.posts[0]?.status}</p></>}
        createRoot(document.getElementById('root')).render(<AppProvider><Controls/></AppProvider>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "no-realtime-backend",
        setup(builder) {
          builder.onResolve({ filter: /supabase\/browser$/ }, () => ({
            path: "browser",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: "export const browserClient=()=>null;",
          }));
        },
      },
    ],
  });
  script = result.outputFiles[0].text;
});

const snapshot = {
  viewer: { id: "me", display_name: "Tester" },
  profiles: [],
  posts: [],
  conversations: [
    {
      id: "room",
      seller_id: "me",
      buyer_id: "other",
      unread_count: 3,
      seller_read_seq: 0,
      buyer_read_seq: 0,
    },
  ],
  messages: [],
  hasMore: false,
};
async function open(page: Page) {
  await page.route("**/__app-performance", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><div id="root"></div><script>${script}</script></html>`,
    }),
  );
  await page.goto("/__app-performance");
  await expect(page.getByRole("heading", { name: "Tester" })).toBeVisible();
}

test("concurrent snapshot refreshes share one network request", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/data", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: snapshot });
  });
  await open(page);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.locator("output")).toHaveText("refreshed");
  expect(requests).toBe(2); // One initial load and one shared refresh.
});

test("a saved mutation is usable while background refresh is blocked", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/data", async (route) => {
    if (++requests > 1) await blocked;
    await route.fulfill({ json: snapshot });
  });
  await page.route("**/api/mutate", (route) =>
    route.fulfill({ json: { id: "post", status: "completed" } }),
  );
  try {
    await open(page);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("output")).toHaveText("saved");
    await expect(page.getByText("completed", { exact: true })).toBeVisible();
    expect(requests).toBe(2);
  } finally {
    release();
  }
});

test("parallel post queries and a repeated visit reuse one result", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/data", (route) => route.fulfill({ json: snapshot }));
  await page.route("**/api/posts?type=market", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: { posts: [], profiles: [], hasMore: false } });
  });
  await open(page);
  await page.getByRole("button", { name: "Posts", exact: true }).click();
  await expect(page.locator("output")).toHaveText("posts loaded");
  await page.getByRole("button", { name: "Posts", exact: true }).click();
  expect(requests).toBe(1);
});

test("reading and sending update the inbox without a full snapshot request", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/data", (route) => {
    requests++;
    return route.fulfill({ json: snapshot });
  });
  await page.route("**/api/mutate", (route) => {
    const { op } = route.request().postDataJSON();
    return route.fulfill({
      json:
        op === "message.send"
          ? {
              id: "message",
              seq: 6,
              conversation_id: "room",
              sender_id: "me",
              body: "hello",
              created_at: new Date().toISOString(),
            }
          : true,
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.locator("output")).toHaveText("read");
  await expect(page.locator("aside")).toHaveText("0:");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("output")).toHaveText("sent");
  await expect(page.locator("aside")).toHaveText("0:hello");
  expect(requests).toBe(1);
});

test("a post response begun before saving cannot restore stale post data", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/data", (route) => route.fulfill({ json: snapshot }));
  await page.route("**/api/posts?type=market", async (route) => {
    const old = ++requests === 1;
    if (old) await pending;
    await route.fulfill({
      json: {
        posts: [{ id: "post", status: old ? "active" : "completed" }],
        hasMore: false,
      },
    });
  });
  await page.route("**/api/mutate", (route) =>
    route.fulfill({ json: { id: "post", status: "completed" } }),
  );
  try {
    await open(page);
    await page.getByRole("button", { name: "Posts", exact: true }).click();
    await expect.poll(() => requests).toBe(1);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("output")).toHaveText("saved");
    release();
    await expect(page.locator("output")).toHaveText("completed");
    expect(requests).toBe(2);
  } finally {
    release();
  }
});

test("an older snapshot cannot restore unread badges after a successful read", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/data", async (route) => {
    if (++requests > 1) await pending;
    await route.fulfill({ json: snapshot });
  });
  await page.route("**/api/mutate", (route) => route.fulfill({ json: true }));
  try {
    await open(page);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect.poll(() => requests).toBe(2);
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await expect(page.locator("output")).toHaveText("read");
    release();
    await expect(page.locator("output")).toHaveText("refreshed");
    await expect(page.locator("aside")).toHaveText("0:");
  } finally {
    release();
  }
});
