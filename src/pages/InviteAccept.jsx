import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, Building } from 'lucide-react';
import { inviteAPI } from '../services/api';
import { useInstance } from '../contexts/InstanceContext';
import { roleLabel } from '../utils/statusMap';

const ROLE_DESCRIPTIONS = {
  GOVERNMENT_ADMIN: 'Government Administrator — full platform access',
  GOVERNMENT_OFFICER: 'Government Officer — manage projects and review submissions',
  ME_OFFICER: 'Monitoring & Evaluation Officer — review and approve submissions',
  CONTRACTOR: 'Contractor — submit progress updates on assigned projects',
  PUBLIC: 'Public account — view published projects',
};

export default function InviteAccept() {
  const { token } = useParams();
  const instance = useInstance();
  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '', department: '', jobTitle: '',
    companyName: '', registrationNo: '', contactPerson: '',
    companyEmail: '', companyPhone: '', companyAddress: '', yearsExperience: '',
  });

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); };

  useEffect(() => {
    let mounted = true;
    inviteAPI.get(token)
      .then((res) => {
        if (!mounted) return;
        const inv = res?.data;
        setInvite(inv);
        if (inv?.email) setForm((f) => ({ ...f, email: inv.email }));
      })
      .catch((e) => { if (mounted) setInviteError(e.message || 'This invite link is invalid or expired'); })
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        token,
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone || undefined,
        department: form.department || undefined,
        jobTitle: form.jobTitle || undefined,
      };
      if (invite?.role === 'CONTRACTOR') {
        Object.assign(payload, {
          companyName: form.companyName,
          registrationNo: form.registrationNo,
          contactPerson: form.contactPerson,
          companyEmail: form.companyEmail,
          companyPhone: form.companyPhone,
          companyAddress: form.companyAddress,
          yearsExperience: form.yearsExperience || undefined,
        });
      }
      const res = await inviteAPI.accept(payload);
      if (res?.success) setDone(true);
      else setError(res?.message || 'Registration failed');
    } catch (err) {
      setError(err.message || 'Registration failed. The link may have expired.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const field = (id, label, props = {}) => {
    const required = props.required !== false;
    return (
      <div className="flex flex-col gap-1.5" key={id}>
        <label htmlFor={id} className="text-sm font-semibold">{label}{required ? ' *' : ''}</label>
        <input id={id} className="input" required={required} {...props} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[480px]">
        <Link to="/" className="inline-flex items-center self-start mb-8" aria-label={`${instance.name} home`}>
          <span className="bg-white border border-border rounded-xl px-3 py-2 inline-flex items-center shadow-sm">
            <img src={instance.logoUrl} alt={instance.name} className="h-9 w-auto" />
          </span>
        </Link>

        <div className="bg-surface border border-border rounded-2xl p-8">
          {checking ? (
            <p className="text-muted">Checking invite link…</p>
          ) : inviteError ? (
            <>
              <span className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" strokeWidth={1.75} />
              </span>
              <h1 className="mt-4 mb-0 font-extrabold text-2xl tracking-[-0.015em]">Invite unavailable</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">{inviteError}</p>
              <p className="mt-3 mb-0 text-muted text-sm">Ask your administrator for a new invite link.</p>
              <Link to="/login" className="btn-secondary mt-6 min-h-[48px]">Back to log in</Link>
            </>
          ) : done ? (
            <>
              <span className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" strokeWidth={1.75} />
              </span>
              <h1 className="mt-4 mb-0 font-extrabold text-2xl tracking-[-0.015em]">Account created</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">
                Your {roleLabel(invite.role)} account is ready. Log in with your email and the password you just set.
              </p>
              <Link to="/login" className="btn-primary mt-6 min-h-[48px]">Log in</Link>
            </>
          ) : (
            <>
              <h1 className="m-0 font-extrabold text-2xl tracking-[-0.015em]">Accept your invite</h1>
              <p className="mt-2 mb-0 text-muted text-[15px]">
                You have been invited as <span className="font-semibold text-ink">{roleLabel(invite.role)}</span>.
                <span className="block text-sm mt-1">{ROLE_DESCRIPTIONS[invite.role]}</span>
              </p>

              {error && (
                <div role="alert" className="mt-5 flex gap-2.5 items-start bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 rounded-xl px-3.5 py-3 text-[15px]">
                  <AlertCircle className="w-5 h-5 flex-none mt-px" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  {field('ia-first', 'First name', { value: form.firstName, onChange: set('firstName'), autoComplete: 'given-name' })}
                  {field('ia-last', 'Last name', { value: form.lastName, onChange: set('lastName'), autoComplete: 'family-name', required: false })}
                </div>
                {field('ia-email', 'Email', {
                  type: 'email', value: form.email, onChange: set('email'), autoComplete: 'email',
                  readOnly: Boolean(invite.email),
                  className: invite.email ? 'input opacity-60 cursor-not-allowed' : 'input',
                })}
                {field('ia-phone', 'Phone', { type: 'tel', value: form.phone, onChange: set('phone'), autoComplete: 'tel', required: false })}
                {field('ia-pass', 'Password', { type: 'password', value: form.password, onChange: set('password'), autoComplete: 'new-password', placeholder: 'Minimum 8 characters' })}
                {field('ia-pass2', 'Confirm password', { type: 'password', value: form.confirmPassword, onChange: set('confirmPassword'), autoComplete: 'new-password' })}

                {invite.role !== 'CONTRACTOR' && invite.role !== 'PUBLIC' && (
                  <div className="grid grid-cols-2 gap-3">
                    {field('ia-dept', 'Department', { value: form.department, onChange: set('department'), required: false })}
                    {field('ia-title', 'Job title', { value: form.jobTitle, onChange: set('jobTitle'), required: false })}
                  </div>
                )}

                {invite.role === 'CONTRACTOR' && (
                  <>
                    <div className="flex items-center gap-2 mt-2 pt-4 border-t border-border">
                      <Building className="w-4 h-4 text-muted" />
                      <h2 className="m-0 text-sm font-semibold">Company details</h2>
                    </div>
                    {field('ia-cname', 'Company name', { value: form.companyName, onChange: set('companyName') })}
                    <div className="grid grid-cols-2 gap-3">
                      {field('ia-regno', 'Registration No.', { value: form.registrationNo, onChange: set('registrationNo') })}
                      {field('ia-yrs', 'Years experience', { type: 'number', min: 0, value: form.yearsExperience, onChange: set('yearsExperience'), required: false })}
                    </div>
                    {field('ia-cperson', 'Contact person', { value: form.contactPerson, onChange: set('contactPerson') })}
                    <div className="grid grid-cols-2 gap-3">
                      {field('ia-cemail', 'Company email', { type: 'email', value: form.companyEmail, onChange: set('companyEmail') })}
                      {field('ia-cphone', 'Company phone', { type: 'tel', value: form.companyPhone, onChange: set('companyPhone') })}
                    </div>
                    {field('ia-caddr', 'Company address', { value: form.companyAddress, onChange: set('companyAddress') })}
                  </>
                )}

                <button type="submit" disabled={submitting} className="btn-primary min-h-[50px] mt-2">
                  {submitting ? 'Creating account…' : 'Create account'}
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
