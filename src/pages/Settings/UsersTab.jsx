import { useState, useEffect } from 'react';
import { Link2, Copy } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI, inviteAPI } from '../../services/api';
import { showError, showSuccess } from '../../utils/toast';
import { roleLabel } from '../../utils/statusMap';

export default function UsersTab() {
  const { user } = useAuth();
  const [managedUsers, setManagedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [inviteForm, setInviteForm] = useState({ role: 'CONTRACTOR', email: '', expiresInDays: 7, note: '' });
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    userAPI.getAll()
      .then((res) => { if (!cancelled) setManagedUsers(res?.data?.users || []); })
      .catch(() => showError('Failed to load users'))
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    inviteAPI.list()
      .then((res) => { if (!cancelled) setInvites(res?.data?.invites || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const createInvite = async () => {
    setInviteBusy(true);
    setInviteUrl('');
    try {
      const res = await inviteAPI.create({
        role: inviteForm.role,
        email: inviteForm.email.trim() || undefined,
        expiresInDays: Number(inviteForm.expiresInDays) || 7,
        note: inviteForm.note.trim() || undefined,
      });
      if (res?.success) {
        setInviteUrl(res.data.invite.url);
        showSuccess('Invite link generated');
        const list = await inviteAPI.list().catch(() => null);
        if (list?.success) setInvites(list.data.invites || []);
      } else {
        showError(res?.message || 'Failed to create invite');
      }
    } catch (e) {
      showError(e.message || 'Failed to create invite');
    } finally {
      setInviteBusy(false);
    }
  };

  const revokeInvite = async (inv) => {
    try {
      const res = await inviteAPI.revoke(inv.id);
      if (res?.success) {
        setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, revokedAt: new Date().toISOString() } : i));
        showSuccess('Invite revoked');
      } else {
        showError(res?.message || 'Revoke failed');
      }
    } catch (e) {
      showError(e.message || 'Revoke failed');
    }
  };

  const handleUserPatch = async (target, updates) => {
    try {
      const res = await userAPI.update(target.id, updates);
      if (res?.success) {
        setManagedUsers((prev) => prev.map((u) => u.id === target.id ? { ...u, ...updates, isActive: updates.isActive ?? u.isActive, role: updates.role ?? u.role } : u));
        showSuccess('User updated');
      } else {
        showError(res?.message || 'Update failed');
      }
    } catch (e) {
      showError(e.message || 'Update failed');
    }
  };

  const handleUserReset = async (target) => {
    const newPassword = window.prompt(`Set a new password for ${target.email} (12+ characters, mixed case + number):`);
    if (newPassword === null) return;
    try {
      const res = await userAPI.resetPassword(target.id, newPassword);
      if (res?.success) showSuccess(res.message || 'Password reset');
      else showError(res?.message || 'Reset failed');
    } catch (e) {
      showError(e.message || 'Reset failed');
    }
  };

  const pendingInvites = invites.filter((i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date());

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h3 className="text-lg font-semibold text-ink">User management</h3>
            <p className="text-sm text-muted">Deactivate accounts, change roles, or reset passwords. Deactivation takes effect immediately.</p>
          </div>
          <button type="button" onClick={() => setShowInviteForm((v) => !v)} className="btn-secondary flex items-center gap-2 flex-none">
            <Link2 className="h-4 w-4" /> Invite link
          </button>
        </div>

        {showInviteForm && (
          <div className="mt-4 mb-6 p-4 border border-border rounded-xl bg-bg space-y-3">
            <p className="text-sm text-muted">Generate a link the person opens to set their own details and password — no shared credentials.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="invite-role" className="block text-xs font-medium text-muted mb-1">Role *</label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
                >
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="ME_OFFICER">M&E Officer</option>
                  <option value="GOVERNMENT_OFFICER">Government Officer</option>
                  <option value="GOVERNMENT_ADMIN">Administrator</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
              <div>
                <label htmlFor="invite-email" className="block text-xs font-medium text-muted mb-1">Their email (optional — locks the link to it)</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contractor@company.com"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
                />
              </div>
              <div>
                <label htmlFor="invite-days" className="block text-xs font-medium text-muted mb-1">Expires in (days)</label>
                <input
                  id="invite-days"
                  type="number" min={1} max={30}
                  value={inviteForm.expiresInDays}
                  onChange={(e) => setInviteForm((f) => ({ ...f, expiresInDays: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
                />
              </div>
              <div>
                <label htmlFor="invite-note" className="block text-xs font-medium text-muted mb-1">Note (optional)</label>
                <input
                  id="invite-note"
                  value={inviteForm.note}
                  onChange={(e) => setInviteForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. for ABC Construction"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={createInvite} disabled={inviteBusy} className="btn-primary text-sm disabled:opacity-50">
                {inviteBusy ? 'Generating…' : 'Generate link'}
              </button>
              {inviteUrl && (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <code className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2 truncate text-ink">{inviteUrl}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(inviteUrl); showSuccess('Link copied'); }}
                    className="btn-secondary text-xs flex items-center gap-1 flex-none"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-ink mb-2">Pending invites</h4>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 p-3 bg-bg border border-border rounded-lg text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{roleLabel(inv.role)}</span>
                    <span className="text-muted"> — {inv.email || 'any email'}{inv.note ? ` · ${inv.note}` : ''}</span>
                    <span className="block text-xs text-muted">expires {new Date(inv.expiresAt).toLocaleDateString()} · by {inv.invitedByName}</span>
                  </div>
                  <button type="button" onClick={() => revokeInvite(inv)} className="text-xs font-semibold text-red-600 flex-none">Revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {usersLoading ? (
          <p className="text-muted text-sm py-6 text-center">Loading…</p>
        ) : managedUsers.length === 0 ? (
          <p className="text-muted text-sm py-6 text-center">No users found.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managedUsers.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-3">
                        <div className="font-medium text-ink">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="px-2 py-3">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          aria-label={`Role for ${u.email}`}
                          onChange={(e) => handleUserPatch(u, { role: e.target.value })}
                          className="border border-border rounded-lg px-2 py-1 text-sm bg-bg disabled:opacity-50"
                        >
                          <option value="GOVERNMENT_ADMIN">Administrator</option>
                          <option value="GOVERNMENT_OFFICER">Govt Officer</option>
                          <option value="ME_OFFICER">M&amp;E Officer</option>
                          <option value="CONTRACTOR">Contractor</option>
                          <option value="PUBLIC">Public</option>
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right space-x-3">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleUserPatch(u, { isActive: !u.isActive })}
                            className={clsx('text-xs font-semibold', u.isActive ? 'text-red-600' : 'text-green-600')}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUserReset(u)}
                          className="text-xs font-semibold text-soft-fg"
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
