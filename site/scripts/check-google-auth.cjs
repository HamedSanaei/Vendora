/* Browser contract regression for Google Identity Services popup (isolated fixtures only). */
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const origin = "http://127.0.0.1:3027";
const logs = [];
let exchangeCount = 0;
let linkCount = 0;
const api = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url, "http://127.0.0.1:5057");
  res.setHeader("Content-Type", "application/json");
  let result = [];
  if (url.pathname === "/api/account/google") {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks).toString()).credential, "fixture-google-id-token");
    exchangeCount++;
    result = { token: "fixture-vendora-session", id: "fixture-user", fullName: "Google Fixture", email: "fixture@gmail.com", role: "Customer" };
  } else if (url.pathname === "/api/account/google/link") {
    assert.equal(req.headers.authorization, "Bearer fixture-vendora-session");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks).toString()).credential, "fixture-google-id-token");
    linkCount++;
    result = { token: "fixture-vendora-session", id: "fixture-user", fullName: "Google Fixture", email: "fixture@gmail.com", role: "Customer" };
  } else if (url.pathname.endsWith("/store-settings")) result = {};
  else if (url.pathname === "/api/catalog/seo") result = { siteName: "Vendora", siteUrl: "", titleTemplate: "{title} | {siteName}", isIndexingEnabled: false };
  else if (url.pathname === "/api/account/me") result = { id: "fixture-user", fullName: "Google Fixture", email: "fixture@gmail.com" };
  res.end(JSON.stringify(result));
});
async function ready(url) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (r.status < 500) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error("Next not ready: " + logs.slice(-18).join(""));
}
const fakeGoogle = `window.google={accounts:{id:{
 initialize:function(opts){window.__gisCallback=opts.callback},
 renderButton:function(node){ const btn=document.createElement('button');btn.textContent='Fixture Google'; btn.addEventListener('click',()=>window.__gisCallback({credential:'fixture-google-id-token'}));node.appendChild(btn);},
 disableAutoSelect:function(){}
}}};`;
async function main() {
  await new Promise(resolve => api.listen(5057, "127.0.0.1", resolve));
  const app = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3027"], {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:5057", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "fixture.apps.googleusercontent.com", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  for (const stream of [app.stdout, app.stderr]) stream.on("data", chunk => { logs.push(chunk.toString()); if (logs.length > 75) logs.shift(); });
  try {
    await ready(origin + "/fa/login");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const locale of ["fa", "en"]) {
        const context = await browser.newContext();
        await context.route("https://accounts.google.com/gsi/client", route => route.fulfill({ contentType: "text/javascript", body: fakeGoogle }));
        const page = await context.newPage();
        await page.goto(origin + "/" + locale + "/login");
        await page.getByText("Fixture Google").waitFor({ timeout: 15000 });
        await page.getByText("Fixture Google").click();
        await page.locator(".vd-account-page").waitFor({ timeout: 15000 });
        const auth = await page.evaluate(() => JSON.parse(localStorage.getItem("auth")));
        assert.equal(auth.accessToken, "fixture-vendora-session");
        await page.goto(origin + "/" + locale + "/account/security");
        await page.getByText("Fixture Google").waitFor({ timeout: 15000 });
        await page.getByText("Fixture Google").click();
        await page.getByText(locale === "fa" ? "حساب Google متصل شد." : "Google account linked.").waitFor({ timeout: 15000 });
        await context.close();
      }
      assert.equal(exchangeCount, 2);
      assert.equal(linkCount, 2);
      console.log("PASS: GIS popup callback, Vendora token exchange, account linking, fa/en UI.");
    } finally { await browser.close(); }
  } finally {
    app.kill();
    api.closeAllConnections();
    api.close();
  }
}
main().catch(error => { console.error(error, logs.slice(-20).join("")); process.exitCode = 1; api.closeAllConnections(); api.close(); });
