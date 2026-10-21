import { useState, useEffect } from 'react';
import { auditAPI } from '../../services/api';
import { showError } from '../../utils/toast';

export default function AuditTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    auditAPI.list({ limit: 100 })
      .then((res) => { if (!cancelled) setEntries(res?.data?.entries || []); })
      .catch(() => showError('Failed to load audit log'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-ink mb-2">Audit log</h3>
      <p className="text-sm text-muted mb-6">Append-only record of sensitive actions — publications, reviews, settings changes, logins.</p>
      {loading ? (
        <p className="text-muted text-sm py-6 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted text-sm py-6 text-center">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 px-2 font-medium">When</th>
                <th className="py-2 px-2 font-medium">Actor</th>
                <th className="py-2 px-2 font-medium">Action</th>
                <th className="py-2 px-2 font-medium">Entity</th>
                <th className="py-2 px-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 px-2 whitespace-nowrap text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-2.5 px-2">{e.actorEmail || 'system'}<span className="block text-xs text-muted">{e.actorRole || ''}</span></td>
                  <td className="py-2.5 px-2 font-mono text-xs">{e.action}</td>
                  <td className="py-2.5 px-2 text-muted">{e.entityType || '—'}</td>
                  <td className="py-2.5 px-2 text-muted max-w-[280px] truncate" title={JSON.stringify(e.detail)}>
                    {e.detail?.name || e.detail?.title || e.detail?.toStage || (Object.keys(e.detail || {}).length ? JSON.stringify(e.detail) : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
