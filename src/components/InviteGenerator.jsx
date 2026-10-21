import { useState, useRef } from 'react';
import { Link2, Copy, CheckCircle } from 'lucide-react';
import { inviteAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { roleLabel } from '../utils/statusMap';

/**
 * Shared invite-link generator — the role-locked counterpart to creating
 * an account with an admin-set password. Renders the form + the generated
 * link once created.
 */
export default function InviteGenerator({ role = 'CONTRACTOR', roleEditable = false, notePlaceholder = '' }) {
  const [form, setForm] = useState({ role, email: '', expiresInDays: 7, note: '' });
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  // Synchronous in-flight guard — state alone can't stop clicks that land
  // before React re-renders the button (the triple-click dupe class of bug).
  const inFlight = useRef(false);

  const generate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setInviteUrl('');
    try {
      const res = await inviteAPI.create({
        role: form.role,
        email: form.email.trim() || undefined,
        expiresInDays: Number(form.expiresInDays) || 7,
        note: form.note.trim() || undefined,
      });
      if (res?.success) {
        setInviteUrl(res.data.invite.url);
        showSuccess('Invite link generated');
      } else {
        showError(res?.message || 'Failed to create invite');
      }
    } catch (e) {
      showError(e.message || 'Failed to create invite');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {roleEditable ? (
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Role *</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink"
            >
              <option value="CONTRACTOR">Contractor</option>
              <option value="ME_OFFICER">M&E Officer</option>
              <option value="GOVERNMENT_OFFICER">Government Officer</option>
              <option value="GOVERNMENT_ADMIN">Administrator</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Role</label>
            <div className="px-3 py-2 border border-border rounded-lg bg-bg text-ink font-medium">{roleLabel(form.role)}</div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Expires in (days)</label>
          <input
            type="number" min={1} max={30}
            value={form.expiresInDays}
            onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Their email (optional — locks the link)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="person@example.com"
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Note (optional, admin-only)</label>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder={notePlaceholder}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          {busy ? 'Generating…' : 'Generate invite link'}
        </button>
      </div>

      {inviteUrl && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-none mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Invite link ready — send it to them</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                Single-use{form.email.trim() ? `, locked to ${form.email.trim()}` : ''}, expires in {form.expiresInDays} day{Number(form.expiresInDays) === 1 ? '' : 's'}.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2 truncate text-ink">{inviteUrl}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(inviteUrl); showSuccess('Link copied'); }}
                  className="btn-secondary text-xs flex items-center gap-1 flex-none"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
