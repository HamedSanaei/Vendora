import { httpClient } from '../../../lib/api/httpClient';

export interface SmsRule { event: string; enabled: boolean; template: string }
export interface SmsRecipient { userId: string; events: string[] }
export interface SmsSettings { parsGreenBrandedOtp?: boolean; otpTemplates?: Array<{purpose:string;text:string}>; version: number; enabled: boolean; provider: string; phoneLogin: boolean; passwordRecovery: boolean; phoneVerification: boolean; otpType: number; patternId: number; lowStockThreshold: number; rules: SmsRule[]; recipients: SmsRecipient[]; providers: Array<{id:string;available:boolean;otpConfigured:boolean;textConfigured:boolean;deliveryConfigured?:boolean;brandedOtpConfigured?:boolean}>; duplicateVerifiedPhones: string[] }
export interface SmsAccount { id:string; name:string; phone:string; isAdmin:boolean }
export interface SmsLog { id:string; event:string; phone:string; provider:string; status:string; createdAtUtc:string; attempts:number; errorCode?:string }
export interface SmsLogPage { page:number; total:number; items:SmsLog[] }
export interface SmsTestChallenge { challengeId:string; codeLength:number; retryAfter:number }
export interface PhoneVerificationReply { code?: string | null; retryAfter: number }

/** Sends an initial ownership challenge to the signed-in administrator's saved phone using the existing account endpoint. */
export async function requestAdminPhoneVerification(): Promise<PhoneVerificationReply> {
  return (await httpClient.post<PhoneVerificationReply>('/api/account/phone/send', {}, { timeout: 25000 })).data;
}

/** Confirms only the current account's saved number; the server determines ownership and confirmation status. */
export async function confirmAdminPhoneVerification(code: string): Promise<PhoneVerificationReply> {
  return (await httpClient.post<PhoneVerificationReply>('/api/account/phone/confirm', { code }, { timeout: 25000 })).data;
}
/** Loads only nonsecret messaging controls through the shared authenticated client. */
export async function getSmsSettings():Promise<SmsSettings> {
  const {data}=await httpClient.get<SmsSettings>('/api/admin/store-settings/sms');
  if(!data||!Array.isArray(data.providers)||!Array.isArray(data.rules)||!Array.isArray(data.recipients)||!Array.isArray(data.duplicateVerifiedPhones))throw new Error('Invalid SMS settings response');
  return data;
}
/** Saves with optimistic version protection; the server rejects unknown providers and unverified admin recipients. */
export async function putSmsSettings(value:SmsSettings):Promise<SmsSettings> { return (await httpClient.put<SmsSettings>('/api/admin/store-settings/sms',value)).data; }
/** Reads account choices without exposing a raw-number send endpoint. */
export async function smsAccounts():Promise<SmsAccount[]> { return (await httpClient.get<SmsAccount[]>('/api/admin/sms/recipients')).data; }
/** Reads paginated, masked audit rows rather than message bodies. */
export async function smsHistory(page:number,status:string):Promise<SmsLogPage> { return (await httpClient.get<SmsLogPage>('/api/admin/sms/messages',{params:{page,status:status||undefined}})).data; }
/** Queues one explicit operation; the component retains its key after network failures. */
export async function sendSms(userId:string,text:string,key:string,test=false):Promise<string> { return (await httpClient.post<{id:string}>(`/api/admin/sms/${test?'test':'send'}`,{userId,text},{headers:{'Idempotency-Key':key}})).data.id; }
/** Sends an actual OTP only to the calling administrator's verified number, without login privileges. */
export async function testSmsCode():Promise<SmsTestChallenge> { return (await httpClient.post<SmsTestChallenge>('/api/admin/sms/test-code', {}, { timeout: 25000 })).data; }
/** Verifies the test challenge, never exchanging it for an administrator session. */
export async function verifySmsTest(challengeId:string,code:string):Promise<void> { await httpClient.post('/api/admin/sms/test-code/verify',{challengeId,code}); }

export const smsEventLabels:Record<string,string> = { OrderPaid:'پرداخت موفق سفارش',OrderShipped:'ارسال سفارش',OrderDelivered:'تحویل سفارش',OrderCancelled:'لغو سفارش',TicketReply:'پاسخ پشتیبانی',PasswordChanged:'تغییر رمز',PhoneChanged:'تغییر شماره همراه',PaymentReview:'پرداخت نیازمند بررسی',AdminOrderPaid:'مدیر: سفارش پرداخت‌شده جدید',AdminTicketNew:'مدیر: تیکت جدید',AdminTicketReply:'مدیر: پاسخ مشتری',AdminLowStock:'مدیر: موجودی کم',AdminPaymentReview:'مدیر: پرداخت نیازمند بررسی',Manual:'ارسال دستی',Test:'تست خدماتی',OtpLogin:'کد ورود',OtpRecovery:'کد بازیابی',OtpTest:'کد آزمایشی',OtpVerification:'کد تأیید شماره' };

/** Keeps provider identifiers stable while giving Persian management screens readable names. */
export const smsProviderLabels:Record<string,string>={ParsGreen:'پارس‌گرین',Kavenegar:'کاوه‌نگار'};
