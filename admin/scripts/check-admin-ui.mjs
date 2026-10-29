/** Exercises the real built admin with isolated browser-only API fixtures; never contacts production. */
import assert from 'node:assert/strict';
import {storeManagementRoutes,checkStoreManagement} from './store-management-fixtures.mjs';
import {shippingLabelRoutes,checkOrderLabels,checkOrderLabelDetail} from './shipping-label-fixtures.mjs';
import { messagingFixture, messagingRoutes, checkMessaging, checkSupport } from './sms-support-fixtures.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../site/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = resolve('dist'), output = resolve('../artifacts/admin-ui', process.argv.includes('--before') ? 'before' : 'after');
const before = process.argv.includes('--before');
const origin = 'http://127.0.0.1:3041';
const profile = { id: 'ui-admin', fullName: 'مدیر فروشگاه وندورا با نام خانوادگی طولانی', email: 'admin@example.invalid', role: 'Admin' };
const products = Array.from({ length: 13 }, (_, i) => ({ id: `product-${i}`, productCode: 100 + i,
  title: `کیف سفری و اداری با عنوان طولانی برای بررسی نمایش محصول ${i + 1}`, slug: `bag-${i}`, description: '<p>توضیحات محصول برای بررسی خوانایی فرم.</p>',
  price: 12980000000, stockQuantity: 12, status: 'Active', inventoryStatus: 'InStock', categories: [], images: [], colors: [], attributes: [], primaryImageUrl: '/qa-bag.svg' }));
const orders = Array.from({ length: 13 }, (_, i) => ({ id: `order-${i}`, orderNumber: `VD-104${i}`, customerName: 'مشتری با نام طولانی برای بررسی چیدمان', createdAtUtc: '2026-10-25T12:00:00Z', totalAmount: 12980000000, status: ['Processing', 'Shipped', 'Delivered'][i % 3], paymentStatus: 'Verified', itemCount: 2, allowedNextStatuses: ['Packed', 'Cancelled'] }));
const overview = { activated: true, postedSales: 12, postedPurchases: 4, salesNetToman: 120000000, purchasesNetToman: 60000000, inventoryValueToman: 12980000000, grossProfitKnownToman: 60000000, unknownCostLines: 0, receivablesToman: 12980000000, payablesToman: 200000, purchaseReturnDifferenceToman: 0 };
const documents = { items: [{ id: 'invoice-1', number: 'INV-100', kind: 1, status: 1, issuedAtUtc: '2026-10-25T12:00:00Z', totalToman: 12980000000, buyerSnapshotJson: '{"Name":"مشتری آزمایشی"}' }], total: 1, page: 1, pageSize: 25 };

/** Supplies only synthetic response shapes used by the audited routes. */
function fixture(path) {
  const messaging=messagingFixture(path); if(messaging!==undefined)return messaging;
  if (path === '/api/account/me') return profile;
  if (path.endsWith('/store-settings/shipping')) return { policy: { id: 1, version: 1, includedInPrice: false, unitAmount: 250000, originCityCode: '', originLatitude: null, originLongitude: null, courierCode: 'IR_POST', serviceType: '', paymentType: 'SENDER', collectionType: 'courier_drop_off' }, packages: [], postexConfigured: false };
  if (path.includes('store-settings')) return { showSeedData: false, profile: {} };
  if (path.endsWith('/dashboard')) return { totalSales: 12980000000, totalOrders: 120, totalProducts: 13, totalCustomers: 80, monthlySales: [5, 6, 7, 8, 9, 10].map(month => ({ year: 2026, month, amount: month * 1000000 })), recentOrders: orders.slice(0, 5) };
  if (path === '/api/admin/products') return products;
  if (path === '/api/admin/products/product-0') return products[0];
  if (path === '/api/admin/orders') return orders;
  if (path === '/api/admin/orders/order-0') return { ...orders[0], currencyCode: 'TOMAN', subtotal: 12980000000, shippingCost: 60000, discountAmount: 0, customer: { ...profile, phoneNumber: '09120000000' }, shipping: { recipientName: profile.fullName, phoneNumber: '09120000000', province: 'تهران', city: 'تهران', streetAddress: 'نشانی طولانی برای آزمون چیدمان و خوانایی اطلاعات ارسال', postalCode: '1234567890' }, items: [{ productId: 'product-0', productTitle: products[0].title, quantity: 1, unitPrice: 12980000000, lineTotal: 12980000000 }], payments: [] };
  if (path.endsWith('/context')) return { activated: true, hasServerVerification: true, paymentStatus: 'Verified', reservations: [], paymentRequiresReview: false };
  if (path.endsWith('/overview')) return overview;
  if (path.endsWith('/documents')) return documents;
  if (path.endsWith('/exchange-rate')) return { rateToman: 100000, isFresh: true };
  if (path.endsWith('/users')) return [{ ...profile, isActive: false, createdAtUtc: '2026-10-25T12:00:00Z' }];
  if (path.endsWith('/seo/settings')) return { siteName: 'وندورا', siteUrl: 'https://example.invalid', titleTemplate: '{title} | {siteName}', isIndexingEnabled: false };
  if (path.endsWith('/discussions')) return { items: [], total: 0, pageNumber: 1, pageSize: 20 };
  return [];
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    // Mirror the production gateway's /admin/ asset prefix as well as root-based dev builds.
    let file = resolve(root, `.${pathname.replace(/^\/admin\//, '/')}`);
    if (!file.startsWith(root + sep)) throw new Error('Outside dist');
    if (!extname(file)) file = resolve(root, 'index.html');
    const body = await readFile(file);
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});

