/* Isolated auth UI regression checks: no real customer accounts or production API calls. */
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const origin = "http://127.0.0.1:3026";
const children = [];
const logs = [];
const api = http.createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  response.setHeader("Content-Type", "application/json");
  const url = new URL(request.url, "http://127.0.0.1:5058");
  const data = url.pathname === "/api/account/login"
    ? { token: "fixture-token", id: "fixture-user", fullName: "Fixture Customer", email: "fixture@example.com", role: "Customer" }
    : url.pathname.endsWith("/store-settings") ? {}
    : url.pathname === "/api/catalog/seo"
      ? { siteName: "Vendora", siteUrl: "", titleTemplate: "{title} | {siteName}", isIndexingEnabled: false }
      : url.pathname === "/api/account/me"
        ? { id: "fixture-user", fullName: "Fixture Customer", email: "fixture@example.com" }
        : [];
  response.end(JSON.stringify(data));
});

async function ready(url) {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try {
      const result = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (result.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  throw new Error("Local Next server not ready: " + url + "\n" + logs.slice(-16).join(""));
}
async function main() {
  await new Promise(resolve => api.listen(5058, "127.0.0.1", resolve));
  const next = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3026"], {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:5058", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_STRIPE_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  children.push(next);
  for (const stream of [next.stdout, next.stderr]) stream.on("data", data => { logs.push(data.toString()); if (logs.length > 70) logs.shift(); });
  await ready(origin + "/fa/login");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of ["fa", "en"]) {
      for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.goto(origin + "/" + locale + "/account");
        await page.locator("#login-email").waitFor({ timeout: 30000 });
        assert.equal(await page.locator("html").getAttribute("dir"), locale === "fa" ? "rtl" : "ltr");
        assert.equal(await page.locator("#login-password").isVisible(), true);
        assert.equal(await page.getByRole("button", { name: locale === "fa" ? "ورود به حساب" : "Sign in", exact: true }).isVisible(), true);
        assert.equal(await page.getByText("خرید خوب، از ورود ساده شروع می‌شود.").count(), 0);
        assert.equal(await page.getByRole("button", { name: /Send sign-in code|ارسال کد ورود|Continue with Google|ادامه با Google/ }).count(), 0);
        assert.equal(await page.getByText("Fixture Customer").count(), 0);
        await page.locator("#login-email").fill("fixture@example.com");
        await page.locator("#login-password").fill("wrong-password");
        await page.getByRole("button", { name: locale === "fa" ? "ورود به حساب" : "Sign in", exact: true }).click();
        await page.locator(".vd-account-page").waitFor({ timeout: 30000 });
        if (width < 1024) {
          await page.locator(".vd-account-page button[aria-expanded]").click();
          await page.getByRole("dialog").getByRole("button", { name: locale === "fa" ? "خروج از حساب" : "Sign out" }).click();
        } else {
          await page.getByRole("button", { name: locale === "fa" ? "خروج از حساب" : "Sign out" }).click();
        }
        await page.locator("#login-email").waitFor({ timeout: 15000 });
        assert.equal(await page.evaluate(() => localStorage.getItem("auth")), null);
        await page.goto(origin + "/" + locale + "/login");
        await page.locator("#login-email").waitFor();
        assert.equal(await page.getByText("خرید خوب، از ورود ساده شروع می‌شود.").count(), 0);
        assert.equal(errors.length, 0, "JS errors: " + errors.join(" | "));
        await context.close();
      }
    }
    console.log("PASS: guest account sign-in (fa/en, desktop/mobile), email login, authenticated account, no disabled methods or marketing.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); console.error(logs.slice(-18).join("")); process.exitCode = 1; }).finally(() => {
  for (const child of children) child.kill();
  api.closeAllConnections(); api.close();
});
