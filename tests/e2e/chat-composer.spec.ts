import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let script: string;
let css: string;
test.use({
  viewport: { width: 390, height: 700 },
  isMobile: true,
  hasTouch: true,
});
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents:
        'import {useState} from "react";import {createRoot} from "react-dom/client";import {Chats} from "./components/chats";function App(){const [open,setOpen]=useState(true);window.closeChat=()=>setOpen(false);return <>{open?<Chats id="room"/>:<main style={{height:1800}}>채팅 밖 화면</main>}<button id="outside">다른 작업</button></>}createRoot(document.getElementById("root")).render(<App/>);',
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "chat-fixture.js",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [
      {
        name: "chat-context",
        setup(builder) {
          builder.onResolve({ filter: /^\.\/provider$/ }, () => ({
            path: "context",
            namespace: "chat",
          }));
          builder.onLoad({ filter: /.*/, namespace: "chat" }, () => ({
            resolveDir: process.cwd(),
            contents: `
        import {useSyncExternalStore} from 'react';
        const control=window.chatTest={bodies:[],finish:[],blur:0,reads:[],closed:[]};
        const message=(seq,body,sender_id='them',client_id='history-'+seq)=>({id:'message-'+seq,seq,body,sender_id,client_id,conversation_id:'room',image_id:null,created_at:'2026-11-08T01:00:00Z'});
        let state={viewer:{id:"me"},profiles:[{id:"them",display_name:"상대방"}],posts:[],messages:Array.from({length:window.chatHistory||0},(_,i)=>message(i+1,'기존 메시지 '+(i+1))),conversations:[{id:"room",seller_id:"me",buyer_id:"them",post_id:"post",title:"테스트 게시글",kind:"giveaway",last_message_at:new Date().toISOString(),buyer_read_seq:0,seller_read_seq:0}]};
        const listeners=new Set();const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};const snapshot=()=>state;
        const append=()=>{const seq=(state.messages.at(-1)?.seq||0)+1;state={...state,messages:[...state.messages,message(seq,'새로 받은 메시지 '+seq)]};listeners.forEach(fn=>fn())};control.append=append;
        const model={base:"/app",image:()=>"",loadMessages:async(id,before)=>{if(before){const older=Array.from({length:10},(_,i)=>message(before-10+i,'이전 메시지 '+(before-10+i)));state={...state,messages:[...older,...state.messages]};listeners.forEach(fn=>fn());return false}return !!window.chatOlder},upload:async()=>"image",mutate:async(op,payload)=>{if(op==="message.read"){control.reads.push(payload.seq);if(window.holdChatRead)return new Promise((resolve,reject)=>control.finishRead=fail=>fail?reject(new Error("read failed")):resolve());return}if(op!=="message.send")return;control.bodies.push(payload.body);return new Promise((resolve,reject)=>control.finish.push(fail=>{if(fail)return reject(new Error("전송 실패"));const seq=(state.messages.at(-1)?.seq||0)+1;const sent=message(seq,payload.body,'me',payload.client_id);state={...state,messages:[...state.messages,sent]};listeners.forEach(fn=>fn());resolve(sent)}));}};
        export const useApp=()=>({...model,state:useSyncExternalStore(subscribe,snapshot)});`,
          }));
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "link",
          }));
          builder.onLoad({ filter: /.*/, namespace: "link" }, () => ({
            contents:
              'import{createElement}from"react";export default function Link(props){return createElement("a",props)}',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  script = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  css =
    (await readFile("tokens.css", "utf8")) +
    (await readFile("app/globals.css", "utf8")).replace(/^@import.*$/gm, "");
});

type Controls = {
  bodies: string[];
  finish: ((fail?: boolean) => void)[];
  blur: number;
  append: () => void;
  reads: number[];
  closed: string[];
  finishRead: (fail?: boolean) => void;
};
async function openChat(
  page: Page,
  options: {
    visualViewport?: boolean;
    history?: number;
    older?: boolean;
    holdRead?: boolean;
  } = {},
) {
  await page.addInitScript((options) => {
    Object.assign(window, {
      chatHistory: options.history ?? 0,
      chatOlder: options.older,
      holdChatRead: options.holdRead,
    });
    if (options.holdRead) {
      const notification = (name: string, room: string, seq: number) => ({
        tag: `chat-${room}`,
        data: { conversationId: room, seq },
        close: () =>
          (window as unknown as { chatTest: Controls }).chatTest.closed.push(
            name,
          ),
      });
      const notifications = [
        notification("read", "room", 1),
        notification("newer", "room", 2),
        notification("other", "other", 1),
      ];
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          getRegistration: async () => ({
            getNotifications: async () => notifications,
          }),
        },
      });
    }
    if (!options.visualViewport) return;
    const viewport = Object.assign(new EventTarget(), {
      height: screen.height,
      width: screen.width,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    Object.assign(window, {
      resizeChatViewport: (height: number, top = 0) => {
        viewport.height = height;
        viewport.offsetTop = top;
        viewport.dispatchEvent(new Event("resize"));
        viewport.dispatchEvent(new Event("scroll"));
      },
    });
  }, options);
  await page.route("**/__chat-composer", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        css +
        '</style><div id="root"></div><script>' +
        script +
        "</script></html>",
    }),
  );
  await page.goto("/__chat-composer");
  await page.getByRole("textbox", { name: "메시지", exact: true }).waitFor();
  await page.evaluate(() => {
    document
      .querySelector('[aria-label="메시지"]')!
      .addEventListener("blur", () => {
        (window as unknown as { chatTest: Controls }).chatTest.blur++;
      });
  });
}

