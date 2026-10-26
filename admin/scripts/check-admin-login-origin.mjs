/** Runs the actual production bundle on isolated copies of both hostnames; never contacts live APIs or uses real credentials. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../site/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = resolve('dist'), output = resolve('../artifacts/admin-login-origin');
const mime = { '.js':'application/javascript', '.css':'text/css', '.html':'text/html', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

/** Verifies requests, bearer auth and upload URLs against the current origin in Persian and English. */
async function main() {
  await mkdir(output, { recursive:true });
  const browser = await chromium.launch({ headless:true });
  try {
    for (const origin of ['https://vendorashop.ir','https://vendora.tofanservice.ir']) for (const locale of ['fa','en']) {
      const context = await browser.newContext({ viewport:{width:1440,height:950} });
      const requests = [], errors = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/')) {
          requests.push({url:url.href,method:route.request().method(),authorization:route.request().headers().authorization});
          assert.equal(url.origin, origin, 'API calls must stay on the displayed domain');
          if (url.pathname === '/api/account/login') return route.fulfill({status:401,json:{message:'QA_INVALID_CREDENTIALS'}});
          if (url.pathname === '/api/account/me') return route.fulfill({status:401,json:{message:'QA_EXPIRED_SESSION'}});
          return route.fulfill({json:{nameFa:'وندورا',logoUrl:'/uploads/qa-logo.svg'}});
        }
        assert.equal(url.origin, origin, 'No legacy-domain image or static requests');
        if (url.pathname === '/uploads/qa-logo.svg') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="44" height="36"><rect width="44" height="36" fill="#006b4f"/></svg>'});
        const path = url.pathname.startsWith('/admin/') ? url.pathname.slice('/admin'.length) : '/index.html';
        const file = resolve(root, '.' + path);
        assert.ok(file.startsWith(root + sep));
        try { await route.fulfill({body:await readFile(file),contentType:mime[extname(file)] || 'application/octet-stream'}); }
        catch { await route.fulfill({status:404,body:'Missing isolated asset'}); }
      });
      const page = await context.newPage(); page.on('pageerror', error=>errors.push(error.message));
      await page.goto(`${origin}/${locale}/admin/login?returnTo=%2F${locale}%2Fadmin`);
      await page.locator('.admin-auth-form input[type="email"]').fill('qa-login@example.invalid');
      await page.locator('.admin-auth-form input[type="password"]').fill('QA-only-invalid-password');
      await page.locator('.admin-auth-form button[type="submit"]').click();
      await page.getByText('QA_INVALID_CREDENTIALS',{exact:true}).waitFor();
      assert.equal(requests.filter(item=>item.url===`${origin}/api/account/login`&&item.method==='POST').length,1);
      assert.equal(await page.getByText('Network Error',{exact:true}).count(),0);
      await page.locator('.admin-store-brand-image').first().waitFor();
      assert.equal(new URL(await page.locator('.admin-store-brand-image').first().getAttribute('src'),origin).origin,origin);
      await page.screenshot({path:resolve(output,`${new URL(origin).hostname}-${locale}.png`),fullPage:true});
      await page.evaluate(()=>localStorage.setItem('vendora_admin_token','isolated-qa-expired-token'));
      const meRequest = page.waitForRequest(request=>request.url()===`${origin}/api/account/me`);
      await page.goto(`${origin}/${locale}/admin/dashboard`); await meRequest; await page.getByRole('button',{name:locale==='fa'?'ادامه':'Continue',exact:true}).waitFor();
      assert.ok(requests.some(item=>item.url===`${origin}/api/account/me`&&item.authorization==='Bearer isolated-qa-expired-token'),'Existing bearer authentication retained');
      assert.deepEqual(errors,[]); await context.close(); console.log(`PASS ${origin}/${locale}: same-origin login, readable API errors, branding and bearer headers`);
    }
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
