/* Proforma authentication regression with local synthetic sessions/API only. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), origin = 'http://127.0.0.1:3033', apiOrigin = 'http://127.0.0.1:5059';
const output = path.resolve(root, '../artifacts/proforma-session');
const valid = 'local-proforma-valid-session', stale = 'local-proforma-rejected-session';
const user = { id: 'local-proforma-user', name: 'کاربر آزمایشی', email: 'proforma@example.invalid', role: 'Customer' };
let mode = 'empty', pdfRejected = false;
const requests = [], logs = [];
/** Serves deterministic failures and documents without real credentials, PDF rendering or production writes. */
const api = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  const url = new URL(request.url, apiOrigin), token = request.headers.authorization;
  response.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/api/account/')) requests.push({ path: url.pathname, page: url.searchParams.get('page'), authorized: token === `Bearer ${valid}`, stale: token === `Bearer ${stale}` });
  if (url.pathname === '/api/account/login') return response.end(JSON.stringify({ id: user.id, fullName: user.name, email: user.email, role: 'Customer', token: valid, completion: { isComplete: true, phoneNumberConfirmed: true } }));
  if (url.pathname === '/api/account/me') {
    if (mode === 'verification-down') return response.writeHead(503).end('{}');
    if (token !== `Bearer ${valid}`) return response.writeHead(401).end('{}');
    return response.end(JSON.stringify({ id: user.id, fullName: user.name, email: user.email, completion: { isComplete: true } }));
  }
  if (url.pathname.startsWith('/api/account/documents')) {
    if (token !== `Bearer ${valid}` || mode === 'access-denied' || mode === 'verification-down') return response.writeHead(401).end('{}');
    if (mode === 'unavailable') return response.writeHead(503).end('{}');
    if (url.pathname.endsWith('/pdf')) {
      if (pdfRejected) return response.writeHead(401).end('{}');
      response.setHeader('Content-Type', 'application/pdf'); return response.end('%PDF-1.4\nLocal authentication fixture only\n');
    }
    const page = Number(url.searchParams.get('page')) || 1;
    const doc = { id: `local-document-${page}`, number: `PF-QA-${page}`, kind: 'Proforma', currency: 'Toman', exchangeRate: 1, issuedAtUtc: '2026-10-25T12:00:00Z', net: 2000000, tax: 0, freight: 0, totalToman: 2000000,
      lines: [{ id: 'local-line', productCode: 100, title: 'کیف آزمایشی', quantity: 1, unitPrice: 2000000, discount: 0, tax: 0, total: 2000000 }] };
    return response.end(JSON.stringify({ items: mode === 'empty' ? [] : [doc], total: mode === 'empty' ? 0 : 26, page, pageSize: 25 }));
  }
  if (url.pathname.startsWith('/api/store-settings')) return response.end(JSON.stringify({ showSeedData: false }));
  if (url.pathname === '/api/catalog/seo') return response.end(JSON.stringify({ siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false }));
  response.end('[]');
});

