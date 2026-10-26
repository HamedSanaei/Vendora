/* Exercises the production Next UI with isolated API fixtures. Never sends SMS or contacts production. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), origin = 'http://127.0.0.1:3035', apiOrigin = 'http://127.0.0.1:5061';
const output = path.resolve(root, '../artifacts/sms-support-ui'), logs = [];
const user = { id: '30000000-0000-0000-0000-000000000129', fullName: 'خریدار آزمایشی', email: 'sms@example.invalid', role: 'Customer', phoneNumber: '09120000129', completion: { firstName: 'خریدار', lastName: 'آزمایشی', isComplete: true, phoneNumberConfirmed: true } };
const challenge = { challengeId: '40000000-0000-0000-0000-000000000129', codeLength: 6, retryAfter: 120 };
/** Supplies only synthetic public/global data required by the existing store shell. */
function common(p) {
  if (p === '/api/account/auth-options') return { phoneLogin: true, passwordRecovery: true, phoneVerification: true };
  if (p === '/api/account/me') return user;
  if (p === '/api/shipping/policy') return { includedInPrice: false, unitAmount: 250000, version: 1 };
  if (p === '/api/catalog/seo') return { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false };
  if (p.startsWith('/api/store-settings')) return { showSeedData: false };
  return [];
}
const api = http.createServer(async (req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(common(new URL(req.url, apiOrigin).pathname))); });
/** Bounds local startup without accepting an unhealthy application. */
async function ready() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { if ((await fetch(origin + '/fa/login', { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* starting */ } await new Promise(r => setTimeout(r, 400)); }
  throw new Error('Local production UI did not start');
}
/** Captures responsive evidence and checks rendered text direction/font/overflow. */
async function capture(page, name, locale) {
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': overflow');
  assert.equal(await page.locator('html').getAttribute('dir'), locale === 'fa' ? 'rtl' : 'ltr');
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
}
/** Runs complete browser workflows; provider and business correctness are covered separately by SQLite tests. */
async function run() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(r => api.listen(5061, '127.0.0.1', r));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3035'], { cwd: root, env: { ...process.env, API_INTERNAL_BASE_URL: apiOrigin, NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => logs.push(data.toString()));
  let browser;
  try {
    await ready(); browser = await chromium.launch();
    for (const width of [390, 768, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      let ticket = null, messages = [], failReply = true; const retryKeys = [], errors = [];
      await context.addInitScript(() => { if (!localStorage.getItem('sms-qa-cart')) { localStorage.setItem('sms-qa-cart', '1'); localStorage.setItem('cart_products', '[]'); } });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method();
        if (!p.startsWith('/api/')) return url.origin === origin ? route.continue() : route.abort();
        let data = common(p), status = 200; const body = req.postDataJSON();
        if (p === '/api/account/otp/request' || p === '/api/account/password/otp/request') data = challenge;
        if (p === '/api/account/otp/verify') { assert.equal(body.code, '123456'); data = { account: { ...user, token: 'local-sms-session' } }; }
        if (p === '/api/account/password/otp/verify') { assert.equal(body.code, '123456'); data = { ...challenge, resetGrant: 'local-transient-recovery-proof' }; }
        if (p === '/api/account/password/otp/reset') { assert.equal(body.grant, 'local-transient-recovery-proof'); assert.equal(body.password, 'Changed123!'); data = {}; }
        if (p === '/api/orders/me') data = [{ id: 'order-owned', orderNumber: 'VD-900' }];
        if (p === '/api/account/tickets') {
          if (method === 'POST') { assert.equal(body.orderId, 'order-owned'); ticket = { id: 'ticket-qa', userId: user.id, subject: body.subject, status: 'WaitingForSupport', version: 1, updatedAtUtc: '2026-10-26T08:00:00Z' }; messages = [{ id: 'message-1', author: user.fullName, text: body.text, isStaff: false, createdAtUtc: ticket.updatedAtUtc }]; data = { id: ticket.id }; }
          else data = { page: 1, total: ticket ? 1 : 0, items: ticket ? [ticket] : [] };
        }
        if (p === '/api/account/tickets/ticket-qa') data = { ticket, messages };
        if (p === '/api/account/tickets/ticket-qa/messages') {
          retryKeys.push(req.headers()['idempotency-key']); assert.equal(body.text, 'پاسخ خصوصی برای آزمایش حفظ پیش‌نویس');
          if (failReply) { failReply = false; status = 503; data = { code: 'UNAVAILABLE' }; }
          else { ticket.version++; messages.push({ id: 'message-2', author: user.fullName, text: body.text, isStaff: false, createdAtUtc: ticket.updatedAtUtc }); data = { id: ticket.id }; }
        }
        if (p === '/api/account/tickets/ticket-qa/status') { ticket = { ...ticket, version: ticket.version + 1, status: body.close ? 'Closed' : 'WaitingForSupport' }; data = { id: ticket.id }; }
        return route.fulfill({ status, json: data });
      });
      const page = await context.newPage(); page.on('pageerror', e => { if(e.message!=='Failed to load Stripe.js')errors.push(e.message); });
      await page.goto(origin + '/fa/login?returnTo=%2Ffa%2Faccount%2Ftickets');
      await page.getByRole('tab', { name: 'شماره موبایل', exact: true }).click();
      await page.getByLabel('شماره موبایل', { exact: true }).fill('09120000129');
      await page.getByRole('button', { name: 'ارسال کد ورود', exact: true }).click();
      await page.getByLabel('رقم 6', { exact: true }).waitFor();
      for (let i = 0; i < 6; i++) await page.getByLabel('رقم ' + (i + 1), { exact: true }).fill(String(i + 1));
      await capture(page, `login-otp-${width}`, 'fa');
      await page.getByRole('button', { name: 'تأیید و ورود', exact: true }).click();
      await page.waitForURL('**/fa/account/tickets');
      await page.getByRole('button', { name: 'تیکت جدید', exact: true }).click();
      await page.getByLabel('موضوع', { exact: true }).fill('پرسش درباره سفارش و زمان ارسال کالا');
      await page.getByLabel('سفارش مرتبط (اختیاری)', { exact: true }).selectOption('order-owned');
      await page.getByLabel('پیام شما', { exact: true }).fill('متن خصوصی تیکت آزمایشی که نباید در پیامک قرار گیرد.');
      await page.getByRole('button', { name: 'ثبت تیکت', exact: true }).click();
      await page.waitForURL('**/fa/account/tickets/ticket-qa');
      const reply = page.getByLabel('پاسخ شما', { exact: true }); await reply.fill('پاسخ خصوصی برای آزمایش حفظ پیش‌نویس');
      await page.getByRole('button', { name: 'ارسال پاسخ', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'متن شما حفظ شده است' }).waitFor();
      assert.equal(await reply.inputValue(), 'پاسخ خصوصی برای آزمایش حفظ پیش‌نویس');
      await page.getByRole('button', { name: 'ارسال پاسخ', exact: true }).click(); await page.locator('ol').getByText('پاسخ خصوصی برای آزمایش حفظ پیش‌نویس', { exact: true }).waitFor();
      assert.ok(retryKeys[0]); assert.equal(retryKeys[0], retryKeys[1]);
      await page.getByRole('button', { name: 'بستن تیکت', exact: true }).click(); await page.getByRole('button', { name: 'بازگشایی تیکت', exact: true }).click(); await reply.waitFor();
      await capture(page, `ticket-${width}`, 'fa');
      await page.goto(origin + '/fa/forgot');
      await page.getByLabel('شماره همراه تأییدشده', { exact: true }).fill('09120000129'); await page.getByRole('button', { name: 'ارسال کد بازیابی', exact: true }).click();
      await page.getByLabel('کد بازیابی', { exact: true }).fill('123456'); await page.getByRole('button', { name: 'تأیید کد', exact: true }).click();
      await page.getByLabel('رمز جدید', { exact: true }).fill('Changed123!'); await page.getByLabel('تکرار رمز جدید', { exact: true }).fill('Changed123!');
      assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('local-transient-recovery-proof'));
      await capture(page, `recovery-${width}`, 'fa'); await page.getByRole('button', { name: 'ثبت رمز جدید', exact: true }).click(); await page.getByText('رمز تغییر کرد؛ اکنون دوباره وارد شوید.', { exact: true }).waitFor();
      assert.ok(!(await page.evaluate(() => localStorage.getItem('auth') ?? '')).includes('local-sms-session'));
      assert.equal(await page.evaluate(() => localStorage.getItem('cart_products')), '[]');
      if (width === 768) { await page.goto(origin + '/en/login'); await page.getByRole('tab', { name: 'Phone', exact: true }).click(); await page.getByLabel('Mobile number', { exact: true }).waitFor(); await capture(page, 'login-en-768', 'en'); }
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS SMS login, ticket retry/ownership UI, recovery and geometry ${width}px`);
    }
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); await new Promise(r => api.close(r)); fs.writeFileSync(path.join(output, 'server.log'), logs.join('')); }
}
run().catch(e => { console.error(e); process.exitCode = 1; api.close(); });