/** Checks page bounds and the actual loaded font, rather than accepting CSS declarations alone. */
async function geometry(page, name, width) {
  await page.evaluate(() => document.fonts.ready);
  if (!await page.locator('.admin-shell, .admin-auth-page').count()) throw new Error(`${name}/${width}: UI root missing: ${(await page.locator('body').innerText()).slice(0, 600)}`);
  const result = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, font: getComputedStyle(document.querySelector('.admin-shell') ?? document.querySelector('.admin-auth-page')).fontFamily }));
  if(result.scroll>result.width+1){console.log('OVERFLOW',await page.locator('.admin-content *').evaluateAll(nodes=>nodes.map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,90),x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth})).filter(el=>el.x<0||el.x+el.width>innerWidth+1).slice(0,25)));await page.screenshot({path:resolve(output,'overflow-'+name+'-'+width+'.png'),fullPage:true});}
  assert.ok(result.scroll <= result.width + 1, `${name}/${width} horizontal overflow: ${JSON.stringify(result)}`);
  if (!before) assert.match(result.font, /Vazirmatn/);
  const loadedWeights = await page.evaluate(() => [...document.fonts].filter(face => face.family.includes('Vazirmatn') && face.status === 'loaded').map(face => face.weight));
  assert.ok(loadedWeights.includes('400') && loadedWeights.includes('700'), `${name}/${width}: actual regular and bold Vazirmatn assets loaded`);
  const escapedControls=await page.locator('.admin-order-status-control select').evaluateAll(nodes=>nodes.filter(el=>{const box=el.getBoundingClientRect(),cell=el.closest('td').getBoundingClientRect();return box.x<cell.x-1||box.right>cell.right+1;}).map(el=>el.getAttribute('aria-label')));
  assert.deepEqual(escapedControls,[],`${name}/${width}: order controls escape their cells`);
  const clipped = await page.locator('.admin-stat-value').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
  assert.deepEqual(clipped, [], `${name}/${width} clipped metric values`);
}