/** Waits for the isolated local Next process. */
async function ready() {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try { if ((await fetch(origin + '/fa/account/proformas', { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* compiling */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Proforma QA server did not start');
}

/** Opens a fresh browser session; fixture tokens never leave the local test origin. */
async function open(browser, token = valid, locale = 'fa', width = 390) {
  requests.length = 0;
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(({ token, user }) => {
    if (sessionStorage.getItem('proforma-fixture')) return;
    sessionStorage.setItem('proforma-fixture', '1');
    if (token) localStorage.setItem('auth', JSON.stringify({ accessToken: token, user }));
  }, { token, user });
  const page = await context.newPage(); await page.goto(`${origin}/${locale}/account/proformas`);
  return { context, page };
}

/** Verifies the credential survives document failures and that expiry is never asserted without evidence. */
async function preserved(page, token = valid) {
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('auth')).accessToken), token);
  assert.equal(await page.getByText('نشست شما منقضی شده است؛ دوباره وارد شوید.', { exact: true }).count(), 0);
}

/** Exercises real UI requests/retry/sign-in-return/pagination/PDF download against the fixture API. */
async function main() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(resolve => api.listen(5059, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3033'], {
    cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiOrigin, API_INTERNAL_BASE_URL: apiOrigin, NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { logs.push(data.toString()); if (logs.length > 60) logs.shift(); });
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    mode = 'empty';
    let session = await open(browser); await session.page.getByText('هنوز پیش‌فاکتوری ندارید', { exact: true }).waitFor();
    assert.ok(requests.some(r => r.path === '/api/account/documents' && r.authorized));
    assert.equal(requests.filter(r => r.path === '/api/account/me').length, 0, 'Healthy document requests need no extra auth probe');
    await preserved(session.page); await session.context.close(); console.log('PASS valid session / empty list / no unnecessary account probes');
    mode = 'access-denied'; session = await open(browser);
    await session.page.getByText('دسترسی به اسناد تأیید نشد. دوباره تلاش کنید؛ ورود شما معتبر است.', { exact: true }).waitFor();
    assert.equal(await session.page.getByRole('link', { name: 'ورود مجدد', exact: true }).count(), 0);
    assert.ok(requests.some(r => r.path === '/api/account/me' && r.authorized)); await preserved(session.page);
    mode = 'rows'; await session.page.getByRole('button', { name: 'تلاش مجدد', exact: true }).click(); await session.page.getByText('PF-QA-1', { exact: true }).waitFor();
    await session.page.getByRole('button', { name: 'بعدی', exact: true }).click(); await session.page.waitForURL('**/fa/account/proformas?page=2');
    await session.page.getByText('PF-QA-2', { exact: true }).waitFor(); assert.equal(await session.page.getByText('PF-QA-1', { exact: true }).count(), 0);
    const download = session.page.waitForEvent('download'); await session.page.getByRole('button', { name: 'PDF A5', exact: true }).click();
    assert.match((await download).suggestedFilename(), /-A5\.pdf$/);
    pdfRejected = true; await session.page.getByRole('button', { name: 'PDF A4', exact: true }).click();
    await session.page.getByText('دسترسی به اسناد تأیید نشد. دوباره تلاش کنید؛ ورود شما معتبر است.', { exact: true }).waitFor();
    assert.equal(await session.page.getByRole('link', { name: 'ورود مجدد', exact: true }).count(), 0); await preserved(session.page);
    pdfRejected = false; await session.context.close(); console.log('PASS document-only 401 keeps valid auth; retry, pagination and authenticated PDF download');
    for (const failure of ['unavailable', 'verification-down']) {
      mode = failure; session = await open(browser);
      await session.page.locator('main [role="alert"]').waitFor(); await preserved(session.page);
      assert.equal(await session.page.getByRole('link', { name: 'ورود مجدد', exact: true }).count(), 0);
      await session.context.close(); console.log(`PASS ${failure}: transient failure does not force sign-in`);
    }
    mode = 'rows';
    for (const width of [390, 768, 1024, 1440]) {
      session = await open(browser, stale, 'fa', width);
      await session.page.getByText('اعتبار ورود شما تأیید نشد؛ دوباره وارد شوید.', { exact: true }).waitFor();
      const signIn = session.page.getByRole('link', { name: 'ورود مجدد', exact: true });
      assert.equal(await signIn.getAttribute('href'), '/fa/login?returnTo=%2Ffa%2Faccount%2Fproformas');
      await preserved(session.page, stale); assert.ok(requests.some(r => r.path === '/api/account/me' && r.stale));
      if (width === 390) {
        await signIn.click(); await session.page.waitForURL('**/fa/login?returnTo=*');
        await session.page.getByLabel('ایمیل', { exact: true }).fill(user.email); await session.page.getByLabel('رمز عبور', { exact: true }).fill('LocalFixtureOnly!234');
        await session.page.getByRole('button', { name: 'ورود به حساب', exact: true }).click(); await session.page.waitForURL('**/fa/account/proformas');
        await session.page.getByText('PF-QA-1', { exact: true }).waitFor(); await preserved(session.page);
      }
      await session.context.close(); console.log(`PASS rejected credential ${width}: safe sign-in return without clearing the cart/session automatically`);
    }
    session = await open(browser, null); await session.page.getByRole('heading', { name: 'ورود به حساب کاربری', exact: true }).waitFor();
    assert.equal(requests.filter(r => r.path.startsWith('/api/account/documents')).length, 0); await session.context.close(); console.log('PASS guest does not request private documents');
    mode = 'empty'; session = await open(browser, valid, 'en', 1440); await session.page.getByText('No proformas yet', { exact: true }).waitFor();
    await session.context.close(); console.log('PASS English account compatibility');
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error, logs.slice(-5).join('')); process.exitCode = 1; });
