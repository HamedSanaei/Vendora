import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { AdminIcon } from '../components/AdminIcon';
import { AdminButton, AdminFeedback, AdminField } from '../components/AdminUi';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';

interface AdminAuthShellPageProps {
  mode: 'login' | 'register' | 'forgot' | 'reset';
}

/** Renders the standalone Penpot admin auth family while preserving existing auth API contracts. */
export const AdminAuthShellPage = observer(function AdminAuthShellPage({ mode }: AdminAuthShellPageProps) {
  const { auth } = useAdminStore();
  const navigate = useNavigate();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(searchParams.get('email') ?? ''); const [phoneNumber, setPhoneNumber] = useState(''); const [password, setPassword] = useState(''); const [inviteCode, setInviteCode] = useState(''); const [resetToken, setResetToken] = useState(''); const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === 'register'; const isForgot = mode === 'forgot'; const isReset = mode === 'reset';
  const title = isFa ? (isRegister ? 'ساخت حساب مدیر' : isForgot ? 'بازیابی رمز عبور' : isReset ? 'تنظیم رمز جدید' : 'ورود به پنل مدیریت') : (isRegister ? 'Register admin' : isForgot ? 'Forgot password' : isReset ? 'Reset password' : 'Admin sign in');
  const description = isFa ? (isRegister ? 'حساب دعوت‌شده وندورا را فعال کنید.' : isForgot ? 'ایمیل حساب مدیریتی را وارد کنید.' : isReset ? 'توکن بازیابی و رمز جدید را ثبت کنید.' : 'برای مدیریت فروشگاه با حساب Admin وارد شوید.') : (isRegister ? 'Activate an invited Vendora admin account.' : isForgot ? 'Enter the admin account email.' : isReset ? 'Enter the reset token and a new password.' : 'Sign in with an Admin account.');

  function resolveReturnTo(): string {
    const requested = searchParams.get('returnTo');
    const prefix = `/${locale}/admin`;
    return requested && (requested === prefix || requested.startsWith(`${prefix}/`)) ? requested : adminPath(locale, 'dashboard');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const succeeded = isRegister ? await auth.register({ fullName, email, password, phoneNumber, inviteCode }) : isForgot ? await auth.forgotPassword(email) : isReset ? await auth.resetPassword(email, resetToken, password) : await auth.login(email, password);
    if (!succeeded) return;
    if (isForgot) { toast.info(isFa ? 'توکن بازیابی توسعه‌ای ایجاد شد.' : 'Development reset token generated.'); return; }
    if (isReset) { toast.success(isFa ? 'رمز عبور با موفقیت تغییر کرد.' : 'Password reset successfully.'); navigate(adminPath(locale, 'login')); return; }
    toast.success(isFa ? 'ورود موفق بود.' : 'Signed in successfully.'); navigate(resolveReturnTo(), { replace: true });
  }

  return (
    <main className="admin-auth-page" data-admin-theme={isFa ? 'penpot' : 'legacy'} dir={isFa ? 'rtl' : 'ltr'} lang={locale}>
      <section className="admin-auth-brand-panel">
        <div className="admin-auth-brand"><span><AdminIcon name="brand" size={28} /></span><div><strong>VENDORA</strong><small>{isFa ? 'مدیریت دقیق، تصمیم‌های بهتر' : 'Precise operations, better decisions'}</small></div></div>
        <div className="admin-auth-brand-copy"><span>{isFa ? 'پنل مدیریت فروشگاه' : 'Store administration'}</span><h1>{isFa ? 'کنترل آرام و دقیق تمام عملیات وندورا.' : 'Calm, precise control over every Vendora operation.'}</h1><p>{isFa ? 'محصولات، سفارش‌ها، مشتریان و رشد فروشگاه در یک فضای امن و منسجم.' : 'Products, orders, customers, and growth in one secure, coherent workspace.'}</p></div>
        <ul><li><AdminIcon name="products" size={18} />{isFa ? 'مدیریت کامل کاتالوگ' : 'Complete catalog management'}</li><li><AdminIcon name="orders" size={18} />{isFa ? 'گردش امن سفارش‌ها' : 'Guarded order lifecycle'}</li><li><AdminIcon name="dashboard" size={18} />{isFa ? 'آمار واقعی فروشگاه' : 'Real commerce metrics'}</li></ul>
      </section>

      <section className="admin-auth-form-panel">
        <div className="admin-auth-mobile-brand"><AdminIcon name="brand" size={23} /><strong>VENDORA</strong></div>
        <div className="admin-auth-card">
          <header><span className="admin-eyebrow">{isFa ? 'دسترسی امن' : 'Secure access'}</span><h2>{title}</h2><p>{description}</p></header>
          <form className="admin-auth-form" onSubmit={handleSubmit}>
            {isRegister ? <AdminField autoComplete="name" label={isFa ? 'نام کامل' : 'Full name'} onChange={(event) => setFullName(event.target.value)} required value={fullName} /> : null}
            <AdminField autoComplete="email" dir="ltr" label={isFa ? 'ایمیل' : 'Email'} onChange={(event) => setEmail(event.target.value)} placeholder="admin@vendora.local" required type="email" value={email} />
            {isRegister ? <AdminField autoComplete="tel" dir="ltr" label={isFa ? 'شماره تماس' : 'Phone number'} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="09120000000" value={phoneNumber} /> : null}
            {isRegister ? <AdminField dir="ltr" label={isFa ? 'کد دعوت' : 'Invite code'} onChange={(event) => setInviteCode(event.target.value)} required value={inviteCode} /> : null}
            {isReset ? <label className="admin-auth-textarea"><span>{isFa ? 'توکن بازیابی' : 'Reset token'}</span><textarea dir="ltr" onChange={(event) => setResetToken(event.target.value)} required rows={4} value={resetToken} /></label> : null}
            {!isForgot ? <label className="admin-auth-password"><span>{isReset ? (isFa ? 'رمز جدید' : 'New password') : (isFa ? 'رمز عبور' : 'Password')}</span><div><input autoComplete={isReset ? 'new-password' : 'current-password'} dir="ltr" minLength={8} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} /><button aria-label={isFa ? 'نمایش یا پنهان‌کردن رمز' : 'Toggle password visibility'} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? '×' : '•••'}</button></div></label> : null}
            {auth.error ? <AdminFeedback tone="error">{auth.error}</AdminFeedback> : null}
            {auth.resetToken ? <div className="admin-auth-token"><strong>{isFa ? 'توکن توسعه‌ای' : 'Development reset token'}</strong><textarea dir="ltr" readOnly rows={4} value={auth.resetToken} /><AdminButton onClick={() => navigate(`${adminPath(locale, 'reset-password')}?email=${encodeURIComponent(email)}`)} variant="secondary">{isFa ? 'تنظیم رمز جدید' : 'Set new password'}</AdminButton></div> : null}
            <AdminButton className="admin-auth-submit" disabled={auth.isLoading} type="submit" variant="brass">{auth.isLoading ? (isFa ? 'لطفاً صبر کنید…' : 'Please wait…') : (isFa ? 'ادامه' : 'Continue')}</AdminButton>
          </form>
          <nav className="admin-auth-links">
            {mode === 'login' ? <><Link to={adminPath(locale, 'forgot-password')}>{isFa ? 'رمز عبور را فراموش کرده‌اید؟' : 'Forgot password?'}</Link><Link to={adminPath(locale, 'register')}>{isFa ? 'فعال‌سازی حساب دعوت‌شده' : 'Activate invited account'}</Link></> : <Link to={adminPath(locale, 'login')}>{isFa ? 'بازگشت به ورود' : 'Back to sign in'}</Link>}
          </nav>
        </div>
      </section>
      <ToastContainer autoClose={5000} position={isFa ? 'bottom-left' : 'bottom-right'} rtl={isFa} />
    </main>
  );
});