test("chat notifications close only after successful reading, preserving newer and other-room alerts", async ({
  page,
}) => {
  await openChat(page, { history: 1, holdRead: true });
  const controls = () =>
    page.evaluate(() => {
      const value = (window as unknown as { chatTest: Controls }).chatTest;
      return { reads: value.reads, closed: value.closed };
    });
  await expect.poll(controls).toEqual({ reads: [1], closed: [] });
  await page.evaluate(async () => {
    (window as unknown as { chatTest: Controls }).chatTest.finishRead(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect((await controls()).closed).toEqual([]);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(controls).toEqual({ reads: [1, 1], closed: [] });
  await page.evaluate(() =>
    (window as unknown as { chatTest: Controls }).chatTest.finishRead(),
  );
  await expect.poll(controls).toEqual({ reads: [1, 1], closed: ["read"] });
});

test("touch send keeps continuous input focus while sending multiple messages", async ({
  page,
}) => {
  await openChat(page);
  const input = page.getByRole("textbox", { name: "메시지", exact: true });
  const send = page.getByRole("button", { name: "메시지 전송" });
  await input.fill("첫 번째 메시지");
  await send.tap();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await input.fill("두 번째 메시지");
  await send.tap();
  await expect(input).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { chatTest: Controls }).chatTest.bodies,
    ),
  ).toEqual(["첫 번째 메시지", "두 번째 메시지"]);
  await page.evaluate(() =>
    (window as unknown as { chatTest: Controls }).chatTest.finish.forEach(
      (finish) => finish(),
    ),
  );
  await expect(page.getByText("전송 중", { exact: true })).toHaveCount(0);
  await expect(input).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { chatTest: Controls }).chatTest.blur,
    ),
  ).toBe(0);
});