/** Captures baseline or verifies the final UI at all required breakpoints with unchanged real routing. */
async function main() {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(3041, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    for (const width of (process.env.ADMIN_QA_WIDTH ? [Number(process.env.ADMIN_QA_WIDTH)] : [390, 768, 1024, 1440])) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      let shippingState = fixture('/api/admin/store-settings/shipping');
      const messaging=messagingRoutes();
      const management=storeManagementRoutes();
      const labels=await shippingLabelRoutes();
      await context.addInitScript(() => localStorage.setItem('vendora_admin_token', 'local-ui-fixture-only'));
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if(await management.handle(route))return;
        if(await messaging.handle(route))return;
        if(await labels.handle(route))return;
        if (url.pathname === '/api/admin/store-settings/shipping') {
          if (route.request().method() === 'PUT') {
            const input = route.request().postDataJSON();
            if (input.policy.version !== shippingState.policy.version) return route.fulfill({ status: 409, json: { code: 'SHIPPING_POLICY_CHANGED' } });
            shippingState = { ...input, policy: { ...input.policy, version: input.policy.version + 1 }, postexConfigured: false };
          }
          return route.fulfill({ json: shippingState });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: fixture(url.pathname) });
        if (url.pathname === '/qa-bag.svg' || url.hostname === 'images.unsplash.com') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect x="40" y="40" width="120" height="90" rx="18" fill="#006b4f"/><path d="M75 40V25a25 25 0 0 1 50 0v15" fill="none" stroke="#004d3a" stroke-width="8"/></svg>' });
        if (url.origin !== origin) return route.abort();
        return route.continue();
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const routes = ['dashboard', 'product-list', 'orders', 'orders/order-0', 'products/product-0/edit', 'profile', 'accounting', 'accounting/sales', 'login'];
      if (!before) routes.push('product-grid', 'category', 'brands', 'colors', 'attributes', 'seo', 'discussions', 'coupon', 'newsletter-subscriptions', 'online-store', 'tickets', 'tickets/ticket-0', 'our-staff', 'register', 'forgot-password', 'reset-password');
      if(process.env.ADMIN_QA_ROUTE)routes.splice(0,routes.length,process.env.ADMIN_QA_ROUTE);
      for (const route of routes) {
        if(route==='online-store')management.requests.length=0;
        await page.goto(`${origin}/fa/admin/${route}`);
        await page.locator('.admin-page-heading h1, .admin-auth-card, .admin-auth-form').first().waitFor();
        await page.waitForTimeout(220);
        if (before) {
          // Baselines record existing overflows; only the corrected build must satisfy geometry.
        } else await geometry(page, route, width);
        if (['dashboard', 'product-list', 'accounting', 'login', 'online-store'].includes(route)) await page.screenshot({ path: resolve(output, `${route}-${width}.png`), fullPage: true });
        if (!before && route === 'online-store') {
          await checkStoreManagement(page,management,async name=>{await geometry(page,name,width);await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});});
          await page.getByRole('tablist',{name:'بخش‌های مدیریت فروشگاه',exact:true}).getByRole('tab',{name:'ارسال و قیمت‌گذاری',exact:true}).click();
          const section = page.locator('section.admin-surface').filter({ has: page.getByRole('heading', { name: 'ارسال و قیمت‌گذاری', exact: true }) });
          await section.getByLabel('ارسال رایگان با احتساب هزینه در قیمت هر واحد کالا', { exact: true }).check();
          await section.getByLabel('سهم ثابت هر واحد (تومان)', { exact: true }).fill('300000');
          await section.getByRole('button', { name: 'افزودن الگوی بسته', exact: true }).click();
          for (const [label, value] of [['از تعداد', '1'], ['تا تعداد', '10'], ['وزن بسته خالی (گرم)', '200'], ['طول (سانتی‌متر)', '40'], ['عرض (سانتی‌متر)', '30'], ['ارتفاع (سانتی‌متر)', '20']]) await section.getByLabel(label, { exact: true }).fill(value);
          const sent = page.waitForRequest(request => request.url().endsWith('/api/admin/store-settings/shipping') && request.method() === 'PUT');
          await section.getByRole('button', { name: 'ذخیره سیاست ارسال', exact: true }).click();
          const input = (await sent).postDataJSON();
          assert.equal(input.policy.includedInPrice, true); assert.equal(input.policy.unitAmount, 300000); assert.equal(input.policy.version, 1);
          assert.deepEqual(input.packages[0], { minQuantity: 1, maxQuantity: 10, emptyWeightGrams: 200, lengthCm: 40, widthCm: 30, heightCm: 20, boxTypeId: 0 });
          await section.getByText('سیاست ارسال ذخیره شد؛ قیمت پایهٔ محصولات تغییر نکرد.', { exact: true }).waitFor();
          await geometry(page, 'shipping-settings', width);
          await section.screenshot({ path: resolve(output, `shipping-settings-${width}.png`) });
        }
        if(!before&&route==='online-store') { await page.getByRole('tablist',{name:'بخش‌های مدیریت فروشگاه',exact:true}).getByRole('tab',{name:'پیامک و اعلان‌ها',exact:true}).click(); await checkMessaging(page,async name=>{await geometry(page,name,width);const target=name.startsWith('sms-admin-phone')?page.getByRole('region',{name:'تأیید شمارهٔ حساب مدیر',exact:true}):page.locator("section.admin-surface").filter({has:page.getByRole("heading",{name:"پیامک و اعلان‌ها",exact:true})});await target.screenshot({path:resolve(output,`${name}-${width}.png`)});}); }
        if(!before&&route==='tickets/ticket-0') await checkSupport(page,messaging.replyKeys,async name=>{await geometry(page,name,width);await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});});
        if(!before&&route==='orders') await checkOrderLabels(page,labels.calls,async name=>{await geometry(page,name,width);await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});});
        if(!before&&route==='orders/order-0') await checkOrderLabelDetail(page,async name=>{await geometry(page,name,width);await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});});
        if (!before && route === 'product-list') {
          assert.equal(await page.locator('.admin-filter-search input').evaluate(el => getComputedStyle(el).fontSize), '15px');
          await page.locator('.admin-filter-search input').fill('عنوان');
          await page.waitForTimeout(350);
          assert.ok(new URL(page.url()).searchParams.get('q'));
          const prev = page.getByRole('button', { name: 'صفحهٔ قبلی', exact: true });
          await prev.waitFor();
          assert.equal(await prev.locator('svg').getAttribute('data-icon-direction'), 'right');
          assert.equal(await page.getByRole('button', { name: 'صفحهٔ بعدی', exact: true }).locator('svg').getAttribute('data-icon-direction'), 'left');
        }
        if (!before && route === 'dashboard' && width < 1024) {
          const menu = page.getByRole('button', { name: 'منو', exact: true });
          await menu.click();
          await page.locator('.admin-sidebar-open').waitFor();
          const parent = page.locator('.admin-menu-parent');
          assert.equal(await parent.locator('svg').last().getAttribute('data-icon-direction'), 'down');
          await parent.click();
          assert.equal(await parent.locator('svg').last().getAttribute('data-icon-direction'), 'left');
          assert.equal(await page.locator('#admin-submenu-products').getAttribute('inert'), '');
          await parent.click();
          const close = page.locator('#admin-navigation').getByRole('button', { name: 'بستن منو', exact: true });
          await close.focus(); await page.keyboard.press('Shift+Tab');
          assert.equal(await page.locator('.admin-logout-btn').evaluate(el => el === document.activeElement), true);
          await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          assert.equal(await menu.evaluate(el => el === document.activeElement), true);
        }
      }
      if (!before) {
        await page.route('**/api/admin/products', route => route.fulfill({ status: 503, json: { message: 'Local UI fixture unavailable' } }));
        await page.goto(origin + '/fa/admin/product-list'); await page.locator('[role="alert"]').first().waitFor();
        await geometry(page, 'product-error', width);
        await page.route('**/api/admin/products', route => route.fulfill({ json: [] }));
        await page.goto(origin + '/fa/admin/product-list'); await page.getByText('محصولی پیدا نشد', { exact: true }).waitFor();
        await geometry(page, 'product-empty', width);
        let resume;
        const responseReady = new Promise(resolve => { resume = resolve; });
        await page.route('**/api/admin/products', async route => { await responseReady; await route.fulfill({ json: products }); });
        await page.goto(origin + '/fa/admin/product-list');
        await page.getByText('در حال بارگذاری محصولات…', { exact: true }).waitFor();
        await geometry(page, 'product-loading', width);
        resume(); await page.locator('.admin-filter-search input').waitFor();
        await page.locator('.admin-menu-parent').evaluate(el => el.focus());
        if (width >= 1024) {
          const outline = await page.locator('.admin-menu-parent').evaluate(el => getComputedStyle(el).outlineWidth);
          assert.ok(parseInt(outline) >= 2, 'Visible focus indicator');
        }
      }
      assert.deepEqual(errors, [], `${width}: browser exceptions`);
      await context.close(); console.log(`PASS Persian routes and responsive layout ${width}px (${before ? 'baseline' : 'corrected'})`);
    }
    if (!before) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(() => localStorage.setItem('vendora_admin_token', 'local-ui-fixture-only'));
      await context.route('**/api/**', route => route.fulfill({ json: fixture(new URL(route.request().url()).pathname) }));
      const page = await context.newPage(); await page.goto(origin + '/en/admin/orders');
      await page.locator('.admin-table').waitFor();
      assert.equal(await page.locator('.admin-shell').getAttribute('dir'), 'ltr');
      assert.equal(await page.getByRole('button', { name: 'Previous page', exact: true }).locator('svg').getAttribute('data-icon-direction'), 'left');
      assert.equal(await page.getByRole('button', { name: 'Next page', exact: true }).locator('svg').getAttribute('data-icon-direction'), 'right');
      await page.goto(origin + '/en/admin/online-store');
      const storeTabs = page.getByRole('tablist', { name: 'Store management sections' });
      await storeTabs.getByRole('tab', { name: 'Identity & branding', exact: true, selected: true }).waitFor();
      await storeTabs.getByRole('tab', { name: 'Identity & branding', exact: true }).focus(); await page.keyboard.press('ArrowRight');
      await storeTabs.getByRole('tab', { name: 'Contact & support', exact: true, selected: true }).waitFor();
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
      await storeTabs.getByRole('tab', { name: 'SMS & notifications', exact: true }).click();
      const phone = page.getByRole('region', { name: 'Verify administrator phone', exact: true });
      await phone.getByRole('button', { name: 'Send my phone verification code', exact: true }).waitFor();
      assert.equal(await phone.getByRole('button', { name: 'Send my phone verification code', exact: true }).isEnabled(), false, 'Missing phone cannot trigger SMS');
      assert.equal(await phone.getByRole('link', { name: 'Edit number in Users', exact: true }).getAttribute('href'), '/en/admin/profile');
      await context.close(); console.log('PASS English routing, semantic pagination directions and LTR store tabs');
    }
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
