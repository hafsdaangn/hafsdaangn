import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

test("shared select supports form values, keyboard navigation, focus and disabled state", async ({
  page,
}) => {
  const result = await build({
    stdin: {
      contents:
        'import {createRoot} from "react-dom/client"; import {Select} from "./components/select"; function App(){ return <form onSubmit={e=>{e.preventDefault();document.querySelector("output").textContent=new FormData(e.currentTarget).get("category")}}><label htmlFor="category">카테고리</label><Select id="category" name="category" defaultValue="교재·도서" options={["교재·도서","문구","전자기기","생활용품","기타"].map(value=>({value,label:value}))}/><label htmlFor="disabled">비활성 선택</label><Select id="disabled" disabled defaultValue="기타" options={[{value:"기타",label:"기타"}]}/><button type="submit">저장</button><output /></form> } createRoot(document.getElementById("root")).render(<App/>);',
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "select-fixture.js",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const css =
    (await readFile("tokens.css", "utf8")) +
    (await readFile("app/globals.css", "utf8")).replace(/^@import.*$/gm, "") +
    result.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
  await page.route("**/__select", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        css +
        'form{max-width:400px;margin:24px;padding:12px}</style><div id="root"></div><script>' +
        result.outputFiles.find((file) => file.path.endsWith(".js"))!.text +
        "</script></html>",
    }),
  );
  await page.goto("/__select");
  const trigger = page.getByRole("combobox", { name: "카테고리", exact: true });
  await expect(trigger).toHaveText("교재·도서");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator("output")).toHaveText("교재·도서");
  await trigger.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.getByRole("option", { name: "전자기기", exact: true }).click();
  await expect(trigger).toHaveText("전자기기");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator("output")).toHaveText("전자기기");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "전자기기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "기타", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText("기타");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole("combobox", { name: "비활성 선택", exact: true }),
  ).toBeDisabled();
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 600 });
    await trigger.click();
    const box = await page.getByRole("listbox").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (width === 375)
      await page.screenshot({
        path: "output/shared-select.png",
        fullPage: true,
      });
    await page.keyboard.press("Escape");
  }
});