test("keyboard viewport changes reveal the composer before typing and keep sent messages directly above it", async ({
  page,
}) => {
  await openChat(page, { visualViewport: true });
  const input = page.getByRole("textbox", { name: "메시지", exact: true });
  const send = page.getByRole("button", { name: "메시지 전송" });
  await input.tap();
  // Mimic Safari/Chrome shrinking only VisualViewport: layout viewport stays 700px.
  await page.evaluate(() =>
    (
      window as unknown as {
        resizeChatViewport: (height: number, top?: number) => void;
      }
    ).resizeChatViewport(420),
  );
  await expect
    .poll(
      async () =>
        (await page.locator(".composer").boundingBox())!.y +
        (await page.locator(".composer").boundingBox())!.height,
    )
    .toBeLessThanOrEqual(421);
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await input.fill("키보드 위 첫 메시지");
  await send.tap();
  const first = page
    .locator(".message")
    .filter({ hasText: "키보드 위 첫 메시지" });
  await expect(first).toBeVisible();
  const firstBox = (await first.boundingBox())!;
  const composer = (await page.locator(".composer").boundingBox())!;
  expect(firstBox.y + firstBox.height).toBeLessThanOrEqual(composer.y);
  expect(composer.y - firstBox.y - firstBox.height).toBeLessThan(40);
  await input.fill("키보드 위 두 번째 메시지");
  await send.tap();
  const second = page
    .locator(".message")
    .filter({ hasText: "키보드 위 두 번째 메시지" });
  await expect(second).toBeVisible();
  expect((await first.boundingBox())!.y).toBeLessThan(firstBox.y);
  expect((await second.boundingBox())!.y).toBeGreaterThan(
    (await first.boundingBox())!.y,
  );
  await page.evaluate(() =>
    (window as unknown as { chatTest: Controls }).chatTest.finish.forEach(
      (finish) => finish(),
    ),
  );
  await expect(page.getByText("전송 중", { exact: true })).toHaveCount(0);
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // iOS may also pan the visual viewport while focusing an input.
  await page.evaluate(() =>
    (
      window as unknown as {
        resizeChatViewport: (height: number, top: number) => void;
      }
    ).resizeChatViewport(420, 48),
  );
  await expect
    .poll(async () => (await page.locator(".chat-layout").boundingBox())!.y)
    .toBe(48);
  await expect
    .poll(async () => {
      const box = (await page.locator(".composer").boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(469);
  await page.evaluate(() =>
    (
      window as unknown as {
        resizeChatViewport: (height: number, top: number) => void;
      }
    ).resizeChatViewport(700, 0),
  );
  await expect
    .poll(async () => (await page.locator(".chat-main").boundingBox())!.height)
    .toBe(700);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect
    .poll(() =>
      page
        .locator(".chat-layout")
        .evaluate((element) => getComputedStyle(element).position),
    )
    .toBe("static");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("chat-room-open"),
      ),
    )
    .toBe(false);
});

test("history stays readable, incoming messages do not pull the reader down, and leaving chat restores document scrolling", async ({
  page,
}) => {
  await openChat(page, { visualViewport: true, history: 40, older: true });
  const messages = page.getByLabel("대화 내용", { exact: true });
  await expect
    .poll(() => messages.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await messages.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const anchor = page.getByText("기존 메시지 1", { exact: true });
  const before = (await anchor.boundingBox())!.y;
  await page.getByRole("button", { name: "이전 메시지 보기" }).click();
  await expect(
    page.getByRole("button", { name: "이전 메시지 보기" }),
  ).toHaveCount(0);
  await expect
    .poll(async () => Math.abs((await anchor.boundingBox())!.y - before))
    .toBeLessThan(2);
  const top = await messages.evaluate((element) => element.scrollTop);
  await page.evaluate(() =>
    (window as unknown as { chatTest: Controls }).chatTest.append(),
  );
  await expect(
    messages.getByText("새로 받은 메시지 41", { exact: true }),
  ).toHaveCount(1);
  expect(await messages.evaluate((element) => element.scrollTop)).toBe(top);
  await page.evaluate(() =>
    (window as unknown as { closeChat: () => void }).closeChat(),
  );
  await expect(page.getByText("채팅 밖 화면", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("chat-room-open"),
    ),
  ).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("keyboard submit restores composer focus and a later send failure does not steal focus", async ({
  page,
}) => {
  await openChat(page);
  const input = page.getByRole("textbox", { name: "메시지", exact: true });
  await input.fill("키보드 전송");
  await page.getByRole("button", { name: "메시지 전송" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  const outside = page.getByRole("button", { name: "다른 작업" });
  await outside.focus();
  await page.evaluate(() =>
    (window as unknown as { chatTest: Controls }).chatTest.finish[0](true),
  );
  await expect(
    page.getByRole("button", { name: "전송 실패 · 재시도" }),
  ).toBeVisible();
  await expect(outside).toBeFocused();
});
