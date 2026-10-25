/* Header handoff regression against local, synthetic API/session fixtures only. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../artifacts/header-dropdowns');
const origin = 'http://127.0.0.1:3029';
let rejectCatalog = false;
let catalogDelay = 0;
let rejectOrders = false;
let orderRequests = 0;
const logs = [];
const products = [
  { id: 'header-qa-1', slug: 'header-qa-1', title: 'کوله‌پشتی شهری آرتین', productCode: 100, price: 1890000, stockQuantity: 3, categoryName: 'کیف شهری' },
  { id: 'header-qa-2', slug: 'header-qa-2', title: 'کیف دوشی نوا', productCode: 101, price: 980000, stockQuantity: 4, categoryName: 'کیف روزمره' },
].map(product => ({ ...product, images: [], categories: [], colors: [], description: '' }));
const saved = products.map(item => ({ _id: item.id, slug: item.slug, title: item.title, originalPrice: 1, quantity: 10 }));
const api = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  response.setHeader('Content-Type', 'application/json');
  const url = new URL(request.url, 'http://127.0.0.1:5055');
  let result = [];
  if (url.pathname.endsWith('/store-settings')) result = {};
  else if (url.pathname === '/api/catalog/seo') result = { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title} | {siteName}', isIndexingEnabled: false };
  else if (url.pathname === '/api/catalog/products/search') result = { products: [], total: 0, page: 1, pageSize: 24 };
  else if (url.pathname === '/api/catalog/products') {
    if (catalogDelay) await new Promise(resolve => setTimeout(resolve, catalogDelay));
    if (rejectCatalog) return response.writeHead(503).end(JSON.stringify({ message: 'Isolated catalog failure' }));
    result = products;
  } else if (url.pathname === '/api/Orders/me') {
    orderRequests++;
    if (rejectOrders) return response.writeHead(503).end(JSON.stringify({ message: 'Isolated orders failure' }));
    result = ['PendingPayment', 'Packed', 'Delivered', 'Delivered', 'Refunded', 'Cancelled'].map((status, i) => ({ id: `qa-order-${i}`, orderNumber: `QA-${i}`, status, items: [] }));
  } else if (url.pathname === '/api/account/me') result = { id: 'header-qa-user', fullName: 'کاربر آزمایشی', email: 'header-qa@vendora.invalid', phoneNumber: '09150008877' };
  response.end(JSON.stringify(result));
});

/** Bounded readiness check; diagnostics contain no real credentials or customer data. */
async function ready() {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try { const result = await fetch(origin + '/fa', { signal: AbortSignal.timeout(3000) }); if (result.status < 500) return; } catch { /* Allow the local compiler to start. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local header test server did not become ready.');
}

/** Seeds only an isolated browser context, preserving stale wishlist prices to test live catalog resolution. */
async function contextFor(browser, width, signedIn = true, touch = false) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, hasTouch: touch });
  await context.addInitScript(({ saved, signedIn }) => {
    localStorage.setItem('wishlist_items', JSON.stringify(saved));
    localStorage.setItem('cart_products', JSON.stringify([{ ...saved[1], orderQuantity: 2 }]));
    if (signedIn) localStorage.setItem('auth', JSON.stringify({ accessToken: 'isolated-header-fixture', user: { id: 'header-qa-user', name: 'کاربر آزمایشی', email: 'header-qa@vendora.invalid' } }));
  }, { saved, signedIn });
  return context;
}

