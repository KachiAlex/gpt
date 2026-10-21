import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HardHat, ClipboardCheck, BarChart3, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInstance } from '../contexts/InstanceContext';
import { showSuccess } from '../utils/toast';

const roleRedirects = {
  GOVERNMENT_ADMIN: '/dashboard',
  GOVERNMENT_OFFICER: '/dashboard',
  CONTRACTOR: '/contractor/dashboard',
  ME_OFFICER: '/me/dashboard',
};

export default function Login() {
  const { signIn, verifyMfa } = useAuth();
  const instance = useInstance();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfa, setMfa] = useState(null); // { mfaToken }
  const [code, setCode] = useState('');

  const completeLogin = (result) => {
    showSuccess('Logged in successfully');
    const dest = location.state?.from?.pathname || roleRedirects[result.data.user.role] || '/dashboard';
    navigate(dest, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signIn({ email: form.email, password: form.password });
      if (!result.success) {
        setError(result.message || 'That email or password is not correct. Check them and try again.');
        return;
      }
      if (result.mfaRequired) {
        setMfa({ mfaToken: result.mfaToken });
        return;
      }
      if (result.mfaSetupRequired) {
        sessionStorage.setItem('gpt_mfa_setup', result.mfaSetupToken);
        navigate('/mfa-setup');
        return;
      }
      completeLogin(result);
    } catch {
      setError('An error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyMfa(mfa.mfaToken, code.trim());
      if (!result.success) {
        setError(result.message || 'That code did not work. Check your authenticator and try again.');
        return;
      }
      completeLogin(result);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-bg text-ink font-sans">
      {/* Left brand panel */}
      <div className="flex-1 min-w-0 bg-[#0c4a6e] text-white px-8 lg:px-14 py-11 flex flex-col">
        <Link to="/" className="inline-flex items-center self-start" aria-label={`${instance.name} home`}>
          <span className="bg-white rounded-xl px-3 py-2 inline-flex items-center">
            <img src={instance.logoUrl} alt={instance.name} className="h-10 w-auto" />
          </span>
        </Link>

        <h1 className="mt-auto font-extrabold text-[42px] leading-[1.1] tracking-[-0.02em] max-w-[420px]">
          Keep public projects moving and accountable
        </h1>
        <ul className="list-none mt-7 p-0 flex flex-col gap-3.5 text-[17px] text-primary-200">
          <li className="flex items-center gap-3">
            <HardHat className="w-[22px] h-[22px] text-primary-400 flex-none" strokeWidth={1.75} />
            Contractors submit milestones and documents
          </li>
          <li className="flex items-center gap-3">
            <ClipboardCheck className="w-[22px] h-[22px] text-primary-400 flex-none" strokeWidth={1.75} />
            M&amp;E officers review and approve
          </li>
          <li className="flex items-center gap-3">
            <BarChart3 className="w-[22px] h-[22px] text-primary-400 flex-none" strokeWidth={1.75} />
            Government staff manage and report
          </li>
        </ul>
        <div className="mt-14 text-sm text-primary-300">© 2026 {instance.footerOrg || instance.name}</div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 min-w-0 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-[440px]">
          <Link to="/" className="inline-flex items-center gap-1.5 min-h-[44px] text-[15px] font-semibold text-soft-fg">
            <ArrowLeft className="w-[18px] h-[18px]" />
            Back to public portal
          </Link>
          <h2 className="mt-3 mb-0 font-extrabold text-[32px] tracking-[-0.015em] text-brand">Log in</h2>
          <p className="mt-1.5 mb-0 text-muted">
            For contractors and government staff. Citizens do not need an account.
          </p>

          {error && (
            <div role="alert" className="mt-5 flex gap-2.5 items-start bg-red-100 text-red-800 rounded-xl px-3.5 py-3 text-[15px]">
              <AlertCircle className="w-5 h-5 flex-none mt-px" />
              <span>{error}</span>
            </div>
          )}

          {mfa ? (
            <form onSubmit={handleMfaSubmit} className="mt-6 flex flex-col gap-[18px]">
              <p className="m-0 text-muted text-[15px]">
                This account has two-factor authentication. Enter the 6-digit code from your authenticator app.
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lg-mfa" className="text-sm font-semibold">Authentication code</label>
                <input
                  id="lg-mfa"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  className="input text-center tracking-[0.4em] text-lg"
                  autoFocus
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary min-h-[54px] text-[17px]">
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => { setMfa(null); setCode(''); setError(''); }}
                className="text-sm font-semibold text-soft-fg"
              >
                Back to email &amp; password
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lg-email" className="text-sm font-semibold">Email</label>
              <input
                id="lg-email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(''); }}
                className="input"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="lg-pass" className="text-sm font-semibold">Password</label>
                <Link to="/forgot-password" className="text-sm font-semibold text-soft-fg">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  id="lg-pass"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }}
                  className="input pr-14"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1 w-11 h-11 rounded-[10px] text-muted flex items-center justify-center hover:bg-hoverbg"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.75} /> : <Eye className="w-5 h-5" strokeWidth={1.75} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary min-h-[54px] text-[17px]">
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          )}

          <p className="mt-6 text-[14.5px] text-muted">
            Need an account? Contractors and officers are registered by a government administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
