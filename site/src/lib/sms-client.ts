"use client";
import axios from "axios";
import { http } from "./http";
import type { AuthAdapterResult, PhoneAuthAdapter } from "./auth/auth-adapter";

export interface SmsCapabilities { phoneLogin: boolean; passwordRecovery: boolean; phoneVerification: boolean }
export interface OtpReply { challengeId?: string; codeLength: number; retryAfter: number; resetGrant?: string; account?: { id: string; fullName: string; email: string; token: string; role: string; phoneNumber?: string; completion: { isComplete: boolean; phoneNumberConfirmed: boolean } } }

/** Reads only public capability flags; no secret/provider/recipient details are exposed. */
export async function smsCapabilities(signal?: AbortSignal): Promise<SmsCapabilities> { return (await http.get<SmsCapabilities>("/account/auth-options", { signal })).data; }

/** Owns a single login challenge per component instance; request and verify never share state across browser sessions. */
export function createPhoneAuthAdapter(): PhoneAuthAdapter {
  let challenge: { id: string; phone: string } | null = null;
  return {
    async requestCode(phone: string): Promise<AuthAdapterResult> {
      try { const { data } = await http.post<OtpReply>("/account/otp/request", { phone });
        if (!data.challengeId) return { ok: false, message: "SMS_SEND_FAILED" };
        challenge = { id: data.challengeId, phone }; return { ok: true, retryAfter: data.retryAfter, codeLength: data.codeLength };
      } catch (error) { return { ok: false, message: smsErrorCode(error) }; }
    },
    async verifyCode(phone: string, code: string): Promise<AuthAdapterResult> {
      if (!challenge || challenge.phone !== phone) return { ok: false, message: "CODE_EXPIRED" };
      try { const { data } = await http.post<OtpReply>("/account/otp/verify", { challengeId: challenge.id, code });
        const account = data.account;
        if (!account?.token) return { ok: false, message: "INVALID_CODE" };
        challenge = null;
        return { ok: true, account: { accessToken: account.token, user: { id: account.id, name: account.fullName, email: account.email, phone: account.phoneNumber, role: account.role, completion: account.completion } } };
      } catch (error) { return { ok: false, message: smsErrorCode(error) }; }
    },
  };
}

/** Uses the same protected challenge semantics for recovery without exposing an Identity reset token. */
export async function recoveryRequest(phone: string): Promise<OtpReply> { return (await http.post<OtpReply>("/account/password/otp/request", { phone })).data; }
/** Exchanges the code for a short-lived grant, not a logged-in session. */
export async function recoveryVerify(challengeId: string, code: string): Promise<OtpReply> { return (await http.post<OtpReply>("/account/password/otp/verify", { challengeId, code })).data; }
/** Consumes the grant once and revokes earlier sessions. */
export async function recoveryReset(challengeId: string, grant: string, password: string): Promise<void> { await http.post("/account/password/otp/reset", { challengeId, grant, password }); }

/** Extracts a stable, non-sensitive application code instead of displaying provider responses. */
export function smsErrorCode(error: unknown): string { return axios.isAxiosError(error) && typeof error.response?.data?.code === "string" ? error.response.data.code : "SMS_UNAVAILABLE"; }
/** Centralized Persian/English flow messages; no raw provider errors or account existence are disclosed. */
export function smsErrorMessage(code: string, fa: boolean): string {
  const messages: Record<string,[string,string]> = {
    INVALID_PHONE: ["شماره همراه معتبر وارد کنید.", "Enter a valid mobile number."],
    INVALID_CODE: ["کد واردشده صحیح نیست.", "Incorrect verification code."],
    CODE_EXPIRED: ["کد منقضی یا مصرف شده است؛ کد تازه بگیرید.", "Code expired or used. Request another."],
    CODE_ATTEMPT_LIMIT: ["تعداد تلاش‌ها بیش از حد مجاز است؛ کد تازه بگیرید.", "Attempt limit reached. Request another code."],
    RESEND_WAIT: ["برای ارسال مجدد کمی صبر کنید.", "Wait before requesting another code."],
    ACCOUNT_LINK_REQUIRED: ["برای اتصال شماره به حساب قبلی، یک‌بار با ایمیل یا گوگل وارد شوید و شماره را در پروفایل تأیید کنید.", "Sign in using your existing email or Google account and verify the phone in your profile."],
    PHONE_OWNERSHIP_CONFLICT: ["مالکیت این شماره نیازمند بررسی پشتیبانی است.", "Contact support to resolve phone ownership."],
    SMS_AUTH_UNAVAILABLE: ["این روش ورود فعلاً فعال نیست؛ از ایمیل یا گوگل استفاده کنید.", "This method is unavailable. Use email or Google."],
    OTP_NOT_ALLOWED: ["ورود پیامکی برای این حساب مجاز نیست.", "SMS sign-in is unavailable for this account."],
    PASSWORD_POLICY_FAILED: ["رمز باید شرایط امنیتی برنامه را داشته باشد؛ حداقل ۶ کاراکتر و یک عدد.", "Password must have at least 6 characters including a digit."],
    INVALID_RESET_GRANT: ["مجوز بازیابی منقضی شده است؛ دوباره کد بگیرید.", "Recovery authorization expired. Request another code."],
  };
  return messages[code]?.[fa ? 0 : 1] ?? (fa ? "عملیات پیامکی انجام نشد؛ کمی بعد دوباره تلاش کنید یا با پشتیبانی تماس بگیرید." : "SMS operation failed. Retry later or contact support.");
}
