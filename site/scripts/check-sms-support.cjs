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
  if (await page.locator('.vd-auth-card').count()) {
    assert.match(await page.locator('.vd-auth-card').evaluate(card => getComputedStyle(card).fontFamily), /Vazirmatn/);
    if (await page.locator('.vd-auth-account-notice').count() && await page.locator('.vd-google-identity-button').count()) {
      const notice = await page.locator('.vd-auth-account-notice').boundingBox(), google = await page.locator('.vd-google-identity-button').boundingBox();
      assert.ok(notice.y >= google.y + google.height + 12, 'Google button and account notice retain their designed separation');
    }
  }
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
      if(width===390)await context.addInitScript(()=>{window.OTPCredential=function(){};Object.defineProperty(navigator,'credentials',{configurable:true,value:{get:()=>Promise.resolve({code:'123456',type:'otp'})}});});
      let ticket = null, messages = [], failReply = true, phoneConfirmed = true, registration = false, rejectProof = false;
      const retryKeys = [], errors = [];
      await context.addInitScript(() => { if (!localStorage.getItem('sms-qa-cart')) { localStorage.setItem('sms-qa-cart', '1'); localStorage.setItem('cart_products', '[]'); } });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method();
        // Isolated visual fixture for the official external widget; never issues Google credentials.
        if (url.hostname === 'accounts.google.com' && p === '/gsi/client') return route.fulfill({ contentType: 'application/javascript', body: `window.google={accounts:{id:{initialize(){},renderButton(target,options){const button=document.createElement('button');button.type='button';button.textContent=options.locale==='fa'?'ادامه با Google':'Continue with Google';button.style.cssText='height:40px;width:100%;background:white;border:1px solid #e5e7eb;border-radius:10px;font:500 13px Vazirmatn;color:#0b0b0b';target.append(button);}}}};` });
        if (!p.startsWith('/api/')) return url.origin === origin ? route.continue() : route.abort();
        let data = common(p), status = 200; const body = req.postDataJSON();
        if(p==='/api/account/me')data={...user,completion:{...user.completion,isComplete:phoneConfirmed,phoneNumberConfirmed:phoneConfirmed}};
        if(p==='/api/account/phone/send')data={retryAfter:120};
        if(p==='/api/account/phone/confirm'){assert.equal(body.code,'123456');phoneConfirmed=true;data={retryAfter:0};}
        if (p === '/api/account/otp/request' || p === '/api/account/password/otp/request') {
          if (registration) assert.equal(body.phone, '09120000129', 'Persian digits and international prefix normalize before sending');
          data = challenge;
        }
        if (p === '/api/account/otp/verify') {
          if (registration) assert.equal(body.fullName, 'علی رضایی', 'Signup name travels only with the verified challenge');
          if (rejectProof) { rejectProof = false; status = 400; data = { code: 'INVALID_CODE' }; }
          else { assert.equal(body.code, '123456'); data = { account: { ...user, token: 'local-sms-session', completion: { ...user.completion, isComplete: !registration } } }; }
        }
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
      await page.goto(origin + '/fa/login?returnTo=%2Ffa%2Fshipping');
      await page.locator('#login-phone').waitFor();
      assert.equal(await page.getByRole('tab', { name: 'شماره موبایل', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('.vd-auth-benefits').isVisible(), width >= 768);
      if (width >= 1024) {
        const card = await page.locator('.vd-auth-card').boundingBox(), panel = await page.locator('.vd-auth-benefits').boundingBox();
        assert.ok(card.x > panel.x && card.y === panel.y, 'RTL card right, brand panel left and top-aligned');
        assert.equal(Math.round(card.width), width >= 1280 ? 500 : 430);
      }
      await capture(page, `login-default-${width}`, 'fa');
      assert.equal(await page.locator('#login-phone').evaluate(input => getComputedStyle(input).backgroundColor), 'rgb(255, 255, 255)', 'Legacy theme must not override the Penpot white field');
      await page.getByRole('tab', { name: 'ایمیل و رمزعبور', exact: true }).click();
      await page.locator('#login-password').fill('example-password');
      await page.getByRole('button', { name: 'نمایش رمز', exact: true }).click();
      assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
      await capture(page, `login-email-${width}`, 'fa');
      await page.goto(origin + '/fa/login?returnTo=%2Ffa%2Faccount%2Ftickets');
      await page.getByRole('tab', { name: 'شماره موبایل', exact: true }).click();
      await page.getByLabel('شماره موبایل', { exact: true }).fill('09120000129');
      await page.getByRole('button', { name: 'ارسال کد ورود', exact: true }).click();
      await page.getByLabel('رقم 6', { exact: true }).waitFor();
      if(width===390){for(let i=0;i<6;i++)assert.equal(await page.getByLabel('رقم '+(i+1),{exact:true}).inputValue(),String(i+1),'WebOTP fills all six digits without submitting');assert.ok(page.url().includes('/fa/login'));}
      else for (let i = 0; i < 6; i++) await page.getByLabel('رقم ' + (i + 1), { exact: true }).fill(String(i + 1));
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
      phoneConfirmed=false;await page.goto(origin+'/fa/account/profile');
      await page.getByRole('button',{name:'ارسال کد تأیید',exact:true}).click();
      await page.getByLabel('کد تأیید پیامک‌شده',{exact:true}).waitFor();
      if(width===390)assert.equal(await page.getByLabel('کد تأیید پیامک‌شده',{exact:true}).inputValue(),'123456','Profile verification receives WebOTP');
      else await page.getByLabel('کد تأیید پیامک‌شده',{exact:true}).fill('123456');
      await page.getByRole('button',{name:'تأیید شماره',exact:true}).click();
      await page.getByText('شماره همراه تأیید شده است',{exact:true}).first().waitFor();
      await capture(page,`profile-phone-${width}`,'fa');
      await page.goto(origin + '/fa/forgot');
      await page.getByLabel('شماره همراه تأییدشده', { exact: true }).fill('09120000129'); await page.getByRole('button', { name: 'ارسال کد بازیابی', exact: true }).click();
      if(width===390)assert.equal(await page.getByLabel('کد بازیابی',{exact:true}).inputValue(),'123456','Recovery supports buffered WebOTP');else await page.getByLabel('کد بازیابی', { exact: true }).fill('123456'); await page.getByRole('button', { name: 'تأیید کد', exact: true }).click();
      await page.getByLabel('رمز جدید', { exact: true }).fill('Changed123!'); await page.getByLabel('تکرار رمز جدید', { exact: true }).fill('Changed123!');
      assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('local-transient-recovery-proof'));
      await capture(page, `recovery-${width}`, 'fa'); await page.getByRole('button', { name: 'ثبت رمز جدید', exact: true }).click(); await page.getByText('رمز تغییر کرد؛ اکنون دوباره وارد شوید.', { exact: true }).waitFor();
      assert.ok(!(await page.evaluate(() => localStorage.getItem('auth') ?? '')).includes('local-sms-session'));
      assert.equal(await page.evaluate(() => localStorage.getItem('cart_products')), '[]');
      registration = true;
      await page.goto(origin + '/fa/register');
      await page.locator('#register-name').waitFor();
      assert.equal(await page.locator('#login-email').count(), 0);
      assert.equal(await page.getByText('Harri', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'ارسال کد ثبت‌نام', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'نام و نام خانوادگی' }).waitFor();
      await page.locator('#register-name').fill('علی رضایی');
      await page.locator('#login-phone').fill('+۹۸۹۱۲ ۰۰۰۰۱۲۹');
      await capture(page, `register-${width}`, 'fa');
      await page.getByRole('button', { name: 'ارسال کد ثبت‌نام', exact: true }).click();
      await page.getByLabel('رقم 6', { exact: true }).waitFor();
      rejectProof = true;
      await page.getByLabel('رقم 1', { exact: true }).fill('000000');
      await page.getByRole('button', { name: 'تأیید و ورود', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'صحیح نیست' }).waitFor();
      await page.getByLabel('رقم 1', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'تأیید و ورود', exact: true }).click();
      await page.waitForURL('**/fa/account');
      assert.equal(await page.evaluate(() => localStorage.getItem('cart_products')), '[]', 'Signup preserves the cart');
      await page.goto(origin + '/fa/register?returnTo=https%3A%2F%2Fevil.invalid');
      const safeLink = page.locator('.vd-auth-card').getByRole('link', { name: 'وارد شوید', exact: true });
      assert.equal(await safeLink.getAttribute('href'), '/fa/login?returnTo=%2Ffa%2Faccount');
      registration = false;
      if (width === 768) { await page.goto(origin + '/en/login'); await page.getByRole('tab', { name: 'Phone', exact: true }).click(); await page.getByLabel('Mobile number', { exact: true }).waitFor(); await capture(page, 'login-en-768', 'en'); }
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS SMS login, ticket retry/ownership UI, recovery and geometry ${width}px`);
    }
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); await new Promise(r => api.close(r)); fs.writeFileSync(path.join(output, 'server.log'), logs.join('')); }
}
run().catch(e => { console.error(e); process.exitCode = 1; api.close(); });
