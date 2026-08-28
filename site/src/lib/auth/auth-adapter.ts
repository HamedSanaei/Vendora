export interface AuthAccount {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface AuthAdapterResult {
  ok: boolean;
  account?: AuthAccount;
  message?: string;
  retryAfter?: number;
}

export interface PhoneAuthAdapter {
  requestCode(phone: string): Promise<AuthAdapterResult>;
  verifyCode(phone: string, code: string): Promise<AuthAdapterResult>;
}

export interface GoogleAuthAdapter {
  signIn(): Promise<AuthAdapterResult>;
}

/** Default safe adapter until an SMS or Google OAuth service is configured. */
export const unavailableAuthAdapter: PhoneAuthAdapter & GoogleAuthAdapter = {
  async requestCode() {
    return { ok: false, message: "AUTH_ADAPTER_UNAVAILABLE" };
  },
  async verifyCode() {
    return { ok: false, message: "AUTH_ADAPTER_UNAVAILABLE" };
  },
  async signIn() {
    return { ok: false, message: "AUTH_ADAPTER_UNAVAILABLE" };
  },
};
