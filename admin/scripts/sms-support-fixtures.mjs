/** Isolated browser fixtures and interactions. No carrier/API traffic or real account records. */
import assert from 'node:assert/strict';
const events = ['OrderPaid','OrderShipped','OrderDelivered','OrderCancelled','TicketReply','PasswordChanged','PhoneChanged','PaymentReview','AdminOrderPaid','AdminTicketNew','AdminTicketReply','AdminLowStock','AdminPaymentReview'];
/** Returns synthetic contract data for SMS and support requests, ahead of generic store-settings fixtures. */
export function messagingFixture(path) {
  if (path === '/api/admin/store-settings/sms') return { version:1,enabled:true,provider:'ParsGreen',phoneLogin:false,passwordRecovery:false,phoneVerification:true,otpType:1,patternId:3,lowStockThreshold:5,rules:events.map(event=>({event,enabled:false,template:'اعلان خدماتی {link}'})),recipients:[],providers:[{id:'ParsGreen',available:true,otpConfigured:true,textConfigured:true,deliveryConfigured:false},{id:'Kavenegar',available:false,otpConfigured:false,textConfigured:false}],duplicateVerifiedPhones:[] };
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
  const replyKeys=[];
  return {
    replyKeys,
    async handle(route) {
      const req=route.request(),path=new URL(req.url()).pathname,method=req.method(); let value=messagingFixture(path),status=200;
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
/** Tests explicit activation, unavailable providers, own-number OTP testing and masked audit states. */
export async function checkMessaging(page, capture) {
  const panel=page.locator('section.admin-surface').filter({has:page.getByRole('heading',{name:'پیامک و اعلان‌ها',exact:true})});
  await panel.getByRole('tab',{name:'تنظیمات',exact:true}).click();
  await panel.getByLabel('ورود و ثبت‌نام پیامکی مشتریان',{exact:true}).check();
  assert.equal(await panel.getByLabel('پروایدر فعال',{exact:true}).locator('option[value="Kavenegar"]').evaluate(el=>el.disabled),true,await panel.getByLabel('پروایدر فعال',{exact:true}).evaluate(el=>el.outerHTML));
  const saved=page.waitForRequest(req=>req.url().endsWith('/store-settings/sms')&&req.method()==='PUT');
  await panel.getByRole('button',{name:'ذخیره تنظیمات پیامک',exact:true}).click();assert.equal((await saved).postDataJSON().phoneLogin,true);
  await panel.getByText('تنظیمات پیامک ذخیره شد.',{exact:true}).waitFor();await capture('sms-settings');
  await panel.getByRole('tab',{name:'تست و ارسال',exact:true}).click();
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
}
/** Verifies response drafts and operation keys survive transient failures, plus explicit close/reopen. */
export async function checkSupport(page, keys, capture) {
  const input=page.getByLabel('پاسخ رسمی پشتیبانی',{exact:true}),text='پاسخ رسمی فروشگاه برای پیگیری سفارش مشتری';await input.fill(text);
  await page.getByRole('button',{name:'ارسال پاسخ',exact:true}).click();await page.getByRole('alert').filter({hasText:'عملیات انجام نشد؛ متن شما حفظ شده است.'}).waitFor();assert.equal(await input.inputValue(),text);
  await page.getByRole('button',{name:'ارسال پاسخ',exact:true}).click();await page.getByText(text,{exact:true}).waitFor();assert.ok(keys[0]);assert.equal(keys[0],keys[1]);
  await page.getByRole('button',{name:'بستن تیکت',exact:true}).click();await page.getByRole('button',{name:'بازگشایی تیکت',exact:true}).click();await input.waitFor();await capture('support-detail');
}
