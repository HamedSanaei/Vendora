export interface SmsCodeAutofill {
  start: () => void;
  ready: (receive: (code: string) => void) => void;
  cancel: () => void;
}

/** Receives one origin-bound OTP with browser consent, buffering early arrival until the HTTP challenge is ready. */
export function createSmsCodeAutofill(): SmsCodeAutofill {
  let current: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | null = null;
  let consumer: ((code: string) => void) | null = null;

  /** Aborts an obsolete permission/request and discards buffered values; manual entry is always available. */
  function cancel(): void {
    current?.abort(); current = null; pending = null; consumer = null;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  /** Delivers a validated code once, without submitting a form or persisting the received value. */
  function deliver(): void {
    if (!current || current.signal.aborted || !pending || !consumer) return;
    const code = pending, receive = consumer; cancel(); receive(code);
  }

  /** Starts before the SMS request so fast messages are not missed; unsupported or denied access fails silently. */
  function start(): void {
    cancel();
    if (typeof window === 'undefined' || !window.isSecureContext || !('OTPCredential' in window) || !navigator.credentials?.get) return;
    const attempt = new AbortController(); current = attempt;
    timer = setTimeout(cancel, 120000);
    try {
      const options: CredentialRequestOptions & { otp: { transport: ['sms'] } } = { otp: { transport: ['sms'] }, signal: attempt.signal };
      void navigator.credentials.get(options).then(credential => {
        if (current !== attempt || attempt.signal.aborted) return;
        const value = (credential as unknown as { code?: unknown } | null)?.code;
        if (typeof value !== 'string' || !/^\d{4,8}$/.test(value)) { cancel(); return; }
        pending = value; deliver();
      }).catch(() => { if (current === attempt) cancel(); });
    } catch { cancel(); }
  }

  /** Attaches the current challenge's consumer after success; no callback runs for a cancelled or failed attempt. */
  function ready(receive: (code: string) => void): void {
    if (!current || current.signal.aborted) return;
    consumer = receive; deliver();
  }
  return { start, ready, cancel };
}
