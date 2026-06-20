import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';

interface AdminAuthShellPageProps {
  mode: 'login' | 'register' | 'forgot' | 'reset';
}

export const AdminAuthShellPage = observer(function AdminAuthShellPage({ mode }: AdminAuthShellPageProps) {
  const { auth } = useAdminStore();
  const navigate = useNavigate();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const title = mode === 'register' ? 'Register admin' : mode === 'forgot' ? 'Forgot password' : mode === 'reset' ? 'Reset password' : 'Login';
  const description = mode === 'register'
    ? 'Create an invited admin account with the configured invite code.'
    : mode === 'forgot'
      ? 'Request a development reset token.'
      : mode === 'reset'
        ? 'Set a new password with a reset token.'
        : 'Sign in with an admin account.';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const succeeded = isRegister
      ? await auth.register({ fullName, email, password, phoneNumber, inviteCode })
      : isForgot
        ? await auth.forgotPassword(email)
        : isReset
          ? await auth.resetPassword(email, resetToken, password)
          : await auth.login(email, password);

    if (!succeeded) {
      return;
    }

    if (isForgot) {
      toast.info('Reset token generated for development.');
      return;
    }

    if (isReset) {
      toast.success('Password reset successfully.');
      navigate(adminPath(locale, 'login'));
      return;
    }

    toast.success('Signed in successfully.');
    navigate(adminPath(locale, 'dashboard'));
  }

  return (
    <section className="admin-page">
      <div className="admin-auth-shell">
        <div className="admin-page-title">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <form className="admin-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <label>
              Full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Vendora Admin" />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@vendora.local" />
          </label>
          {isRegister ? (
            <label>
              Phone number
              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="09120000000" />
            </label>
          ) : null}
          {isRegister ? (
            <label>
              Invite code
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="DEV-ADMIN-INVITE" />
            </label>
          ) : null}
          {isReset ? (
            <label>
              Reset token
              <textarea value={resetToken} onChange={(event) => setResetToken(event.target.value)} rows={4} />
            </label>
          ) : null}
          {!isForgot ? (
            <label>
              {isReset ? 'New password' : 'Password'}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pass123$" />
            </label>
          ) : null}
          {auth.error ? <div className="admin-error">{auth.error}</div> : null}
          {auth.resetToken ? (
            <div className="admin-info-box">
              <strong>Development reset token</strong>
              <textarea readOnly value={auth.resetToken} rows={4} />
            </div>
          ) : null}
          <button className="admin-primary-btn" type="submit" disabled={auth.isLoading}>
            {auth.isLoading ? 'Please wait...' : 'Continue'}
          </button>
        </form>
      </div>
    </section>
  );
});
