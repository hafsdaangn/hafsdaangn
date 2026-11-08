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
  conversations: [],
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
