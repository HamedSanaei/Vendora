/* Real Next UI against an isolated local HTTP fixture. No external carrier, payment or production data. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), origin = 'http://127.0.0.1:3034', apiOrigin = 'http://127.0.0.1:5060';
const output = path.resolve(root, '../artifacts/shipping-ui');
const id = '10000000-0000-0000-0000-000000000100', addressId = '20000000-0000-0000-0000-000000000100';
const user = { id: '30000000-0000-0000-0000-000000000100', _id: '30000000-0000-0000-0000-000000000100', name: 'خریدار آزمایشی', email: 'shipping@example.invalid', phone: '09121111111', role: 'Customer' };
let included = true, postalError = false, ambiguous = false;
const calls = [], logs = [];
/** Produces current public prices, keeping the fixture's persisted base price unchanged. */
function product() { return { id, productCode: 100, title: 'کیف آزمایشی ارسال', slug: 'shipping-fixture', price: 1000000 + (included ? 250000 : 0), basePrice: 1000000, embeddedShippingUnitAmount: included ? 250000 : 0, freeShipping: included, shippingPolicyVersion: included ? 2 : 3, stockQuantity: 100, images: [], categories: [], colors: [] }; }
/** Returns the real endpoint shapes without performing writes outside the ephemeral fixture. */
function answer(url, body, authorization) {
  const p = url.pathname;
  if (p === '/api/shipping/policy') return { includedInPrice: included, unitAmount: 250000, version: included ? 2 : 3 };
  if (p === '/api/account/me') return { ...user, fullName: user.name, completion: { isComplete: true, phoneNumberConfirmed: true } };
  if (p === '/api/account/addresses') return [{ id: addressId, title: 'خانه', recipientName: user.name, phoneNumber: user.phone, province: 'تهران', city: 'تهران', streetAddress: 'خیابان آزمایشی، پلاک ۲', plaque: '2', postalCode: '1234567890', isDefault: true }];
  if (p === '/api/shipping/cart-pricing') {
    const subtotal = body.items.reduce((n, line) => n + line.quantity * product().price, 0);
    const discount = body.couponCode === 'TEN' ? body.items.reduce((n, line) => n + line.quantity * 100000, 0) : 0;
    return { subtotal, discount, payable: subtotal - discount };
  }
  if (p === '/api/shipping/reference/cities') return { items: [{ code: '101', name: 'تهران', province: 'تهران' }, { code: '102', name: 'تهران', province: 'تهران' }] };
  if (p === '/api/shipping/quote') {
    assert.equal(authorization, 'Bearer local-shipping-session');
    calls.push(body);
    if (ambiguous && body.method === 'post' && !body.destinationCityCode) return { status: 422, code: 'POSTEX_CITY_SELECTION_REQUIRED' };
    if (postalError && body.method === 'post') return { status: 503, code: 'POSTEX_UNAVAILABLE' };
    const subtotal = body.items.reduce((n, line) => n + line.quantity * product().price, 0);
    const discount = body.couponCode === 'TEN' ? body.items.reduce((n, line) => n + line.quantity * 100000, 0) : 0;
    const cost = included || body.method !== 'post' ? 0 : 75000;
    return { id: cost ? '40000000-0000-0000-0000-000000000100' : null, cost, paymentMode: included ? 'free' : body.method === 'post' ? 'prepaid' : 'collect', expiresAtUtc: cost ? new Date(Date.now() + 600000).toISOString() : null, policyVersion: included ? 2 : 3, subtotal, discount, payable: subtotal - discount + cost };
  }
  if (p === '/api/catalog/products') return [product()];
  if (p === '/api/catalog/seo') return { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false };
  if (p.startsWith('/api/store-settings')) return { showSeedData: false };
  return [];
}
const api = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  let raw = ''; for await (const chunk of req) raw += chunk;
  const data = answer(new URL(req.url, apiOrigin), raw ? JSON.parse(raw) : null, req.headers.authorization);
  res.writeHead(data.status || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
});
/** Waits for the production build's local web server. */
async function ready() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin + '/fa/shipping', { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local shipping UI did not start');
}
/** Seeds a synthetic cart/session, intercepting every API origin to keep browser traffic local. */
async function open(browser, width, quantity = 2, locale = 'fa', coupon = true) {
  calls.length = 0;
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.route('**/api/**', async route => {
    const req = route.request(), data = answer(new URL(req.url()), req.postDataJSON(), req.headers().authorization);
    await route.fulfill({ status: data.status || 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await context.addInitScript(({ user, item, quantity, coupon }) => {
    if (sessionStorage.getItem('shipping-fixture')) return;
    sessionStorage.setItem('shipping-fixture', '1');
    localStorage.setItem('auth', JSON.stringify({ accessToken: 'local-shipping-session', user }));
    localStorage.setItem('cart_products', JSON.stringify([{ ...item, _id: item.id, originalPrice: item.price, discount: 0, orderQuantity: quantity, quantity: 100, relatedImages: [], tags: [], category: {}, brand: {}, colors: [] }]));
    if (coupon) localStorage.setItem('couponInfo', JSON.stringify({ couponCode: 'TEN', discountPercentage: 10 }));
  }, { user, item: product(), quantity, coupon });
  const page = await context.newPage(); await page.goto(`${origin}/${locale}/shipping`);
  await page.locator('input[name="shipping-method"]').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('main h1'));
  await page.waitForTimeout(350);
  return { context, page };
}
/** Checks viewport overflow and saves a real screenshot, without claiming pixel-perfect comparison. */
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${name}`);
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
}
/** Runs free/collect/postal/error/threshold/persistence flows through the actual React components. */
async function main() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(resolve => api.listen(5060, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3034'], {
    cwd: root, env: { ...process.env, API_INTERNAL_BASE_URL: apiOrigin, NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => logs.push(data.toString()));
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    for (const width of [390, 768, 1024, 1440]) {
      included = true;
      const { context, page } = await open(browser, width);
      assert.equal(await page.locator('input[name="shipping-method"]').count(), 2);
      await page.getByText('ارسال رایگان است؛ سهم ثابت ارسال در قیمت هر کالا لحاظ شده است.', { exact: true }).waitFor();
      await capture(page, `free-shipping-${width}`);
      await page.locator('main button[type="submit"]:visible').click();
      await page.waitForURL('**/fa/checkout'); await page.getByRole('heading', { name: 'پرداخت و ثبت سفارش', exact: true }).waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shipping_info')));
      assert.equal(saved.shippingPaymentMode, 'free'); assert.equal(saved.shippingCost, 0); assert.equal(saved.shippingPolicyVersion, 2);
      assert.equal(saved.shippingServerTotals.payable, 2300000);
      await capture(page, `free-payment-${width}`);
      const cartPreview = page.waitForResponse(response => response.url().endsWith('/shipping/cart-pricing'));
      await page.goto(`${origin}/fa/cart`); await cartPreview;
      await page.getByText('۲٬۳۰۰٬۰۰۰ تومان', { exact: true }).filter({ visible: true }).first().waitFor();
      await capture(page, `free-cart-${width}`); await context.close();
    }
    included = false;
    let session = await open(browser, 390, 11, 'fa', false);
    assert.equal(await session.page.locator('input[name="shipping-method"]').count(), 3);
    await session.page.getByText('تیپاکس', { exact: true }).click();
    await session.page.waitForTimeout(250); await session.page.getByText('کرایه توسط شرکت حمل‌ونقل هنگام تحویل جداگانه دریافت می‌شود.', { exact: true }).filter({ visible: true }).first().waitFor();
    await capture(session.page, 'collect-shipping-390');
    await session.page.locator('main button[type="submit"]:visible').click(); await session.page.waitForURL('**/fa/checkout');
    let saved = await session.page.evaluate(() => JSON.parse(localStorage.getItem('shipping_info')));
    assert.equal(saved.shippingPaymentMode, 'collect'); assert.equal(saved.shippingServerTotals.payable, 11000000); await session.context.close();
    postalError = true; session = await open(browser, 768, 10, 'fa', false);
    assert.equal(await session.page.locator('input[name="shipping-method"]').count(), 2);
    await session.page.getByText('استعلام ارسال انجام نشد. دوباره تلاش یا روش دیگری انتخاب کنید.', { exact: true }).waitFor();
    assert.equal(await session.page.locator('main button[type="submit"]:visible').isDisabled(), true); assert.ok(session.page.url().endsWith('/shipping'));
    postalError = false; await session.page.getByRole('button', { name: 'تلاش مجدد', exact: true }).click();
    await session.page.waitForTimeout(300); await capture(session.page, 'post-shipping-768');
    await session.page.locator('main button[type="submit"]:visible').click(); await session.page.waitForURL('**/fa/checkout');
    saved = await session.page.evaluate(() => JSON.parse(localStorage.getItem('shipping_info')));
    assert.equal(saved.shippingCost, 75000); assert.ok(saved.shippingQuoteId); assert.equal(saved.shippingServerTotals.payable, 10075000);
    await session.page.reload(); await session.page.getByRole('heading', { name: 'پرداخت و ثبت سفارش', exact: true }).waitFor(); await capture(session.page, 'post-payment-refresh-768');
    await session.context.close();
    session = await open(browser, 390, 11, 'fa', false);
    await session.page.getByText('باربری همراه بیمه', { exact: true }).click(); await session.page.waitForTimeout(250);
    await session.page.locator('main button[type="submit"]:visible').click(); await session.page.waitForURL('**/fa/checkout');
    await session.page.evaluate(() => { const items = JSON.parse(localStorage.getItem('cart_products')); items[0].orderQuantity = 10; localStorage.setItem('cart_products', JSON.stringify(items)); });
    await session.page.goto(`${origin}/fa/shipping`);
    await session.page.getByText('تعداد سفارش برای باربری باید بیش از ۱۰ عدد باشد؛ روش دیگری انتخاب کنید.', { exact: true }).waitFor();
    assert.equal(await session.page.locator('input[name="shipping-method"]:checked').count(), 0);
    await session.context.close();
    ambiguous = true; session = await open(browser, 390, 2, 'fa', false);
    await session.page.getByLabel('شهر مقصد در پستِکس', { exact: false }).selectOption('101');
    await session.page.waitForTimeout(250); assert.ok(calls.some(call => call.destinationCityCode === '101'));
    await session.page.locator('main button[type="submit"]:visible').click(); await session.page.waitForURL('**/fa/checkout');
    await session.context.close(); ambiguous = false;
    included = true; session = await open(browser, 1024, 2, 'en', false);
    assert.equal(await session.page.locator('main').evaluate(el => getComputedStyle(el).direction), 'ltr'); await capture(session.page, 'en-shipping-1024'); await session.context.close();
    console.log('PASS: 4 Persian widths, free base-only discount, >10 freight, collect, postal failure/retry/quote persistence, English LTR; no production calls.');
  } finally {
    await browser?.close(); app.kill(); await new Promise(resolve => api.close(resolve)); fs.writeFileSync(path.join(output, 'server.log'), logs.join(''));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
