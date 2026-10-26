/* Homepage slideshow regression with isolated local playlists/images; never writes production data. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../artifacts/hero-slideshow');
const origin = 'http://127.0.0.1:3032', apiOrigin = 'http://127.0.0.1:5058';
const logs = [];
let single = false, delayImage = false, failPlaylist = false;
const slides = [0, 1, 2].map(index => ({ id: `hero-${index}`, imageUrl: `${apiOrigin}/uploads/hero/${index}.svg`, sortOrder: index, durationSeconds: 1 + index }));
const api = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  const url = new URL(request.url, apiOrigin);
  if (url.pathname.startsWith('/uploads/hero/')) {
    if (delayImage && url.pathname.endsWith('/1.svg')) await new Promise(resolve => setTimeout(resolve, 4000));
    response.setHeader('Content-Type', 'image/svg+xml');
    const color = url.pathname.endsWith('/0.svg') ? '#c8ded4' : url.pathname.endsWith('/1.svg') ? '#ddd2bf' : '#cedce9';
    return response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="700"><rect width="1400" height="700" fill="${color}"/><path d="M250 300V220a100 100 0 0 1 200 0v80" fill="none" stroke="#004d3a" stroke-width="20"/><rect x="170" y="300" width="360" height="300" rx="44" fill="#006b4f"/></svg>`);
  }
  response.setHeader('Content-Type', 'application/json');
  let result = [];
  if (url.pathname === '/api/slideshow') { if (failPlaylist) return response.writeHead(503).end('{}'); result = single ? slides.slice(0, 1) : slides; }
  else if (url.pathname.startsWith('/api/store-settings')) result = { showSeedData: false };
  else if (url.pathname === '/api/catalog/seo') result = { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false };
  else if (url.pathname === '/api/catalog/products/search') result = { products: [], total: 0, page: 1, pageSize: 24 };
  response.end(JSON.stringify(result));
});

/** Waits for the dedicated local Next process. */
async function ready() {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try { if ((await fetch(origin + '/fa', { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* compiling */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Hero QA server did not start');
}

/** Waits until a specific real slide and its fade are settled without accessing Swiper internals. */
async function active(page, index) {
  await page.waitForFunction(index => {
    const slide = document.querySelector('.vd-hero__swiper .swiper-slide[aria-hidden="false"], .vd-hero__static');
    const photo = slide?.querySelector('.vd-hero__photo'), img = photo?.querySelector('img');
    return img?.getAttribute('src').endsWith(`/${index}.svg`) && photo.dataset.ready === 'true' && Number(getComputedStyle(slide).opacity) > .99;
  }, index);
  await page.waitForTimeout(650); // Let the specified 600ms zoom/fade finish before the next gesture.
}

/** Generates a real mouse drag or browser touch gesture across the existing image area. */
async function drag(page, context, touch, rtl = true) {
  const box = await page.locator('.vd-hero__photos').boundingBox();
  const from = box.x + box.width * (rtl ? .3 : .7), to = box.x + box.width * (rtl ? .7 : .3), y = box.y + box.height * .3;
  if (touch) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * i / 6, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(from, y); await page.mouse.down(); await page.mouse.move(to, y, { steps: 10 }); await page.mouse.up();
  }
}

/** Checks responsive controls, every navigation path, autoplay, load delay and reduced motion. */
async function main() {
  fs.mkdirSync(output, { recursive: true }); await new Promise(resolve => api.listen(5058, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3032'], {
    cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiOrigin, API_INTERNAL_BASE_URL: apiOrigin, NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_STRIPE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { logs.push(data.toString()); if (logs.length > 60) logs.shift(); });
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true });
    for (const width of (process.env.HERO_QA_EXTRA_ONLY === '1' ? [] : (process.env.HERO_QA_WIDTHS || '390,768,1024,1440').split(',').map(Number))) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, hasTouch: touch });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/fa');
      const hero = page.locator('.vd-hero-slideshow'); await hero.waitFor(); await hero.hover(); await hero.focus(); await active(page, 0);
      for (const element of [hero.locator('.vd-hero__photos'), hero.locator('.vd-hero__photo.is-active > img')]) {
        assert.ok(await element.evaluate(node => parseFloat(getComputedStyle(node).borderTopLeftRadius) >= 24 && parseFloat(getComputedStyle(node).borderBottomLeftRadius) >= 24), 'Both physical left corners are rounded');
      }
      assert.equal(await hero.getByRole('group', { name: 'انتخاب عکس' }).count(), 0, 'Old indicator panel removed');
      assert.equal(await hero.locator('.vd-hero__next').isVisible(), !touch && width >= 768);
      if (!touch && width >= 768) {
        const box = await hero.locator('.vd-hero__photos').boundingBox();
        for (const arrow of await hero.locator('.vd-hero__arrow').all()) {
          const a = await arrow.boundingBox(); assert.ok(Math.abs(a.y + a.height / 2 - box.y - box.height / 2) < 1);
          assert.ok(a.x >= box.x && a.x + a.width <= box.x + box.width); assert.ok(a.width >= 44);
          assert.ok(a.x + a.width <= box.x + box.width / 2, 'RTL arrows stay in the photo half, clear of the title/CTA');
        }
        await hero.getByRole('button', { name: 'عکس بعدی', exact: true }).click(); await active(page, 1);
        await hero.getByRole('button', { name: 'عکس بعدی', exact: true }).click(); await active(page, 2);
        await hero.getByRole('button', { name: 'عکس بعدی', exact: true }).click(); await active(page, 0);
      }
      await drag(page, context, touch); await active(page, 1);
      assert.equal(await page.locator('.vd-hero__photo.is-active > img').evaluate(img => getComputedStyle(img).animationName), 'vd-hero-zoom');
      const firstZoom = await page.locator('.vd-hero__photo.is-active > img').evaluate(img => img.getAnimations()[0]?.startTime);
      await hero.focus(); await page.keyboard.press('ArrowLeft'); await active(page, 2);
      await page.keyboard.press('ArrowRight'); await active(page, 1);
      assert.equal(await page.locator('.vd-hero__photo.is-active > img').evaluate(img => getComputedStyle(img).animationName), 'vd-hero-zoom');
      assert.ok(await page.locator('.vd-hero__photo.is-active > img').evaluate((img, before) => img.getAnimations()[0]?.startTime > before, firstZoom), 'Zoom restarts on returning to the same image');
      const photo = await hero.locator('.vd-hero__photos').boundingBox();
      await page.mouse.move(photo.x + photo.width * .65, photo.y + 40); await page.mouse.wheel(-160, 0); await active(page, 2);
      fs.writeFileSync(path.join(output, `geometry-${touch ? 'touch' : 'mouse'}-${width}.json`), JSON.stringify(await hero.evaluate(node => ({ hero: node.getBoundingClientRect().toJSON(), scrollX, scrollY, innerWidth, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })), null, 2));
      const scrollBefore = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 180);
      await page.waitForFunction(before => scrollY > before, scrollBefore, { timeout: 3000 });
      // Other existing homepage promo columns overflow at 1024; restore the viewport for a scoped hero comparison.
      await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(output, `${touch ? 'touch' : 'mouse'}-${width}.png`) });
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS ${touch ? 'touch' : 'mouse'} ${width}: controls, drag, keys, wheel, loop, zoom, vertical scroll`);
    }
    if (process.env.HERO_QA_LAYOUT_ONLY === '1') return;
    // A clean untouched viewport verifies the original per-slide durations and focus-only pause control.
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } }), page = await context.newPage();
    await page.goto(origin + '/fa'); await page.mouse.move(0, 0);
    await active(page, 0); await active(page, 1);
    const hero = page.locator('.vd-hero-slideshow'); await hero.hover();
    await page.waitForTimeout(2500); assert.ok(await hero.locator('.swiper-slide[aria-hidden="false"] img').getAttribute('src').then(src => src.endsWith('/1.svg')));
    await hero.focus(); const pause = hero.getByRole('button', { name: 'توقف پخش خودکار' }); await pause.focus();
    assert.ok(await pause.evaluate(button => getComputedStyle(button).clipPath === 'none'));
    await page.keyboard.press('Enter'); await hero.getByRole('button', { name: 'شروع پخش خودکار' }).waitFor();
    await page.mouse.move(0, 0); await page.locator('body').click({ position: { x: 0, y: 0 } }); await page.waitForTimeout(2500);
    assert.ok((await hero.locator('.swiper-slide[aria-hidden="false"] img').getAttribute('src')).endsWith('/1.svg'));
    await context.close(); console.log('PASS autoplay timing, hover/focus pause and explicit stop');
    delayImage = true;
    const slowContext = await browser.newContext({ viewport: { width: 390, height: 850 }, reducedMotion: 'reduce' }), slow = await slowContext.newPage();
    await slow.goto(origin + '/fa', { waitUntil: 'domcontentloaded' }); await active(slow, 0); await slow.locator('.vd-hero-slideshow').focus(); await slow.keyboard.press('ArrowLeft');
    assert.equal(await slow.locator('.swiper-slide[aria-hidden="false"] .vd-hero__photo').getAttribute('data-ready'), 'false', 'Slow next image is genuinely pending');
    const backing = slow.locator('.vd-hero__backing .vd-hero__photo'); assert.equal(await backing.getAttribute('data-ready'), 'true');
    assert.equal(await backing.evaluate(node => getComputedStyle(node).opacity), '1'); await active(slow, 1);
    assert.equal(await slow.locator('.vd-hero__photo.is-active img').evaluate(img => getComputedStyle(img).animationName), 'none');
    await slowContext.close(); delayImage = false; console.log('PASS slow image retained background and reduced motion');
    single = true;
    const singleContext = await browser.newContext(), singlePage = await singleContext.newPage(); await singlePage.goto(origin + '/fa'); await active(singlePage, 0);
    assert.equal(await singlePage.locator('.vd-hero__arrow, .vd-hero__autoplay').count(), 0); await singleContext.close(); single = false;
    console.log('PASS single slide without controls');
    failPlaylist = true;
    const fallbackContext = await browser.newContext(), fallback = await fallbackContext.newPage(); await fallback.goto(origin + '/fa');
    await fallback.locator('.vd-hero__swiper .vd-hero__photo[data-ready="true"]').first().waitFor();
    assert.equal(await fallback.locator('.vd-hero__swiper .swiper-slide').count(), 3);
    await fallback.locator('.vd-hero-slideshow').focus(); await fallback.keyboard.press('ArrowLeft');
    const editorial = fallback.locator('.swiper-slide[aria-hidden="false"] .vd-hero__photo[data-editorial="true"][data-ready="true"] > img');
    await editorial.waitFor();
    assert.ok(await editorial.evaluate(img => {
      const box = img.getBoundingClientRect(), style = getComputedStyle(img);
      return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight) < .02 && parseFloat(style.borderTopLeftRadius) >= 24 && parseFloat(style.borderBottomLeftRadius) >= 24;
    }), 'Editorial image box matches its uncropped pixels so its left corner radius is visible');
    await fallback.screenshot({ path: path.join(output, 'default-editorial.png'), animations: 'disabled' });
    await fallbackContext.close(); failPlaylist = false;
    console.log('PASS API failure retains original default playlist');
    const enContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' }), en = await enContext.newPage();
    await en.goto(origin + '/en'); const enHero = en.locator('.vd-hero-slideshow'); await enHero.focus(); await active(en, 0);
    await en.keyboard.press('ArrowRight'); await active(en, 1); await drag(en, enContext, false, false); await active(en, 2);
    const shop = enHero.getByRole('link', { name: 'Browse products' }), button = await shop.boundingBox();
    await en.mouse.move(button.x + button.width / 2, button.y + button.height / 2); await en.mouse.down();
    await en.mouse.move(button.x + button.width - 8, button.y + button.height / 2, { steps: 6 }); await en.mouse.up();
    assert.ok(new URL(en.url()).pathname === '/en', 'Dragging across a CTA must not navigate');
    await shop.click(); await en.waitForURL('**/en/shop');
    await enContext.close(); console.log('PASS English LTR and existing shop CTA');
  } finally { if (browser) await browser.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error, logs.slice(-5).join('')); process.exitCode = 1; });
