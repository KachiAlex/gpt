import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.resetPassword({ token, newPassword: form.newPassword });
      if (res?.success) {
        setDone(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(res?.message || 'Reset failed. The link may have expired.');
      }
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px]">
        <Link to="/" className="inline-flex items-center self-start mb-8" aria-label="Government Project Tracker home">
          <span className="bg-white border border-border rounded-xl px-3 py-2 inline-flex items-center shadow-sm">
            <img src="/logo.png" alt="Government Project Tracker" className="h-9 w-auto" />
          </span>
        </Link>

        <div className="bg-surface border border-border rounded-2xl p-8">
          {done ? (
            <>
              <span className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" strokeWidth={1.75} />
              </span>
              <h1 className="mt-4 mb-0 font-extrabold text-2xl tracking-[-0.015em]">Password reset</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">Redirecting you to log in…</p>
            </>
          ) : !token ? (
            <>
              <h1 className="m-0 font-extrabold text-2xl tracking-[-0.015em]">Invalid link</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">
                This reset link is missing its token. Request a new one.
              </p>
              <Link to="/forgot-password" className="btn-primary mt-6 min-h-[48px]">
                Request reset link
              </Link>
            </>
          ) : (
            <>
              <h1 className="m-0 font-extrabold text-2xl tracking-[-0.015em]">Choose a new password</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">At least 8 characters.</p>

              {error && (
                <div role="alert" className="mt-5 flex gap-2.5 items-start bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 rounded-xl px-3.5 py-3 text-[15px]">
                  <AlertCircle className="w-5 h-5 flex-none mt-px" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rp-new" className="text-sm font-semibold">New password</label>
                  <div className="relative">
                    <input
                      id="rp-new"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.newPassword}
                      onChange={(e) => { setForm({ ...form, newPassword: e.target.value }); setError(''); }}
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rp-confirm" className="text-sm font-semibold">Confirm password</label>
                  <input
                    id="rp-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => { setForm({ ...form, confirmPassword: e.target.value }); setError(''); }}
                    className="input"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary min-h-[50px]">
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>

        <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 min-h-[44px] text-[15px] font-semibold text-soft-fg">
          <ArrowLeft className="w-[18px] h-[18px]" />
          Back to log in
        </Link>
      </div>
    </div>
  );
}