/** Asserts the actual shipped header geometry and the complete desktop interaction/data contract. */
async function desktopChecks(browser, locale) {
  const context = await contextFor(browser, 1440);
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/${locale}`);
  const account = page.locator('[data-header-trigger="account"]');
  const wishlist = page.locator('[data-header-trigger="wishlist"]');
  const cart = page.locator('[data-header-trigger="cart"]');
  // Existing Bootstrap gap-3 is 16px; preserve the current header rather than restyling it.
  for (const [trigger, left] of [[cart, 44], [account, 104], [wishlist, 164]]) {
    const box = await trigger.boundingBox(); assert.equal(box.width, 44); assert.equal(box.height, 44); assert.equal(box.x, left);
  }
  const accountPanel = page.locator('[data-header-dropdown="account"]:visible');
  await account.hover(); await accountPanel.waitFor();
  assert.match(await accountPanel.innerText(), /کاربر آزمایشی/);
  for (const route of ['account', 'account/orders', 'account/addresses', 'account/wishlist', 'account/returns', 'account/transactions', 'account/proformas', 'account/security']) assert.ok(await accountPanel.locator(`a[href="/${locale}/${route}"]`).count());
  assert.equal((await accountPanel.boundingBox()).width, 380);
  await accountPanel.hover(); await page.waitForTimeout(300); assert.ok(await accountPanel.isVisible());
  await accountPanel.screenshot({ path: path.join(output, `account-${locale}-1440.png`) });
  await page.keyboard.press('Escape'); await accountPanel.waitFor({ state: 'hidden' });
  assert.ok(await account.evaluate(node => node === document.activeElement));
  await account.hover(); await accountPanel.waitFor(); await account.click(); await accountPanel.waitFor({ state: 'hidden' });
  await account.click(); await accountPanel.waitFor();
  await wishlist.hover();
  const wishlistPanel = page.locator('[data-header-dropdown="wishlist"]:visible');
  await wishlistPanel.waitFor(); await accountPanel.waitFor({ state: 'hidden' });
  await wishlistPanel.getByText(locale === 'fa' ? '۱٬۸۹۰٬۰۰۰ تومان' : '1,890,000 Toman', { exact: true }).waitFor();
  assert.equal((await wishlistPanel.boundingBox()).width, 440);
  await wishlistPanel.screenshot({ path: path.join(output, `wishlist-${locale}-1440.png`) });
  const add = wishlistPanel.locator('article').first().getByRole('button', { name: locale === 'fa' ? 'افزودن به سبد' : 'Add to cart', exact: true });
  await add.click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cart_products')).find(p => p._id === 'header-qa-1').orderQuantity), 1);
  await add.click(); await add.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products')).find(p => p._id === 'header-qa-1').orderQuantity === 3);
  assert.ok(await wishlistPanel.locator('article').first().locator('button:disabled').isVisible());
  const remove = () => wishlistPanel.locator('article').first().locator('button[aria-label]');
  await remove().click(); await remove().click();
  // Removing both rows shrinks/repositions the panel; re-enter the trigger before inspecting the empty state.
  await wishlist.hover(); await wishlistPanel.hover();
  await wishlistPanel.getByText(locale === 'fa' ? 'هنوز محصولی ذخیره نکرده‌اید' : "You haven't saved any products yet", { exact: true }).waitFor();
  assert.equal((await wishlistPanel.boundingBox()).width, 400);
  await wishlistPanel.screenshot({ path: path.join(output, `wishlist-empty-${locale}-1440.png`) });
  await cart.hover();
  const cartPanel = page.locator('#vd-header-cart-desktop'); await cartPanel.waitFor();
  await wishlistPanel.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  const line = cartPanel.locator('article').first();
  await line.getByRole('button', { name: locale === 'fa' ? 'افزایش تعداد' : 'Increase quantity', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products')).find(item => item._id === 'header-qa-2').orderQuantity === 3);
  await cartPanel.getByText(locale === 'fa' ? '۸٬۶۱۰٬۰۰۰ تومان' : '8,610,000 Toman', { exact: true }).first().waitFor();
  await line.getByRole('button', { name: locale === 'fa' ? 'کم‌کردن تعداد' : 'Decrease quantity', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products')).find(item => item._id === 'header-qa-2').orderQuantity === 2);
  await cartPanel.screenshot({ path: path.join(output, `cart-${locale}-1440.png`) });
  await account.hover(); await accountPanel.waitFor(); await cartPanel.waitFor({ state: 'hidden' });
  await page.mouse.move(1000, 800); await accountPanel.waitFor({ state: 'hidden' });
  await page.locator('#vd-desktop-search').focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await accountPanel.waitFor();
  await page.keyboard.press('Escape'); await accountPanel.waitFor({ state: 'hidden' });
  await page.keyboard.press('Tab'); await wishlistPanel.waitFor();
  await page.keyboard.press('Shift+Tab'); await accountPanel.waitFor();
  await page.keyboard.press('Escape'); await accountPanel.waitFor({ state: 'hidden' });
  await account.focus(); await page.keyboard.press('ArrowDown'); await accountPanel.waitFor();
  assert.ok(await accountPanel.evaluate(node => node.contains(document.activeElement)));
  await page.keyboard.press('Escape'); await accountPanel.waitFor({ state: 'hidden' });
  await account.click(); await accountPanel.waitFor();
  await page.locator('#vd-desktop-search').click(); await accountPanel.waitFor({ state: 'hidden' });
  await account.hover(); await accountPanel.waitFor();
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.waitForTimeout(150);
  const shortBox = await accountPanel.boundingBox(); assert.ok(shortBox.y + shortBox.height <= 500);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await accountPanel.getByRole('button', { name: locale === 'fa' ? 'خروج از حساب کاربری' : 'Sign out', exact: true }).click();
  await page.waitForURL(`**/${locale}/login`);
  assert.equal(await page.evaluate(() => localStorage.getItem('auth')), null);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cart_products')).length), 2);
  await page.locator('[data-header-trigger="account"]').hover();
  const guest = page.locator('[data-header-dropdown="account"]:visible'); await guest.waitFor();
  assert.ok(await guest.locator(`a[href*="/${locale}/login?returnTo="]`).isVisible());
  assert.equal(await guest.locator(`a[href="/${locale}/cart"]`).count(), 1);
  assert.equal(await guest.locator(`a[href="/${locale}/faq"]`).count(), 1);
  await guest.screenshot({ path: path.join(output, `guest-${locale}-1440.png`) });
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`PASS desktop ${locale}: original trigger geometry, all account routes, hover bridge, toggle, focus, Escape, outside click, single surface, live prices, stock, cart/wishlist mutations, empty state, viewport clamp and logout.`);
}

/** Exercises the existing mobile header, cart sheet, account drawer and bottom navigation at tablet/phone sizes. */
async function mobileChecks(browser, width) {
  const context = await contextFor(browser, width, true, true); const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/fa');
  await page.locator('[data-header-trigger="wishlist"] span').waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-header-trigger="account"]').isVisible(), false);
  await page.locator('.vd-mobile-bottom-nav a[href="/fa/account"][aria-haspopup="dialog"]').waitFor();
  const trigger = page.locator('button[aria-controls="vd-header-cart-mobile"]');
  await trigger.tap();
  const sheet = page.locator('#vd-header-cart-mobile'); await sheet.waitFor();
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.ok((await sheet.boundingBox()).width <= width);
  await page.keyboard.press('Shift+Tab'); assert.ok(await sheet.evaluate(node => node.contains(document.activeElement)));
  await page.screenshot({ path: path.join(output, `cart-fa-${width}.png`) });
  await page.touchscreen.tap(width - 12, 150); await sheet.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate(node => node === document.activeElement));
  await trigger.tap(); await sheet.waitFor();
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  const account = page.locator('.vd-mobile-bottom-nav a[href="/fa/account"]');
  // Tap the visible upper part of the item, away from Next's local-only corner dev indicator.
  await account.tap({ position: { x: 60, y: 16 } }); const drawer = page.locator('#vd-header-account-mobile'); await drawer.waitFor();
  assert.equal(await drawer.locator('nav a').count(), 6);
  await drawer.locator('.vd-header-mobile-order-tiles a').first().getByText('۲', { exact: true }).waitFor();
  assert.deepEqual(await drawer.locator('.vd-header-mobile-order-tiles span').allTextContents(), ['۲', '۲', '۱']);
  await drawer.getByText('۰۹۱۵•••۸۸۷۷', { exact: true }).waitFor();
  assert.ok(await drawer.evaluate(node => node.contains(document.activeElement)));
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await drawer.evaluate(node => getComputedStyle(node).fontFamily.includes('Vazirmatn')));
  assert.ok(await drawer.locator('h2').first().evaluate(node => getComputedStyle(node).fontFamily.includes('Vazirmatn')));
  for (const link of await drawer.locator('a').all()) assert.ok((await link.boundingBox()).height >= 44);
  const bounds = await drawer.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
  assert.equal((await page.locator('.vd-header-mobile-surface').boundingBox()).y, 116);
  assert.equal(await page.locator('main').first().evaluate(node => node.inert), true);
  await page.screenshot({ path: path.join(output, `account-fa-${width}.png`) });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, "Open surfaces must isolate unrelated homepage overflow");
  fs.writeFileSync(path.join(output, `mobile-surface-${width}.json`), JSON.stringify(await drawer.evaluate(node => ({ bounds: node.getBoundingClientRect().toJSON(), scrollX, docWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })), null, 2));
  await drawer.locator('nav a[href="/fa/account/wishlist"]').tap();
  const wishlist = page.locator('#vd-header-wishlist-mobile'); await wishlist.waitFor();
  await drawer.waitFor({ state: 'hidden' });
  await wishlist.getByText('۱٬۸۹۰٬۰۰۰ تومان', { exact: true }).waitFor();
  const allSaved = wishlist.locator('a[href="/fa/account/wishlist"]');
  assert.equal(await allSaved.evaluate(node => getComputedStyle(node).color), 'rgb(0, 107, 79)');
  assert.equal(await wishlist.locator('article').count(), 2);
  for (const button of await wishlist.locator('article button').all()) { const box = await button.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44); }
  await page.screenshot({ path: path.join(output, `wishlist-fa-${width}.png`) });
  if (width === 768) {
    await allSaved.tap(); await page.waitForURL('**/fa/account/wishlist');
    await wishlist.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('main').first().evaluate(node => node.inert), false);
    await page.goBack(); await page.waitForURL('**/fa');
    await account.tap({ position: { x: 60, y: 16 } }); await drawer.waitFor();
    await drawer.locator('nav a[href="/fa/account/wishlist"]').tap(); await wishlist.waitFor();
  }
  const add = wishlist.locator('article').first().getByRole('button', { name: 'افزودن به سبد خرید', exact: true });
  await add.tap();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products')).find(p => p._id === 'header-qa-1').orderQuantity === 1);
  assert.equal(await page.locator('.vd-mobile-bottom-nav a[href="/fa/cart"] span.rounded-full').innerText(), '۳');
  await add.tap(); await add.tap();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products')).find(p => p._id === 'header-qa-1').orderQuantity === 3);
  assert.ok(await wishlist.locator('article').first().locator('button:disabled').isVisible());
  for (let i = 0; i < 2; i++) await wishlist.locator('article').first().locator('button[aria-label]').tap();
  await wishlist.getByText('هنوز محصولی ذخیره نکرده‌اید', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wishlist_items')).length), 0);
  await page.screenshot({ path: path.join(output, `wishlist-empty-fa-${width}.png`) });
  await wishlist.getByRole('button', { name: 'بازگشت', exact: true }).tap(); await drawer.waitFor();
  await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' });
  assert.ok(await account.evaluate(node => node === document.activeElement));
  assert.equal(await page.locator('main').first().evaluate(node => node.inert), false);
  await account.tap({ position: { x: 60, y: 16 } }); await drawer.waitFor();
  await account.tap({ position: { x: 60, y: 16 } }); await drawer.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.equal(await page.locator('.vd-mobile-bottom-nav li').count(), 4);
  const geometry = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
    headerWidth: document.querySelector('header').getBoundingClientRect().width,
    outside: Array.from(document.querySelectorAll('body *')).map(node => ({ tag: node.tagName, classes: node.className, bounds: node.getBoundingClientRect().toJSON() })).filter(item => item.bounds.width > 0 && (item.bounds.right > innerWidth + 1 || item.bounds.left < -1)).slice(0, 18) }));
  fs.writeFileSync(path.join(output, `geometry-${width}.json`), JSON.stringify(geometry, null, 2));
  assert.ok(geometry.headerWidth <= width);
  if (width === 390) {
    await page.goto(origin + '/fa/cart');
    const sticky = page.locator('main > div > div.fixed');
    await page.locator('main a[href="/fa/shipping"]').first().waitFor();
    await page.screenshot({ path: path.join(output, 'full-cart-fa-390.png') });
    assert.equal(await sticky.count(), 1); assert.ok(await sticky.isVisible());
    const bar = await sticky.boundingBox(), nav = await page.locator('.vd-mobile-bottom-nav').boundingBox();
    assert.ok(bar.y + bar.height <= nav.y + 1);
    await sticky.getByText('۱٬۹۶۰٬۰۰۰ تومان', { exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  await context.close(); console.log(`PASS responsive ${width}: existing navigation/cart sheet, live account counts, wishlist cards/add/stock/removal/empty/back, Escape, focus, body lock and background inert cleanup.`);
}

/** Guest state, safe return destinations, live query failures and compatibility without production access. */
async function mobileStateChecks(browser) {
  const beforeGuest = orderRequests;
  const context = await contextFor(browser, 390, false, true); const page = await context.newPage();
  await page.goto(origin + '/fa');
  await page.locator('[data-header-trigger="wishlist"] span').waitFor({ state: 'attached' });
  const account = page.locator('.vd-mobile-bottom-nav a[href="/fa/account"]');
  await account.tap({ position: { x: 60, y: 16 } });
  const panel = page.locator('#vd-header-account-mobile'); await panel.waitFor();
  await panel.getByText('به وندورا خوش آمدید', { exact: true }).waitFor();
  assert.equal(await panel.locator('a[href="/fa/login?returnTo=%2Ffa"]').count(), 1);
  assert.equal(await panel.locator('a[href="/fa/login?returnTo=%2Ffa%2Faccount%2Forders"]').count(), 1);
  assert.equal(await panel.locator('a[href="/fa/cart"]').count(), 1);
  await page.screenshot({ path: path.join(output, 'guest-fa-390.png') });
  assert.equal(orderRequests, beforeGuest, 'Guest must not request private orders');
  await panel.locator('a[href="/fa/login?returnTo=%2Ffa"]').tap();
  await page.waitForURL('**/fa/login?returnTo=%2Ffa'); await panel.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cart_products')).length), 1);
  await context.close();
  rejectOrders = true;
  const failure = await contextFor(browser, 390, true, true); const failurePage = await failure.newPage();
  await failurePage.goto(origin + '/fa'); await failurePage.locator('[data-header-trigger="wishlist"] span').waitFor({ state: 'attached' });
  await failurePage.locator('.vd-mobile-bottom-nav a[href="/fa/account"]').tap({ position: { x: 60, y: 16 } });
  const failed = failurePage.locator('#vd-header-account-mobile');
  await failed.getByRole('alert').waitFor();
  assert.deepEqual(await failed.locator('.vd-header-mobile-order-tiles span').allTextContents(), ['—', '—', '—']);
  rejectOrders = false;
  await failed.getByRole('button', { name: 'تلاش مجدد', exact: true }).tap();
  await failed.locator('.vd-header-mobile-order-tiles a').first().getByText('۲', { exact: true }).waitFor();
  await failed.getByRole('button', { name: 'خروج از حساب کاربری', exact: true }).tap();
  await failurePage.waitForURL('**/fa/login');
  assert.equal(await failurePage.evaluate(() => localStorage.getItem('auth')), null);
  assert.equal(await failurePage.evaluate(() => document.body.style.overflow), '');
  assert.equal(await failurePage.evaluate(() => JSON.parse(localStorage.getItem('cart_products')).length), 1);
  await failure.close();
  const english = await contextFor(browser, 768, true, true); const en = await english.newPage();
  await en.goto(origin + '/en'); await en.locator('[data-header-trigger="wishlist"] span').waitFor({ state: 'attached' }); await en.locator('.vd-mobile-bottom-nav a[aria-haspopup="dialog"]').waitFor(); await en.locator('.vd-mobile-bottom-nav a[href="/en/account"]').tap({ position: { x: 60, y: 16 } });
  await en.locator('#vd-header-account-mobile').waitFor();
  assert.equal(await en.locator('#vd-header-account-mobile').getAttribute('dir'), 'ltr');
  await en.locator('#vd-header-account-mobile nav a[href="/en/account/wishlist"]').tap();
  await en.locator('#vd-header-wishlist-mobile').getByText('1,890,000 Toman', { exact: true }).waitFor();
  await en.screenshot({ path: path.join(output, 'wishlist-en-768.png') });
  await english.close();
  console.log('PASS mobile guest/login return, no guest private API calls, order failure/retry and English LTR.');
}

/** Wide touch screens use tap toggles rather than emulated mouse-hover dismissal. */
async function wideTouchChecks(browser) {
  const context = await contextFor(browser, 1440, false, true); const page = await context.newPage();
  await page.goto(origin + '/fa'); await page.locator('[data-header-trigger="wishlist"] span').waitFor();
  const trigger = page.locator('[data-header-trigger="account"]'); const panel = page.locator('#vd-header-account');
  await trigger.tap(); await panel.waitFor(); await page.waitForTimeout(350); assert.ok(await panel.isVisible());
  await trigger.tap(); await panel.waitFor({ state: 'hidden' });
  await context.close(); console.log('PASS wide touch: tap toggle without emulated hover dismissal.');
}

/** Failed catalog loads must not enable purchases with locally persisted prices; retry uses the same query. */
async function failureChecks(browser) {
  rejectCatalog = true;
  const context = await contextFor(browser, 1440, false); const page = await context.newPage();
  await page.goto(origin + '/fa'); await page.locator('[data-header-trigger="wishlist"] span').waitFor(); await page.locator('[data-header-trigger="wishlist"]').hover();
  const panel = page.locator('[data-header-dropdown="wishlist"]:visible');
  await panel.getByRole('alert').waitFor();
  assert.equal(await panel.locator('article button:disabled').count(), 2);
  rejectCatalog = false;
  await panel.getByRole('button', { name: 'تلاش مجدد', exact: true }).click();
  await panel.getByText('۱٬۸۹۰٬۰۰۰ تومان', { exact: true }).waitFor();
  await context.close();
  catalogDelay = 3000;
  const loading = await contextFor(browser, 1440, false); const loadingPage = await loading.newPage();
  await loadingPage.goto(origin + '/fa', { waitUntil: 'domcontentloaded' }); await loadingPage.locator('[data-header-trigger="wishlist"] span').waitFor(); await loadingPage.locator('[data-header-trigger="wishlist"]').hover();
  await loadingPage.locator('[aria-busy="true"]').waitFor();
  await loadingPage.locator('[data-header-dropdown="wishlist"]').getByText('۱٬۸۹۰٬۰۰۰ تومان', { exact: true }).waitFor();
  catalogDelay = 0; await loading.close();
  console.log('PASS catalog errors, disabled stale-price actions, retry and loading.');
}

/** Runs all browser assertions and always shuts down only the test-owned servers. */
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => api.listen(5055, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3029'], {
    cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:5055', NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { logs.push(data.toString()); if (logs.length > 100) logs.shift(); });
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    if (!process.env.HEADER_QA_MOBILE_ONLY) for (const locale of ['fa', 'en']) await desktopChecks(browser, locale);
    for (const width of [1024, 768, 390]) await mobileChecks(browser, width);
    await mobileStateChecks(browser);
    if (!process.env.HEADER_QA_MOBILE_ONLY) { await wideTouchChecks(browser); await failureChecks(browser); }
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error, logs.slice(-12).join('')); process.exitCode = 1; });
