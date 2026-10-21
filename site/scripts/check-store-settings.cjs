/* Browser regression checks against an isolated public API fixture; never writes to a real store database. */
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/store-settings');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6N2QAAAAASUVORK5CYII=', 'base64');
let profile = {}; let saves = 0; let rejectSave = false;
const children = []; const logs = [];

/** Serves the same public settings to SSR and browser requests with small catalog/auth fixtures. */
const api = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  const url = new URL(request.url, 'http://127.0.0.1:5059');
  if (url.pathname.startsWith('/uploads/')) { response.setHeader('Content-Type', 'image/png'); response.end(png); return; }
  response.setHeader('Content-Type', 'application/json');
  let result = [];
  if (url.pathname.endsWith('/store-settings')) {
    if (request.method === 'PUT') {
      if (rejectSave) { response.writeHead(400).end(JSON.stringify({ errors: { email: 'invalidEmail' } })); return; }
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const settings = JSON.parse(body.match(/name="settings"\r\n\r\n([^]*?)\r\n--/)[1]);
      profile = settings.profile;
      if (body.includes('name="logo";')) profile.logoUrl = '/uploads/products/test-logo.png';
      if (body.includes('name="favicon";')) profile.faviconUrl = '/uploads/products/test-icon.png';
      profile.enamad = settings.enamadCode ? { href: 'https://trustseal.enamad.ir/?id=123', imageUrl: 'https://trustseal.enamad.ir/logo.aspx?id=123' } : null;
      saves++;
    }
    result = profile;
  } else if (url.pathname === '/api/catalog/seo') result = { siteName: profile.nameFa || 'وندورا', siteUrl: '', titleTemplate: '{title} | {siteName}', isIndexingEnabled: false, logoUrl: profile.logoUrl || null, socialProfiles: profile.socialProfiles || null };
  else if (url.pathname === '/api/catalog/seo/redirect') result = null;
  else if (url.pathname === '/api/catalog/products/search') result = { products: [], total: 0, page: 1, pageSize: 10 };
  else if (url.pathname === '/api/account/me') result = { id: 'test-admin', fullName: 'Test Administrator', role: 'Admin', email: 'admin@example.com' };
  response.end(JSON.stringify(result));
});

/** Starts only task-owned local servers and retains bounded diagnostics for failures. */
function launch(script, args, cwd, environment = {}) {
  const child = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...environment }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', value => { logs.push(value.toString()); if (logs.length > 100) logs.shift(); });
  children.push(child); return child;
}

