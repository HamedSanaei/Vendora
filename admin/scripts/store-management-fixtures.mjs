import assert from 'node:assert/strict';

/** Supplies mutable local-only profile responses and records requests to prove lazy loading and explicit saves. */
export function storeManagementRoutes() {
  let profile={showSeedData:false,nameFa:'وندورا',phone:'02112345678',email:'store@example.invalid',addressFa:'نشانی آزمایشی فروشگاه',enamadEnabled:false};
  const requests=[],saves=[];
  return {requests,saves,async handle(route){
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path.startsWith('/api/'))requests.push(path);
    if(path!=='/api/admin/store-settings'&&path!=='/api/store-settings')return false;
    if(req.method()==='PUT'){
      const raw=req.postData(),json=raw.match(/name="settings"\r\n\r\n([^\r\n]+)/)?.[1];assert.ok(json,'Shared multipart contract retained');
      const input=JSON.parse(json);saves.push({input,hasLogo:raw.includes('filename="logo.png"')});
      if(input.profile.email&&!input.profile.email.includes('@')){await route.fulfill({status:400,json:{errors:{email:'invalidEmail'}}});return true;}
      profile={...profile,...input.profile};
    }
    await route.fulfill({json:profile});return true;
  }};
}

/** Tests scoped visibility, retained text/file drafts, isolated defaults, cross-scope validation, URL/history and keyboard operation. */
export async function checkStoreManagement(page,state,capture) {
  const tabs=page.getByRole('tablist',{name:'بخش‌های مدیریت فروشگاه',exact:true});
  const choose=async name=>{await tabs.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(80);assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);};
  await page.getByRole('heading',{name:'مدیریت فروشگاه',exact:true,level:1}).waitFor();await page.locator('#settings-nameFa').waitFor();
  assert.equal(await tabs.getByRole('tab').count(),8);
  assert.equal(state.requests.some(path=>/\/admin\/(sms|slideshow)|\/store-settings\/shipping/.test(path)),false,'Unopened scopes do not eagerly load their APIs');
  await page.locator('#settings-nameFa').fill('برند پیش‌نویس');
  await page.locator('#settings-homeTitleFa').fill('خرید کیف از وندورا | تولید مستقیم');
  assert.equal(await page.locator('#settings-homeTitleFa').getAttribute('maxlength'),'150');
  await page.locator('.admin-store-settings input[type="file"]').first().setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6N2QAAAAASUVORK5CYII=','base64')});
  await choose('تماس و پشتیبانی');await page.locator('#settings-phone').fill('02187654321');
  await page.getByRole('button',{name:'تنظیمات پیش‌فرض',exact:true}).click();assert.equal(await page.locator('#settings-phone').inputValue(),'');
  await choose('هویت و ظاهر');assert.equal(await page.locator('#settings-nameFa').inputValue(),'برند پیش‌نویس');assert.equal(await page.locator('.admin-store-settings input[type="file"]').first().evaluate(el=>el.files[0]?.name),'logo.png');
  await choose('تماس و پشتیبانی');await page.locator('#settings-phone').fill('02187654321');await page.locator('#settings-email').fill('invalid-email');
  await choose('هویت و ظاهر');await page.getByRole('button',{name:'ذخیره تنظیمات',exact:true}).click();
  await page.getByRole('button',{name:/بررسی خطاهای بخش اطلاعات تماس/}).click();await tabs.getByRole('tab',{name:'تماس و پشتیبانی',exact:true,selected:true}).waitFor();
  await page.locator('#settings-email').fill('updated@example.invalid');await page.getByRole('button',{name:'ذخیره تنظیمات',exact:true}).click();await page.getByText('تنظیمات فروشگاه ذخیره شد.',{exact:true}).waitFor();
  assert.equal(state.saves.at(-1).input.profile.nameFa,'برند پیش‌نویس');assert.equal(state.saves.at(-1).input.profile.phone,'02187654321');assert.equal(state.saves.at(-1).hasLogo,true);
  assert.equal(state.saves.at(-1).input.profile.homeTitleFa,'خرید کیف از وندورا | تولید مستقیم');
  await choose('نماد اعتماد');await page.getByRole('checkbox',{name:'نمایش اینماد در فوتر',exact:true}).waitFor();
  await choose('ارسال و قیمت‌گذاری');await page.getByLabel('سهم ثابت هر واحد (تومان)',{exact:true}).fill('333333');
  await choose('پیامک و اعلان‌ها');await page.getByLabel('آستانه موجودی قابل‌فروش کم',{exact:true}).fill('6');
  await choose('اسلایدر صفحه اصلی');await page.locator('#slideshow-order').fill('7');
  await choose('داده‌های نمونه');await page.getByRole('switch',{name:'نمایش داده‌های نمونه',exact:true}).waitFor();
  await choose('مشاهده فروشگاه');assert.equal(await page.locator('[role="tabpanel"]:visible a[href$="/fa/shop"]').count(),1);
  await choose('ارسال و قیمت‌گذاری');assert.equal(await page.getByLabel('سهم ثابت هر واحد (تومان)',{exact:true}).inputValue(),'333333');
  await choose('اسلایدر صفحه اصلی');assert.equal(await page.locator('#slideshow-order').inputValue(),'7');
  await choose('پیامک و اعلان‌ها');assert.equal(await page.getByLabel('آستانه موجودی قابل‌فروش کم',{exact:true}).inputValue(),'6');
  await tabs.getByRole('tab',{name:'هویت و ظاهر',exact:true}).focus();await page.keyboard.press('ArrowLeft');await tabs.getByRole('tab',{name:'تماس و پشتیبانی',exact:true,selected:true}).waitFor();
  await page.keyboard.press('End');await tabs.getByRole('tab',{name:'مشاهده فروشگاه',exact:true,selected:true}).waitFor();await page.keyboard.press('Home');
  await tabs.getByRole('tab',{name:'هویت و ظاهر',exact:true,selected:true}).waitFor();await page.waitForTimeout(220);assert.equal(await tabs.getByRole('tab',{selected:true}).evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');await capture('store-management-identity');
  await choose('تماس و پشتیبانی');await page.reload();await page.locator('#settings-phone').waitFor();assert.equal(await page.locator('#settings-phone').inputValue(),'02187654321');assert.equal(new URL(page.url()).searchParams.get('section'),'contact');
  await choose('نماد اعتماد');await page.goBack();await page.locator('#settings-phone').waitFor();await tabs.getByRole('tab',{name:'تماس و پشتیبانی',exact:true,selected:true}).waitFor();
  await page.goto(new URL('/fa/admin/online-store?smsTab=history',page.url()).href);await page.getByText('0912***129',{exact:true}).waitFor();assert.equal(await tabs.getByRole('tab',{name:'پیامک و اعلان‌ها',exact:true}).getAttribute('aria-selected'),'true');
  await page.clock.install();await choose('مشاهده فروشگاه');const histories=state.requests.filter(path=>path==='/api/admin/sms/messages').length;await page.clock.fastForward(11000);assert.equal(state.requests.filter(path=>path==='/api/admin/sms/messages').length,histories,'Hidden SMS history stops polling');await page.clock.resume();
}
