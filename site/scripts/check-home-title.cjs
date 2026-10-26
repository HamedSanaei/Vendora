/* Verifies saved admin settings in real server-rendered homepage titles; all data and servers are isolated. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'artifacts/home-title');
const apiOrigin = 'http://127.0.0.1:5066', siteOrigin = 'http://127.0.0.1:3038', adminOrigin = 'http://127.0.0.1:3046';
let profile = {}, saves = 0;
/** Supplies synthetic public settings, isolated authenticated admin identity, and an empty catalog. */
async function apiRequest(req, res) {
  const url = new URL(req.url, apiOrigin); let value = [];
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.endsWith('/store-settings')) {
    if (req.method === 'PUT') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      profile = JSON.parse(body.match(/name="settings"\r\n\r\n([^]*?)\r\n--/)[1]).profile; saves++;
    }
    value = profile;
  } else if (url.pathname === '/api/account/me') value = {id:'qa-admin',fullName:'مدیر آزمایشی',email:'admin@example.invalid',role:'Admin'};
  else if (url.pathname === '/api/catalog/seo') value = {siteName:'وندورا',siteUrl:'https://example.invalid',titleTemplate:'{title} | {siteName}',isIndexingEnabled:false};
  else if (url.pathname === '/api/catalog/seo/redirect') value = null;
  else if (url.pathname === '/api/catalog/products/search') value = {products:[],total:0,page:1,pageSize:24};
  res.end(JSON.stringify(value));
}
const api = http.createServer(apiRequest);
const admin = http.createServer(async (req,res) => {
  if (req.url.startsWith('/api/')) return apiRequest(req,res);
  const name = decodeURIComponent(new URL(req.url,adminOrigin).pathname).replace(/^\/admin\//,'/');
  const file = path.resolve(root,'admin/dist','.'+(path.extname(name) ? name : '/index.html'));
  if (!file.startsWith(path.join(root,'admin/dist') + path.sep)) return res.writeHead(404).end();
  try { res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');res.end(await fs.promises.readFile(file)); }
  catch {res.writeHead(404).end();}
});
/** Waits for the dedicated Next production server without contacting public hosts. */
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(siteOrigin+'/fa',{signal:AbortSignal.timeout(2000)})).status < 500) return; } catch { /* Starting. */ }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('Isolated homepage title server failed to start');
}
/** Exercises save/refresh/clear, responsive settings UI, initial HTML and unchanged English/shop titles. */
async function main() {
  fs.mkdirSync(output,{recursive:true});
  await Promise.all([new Promise(resolve=>api.listen(5066,'127.0.0.1',resolve)),new Promise(resolve=>admin.listen(3046,'127.0.0.1',resolve))]);
  const app = spawn(process.execPath,[path.join(root,'site/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3038'],{cwd:path.join(root,'site'),env:{...process.env,API_INTERNAL_BASE_URL:apiOrigin,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const logs=[];for(const stream of [app.stdout,app.stderr])stream.on('data',chunk=>logs.push(chunk.toString()));
  let browser;
  try {
    await ready();browser=await chromium.launch({headless:true});
    const context=await browser.newContext(),errors=[];
    await context.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('vendora_admin_token','isolated-title-qa');},adminOrigin);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===siteOrigin&&url.pathname.startsWith('/api/'))return route.fulfill({json: url.pathname.endsWith('/store-settings') ? profile : []});
      if(![siteOrigin,adminOrigin].includes(url.origin))return route.abort();
      return route.continue();
    });
    const storefront=await context.newPage(),settings=await context.newPage();
    for(const page of [storefront,settings])page.on('pageerror',error=>{if(!error.message.includes('Stripe'))errors.push(error.message);});
    await storefront.goto(siteOrigin+'/fa');assert.equal(await storefront.title(),'وندورا');
    let previous='وندورا';
    for(const width of [390,768,1024,1440]){
      await settings.setViewportSize({width,height:900});await settings.goto(adminOrigin+'/fa/admin/online-store?section=identity');
      const title=settings.locator('#settings-homeTitleFa');await title.waitFor();
      assert.equal(await title.getAttribute('maxlength'),'150');
      const value=`خرید کیف وندورا | تولید مستقیم ${width}`;await title.fill(value);
      await storefront.reload();assert.equal(await storefront.title(),previous,'Unsubmitted draft does not change public title');
      await settings.getByRole('button',{name:'ذخیره تنظیمات',exact:true}).click();await settings.getByText('تنظیمات فروشگاه ذخیره شد.',{exact:true}).waitFor();
      await storefront.reload();assert.equal(await storefront.title(),value);
      for(const selector of ['meta[property="og:title"]','meta[name="twitter:title"]'])assert.equal(await storefront.locator(selector).getAttribute('content'),value);
      await title.scrollIntoViewIfNeeded();assert.ok(await settings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await settings.screenshot({path:path.join(output,`admin-${width}.png`)});
      await settings.reload();assert.equal(await settings.locator('#settings-homeTitleFa').inputValue(),value);previous=value;
      console.log(`PASS ${width}: admin save and draft isolation, refreshed browser/social title, no horizontal overflow`);
    }
    // A real browser with JavaScript disabled verifies that the title comes from server metadata.
    const staticContext=await browser.newContext({javaScriptEnabled:false});const staticPage=await staticContext.newPage();
    await staticPage.goto(siteOrigin+'/fa');assert.equal(await staticPage.title(),previous);await staticContext.close();
    await storefront.goto(siteOrigin+'/fa/shop');assert.ok(!(await storefront.title()).includes(previous),'Homepage title does not override catalog SEO');
    await storefront.goto(siteOrigin+'/en');assert.equal(await storefront.title(),'Vendora');
    await settings.locator('#settings-homeTitleFa').fill('');await settings.getByRole('button',{name:'ذخیره تنظیمات',exact:true}).click();await settings.getByText('تنظیمات فروشگاه ذخیره شد.',{exact:true}).waitFor();
    await storefront.goto(siteOrigin+'/fa');assert.equal(await storefront.title(),'وندورا');assert.equal(saves,5);assert.deepEqual(errors,[]);
    console.log('PASS initial HTML without JavaScript, clear/default without duplicate name, English compatibility and catalog title isolation');await context.close();
  }catch(error){console.error(logs.slice(-3).join(''));throw error;}
  finally{await browser?.close();app.kill();for(const server of [api,admin]){server.closeAllConnections();server.close();}}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