/** Polls readiness within a bounded startup window. */
async function ready(url) {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try { const status = await new Promise((resolve, reject) => { const req = (url.startsWith('https:') ? https : http).get(url, { rejectUnauthorized: false }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.setTimeout(2000, () => req.destroy()); }); if (status < 500) return; } catch { /* Retry while the local server starts. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start: ${url}`);
}

/** Checks default/draft/save/reset semantics and both locale directions on desktop and mobile. */
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => api.listen(5059, '127.0.0.1', resolve));
  launch(path.join(root, 'site/node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', '3016'], path.join(root, 'site'), { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:5059', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' });
  launch(path.join(root, 'admin/node_modules/vite/bin/vite.js'), ['preview', '--host', '127.0.0.1', '--port', '3017'], path.join(root, 'admin'));
  await Promise.all([ready('http://127.0.0.1:3016/fa'), ready('https://127.0.0.1:3017')]);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    const failures = []; context.on('page', page => page.on('pageerror', error => failures.push(error.message)));
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()); url.host = '127.0.0.1:5059'; url.protocol = 'http:';
      const response = await route.fetch({ url: url.toString() }); await route.fulfill({ response });
    });
    await context.route('https://trustseal.enamad.ir/**', route => route.fulfill({ contentType: 'image/png', body: png }));
    await context.addInitScript(() => { if (location.origin === 'https://127.0.0.1:3017') localStorage.setItem('vendora_admin_token', 'isolated-browser-fixture'); });
    const site = await context.newPage(); const admin = await context.newPage();
    await site.goto('http://127.0.0.1:3016/fa');
    assert.match(await site.locator('header').innerText(), /VENDORA/);
    assert.equal(await site.locator('footer a[href*="trustseal.enamad.ir"]').count(), 0);
    await site.screenshot({ path: path.join(output, 'defaults-fa-desktop.png'), fullPage: true });
    await admin.goto('https://127.0.0.1:3017/fa/admin/online-store');
    await admin.locator('#settings-nameFa').waitFor();
    assert.equal(await admin.title(), 'Vendora');
    await admin.locator('#settings-nameFa').fill('پیش‌نویس');
    assert.match(await admin.locator('.admin-brand').innerText(), /VENDORA/); assert.equal(saves, 0);
    await admin.getByRole('button', { name: 'تنظیمات پیش‌فرض', exact: true }).click();
    assert.equal(await admin.locator('#settings-nameFa').inputValue(), ''); assert.equal(saves, 0);
    const fields = { nameFa: 'کیف آوا', nameEn: 'Ava Bags', introFa: 'تولید مستقیم کیف آوا', introEn: 'Bags made by Ava', addressFa: 'تهران، خیابان نمونه', addressEn: 'Tehran, Sample Street', hoursFa: 'شنبه تا پنجشنبه ۹ تا ۱۸', hoursEn: 'Saturday to Thursday, 9 to 18', phone: '02112345678', email: 'hello@example.com', socialProfiles: 'https://instagram.com/ava' };
    for (const [key, value] of Object.entries(fields)) await admin.locator(`#settings-${key}`).fill(value);
    await admin.locator('input[type="file"]').nth(1).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await admin.locator('input[type="file"]').nth(2).setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: png });
    await admin.locator('.admin-store-settings textarea[dir="ltr"]').last().fill('<a href="https://trustseal.enamad.ir/?id=123"><img src="https://trustseal.enamad.ir/logo.aspx?id=123" /></a>');
    await admin.getByLabel('نمایش اینماد در فوتر').check();
    await admin.getByRole('button', { name: 'ذخیره تنظیمات', exact: true }).click();
    await admin.getByText('تنظیمات فروشگاه ذخیره شد.', { exact: true }).waitFor();
    assert.equal(saves, 1); assert.match(await admin.locator('.admin-brand').innerText(), /کیف آوا/);
    assert.match(await admin.title(), /کیف آوا/);
    for (const locale of ['fa', 'en']) {
      for (const width of [1440, 390]) {
        await site.setViewportSize({ width, height: 1000 });
        await site.goto(`http://127.0.0.1:3016/${locale}`);
        assert.equal(await site.locator('html').getAttribute('dir'), locale === 'fa' ? 'rtl' : 'ltr');
        assert.match(await site.locator('footer').innerText(), /02112345678/);
        assert.match(await site.locator('footer').innerText(), new RegExp(locale === 'fa' ? 'کیف آوا' : 'Ava Bags'));
        assert.equal(await site.locator('footer a[href*="trustseal.enamad.ir"]').count(), 1);
        assert.equal(await site.locator('link[rel="icon"][href*="test-icon.png"]').count(), 1);
        await site.screenshot({ path: path.join(output, `configured-${locale}-${width}.png`), fullPage: true });
        await site.goto(`http://127.0.0.1:3016/${locale}/contact`);
        assert.match(await site.locator('main').innerText(), /hello@example.com/);
        await site.goto(`http://127.0.0.1:3016/${locale}/login`);
        assert.equal(await site.locator('img[alt="' + (locale === 'fa' ? 'کیف آوا' : 'Ava Bags') + '"]').count() > 0, true);
        await admin.setViewportSize({ width, height: 1000 });
        await admin.goto(`https://127.0.0.1:3017/${locale}/admin/online-store`);
        await admin.locator('#settings-nameFa').waitFor();
        assert.equal(await admin.locator('html').getAttribute('dir'), locale === 'fa' ? 'rtl' : 'ltr');
        await admin.locator('.admin-store-settings').screenshot({ path: path.join(output, `admin-${locale}-${width}.png`) });
      }
    }
    rejectSave = true;
    await admin.locator('#settings-nameEn').fill('Unsaved name');
    await admin.getByRole('button', { name: 'Save settings', exact: true }).click();
    await admin.getByText('Enter a valid email.', { exact: true }).waitFor();
    assert.equal(await admin.locator('#settings-nameEn').inputValue(), 'Unsaved name');
    assert.match(await admin.locator('.admin-brand').innerText(), /Ava Bags/); assert.equal(saves, 1);
    rejectSave = false;
    await admin.getByRole('button', { name: 'Default settings', exact: true }).click();
    assert.match(await admin.locator('.admin-brand').innerText(), /Ava Bags/); assert.equal(saves, 1);
    await admin.getByRole('button', { name: 'Save settings', exact: true }).click();
    await admin.getByText('Store settings saved.', { exact: true }).waitFor();
    assert.equal(saves, 2); assert.match(await admin.locator('.admin-brand').innerText(), /VENDORA/);
    assert.equal(await admin.title(), 'Vendora');
    await site.goto('http://127.0.0.1:3016/en');
    assert.equal(await site.locator('footer a[href*="trustseal.enamad.ir"]').count(), 0);
    assert.match(await site.locator('footer').innerText(), /VENDORA/);
    assert.equal(await site.locator('link[rel="icon"][href*="test-icon.png"]').count(), 0);
    assert.deepEqual(failures, []);
    console.log('PASS: defaults, unsaved drafts, saved branding/images/badge, validation failure, reset; fa/en desktop/mobile. Screenshots: artifacts/store-settings');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); console.error(logs.slice(-15).join('')); process.exitCode = 1; }).finally(() => {
  for (const child of children) child.kill(); api.closeAllConnections(); api.close();
});
