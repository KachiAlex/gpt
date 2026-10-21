import { useState } from 'react';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import { showError, showSuccess } from '../../utils/toast';

const Requirement = ({ met, label }) => (
  <li className="flex items-center">
    {met
      ? <Check className="h-4 w-4 text-green-500 mr-2" aria-hidden="true" />
      : <X className="h-4 w-4 text-red-500 mr-2" aria-hidden="true" />}
    {label}
  </li>
);

export default function SecurityTab() {
  const { user, updateUser, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  // Two-factor auth (TOTP)
  const [mfaSetup, setMfaSetup] = useState(null); // { secret, qrDataUrl }
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaDisable, setMfaDisable] = useState({ open: false, password: '', code: '' });

  const handleChangePassword = async () => {
    setPasswordMessage('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage('Enter your current password and a new password.');
      return;
    }
    if (passwordForm.newPassword.length < 12) {
      setPasswordMessage('New password must be at least 12 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (res?.success) {
        // The backend revokes every session on password change — take the user
        // straight to login instead of leaving them to hit a surprise 401.
        setPasswordMessage('Password changed — signing you out. Log in again with your new password.');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => signOut(), 2500);
      } else {
        setPasswordMessage(res?.message || 'Failed to change password.');
      }
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const startMfaSetup = async () => {
    setMfaBusy(true);
    try {
      const res = await authAPI.mfaSetup();
      if (res.success) setMfaSetup(res.data);
      else showError(res.message || 'Could not start two-factor setup');
    } catch (e) {
      showError(e.message || 'Could not start two-factor setup');
    } finally {
      setMfaBusy(false);
    }
  };

  const enableMfa = async () => {
    setMfaBusy(true);
    try {
      const res = await authAPI.mfaEnable(mfaCode, mfaPassword);
      if (res.success) {
        showSuccess('Two-factor authentication enabled');
        updateUser({ ...user, totpEnabled: true });
        setMfaSetup(null); setMfaCode(''); setMfaPassword('');
      } else showError(res.message || 'Invalid code');
    } catch (e) {
      showError(e.message || 'Verification failed');
    } finally {
      setMfaBusy(false);
    }
  };

  const disableMfa = async () => {
    setMfaBusy(true);
    try {
      const res = await authAPI.mfaDisable(mfaDisable.password, mfaDisable.code);
      if (res.success) {
        showSuccess('Two-factor authentication disabled');
        updateUser({ ...user, totpEnabled: false });
        setMfaDisable({ open: false, password: '', code: '' });
      } else showError(res.message || 'Could not disable');
    } catch (e) {
      showError(e.message || 'Could not disable');
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-6">Password &amp; Authentication</h3>
        <div className="space-y-6">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-ink mb-2">Current Password</label>
            <div className="relative">
              <input
                id="current-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                autoComplete="current-password"
                className="w-full pr-10 pl-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted" /> : <Eye className="h-4 w-4 text-muted" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-ink mb-2">New Password</label>
              <input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                autoComplete="new-password"
                className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-ink mb-2">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                autoComplete="new-password"
                className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-bg rounded-lg p-4" aria-live="polite">
            <h4 className="text-sm font-medium text-ink mb-2">Password Requirements</h4>
            <ul className="text-sm text-muted space-y-1">
              <Requirement met={passwordForm.newPassword.length >= 12} label="At least 12 characters long" />
              <Requirement met={/[a-z]/.test(passwordForm.newPassword) && /[A-Z]/.test(passwordForm.newPassword)} label="Contains uppercase and lowercase letters" />
              <Requirement met={/[0-9]/.test(passwordForm.newPassword)} label="Contains at least one number" />
            </ul>
          </div>

          {passwordMessage && (
            <p className={clsx('text-sm', passwordMessage.includes('changed') || passwordMessage.includes('success') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')} role="status">
              {passwordMessage}
            </p>
          )}
          <button type="button" onClick={handleChangePassword} disabled={passwordSaving} className="btn-primary self-start">
            {passwordSaving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>

      {/* Two-factor authentication */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Two-factor authentication</h3>
            <p className="text-sm text-muted mt-1">
              Requires a code from an authenticator app (e.g. Google/Microsoft Authenticator) at each login.
            </p>
          </div>
          <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full',
            user?.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-muted')}>
            {user?.totpEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {!user?.totpEnabled && !mfaSetup && (
          <button type="button" disabled={mfaBusy} onClick={startMfaSetup} className="btn-primary self-start">
            {mfaBusy ? 'Preparing…' : 'Set up two-factor authentication'}
          </button>
        )}

        {!user?.totpEnabled && mfaSetup && (
          <div className="space-y-4">
            <p className="text-sm text-muted">1. Scan this QR code with your authenticator app, or enter the key manually.</p>
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <img src={mfaSetup.qrDataUrl} alt="TOTP QR code" className="w-44 h-44 rounded-lg border border-border" />
              <div>
                <div className="text-xs font-semibold text-muted mb-1">Manual entry key</div>
                <code className="block bg-bg rounded-lg px-3 py-2 text-sm break-all select-all">{mfaSetup.secret}</code>
              </div>
            </div>
            <div>
              <label htmlFor="mfa-setup-code" className="text-sm text-muted block mb-2">2. Enter the 6-digit code it now shows:</label>
              <input
                id="mfa-setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="w-40 border border-border rounded-lg px-3 py-2 text-center tracking-[0.3em] focus:ring-2 focus:ring-primary-500"
                placeholder="123456"
              />
            </div>
            <div>
              <label htmlFor="mfa-setup-password" className="text-sm text-muted block mb-2">3. Confirm with your account password:</label>
              <div className="flex gap-3 items-center">
                <input
                  id="mfa-setup-password"
                  type="password"
                  value={mfaPassword}
                  onChange={(e) => setMfaPassword(e.target.value)}
                  className="w-48 border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  disabled={mfaBusy || mfaCode.length !== 6 || !mfaPassword}
                  onClick={enableMfa}
                  className="btn-primary"
                >
                  Enable
                </button>
                <button type="button" onClick={() => { setMfaSetup(null); setMfaCode(''); setMfaPassword(''); }} className="text-sm text-soft-fg font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {user?.totpEnabled && !mfaDisable.open && (
          <button
            type="button"
            onClick={() => setMfaDisable({ open: true, password: '', code: '' })}
            className="text-sm font-semibold text-red-600 hover:text-red-700"
          >
            Disable two-factor authentication
          </button>
        )}

        {user?.totpEnabled && mfaDisable.open && (
          <div className="space-y-3 max-w-sm">
            <p className="text-sm text-muted">Confirm your password and current code to disable:</p>
            <input
              type="password"
              placeholder="Password"
              aria-label="Password to confirm disabling two-factor authentication"
              value={mfaDisable.password}
              onChange={(e) => setMfaDisable({ ...mfaDisable, password: e.target.value })}
              autoComplete="current-password"
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              aria-label="Current authenticator code"
              value={mfaDisable.code}
              onChange={(e) => setMfaDisable({ ...mfaDisable, code: e.target.value.replace(/\D/g, '') })}
              autoComplete="one-time-code"
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={mfaBusy}
                onClick={disableMfa}
                className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-red-700"
              >
                Disable 2FA
              </button>
              <button type="button" onClick={() => setMfaDisable({ open: false, password: '', code: '' })} className="text-sm text-soft-fg font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
