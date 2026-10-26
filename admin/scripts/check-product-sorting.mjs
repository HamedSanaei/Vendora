/** Real compiled admin UI with synthetic catalog data and no production API access. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(new URL('../../site/package.json',import.meta.url)),{chromium}=require('playwright');
const root=resolve('dist'),output=resolve('../artifacts/product-sorting-ui'),origin='http://127.0.0.1:3042';
const products=Array.from({length:13},(_,i)=>({id:`sort-${i}`,productCode:100+i,title:`کیف آزمایشی ${i}`,slug:`bag-${i}`,price:1000+i*100,stockQuantity:i,status:'Active',inventoryStatus:i?'InStock':'OutOfStock',categories:[{id:'category-1',name:'کیف',slug:'bags'}],images:[],colors:[],attributes:[],primaryImageUrl:'/sort-bag.svg',createdAtUtc:`2026-01-${String(i+1).padStart(2,'0')}T12:00:00Z`,updatedAtUtc:i===0?'2026-04-01T00:00:00Z':null}));
const server=createServer(async(req,res)=>{
  try{const path=decodeURIComponent(new URL(req.url,origin).pathname);let file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw new Error('Outside dist');if(!extname(file))file=resolve(root,'index.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.svg':'image/svg+xml'}[extname(file)]??'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
});

/** Checks actual rendered product ordering, not just a selected option's label. */
async function codes(page,grid=false){
  return page.locator(grid?'.admin-product-card-body small':'.admin-product-cell small').allTextContents().then(texts=>texts.filter(text=>text.includes('کد محصول')||text.includes('Product code')).map(text=>Number(text.match(/\d+/)?.[0])));
}
/** Measures the same responsive bounds and captures screenshots of the new control in both existing views. */
async function capture(page,name){await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});}

/** Exercises sort persistence, page reset, cross-view/Back behavior and category/search preservation at every breakpoint. */
async function main(){
  await mkdir(output,{recursive:true});await new Promise(r=>server.listen(3042,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    for(const width of [390,768,1024,1440]){
      const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(()=>localStorage.setItem('vendora_admin_token','sort-fixture-only'));
      await context.route('**/*',route=>{
        const url=new URL(route.request().url()),p=url.pathname;
        if(p.startsWith('/api/')){let data=[];if(p==='/api/account/me')data={id:'sort-admin',fullName:'مدیر آزمایشی',email:'sort@example.invalid',role:'Admin'};if(p==='/api/admin/products')data=products;if(p==='/api/admin/categories')data=[{id:'category-1',name:'کیف',slug:'bags',isActive:true}];if(p.includes('store-settings'))data={showSeedData:false,profile:{}};return route.fulfill({json:data});}
        if(p==='/sort-bag.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="20" y="20" width="60" height="70" fill="#006b4f"/></svg>'});
        return url.origin===origin?route.continue():route.abort();
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/fa/admin/product-list');const sort=page.getByLabel('مرتب‌سازی محصولات',{exact:true});await sort.waitFor();assert.deepEqual(await codes(page),[112,111,110,109,108,107,106,105,104,103]);
      await page.getByRole('button',{name:'۲',exact:true}).click();await page.waitForTimeout(100);assert.deepEqual(await codes(page),[102,101,100]);
      await sort.selectOption('oldest');await page.waitForTimeout(100);assert.equal(new URL(page.url()).searchParams.get('page'),null);assert.deepEqual((await codes(page)).slice(0,3),[100,101,102]);await page.reload();await sort.waitFor();assert.equal(await sort.inputValue(),'oldest');assert.equal((await codes(page))[0],100);
      await page.getByRole('link',{name:'گرید',exact:true}).click();await page.locator('.admin-product-card').first().waitFor();assert.equal(await sort.inputValue(),'oldest');assert.equal((await codes(page,true))[0],100);
      await sort.selectOption('price-desc');await page.waitForTimeout(100);assert.equal((await codes(page,true))[0],112);await capture(page,`grid-${width}`);
      await page.goBack();await page.locator('.admin-product-cell').first().waitFor();assert.equal(await sort.inputValue(),'oldest');assert.equal((await codes(page))[0],100);
      await page.getByLabel('فیلتر دسته‌بندی',{exact:true}).selectOption('category-1');await sort.selectOption('stock-desc');await page.waitForTimeout(100);assert.equal(new URL(page.url()).searchParams.get('category'),'category-1');assert.equal((await codes(page))[0],112);
      await sort.selectOption('updated');await page.waitForTimeout(100);assert.equal((await codes(page))[0],100);await page.locator('.admin-filter-search input').fill('۱۰۱');await page.waitForTimeout(150);assert.deepEqual(await codes(page),[101]);assert.equal(await sort.inputValue(),'updated');
      await page.locator('.admin-filter-search input').fill('');await page.waitForURL(url=>!url.searchParams.has('q'));await page.waitForFunction(()=>document.querySelectorAll('.admin-product-cell').length===10);await sort.selectOption('name');await page.waitForTimeout(100);assert.equal((await codes(page))[0],100);await capture(page,`list-${width}`);
      if(width===768){await page.goto(origin+'/en/admin/product-grid?sort=price-asc');await page.getByLabel('Sort products',{exact:true}).waitFor();assert.equal((await codes(page,true))[0],100);assert.equal(await page.locator('.admin-shell').getAttribute('dir'),'ltr');}
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS product sorting, URL, refresh, pagination, list/grid and bounds ${width}px`);
    }
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});
