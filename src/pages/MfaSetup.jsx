import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { authAPI } from '../services/api';
import { useInstance } from '../contexts/InstanceContext';

/**
 * Forced MFA enrollment — reached when a deployment requires admins to
 * enable TOTP before their first session (ADMIN_MFA_REQUIRED). The login
 * response carries a scoped `purpose: mfa_setup` token (15 min) that only
 * the /mfa/setup + /mfa/enable endpoints accept.
 */
export default function MfaSetup() {
  const navigate = useNavigate();
  const { instance } = useInstance();
  const [token] = useState(() => sessionStorage.getItem('gpt_mfa_setup'));
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await authAPI.mfaSetup(token);
        if (res.success) setSetup(res.data);
        else setError(res.message || 'Could not start two-factor setup. Log in again to retry.');
      } catch (e) {
        setError(e.message || 'Could not start two-factor setup. Log in again to retry.');
      } finally {
        setBusy(false);
      }
    })();
  }, [token, navigate]);

  const handleEnable = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await authAPI.mfaEnable(code, password, token);
      if (res.success) {
        sessionStorage.removeItem('gpt_mfa_setup');
        setDone(true);
      } else {
        setError(res.message || 'Invalid code — check your authenticator app and password.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <img src={instance.logoUrl} alt={instance.name} className="h-10 w-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <h1 className="text-lg font-bold">Set up two-factor authentication</h1>
          </div>

          {done ? (
            <>
              <p className="text-sm text-muted mb-5">
                Two-factor authentication is enabled on your account. Log in again to continue.
              </p>
              <Link to="/login" className="btn-primary inline-block text-center w-full">Back to login</Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted mb-5">
                This deployment requires administrators to secure their account with an
                authenticator app before signing in.
              </p>

              {error && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                  {error}
                </div>
              )}

              {busy && !setup && <p className="text-sm text-muted">Preparing your secret key…</p>}

              {setup && (
                <form onSubmit={handleEnable} className="space-y-4">
                  <div>
                    <p className="text-sm text-muted mb-2">1. Scan this QR code with your authenticator app, or enter the key manually:</p>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <img src={setup.qrDataUrl} alt="TOTP QR code" className="w-40 h-40 rounded-lg border border-border" />
                      <code className="block bg-bg rounded-lg px-3 py-2 text-xs break-all select-all">{setup.secret}</code>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="mfa-code" className="text-sm text-muted block mb-1">2. Enter the 6-digit code it now shows:</label>
                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-40 border border-border rounded-lg px-3 py-2 text-center tracking-[0.3em] focus:ring-2 focus:ring-primary-500"
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <label htmlFor="mfa-password" className="text-sm text-muted block mb-1">3. Confirm with your account password:</label>
                    <input
                      id="mfa-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                      placeholder="Password"
                      autoComplete="current-password"
                    />
                  </div>
                  <button type="submit" disabled={busy || code.length !== 6 || !password} className="btn-primary w-full">
                    {busy ? 'Enabling…' : 'Enable two-factor authentication'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
