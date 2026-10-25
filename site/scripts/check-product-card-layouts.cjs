/* Product-card regression uses only local synthetic catalog/session data. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../artifacts/product-card-layouts');
const baseline = process.env.CARD_QA_BASELINE === '1';
const origin = 'http://127.0.0.1:3030';
const category = { id: 'qa-bags', slug: 'qa-bags', name: 'کیف', parentCategoryId: null, children: [] };
const products = [
  { title: 'کوله‌پشتی آرتین', price: 1890000, stockQuantity: 3 },
  { title: 'کیف دستی بسیار کاربردی با عنوان طولانی برای بررسی چینش کارت و قیمت بزرگ', price: 9990000000, stockQuantity: 5 },
  { title: 'کیف دوشی ناموجود', price: 980000, stockQuantity: 0 },
  { title: 'کیف روزمره', price: 1450000, stockQuantity: 4 },
  { title: 'کوله تازه‌قیمت', price: 2250000, stockQuantity: 2, priceFreshness: { verifiedAtUtc: new Date().toISOString(), expiresAtUtc: new Date(Date.now() + 3600000).toISOString() } },
].map((p, i) => ({ ...p, id: `card-qa-${i}`, slug: `card-qa-${i}`, productCode: 100 + i, description: 'توضیحات آزمایشی کالا', descriptionHtml: '<p>شرح کالا</p>',
  images: [], colors: [], categories: [category], categoryId: category.id, categoryName: category.name, categorySlug: category.slug, breadcrumbs: [category] }));
const saved = products.map(p => ({ _id: p.id, slug: p.slug, title: p.title, originalPrice: p.price, quantity: p.stockQuantity,
  discount: p.id === 'card-qa-3' ? 20 : 0, category: { name: category.name, slug: category.slug } }));
const logs = [];
const api = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  response.setHeader('Content-Type', 'application/json');
  const url = new URL(request.url, 'http://127.0.0.1:5056');
  let result = [];
  if (url.pathname === '/api/store-settings') result = { showSeedData: true };
  else if (url.pathname === '/api/store-settings/seed-visibility') result = { showSeedData: true };
  else if (url.pathname === '/api/catalog/seo') result = { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title} | {siteName}', isIndexingEnabled: false };
  else if (url.pathname === '/api/catalog/products/search') result = { products, total: products.length, page: 1, pageSize: 24 };
  else if (url.pathname === '/api/catalog/products') result = products;
  else if (url.pathname.startsWith('/api/catalog/products/')) result = products.find(p => p.slug === url.pathname.split('/').pop()) ?? products[0];
  else if (url.pathname === '/api/catalog/categories/tree') result = [category];
  else if (url.pathname.startsWith('/api/catalog/categories/')) result = { ...category, breadcrumbs: [], description: 'معرفی دسته' };
  else if (url.pathname === '/api/account/me') result = { id: 'card-qa-user', fullName: 'کاربر آزمایشی', email: 'cards@vendora.invalid', completion: { isComplete: true } };
  else if (/reviews|questions|answers/.test(url.pathname)) result = { items: [], total: 0, pageNumber: 1, pageSize: 10 };
  response.end(JSON.stringify(result));
});

/** Waits for the isolated local Next server without contacting a production system. */
async function ready() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin + '/fa', { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* compiler startup */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Product-card QA server did not start.');
}

/** Creates a fresh client state so each route sees the same products and empty cart. */
async function open(browser, width, route) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1280 });
  await context.addInitScript(saved => {
    if (sessionStorage.getItem('card-qa-seeded')) return;
    sessionStorage.setItem('card-qa-seeded', '1');
    localStorage.setItem('wishlist_items', JSON.stringify(saved)); localStorage.setItem('cart_products', '[]');
    localStorage.setItem('auth', JSON.stringify({ accessToken: 'isolated-card-fixture', user: { id: 'card-qa-user', name: 'کاربر آزمایشی' } }));
  }, saved);
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + route);
  await page.locator('.vd-product-card').first().waitFor();
  await page.locator('[data-header-trigger="wishlist"] span').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors };
}

