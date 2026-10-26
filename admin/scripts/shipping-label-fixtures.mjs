/** Tests existing order pages with the real synthetic QuestPDF output and isolated API fixtures. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Supplies label PDFs or safe field errors, recording the exact selected IDs sent by the real UI. */
export async function shippingLabelRoutes() {
  const pdf=await readFile(new URL('../../artifacts/shipping-labels/windows/shipping-label-single-A5.pdf',import.meta.url));
  const calls=[];let failSingle=true;
  return {calls,async handle(route){
    const request=route.request(),path=new URL(request.url()).pathname;
    if(!/\/api\/admin\/orders\/(shipping-labels\/pdf|[^/]+\/shipping-label\/pdf)$/.test(path))return false;
    calls.push({path,method:request.method(),data:request.postDataJSON()});
    if(path.includes('/shipping-label/')&&failSingle){failSingle=false;await route.fulfill({status:422,json:{code:'LABEL_RECIPIENT_INCOMPLETE',orderNumber:'VD-1040',fields:['postalCode']}});}
    else await route.fulfill({contentType:'application/pdf',headers:{'Cache-Control':'no-store'},body:pdf});
    return true;
  }};
}

/** Exercises cross-page selection, filter reset, download/error retry and both blocked/working print viewers. */
export async function checkOrderLabels(page,calls,capture) {
  const target=await page.locator('.admin-order-label-selection label').first().boundingBox();assert.ok(target.width>=44&&target.height>=44,'Accessible checkbox target');
  const all=page.getByLabel('انتخاب همه سفارش‌های این صفحه',{exact:true});await all.check();
  await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();await page.getByLabel('انتخاب سفارش VD-10410',{exact:true}).waitFor();assert.equal(await all.isChecked(),false);await all.check();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'دانلود گروهی برچسب A5',exact:true}).click();assert.equal((await download).suggestedFilename(),'shipping-labels-A5.pdf');
  assert.equal(calls.at(-1).method,'POST');assert.deepEqual(calls.at(-1).data.orderIds,Array.from({length:13},(_,i)=>`order-${i}`));
  await page.getByRole('button',{name:'صفحهٔ قبلی',exact:true}).click();await page.getByLabel('انتخاب سفارش VD-1040',{exact:true}).waitFor();assert.equal(await all.isChecked(),true);
  await page.locator('.admin-filter-search input').fill('VD-1040');await page.waitForTimeout(250);assert.equal(await page.getByRole('button',{name:'دانلود گروهی برچسب A5',exact:true}).isDisabled(),true);
  await page.locator('.admin-filter-search input').fill('');await page.waitForTimeout(250);await page.getByLabel('انتخاب سفارش VD-1040',{exact:true}).check();
  await page.getByRole('button',{name:'دانلود گروهی برچسب A5',exact:true}).click();await page.getByRole('alert').filter({hasText:'کد پستی'}).waitFor();
  const retried=page.waitForEvent('download');await page.getByRole('button',{name:'دانلود گروهی برچسب A5',exact:true}).click();assert.match((await retried).suggestedFilename(),/shipping-label-order-0-A5/);
  const before=calls.length;await page.evaluate(()=>{window.qaSavedOpen=window.open;window.open=()=>null;});
  await page.getByRole('button',{name:'چاپ گروهی برچسب‌ها',exact:true}).click();await page.getByRole('alert').filter({hasText:'مسدود'}).waitFor();assert.equal(calls.length,before);
  await page.evaluate(()=>{window.open=window.qaSavedOpen;delete window.qaSavedOpen;});
  // Chromium headless can download PDFs instead of rendering its native viewer. Capture the same viewer handoff deterministically.
  await page.evaluate(()=>{window.qaSavedOpen=window.open;window.open=()=>({opener:null,location:{replace(url){window.qaPrintUrl=url;}},close(){}});});
  await page.getByRole('button',{name:'چاپ گروهی برچسب‌ها',exact:true}).click();await page.waitForFunction(()=>window.qaPrintUrl?.startsWith('blob:'));
  assert.equal(await page.evaluate(async()=>new TextDecoder().decode((await (await fetch(window.qaPrintUrl)).arrayBuffer()).slice(0,4))),'%PDF');
  await page.evaluate(()=>{window.open=window.qaSavedOpen;delete window.qaSavedOpen;delete window.qaPrintUrl;});
  const bounds=await page.getByRole('button',{name:'دانلود گروهی برچسب A5',exact:true}).boundingBox();assert.ok(bounds.height>=44);
  await capture('shipping-label-orders');
}

/** Checks the detail page uses the single-order route and reuses the same download action. */
export async function checkOrderLabelDetail(page,capture) {
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'دانلود برچسب A5',exact:true}).click();assert.match((await downloaded).suggestedFilename(),/shipping-label-order-0-A5/);await capture('shipping-label-detail');
}
