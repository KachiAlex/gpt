import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Enter the email address on your account.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.forgotPassword(email.trim());
      if (res?.success) {
        setSent(true);
      } else {
        setError(res?.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
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
          {sent ? (
            <>
              <span className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" strokeWidth={1.75} />
              </span>
              <h1 className="mt-4 mb-0 font-extrabold text-2xl tracking-[-0.015em]">Check your email</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">
                If <span className="font-semibold text-ink">{email}</span> is registered, we sent a reset link. It expires in 30 minutes.
              </p>
              <Link to="/login" className="btn-primary mt-6 min-h-[48px]">
                Back to log in
              </Link>
            </>
          ) : (
            <>
              <h1 className="m-0 font-extrabold text-2xl tracking-[-0.015em]">Reset your password</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">
                Enter your account email and we will send you a reset link.
              </p>

              {error && (
                <div role="alert" className="mt-5 flex gap-2.5 items-start bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 rounded-xl px-3.5 py-3 text-[15px]">
                  <AlertCircle className="w-5 h-5 flex-none mt-px" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fp-email" className="text-sm font-semibold">Email</label>
                  <input
                    id="fp-email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className="input"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary min-h-[50px]">
                  {loading ? 'Sending…' : 'Send reset link'}
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
