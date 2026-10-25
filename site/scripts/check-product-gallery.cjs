/* Product gallery regression: isolated local API/images only; no real account or product writes. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../artifacts/product-gallery');
const origin = 'http://127.0.0.1:3031';
const apiOrigin = 'http://127.0.0.1:5057';
const images = ['landscape', 'portrait', 'square'].map((name, index) => ({ id: name, imageUrl: `${apiOrigin}/uploads/gallery/${name}.svg`, altText: `تصویر ${index + 1}`, sortOrder: index, isPrimary: !index }));
const logs = [];
/** Returns only local synthetic product/image fixtures for this browser check. */
const api = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  const url = new URL(request.url, apiOrigin);
  if (url.pathname.startsWith('/uploads/')) {
    if (url.pathname.includes('broken')) return response.writeHead(404).end();
    const [width, height] = url.pathname.includes('portrait') ? [700, 1100] : url.pathname.includes('square') ? [800, 800] : [1200, 700];
    response.setHeader('Content-Type', 'image/svg+xml');
    return response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f6faf8"/><g transform="translate(${width / 2 - 130} ${height / 2 - 110})"><path d="M60 80V40a70 70 0 0 1 140 0v40" fill="none" stroke="#004d3a" stroke-width="16"/><rect y="80" width="260" height="240" rx="36" fill="#006b4f"/><path d="M50 140h160" stroke="#b8e1d1" stroke-width="10"/></g></svg>`);
  }
  response.setHeader('Content-Type', 'application/json');
  let result = [];
  if (url.pathname === '/api/store-settings' || url.pathname === '/api/store-settings/seed-visibility') result = { showSeedData: false };
  else if (url.pathname === '/api/catalog/seo') result = { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false };
  else if (url.pathname.startsWith('/api/catalog/products/')) {
    const id = url.pathname.split('/').pop();
    const media = id === 'single' ? images.slice(0, 1) : id === 'empty' ? [] : id === 'broken' ? [{ ...images[0], imageUrl: `${apiOrigin}/uploads/gallery/broken.svg` }, images[1]] : images;
    result = { id, slug: id, title: 'کیف آزمایشی گالری وندورا', productCode: 100, price: 1890000, stockQuantity: 4, description: 'محصول آزمایشی', images: media, categories: [], colors: [], breadcrumbs: [] };
  } else if (/reviews|questions|answers/.test(url.pathname)) result = { items: [], total: 0, pageNumber: 1, pageSize: 10 };
  response.end(JSON.stringify(result));
});

/** Waits for Next startup on the dedicated test port. */
async function ready() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin + '/fa/product/gallery-qa', { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* compiling */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Gallery QA server did not start');
}

/** Checks actual rendered image aspect/containment rather than only CSS declarations. */
async function checkImage(dialog, width, height) {
  const image = dialog.locator('.vd-product-lightbox__image');
  await image.locator('xpath=self::*[contains(@class,"is-loaded")]').waitFor();
  const dimensions = await image.evaluate(node => ({ naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight, box: node.getBoundingClientRect().toJSON() }));
  assert.ok(Math.abs(dimensions.box.width / dimensions.box.height - dimensions.naturalWidth / dimensions.naturalHeight) < .02, 'Uncropped natural aspect ratio');
  assert.ok(dimensions.box.x >= 0 && dimensions.box.right <= width + 1);
  assert.ok(dimensions.box.y >= 0 && dimensions.box.bottom <= height + 1);
  return dimensions.box;
}

/** Exercises modal interaction, touch, keyboard, focus, responsive geometry and error states. */
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => api.listen(5057, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3031'], {
    cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiOrigin, API_INTERNAL_BASE_URL: apiOrigin, NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { logs.push(data.toString()); if (logs.length > 60) logs.shift(); });
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      const height = 900, context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/fa/product/gallery-qa');
      const trigger = page.getByRole('button', { name: /^نمایش بزرگ تصاویر/ });
      const dialog = page.getByRole('dialog');
      await trigger.click(); await dialog.waitFor();
      assert.equal(await dialog.evaluate(node => node.matches(':modal')), true);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      const first = await checkImage(dialog, width, height);
      await dialog.locator('.vd-product-lightbox__image').click(); assert.ok(await dialog.isVisible());
      await dialog.getByRole('button', { name: 'تصویر بعدی', exact: true }).click(); await checkImage(dialog, width, height);
      assert.ok((await dialog.locator('.vd-product-lightbox__image').getAttribute('src')).includes('portrait'));
      await page.keyboard.press('ArrowLeft'); await checkImage(dialog, width, height);
      assert.ok((await dialog.locator('.vd-product-lightbox__image').getAttribute('src')).includes('square'));
      await dialog.getByRole('button', { name: 'تصویر بعدی', exact: true }).click();
      assert.ok((await dialog.locator('.vd-product-lightbox__image').getAttribute('src')).includes('landscape'));
      // Real browser touch events exercise horizontal swipe without triggering vertical scrolling.
      const cdp = await context.newCDPSession(page), x = first.x + first.width * .35, y = first.y + first.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 65, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelector('.vd-product-lightbox__image')?.getAttribute('src').includes('portrait'));
      await dialog.getByRole('button', { name: 'بستن گالری' }).focus();
      await page.keyboard.press('Shift+Tab'); assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Focus stays inside');
      await page.screenshot({ path: path.join(output, `gallery-${width}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.ok(await trigger.evaluate(node => node === document.activeElement));
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await trigger.click(); await dialog.waitFor(); await checkImage(dialog, width, height);
      await dialog.locator('.vd-product-lightbox__stage').click({ position: { x: 2, y: 2 } }); await dialog.waitFor({ state: 'hidden' });
      await trigger.click(); await dialog.waitFor();
      await dialog.getByRole('button', { name: 'بستن گالری' }).click(); await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS gallery modal ${width}: images, aspect, arrows, wrap, swipe, focus, Escape, backdrop, close, scroll restoration`);
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 700 }, reducedMotion: 'reduce' }), page = await context.newPage();
    for (const id of ['single', 'empty', 'broken']) {
      await page.goto(origin + '/fa/product/' + id); await page.getByRole('button', { name: /^نمایش بزرگ تصاویر/ }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      if (id === 'broken') {
        await dialog.getByText('این تصویر بارگذاری نشد؛ تصویر دیگری را انتخاب کنید.').waitFor(); await dialog.getByRole('button', { name: 'تصویر بعدی' }).click(); await checkImage(dialog, 390, 700);
      } else assert.equal(await dialog.getByRole('button', { name: 'تصویر بعدی' }).count(), 0);
      assert.equal(await dialog.evaluate(node => getComputedStyle(node).animationName), 'none');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      console.log(`PASS ${id} image / reduced motion`);
    }
    await page.goto(origin + '/en/product/gallery-qa'); await page.getByRole('button', { name: /^Enlarge product images/ }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor(); assert.equal(await dialog.getAttribute('dir'), 'ltr');
    await page.keyboard.press('ArrowRight'); await checkImage(dialog, 390, 700);
    assert.ok((await dialog.locator('img.vd-product-lightbox__image').getAttribute('src')).includes('portrait'));
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await context.close(); console.log('PASS English LTR gallery');
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error, logs.slice(-5).join('')); process.exitCode = 1; });