/** Measures actual price/action geometry and clipping, including long titles and large values. */
async function geometry(page) {
  return page.locator('.vd-product-card').evaluateAll(cards => cards.filter(card => card.getClientRects().length > 0).map(card => {
    const rect = node => node?.getBoundingClientRect().toJSON();
    const price = card.querySelector('.vd-product-card__price');
    const action = card.querySelector('.vd-product-card__action button');
    const number = card.querySelector('.vd-card-price__number');
    return { card: rect(card), price: rect(price), action: rect(action), text: card.querySelector('h2')?.textContent,
      numberOverflow: number ? number.scrollWidth > number.clientWidth + 1 : false,
      number: number ? { text: number.textContent, client: number.clientWidth, scroll: number.scrollWidth, font: getComputedStyle(number).fontSize } : null,
      buttonVisible: action ? getComputedStyle(action).visibility !== 'hidden' : false,
      glyph: rect(action?.querySelector('.vd-card-purchase__visual svg')),
      previous: rect(card.querySelector('.vd-card-price--previous')),
      current: rect(card.querySelector('.vd-card-price:not(.vd-card-price--previous)')),
      visual: rect(action?.querySelector('.vd-card-purchase__visual')) };
  }));
}

/** Exercises the existing Redux/listener workflow through the shared square and quantity popover. */
async function cartActions(page, width) {
  const card = page.locator('.vd-product-card').first();
  const trigger = card.locator('.vd-card-purchase__button');
  await trigger.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products'))[0]?.orderQuantity === 1);
  await trigger.click();
  const panel = page.locator('.vd-card-quantity-popover'); await panel.waitFor();
  assert.equal(await panel.getAttribute('dir'), 'rtl');
  const box = await panel.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
  await panel.getByRole('button', { name: 'افزایش تعداد', exact: true }).click();
  await panel.getByRole('button', { name: 'افزایش تعداد', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products'))[0].orderQuantity === 3);
  await panel.getByRole('button', { name: /موجودی/ }).press('Enter');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cart_products'))[0].orderQuantity), 3);
  await page.screenshot({ path: path.join(output, `quantity-${width}.png`) });
  await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate(node => node === document.activeElement));
  await trigger.click(); await panel.waitFor();
  await panel.getByRole('button', { name: 'کم‌کردن تعداد', exact: true }).click();
  await panel.getByRole('button', { name: 'کم‌کردن تعداد', exact: true }).click();
  await panel.getByRole('button', { name: 'حذف', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cart_products')).length), 0);
  await trigger.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products'))[0]?.orderQuantity === 1);
  await page.keyboard.press('Enter'); await panel.waitFor();
  await page.locator('#vd-mobile-search, #vd-desktop-search:visible').first().click(); await panel.waitFor({ state: 'hidden' });
  await page.reload(); await trigger.waitFor();
  await trigger.getByText('۱', { exact: true }).waitFor();
}

/** Verifies each active route at all requested widths and retains before/after screenshots. */
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => api.listen(5056, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3030'], {
    cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:5056', API_INTERNAL_BASE_URL: 'http://127.0.0.1:5056', NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { logs.push(data.toString()); if (logs.length > 100) logs.shift(); });
  let browser; const measurements = {};
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    const routes = process.env.CARD_QA_EXTRA_ONLY === '1' ? {} : { home: '/fa', shop: '/fa/shop', search: '/fa/search?query=کیف', category: '/fa/category/qa-bags', related: '/fa/product/card-qa-0', wishlist: '/fa/account/wishlist' };
    const before = !baseline && fs.existsSync(path.join(output, 'before.json')) ? JSON.parse(fs.readFileSync(path.join(output, 'before.json'))) : {};
    for (const width of [320, 390, 768, 1024, 1440]) for (const [name, route] of Object.entries(routes)) {
      const { context, page, errors } = await open(browser, width, route);
      const rows = await geometry(page); measurements[`${name}-${width}`] = rows;
      fs.writeFileSync(path.join(output, `latest-${name}-${width}.json`), JSON.stringify(rows, null, 2));
      if (!baseline) {
        for (const row of rows) {
          assert.ok(row.action && row.buttonVisible, `${name}/${width}: missing purchase action`);
          assert.ok(row.action.x + row.action.width <= row.price.x + 1, `${name}/${width}: button must be left of price`);
          assert.ok(row.action.y < row.price.y + row.price.height && row.price.y < row.action.y + row.action.height, `${name}/${width}: price/action must share a row`);
          assert.equal(row.action.width, 44); assert.equal(row.action.height, 44);
          assert.ok(row.visual.width >= 40 && row.visual.width <= 44); assert.equal(row.visual.width, row.visual.height);
          assert.ok(Math.abs(row.glyph.x + row.glyph.width / 2 - row.visual.x - row.visual.width / 2) < 1, 'Centered purchase glyph X');
          assert.ok(Math.abs(row.glyph.y + row.glyph.height / 2 - row.visual.y - row.visual.height / 2) < 1, 'Centered purchase glyph Y');
          if (row.previous) assert.ok(row.previous.bottom <= row.current.top + 1, 'Previous price above current price');
          assert.ok(!row.numberOverflow, `${name}/${width}: price overflow`);
          assert.ok(row.action.y + row.action.height <= row.card.y + row.card.height, `${name}/${width}: clipped action`);
        }
        for (let i = 0; i < Math.min(rows.length, before[`${name}-${width}`]?.length ?? 0); i++) assert.ok(rows[i].card.height <= before[`${name}-${width}`][i].card.height + 1, `${name}/${width}: unnecessary card height increase`);
        if (name === 'shop') {
          const unavailable = page.locator('.vd-product-card').filter({ hasText: 'کیف دوشی ناموجود' });
          assert.ok(await unavailable.locator('.vd-card-purchase__button').isDisabled());
          await cartActions(page, width);
        }
      }
      await page.locator('.vd-product-card').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${name}-${width}.png`) });
      assert.deepEqual(errors, [], `${name}/${width}: browser errors`);
      await context.close(); console.log(`PASS ${baseline ? 'baseline' : 'layout'} ${name} ${width}`);
    }
    if (!baseline) {
      for (const width of [390, 1440]) {
        const { context, page, errors } = await open(browser, width, '/en/shop');
        for (const row of await geometry(page)) {
          assert.ok(row.price.x + row.price.width <= row.action.x + 1, `English/${width}: LTR ordering`);
          assert.ok(!row.numberOverflow, `English/${width}: price overflow`);
        }
        const trigger = page.locator('.vd-card-purchase__button').first();
        await trigger.click(); await trigger.click();
        const panel = page.locator('.vd-card-quantity-popover'); await panel.waitFor();
        assert.equal(await panel.getAttribute('dir'), 'ltr');
        await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
        // Existing locale-rewrite header mismatch is reported separately; card errors still fail.
        const headerWarnings = errors.filter(error => error.includes('Hydration failed') && error.includes('Bag Manufacturer') && error.includes('href="/fa"'));
        assert.deepEqual(errors.filter(error => !headerWarnings.includes(error)), []);
        if (headerWarnings.length) console.log(`KNOWN ISSUE English header hydration ${width}`);
        await context.close(); console.log(`PASS English card LTR ${width}`);
      }
      const { context, page, errors } = await open(browser, 390, '/fa/account/wishlist');
      await page.evaluate(() => localStorage.setItem('wishlist_items', '[]')); await page.reload();
      const trigger = page.locator('.vd-card-purchase__button').first(); await trigger.waitFor();
      for (const row of await geometry(page)) assert.ok(!row.numberOverflow && row.action.x < row.price.x, 'Empty-wishlist recommendations');
      await trigger.click(); await trigger.click();
      const panel = page.locator('.vd-card-quantity-popover'); await panel.waitFor();
      await panel.getByRole('button', { name: 'افزایش تعداد', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('cart_products'))[0]?.orderQuantity === 2);
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []); await context.close(); console.log('PASS empty-wishlist recommendation quantity');
    }
    if (Object.keys(measurements).length) fs.writeFileSync(path.join(output, baseline ? 'before.json' : 'after.json'), JSON.stringify(measurements, null, 2));
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error, logs.slice(-8).join('')); process.exitCode = 1; });
