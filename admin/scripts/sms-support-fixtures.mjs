/** Isolated browser fixtures and interactions. No carrier/API traffic or real account records. */
import assert from 'node:assert/strict';
const events = ['OrderPaid','OrderShipped','OrderDelivered','OrderCancelled','TicketReply','PasswordChanged','PhoneChanged','PaymentReview','AdminOrderPaid','AdminTicketNew','AdminTicketReply','AdminLowStock','AdminPaymentReview'];
const otpTemplates=[['Login','کد ورود شما به وندوراشاپ'],['Registration','کد ثبت‌نام شما در وندوراشاپ'],['PhoneVerification','کد تأیید شماره همراه شما در وندوراشاپ'],['Recovery','کد بازیابی رمز عبور شما در وندوراشاپ'],['Test','کد آزمایشی پیامک وندوراشاپ']].map(([purpose,text])=>({purpose,text:text+': {code}\n\n@vendorashop.ir #{code}'}));
/** Returns synthetic contract data for SMS and support requests, ahead of generic store-settings fixtures. */
export function messagingFixture(path) {
  if (path === '/api/admin/store-settings/sms') return { version:1,enabled:true,provider:'ParsGreen',parsGreenBrandedOtp:false,otpTemplates,phoneLogin:false,passwordRecovery:false,phoneVerification:true,otpType:1,patternId:3,lowStockThreshold:5,rules:events.map(event=>({event,enabled:false,template:'اعلان خدماتی {link}'})),recipients:[],providers:[{id:'ParsGreen',available:true,otpConfigured:true,textConfigured:true,deliveryConfigured:false,brandedOtpConfigured:true},{id:'Kavenegar',available:true,otpConfigured:true,textConfigured:true,deliveryConfigured:true}],duplicateVerifiedPhones:[] };
  if (path === '/api/admin/sms/recipients') return [{id:'ui-admin',name:'مدیر آزمایشی',phone:'0912***128',isAdmin:true},{id:'ui-customer',name:'خریدار آزمایشی',phone:'0912***129',isAdmin:false}];
  if (path === '/api/admin/sms/messages') return {page:1,total:2,items:[{id:'sms-1',event:'OrderPaid',phone:'0912***129',provider:'ParsGreen',status:'Accepted',createdAtUtc:'2026-10-26T08:00:00Z',attempts:1},{id:'sms-2',event:'Test',phone:'0912***128',provider:'ParsGreen',status:'Unknown',createdAtUtc:'2026-10-26T08:05:00Z',attempts:1}]};
  const ticket={id:'ticket-0',subject:'پرسش درباره زمان ارسال سفارش و پیگیری پاسخ پشتیبانی',customerName:'خریدار با نام بلند آزمایشی',userId:'ui-customer',status:'WaitingForSupport',version:1,updatedAtUtc:'2026-10-26T08:00:00Z'};
  if (path === '/api/admin/tickets') return {page:1,total:1,items:[ticket]};
  if (path === '/api/admin/tickets/ticket-0') return {ticket,messages:[{id:'message-0',author:'خریدار آزمایشی',isStaff:false,text:'متن خصوصی مشتری برای بررسی پاسخ پشتیبانی.',createdAtUtc:ticket.updatedAtUtc}]};
  return undefined;
}
/** Owns mutable fixture state per browser context, including one recoverable reply failure. */
export function messagingRoutes() {
  let settings=messagingFixture('/api/admin/store-settings/sms'),detail=messagingFixture('/api/admin/tickets/ticket-0'),failReply=true;
  const currentAdmin={id:'ui-admin',fullName:'مدیر آزمایشی',email:'admin@example.invalid',role:'Admin',phoneNumber:'09120000128',completion:{phoneNumberConfirmed:true}};
  const replyKeys=[];
  return {
    replyKeys,
    async handle(route) {
      const req=route.request(),path=new URL(req.url()).pathname,method=req.method(); let value=path==='/api/account/me'?currentAdmin:messagingFixture(path),status=200;
      if(path==='/api/admin/store-settings/sms'&&method==='PUT'){const body=req.postDataJSON();assert.equal(body.version,settings.version);settings={...body,version:body.version+1};}
      if(path==='/api/admin/store-settings/sms')value=settings;
      if(path==='/api/admin/tickets/ticket-0')value=detail;
      if(path==='/api/admin/sms/send'||path==='/api/admin/sms/test'){assert.ok(req.headers()['idempotency-key']);value={id:'queued-qa'};}
      if(path==='/api/admin/sms/test-code')value={challengeId:'test-qa',codeLength:6,retryAfter:120};
      if(path==='/api/admin/sms/test-code/verify'){assert.equal(req.postDataJSON().code,'123456');value={account:null};}
      if(path==='/api/admin/tickets/ticket-0/messages'){
        const body=req.postDataJSON();replyKeys.push(req.headers()['idempotency-key']);
        if(failReply){failReply=false;status=503;value={code:'UNAVAILABLE'};}
        else{detail={ticket:{...detail.ticket,version:detail.ticket.version+1,status:'WaitingForCustomer'},messages:[...detail.messages,{id:'staff-1',author:'مدیر آزمایشی',isStaff:true,text:body.text,createdAtUtc:detail.ticket.updatedAtUtc}]};value={id:'ticket-0'};}
      }
      if(path==='/api/admin/tickets/ticket-0/status'){detail={...detail,ticket:{...detail.ticket,version:detail.ticket.version+1,status:req.postDataJSON().close?'Closed':'WaitingForSupport'}};value={id:'ticket-0'};}
      if(value===undefined)return false;
      await route.fulfill({status,json:value});return true;
    },
  };
}
/** Tests provider selection, explicit activation, own-number OTP testing and masked audit states. */
export async function checkMessaging(page, capture) {
  const panel=page.locator('section.admin-surface').filter({has:page.getByRole('heading',{name:'پیامک و اعلان‌ها',exact:true})});
  await panel.getByRole('tab',{name:'تنظیمات',exact:true}).click();
  await panel.getByLabel('ورود و ثبت‌نام پیامکی مشتریان',{exact:true}).check();
  const provider=panel.getByLabel('پروایدر فعال',{exact:true});
  await panel.getByRole('checkbox',{name:'ارسال کد با متن اختصاصی وندوراشاپ',exact:true}).check();
  assert.equal(await panel.getByLabel('نوع کد پارس‌گرین',{exact:true}).count(),0);
  await panel.getByText('مشاهدهٔ پنج متن ثبت‌شدهٔ کدها',{exact:true}).click();
  assert.equal(await panel.getByLabel('کد ثبت‌نام با شماره',{exact:true}).inputValue(),'کد ثبت‌نام شما در وندوراشاپ: {code}\n\n@vendorashop.ir #{code}');
  await capture('sms-branded-otp');
  await panel.getByRole('button',{name:'ذخیره تنظیمات پیامک',exact:true}).click();await panel.getByText('تنظیمات پیامک ذخیره شد.',{exact:true}).waitFor();
  assert.equal(await provider.locator('option[value="Kavenegar"]').evaluate(el=>el.disabled),false);
  await provider.selectOption('Kavenegar');
  await panel.getByText(/الگو باید شامل %token باشد/).waitFor();
  assert.equal(await panel.getByLabel('نوع کد پارس‌گرین',{exact:true}).count(),0);
  await capture('sms-kavenegar');
  await panel.getByRole('tab',{name:'تست و ارسال',exact:true}).click();
  assert.equal(await panel.getByRole('button',{name:'تست دریافت کد تأیید',exact:true}).isEnabled(),false,'Unsaved provider changes must not send through the previously saved carrier');
  await panel.getByRole('tab',{name:'تنظیمات',exact:true}).click();
  const saved=page.waitForRequest(req=>req.url().endsWith('/store-settings/sms')&&req.method()==='PUT');
  await panel.getByRole('button',{name:'ذخیره تنظیمات پیامک',exact:true}).click();const input=(await saved).postDataJSON();assert.equal(input.phoneLogin,true);assert.equal(input.provider,'Kavenegar');
  await panel.getByText('تنظیمات پیامک ذخیره شد.',{exact:true}).waitFor();await capture('sms-settings');
  await panel.getByRole('tab',{name:'تست و ارسال',exact:true}).click();
  assert.equal(await panel.getByLabel('متن پیام خدماتی',{exact:true}).getAttribute('maxlength'),'1800');
  page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'ارسال پیامک تست خدماتی',exact:true}).click();
  await panel.getByText('پیام در صف قرار گرفت؛ این وضعیت به معنی تحویل به گوشی نیست.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'تست دریافت کد تأیید',exact:true}).click();
  await panel.getByLabel('کد دریافتی مدیر',{exact:true}).fill('123456');await panel.getByRole('button',{name:'تأیید تست کد',exact:true}).click();
  await panel.getByText('دریافت کد تأیید شد؛ مجوز ورود ایجاد نشد.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('vendora_admin_token')),'local-ui-fixture-only');
  await panel.getByLabel('گیرندهٔ پیام خدماتی',{exact:true}).selectOption('ui-customer');await panel.getByLabel('متن پیام خدماتی',{exact:true}).fill('اعلان خدماتی آزمایشی');
  page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'پیش‌نمایش و ارسال',exact:true}).click();
  await panel.getByText('پیام در صف قرار گرفت؛ این وضعیت به معنی تحویل به گوشی نیست.',{exact:true}).waitFor();
  await panel.getByRole('tab',{name:'گزارش ارسال',exact:true}).click();await panel.getByText('0912***129',{exact:true}).waitFor();await capture('sms-history');
  const incomplete=messagingFixture('/api/admin/store-settings/sms');incomplete.providers[0].textConfigured=false;
  const currentAdmin={id:'ui-admin',fullName:'مدیر آزمایشی',email:'admin@example.invalid',role:'Admin',phoneNumber:'09120000128',completion:{phoneNumberConfirmed:false}};
  const phone=panel.getByRole('region',{name:'تأیید شمارهٔ حساب مدیر',exact:true});let initialSends=0;
  await page.route('**/api/account/me',route=>route.fulfill({json:currentAdmin}));
  await page.route('**/api/admin/sms/recipients',route=>route.fulfill({json:messagingFixture('/api/admin/sms/recipients').filter(account=>currentAdmin.completion.phoneNumberConfirmed||!account.isAdmin)}));
  await page.route('**/api/account/phone/send',route=>{assert.deepEqual(route.request().postDataJSON(),{});assert.match(route.request().headers().authorization,/^Bearer /);initialSends++;return route.fulfill({json:{code:null,retryAfter:120}});});
  await page.route('**/api/account/phone/confirm',route=>{const input=route.request().postDataJSON();assert.deepEqual(Object.keys(input),['code']);const ok=input.code==='123456';if(ok)currentAdmin.completion.phoneNumberConfirmed=true;return route.fulfill({status:ok?200:400,json:{code:ok?null:'INVALID_CODE',retryAfter:0}});});
  await page.route('**/api/admin/store-settings/sms',route=>route.fulfill({json:incomplete}));
  await page.route('**/api/admin/sms/test-code',route=>route.fulfill({status:currentAdmin.completion.phoneNumberConfirmed?200:400,json:currentAdmin.completion.phoneNumberConfirmed?{challengeId:'test-qa',codeLength:6,retryAfter:120}:{code:'SMS_VERIFIED_RECIPIENT_REQUIRED'}}));
  await page.reload();await panel.getByRole('tab',{name:'تست و ارسال',exact:true}).click();
  assert.equal(await panel.getByRole('button',{name:'ارسال پیامک تست خدماتی',exact:true}).isEnabled(),false);
  assert.equal(await panel.getByRole('button',{name:'تست دریافت کد تأیید',exact:true}).isEnabled(),true,'Missing sender does not block OTP testing');
  assert.equal(await panel.getByRole('link',{name:/در فروشگاه/}).count(),0,'Verification stays in admin');
  await panel.getByRole('button',{name:'تست دریافت کد تأیید',exact:true}).click();
  await panel.getByRole('alert').filter({hasText:'حساب گیرنده شمارهٔ موبایل تأییدشده ندارد.'}).waitFor();
  await capture('sms-verified-phone-required');
  await phone.getByRole('button',{name:'ارسال کد تأیید شمارهٔ من',exact:true}).click();
  await phone.getByLabel('کد تأیید شمارهٔ من',{exact:true}).waitFor();
  if(page.viewportSize().width===390)assert.equal(await phone.getByLabel('کد تأیید شمارهٔ من',{exact:true}).inputValue(),'123456','WebOTP fills initial admin phone verification');
  await capture('sms-admin-phone-entry');
  await phone.getByLabel('کد تأیید شمارهٔ من',{exact:true}).fill('000000');
  assert.equal(initialSends,1);assert.equal(await panel.getByRole('button',{name:/ثانیه تا ارسال مجدد/}).isEnabled(),false);
  assert.equal(await panel.getByRole('button',{name:/ثانیه$/,exact:false}).isEnabled(),false);
  await phone.getByRole('button',{name:'تأیید شمارهٔ همراه من',exact:true}).click();
  await phone.getByRole('alert').filter({hasText:'کد واردشده صحیح نیست'}).waitFor();
  assert.equal(await phone.getByLabel('کد تأیید شمارهٔ من',{exact:true}).inputValue(),'000000');
  await phone.getByLabel('کد تأیید شمارهٔ من',{exact:true}).fill('۱۲۳۴۵۶');
  await phone.getByRole('button',{name:'تأیید شمارهٔ همراه من',exact:true}).click();
  await phone.getByText('شمارهٔ همراه این حساب تأیید شده است.',{exact:true}).waitFor();
  assert.equal(initialSends,1);await page.clock.runFor(121000);
  await panel.getByRole('button',{name:'تست دریافت کد تأیید',exact:true}).click();
  await panel.getByLabel('کد دریافتی مدیر',{exact:true}).fill('123456');
  await panel.getByRole('button',{name:'تأیید تست کد',exact:true}).click();
  await panel.getByText('دریافت کد تأیید شد؛ مجوز ورود ایجاد نشد.',{exact:true}).waitFor();
  await panel.getByRole('tab',{name:'تنظیمات',exact:true}).click();
  await panel.getByRole('checkbox',{name:'مدیر آزمایشی — 0912***128',exact:true}).waitFor();
  await capture('sms-admin-phone-verified');
}
/** Verifies response drafts and operation keys survive transient failures, plus explicit close/reopen. */
export async function checkSupport(page, keys, capture) {
  const input=page.getByLabel('پاسخ رسمی پشتیبانی',{exact:true}),text='پاسخ رسمی فروشگاه برای پیگیری سفارش مشتری';await input.fill(text);
  await page.getByRole('button',{name:'ارسال پاسخ',exact:true}).click();await page.getByRole('alert').filter({hasText:'عملیات انجام نشد؛ متن شما حفظ شده است.'}).waitFor();assert.equal(await input.inputValue(),text);
  await page.getByRole('button',{name:'ارسال پاسخ',exact:true}).click();await page.getByText(text,{exact:true}).waitFor();assert.ok(keys[0]);assert.equal(keys[0],keys[1]);
  await page.getByRole('button',{name:'بستن تیکت',exact:true}).click();await page.getByRole('button',{name:'بازگشایی تیکت',exact:true}).click();await input.waitFor();await capture('support-detail');
}
