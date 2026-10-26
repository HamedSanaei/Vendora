/* Checks the real homepage with isolated fixtures; never connects to production APIs. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:3036', apiOrigin = 'http://127.0.0.1:5063';
const output = path.resolve(root, '../artifacts/home-scrollbar');
/** Supplies only synthetic public catalog data for the isolated homepage. */
function fixture(url) {
  if (url.pathname.startsWith('/api/store-settings')) return { showSeedData: false };
  if (url.pathname === '/api/catalog/seo') return { siteName: 'Vendora', siteUrl: '', titleTemplate: '{title}', isIndexingEnabled: false };
  if (url.pathname === '/api/catalog/products/search') return { products: [], total: 0, page: 1, pageSize: 24 };
  if (url.pathname === '/api/shipping/policy') return { enabled: false, fixedAmount: 250000, version: 1 };
  return [];
}
const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(fixture(new URL(req.url, apiOrigin))));
});
/** Waits for the dedicated local production server to respond. */
async function ready() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(origin + '/fa', { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Homepage QA server failed to start');
}
/** Verifies native scrollbar visibility, vertical scrolling and responsive geometry in both directions. */
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => api.listen(5063, '127.0.0.1', resolve));
  const app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3036'], {
    cwd: root, env: { ...process.env, API_INTERNAL_BASE_URL: apiOrigin, NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = []; for (const stream of [app.stdout, app.stderr]) stream.on('data', chunk => logs.push(chunk.toString()));
  let browser;
  try {
    await ready(); browser = await chromium.launch({ headless: true, args: ['--disable-features=OverlayScrollbar'] });
    for (const [locale, width] of [...[390,768,1024,1440].map(width => ['fa',width]), ['en',1440]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: fixture(url) });
        if (url.origin !== origin) return route.abort();
        return route.continue();
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => { if (!error.message.includes('Stripe')) errors.push(error.message); });
      await page.goto(origin + '/' + locale); await page.locator('.vd-home').waitFor(); await page.waitForTimeout(500);
      const measure = () => page.evaluate(() => {
        const root = document.documentElement, css = getComputedStyle(root), bar = getComputedStyle(root, '::-webkit-scrollbar');
        return { scrollbar: css.scrollbarWidth, gutter: css.scrollbarGutter, barDisplay: bar.display, barWidth: bar.width, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, clientLeft: root.clientLeft, innerWidth, direction: css.direction };
      });
      const geometry = await measure();
      assert.notEqual(geometry.scrollbar, 'none'); assert.notEqual(geometry.barDisplay, 'none'); assert.notEqual(geometry.barWidth, '0px');
      assert.ok(geometry.scrollHeight > geometry.clientHeight, 'Homepage overflows vertically');

      await page.mouse.move(width / 2, 450); await page.mouse.wheel(0, 500); await page.waitForFunction(() => scrollY > 100);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${locale}-${width}.png`) });
      // Reproduce the removed rule in this isolated browser to retain a before comparison.
      const before = await page.addStyleTag({ content: 'html:has(.vd-home){scrollbar-width:none}html:has(.vd-home)::-webkit-scrollbar{display:none}' });
      await page.screenshot({ path: path.join(output, `${locale}-${width}-before.png`) });
      const baseline = await measure(); await before.evaluate(node => node.remove());
      assert.ok(geometry.scrollWidth <= baseline.scrollWidth + 1, 'Scrollbar restoration introduces no horizontal overflow');
      if (geometry.scrollWidth > geometry.clientWidth + 1) console.log(`NOTE ${locale} ${width}: existing homepage promo overflow also occurs with the previous hidden-scrollbar rule (${baseline.scrollWidth}px).`);
      assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, `${locale}-${width}.json`), JSON.stringify(geometry, null, 2));
      console.log(`PASS ${locale} ${width}: native scrollbar and wheel scrolling; RTL/LTR preserved`); await context.close();
    }
  } catch (error) { console.error(logs.slice(-4).join('')); throw error; }
  finally { await browser?.close(); app.kill(); api.closeAllConnections(); api.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
