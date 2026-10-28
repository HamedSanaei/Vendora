/* Regression checks for remote eNamad failures, slow loads and manual retries. All carrier images/settings are isolated fixtures. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..'), output = path.resolve(root,'../artifacts/enamad-resilience');
const origin='http://127.0.0.1:3048', apiOrigin='http://127.0.0.1:5068';
const href='https://trustseal.enamad.ir/?id=8380573&Code=UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu';
const imageUrl=href.replace('/?','/logo.aspx?');
let enabled=true;
/** Supplies the same synthetic settings to the server and the browser without live API writes. */
function fixture(url) {
  if(url.pathname.startsWith('/api/store-settings'))return {showSeedData:false,enamadEnabled:enabled,enamad:{href,imageUrl}};
  if(url.pathname==='/api/catalog/seo')return {siteName:'وندورا',siteUrl:'',titleTemplate:'{title}',isIndexingEnabled:false};
  if(url.pathname==='/api/catalog/products/search')return {products:[],total:0,page:1,pageSize:24};
  return [];
}
const api=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixture(new URL(req.url,apiOrigin))));});
/** Waits for the isolated production server. */
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(origin+'/fa',{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{/* Starting. */}await new Promise(r=>setTimeout(r,500));}throw new Error('Isolated seal QA server did not start');}
/** Checks real footer markup and interactive recovery without requiring the issuer's network availability. */
async function main(){
  fs.mkdirSync(output,{recursive:true});await new Promise(r=>api.listen(5068,'127.0.0.1',r));
  const app=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3048'],{cwd:root,env:{...process.env,API_INTERNAL_BASE_URL:apiOrigin,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const logs=[];for(const stream of [app.stdout,app.stderr])stream.on('data',data=>logs.push(data.toString()));let browser;
  try{
    await ready();browser=await chromium.launch({headless:true});
    for(const [locale,width] of [...[390,768,1024,1440].map(w=>['fa',w]),['en',1440]]){
      let mode='error',requests=0;const pending=[];
      const context=await browser.newContext({viewport:{width,height:900}});
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.hostname==='trustseal.enamad.ir'){
          requests++;assert.equal(url.href,imageUrl,'Official source remains unchanged');
          if(mode==='error')return route.abort('connectionclosed');
          if(mode==='slow')return new Promise(resolve=>pending.push(async()=>{await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="125" height="136"><text x="10" y="60">TEST SEAL</text></svg>'});resolve();}));
          return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="125" height="136"><text x="10" y="60">TEST SEAL</text></svg>'});
        }
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:fixture(url)});
        if(url.origin!==origin)return route.abort();return route.continue();
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>{if(!e.message.includes('Stripe'))errors.push(e.message);});
      const seal=page.locator('footer [data-enamad-state]');
      await page.goto(origin+'/'+locale,{waitUntil:'domcontentloaded'});
      await page.locator('footer [data-enamad-state="error"]').waitFor();
      const verify=seal.getByRole('link',{name:locale==='fa'?'مشاهده اعتبار':'Verify with issuer',exact:true});
      await verify.waitFor();assert.equal(await verify.getAttribute('href'),href);assert.equal(await verify.getAttribute('referrerpolicy'),'origin');
      const box=await seal.boundingBox();assert.equal(Math.round(box.width),125);assert.ok(box.height>=136);
      assert.equal(await seal.locator('img').getAttribute('code'),'UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu');
      assert.ok(await seal.locator('span[inert]').count()>0,'Failed official anchor is excluded from keyboard navigation');
      await seal.scrollIntoViewIfNeeded();await page.locator('footer').screenshot({path:path.join(output,`${locale}-${width}-error.png`)});
      mode='ok';const before=requests;await seal.getByRole('button',{name:locale==='fa'?'دریافت دوباره تصویر':'Retry image'}).click();
      await page.locator('footer [data-enamad-state="ready"]').waitFor();assert.equal(requests,before+1,'Only explicit retry requests another image');
      assert.equal(await seal.getByRole('link',{name:locale==='fa'?'مشاهده اعتبار':'Verify with issuer',exact:true}).count(),0);
      assert.ok(await seal.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
      await page.locator('footer').screenshot({path:path.join(output,`${locale}-${width}-ready.png`)});
      if(width===768){
        mode='slow';await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('footer [data-enamad-state="slow"]').waitFor({timeout:12000});
        assert.ok(await seal.getByRole('link',{name:'مشاهده اعتبار',exact:true}).isVisible());
        await Promise.all(pending.splice(0).map(finish=>finish()));await page.locator('footer [data-enamad-state="ready"]').waitFor();
      }
      if(locale==='en'){
        enabled=false;const before=requests;await page.reload({waitUntil:'domcontentloaded'});await page.locator('footer').waitFor();
        assert.equal(await seal.count(),0);assert.equal(requests,before,'Explicitly disabled seals never fetch an image');enabled=true;
      }
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}/${width}: reserved layout, issuer link, unchanged official markup, explicit retry and recovery`);
    }
  }catch(error){console.error(logs.slice(-3).join(''));throw error;}
  finally{await browser?.close();app.kill();api.closeAllConnections();api.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
