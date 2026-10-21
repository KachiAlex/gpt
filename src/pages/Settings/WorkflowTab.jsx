import { useState, useEffect } from 'react';
import { Check, X, Plus, Trash2, Save } from 'lucide-react';
import { useInstance } from '../../contexts/InstanceContext';
import { instanceAPI } from '../../services/api';
import { showError, showSuccess } from '../../utils/toast';

const REVIEW_ROLES = [
  ['ME_OFFICER', 'M&E Officer'],
  ['GOVERNMENT_OFFICER', 'Government Officer'],
  ['GOVERNMENT_ADMIN', 'Administrator'],
];

export default function WorkflowTab() {
  const { stages: workflowStages, refreshWorkflow } = useInstance();
  const [wfStages, setWfStages] = useState([]);
  const [wfSaving, setWfSaving] = useState(false);
  const [configRequests, setConfigRequests] = useState([]);

  // Editable mid-chain stages (between Submitted and the Approved/Rejected terminals)
  useEffect(() => {
    setWfStages(
      workflowStages
        .filter((s) => !s.isTerminal && !['DRAFT', 'SUBMITTED'].includes(s.key))
        .map((s) => ({ key: s.key, label: s.label, allowedRoles: [...s.allowedRoles] }))
    );
  }, [workflowStages]);

  useEffect(() => {
    loadConfigRequests();
  }, []);

  const loadConfigRequests = async () => {
    try {
      const res = await instanceAPI.listRequests();
      if (res?.success) setConfigRequests(res.data.requests || []);
    } catch { /* queue may not exist pre-migration */ }
  };

  const wfToggleRole = (idx, role) =>
    setWfStages((prev) => prev.map((s, i) =>
      i === idx
        ? { ...s, allowedRoles: s.allowedRoles.includes(role) ? s.allowedRoles.filter((r) => r !== role) : [...s.allowedRoles, role] }
        : s
    ));

  const saveWorkflow = async () => {
    if (wfStages.some((s) => !s.label.trim() || s.allowedRoles.length === 0)) {
      showError('Every stage needs a label and at least one approving role.');
      return;
    }
    setWfSaving(true);
    try {
      const res = await instanceAPI.updateWorkflow(wfStages);
      if (res?.data?.pending) {
        showSuccess('Change submitted — awaiting approval from a second administrator');
        loadConfigRequests();
      } else {
        await refreshWorkflow();
        showSuccess('Review workflow updated');
      }
    } catch (e) {
      showError(e.message || 'Failed to save workflow');
    } finally {
      setWfSaving(false);
    }
  };

  const decideRequest = async (id, approve) => {
    try {
      const res = approve ? await instanceAPI.approveRequest(id) : await instanceAPI.rejectRequest(id);
      if (res?.success) {
        showSuccess(res.message || (approve ? 'Change applied' : 'Request rejected'));
        loadConfigRequests();
        if (approve) refreshWorkflow();
      } else {
        showError(res?.message || 'Action failed');
      }
    } catch (e) {
      showError(e.message || 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-2">Submission review workflow</h3>
        <p className="text-sm text-muted mb-6">
          Stages a contractor submission passes through between <strong>Submitted</strong> and <strong>Approved</strong>.
          Each stage lists the roles allowed to move a submission into it. Rejected is always available to those roles.
        </p>

        <div className="space-y-3">
          {wfStages.map((stage, idx) => (
            <div key={stage.key || idx} className="flex flex-wrap items-center gap-3 p-4 border border-border rounded-xl">
              <span className="text-xs font-bold text-muted w-6">{idx + 2}.</span>
              <input
                className="input flex-1 min-w-[160px]"
                value={stage.label}
                onChange={(e) => setWfStages((prev) => prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s)))}
                placeholder="Stage name"
                aria-label={`Stage ${idx + 1} name`}
              />
              <div className="flex flex-wrap gap-3">
                {REVIEW_ROLES.map(([role, label]) => (
                  <label key={role} className="flex items-center gap-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={stage.allowedRoles.includes(role)}
                      onChange={() => wfToggleRole(idx, role)}
                      className="accent-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWfStages((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 p-2 rounded-lg"
                aria-label={`Remove stage ${stage.label}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {wfStages.length === 0 && (
            <p className="text-sm text-muted p-4 border border-dashed border-border rounded-xl">
              No intermediate stages — submissions go straight from Submitted to Approved.
            </p>
          )}

          <button
            type="button"
            onClick={() => setWfStages((prev) => [...prev, { key: '', label: '', allowedRoles: ['ME_OFFICER'] }])}
            className="btn-secondary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add stage
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={saveWorkflow} disabled={wfSaving} className="btn-primary">
            <Save className="h-4 w-4 mr-2" />
            {wfSaving ? 'Saving…' : 'Save workflow'}
          </button>
        </div>
      </div>

      {/* Pending config-change requests (two-admin approval) */}
      {configRequests.filter((r) => r.status === 'PENDING').length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-ink mb-1">Pending approvals</h3>
          <p className="text-sm text-muted mb-4">Configuration changes awaiting a second administrator.</p>
          <div className="space-y-3">
            {configRequests.filter((r) => r.status === 'PENDING').map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-xl p-4">
                <div className="min-w-0">
                  <div className="font-medium text-ink capitalize">{r.kind} change</div>
                  <div className="text-xs text-muted">
                    requested by {r.requestedByEmail} · {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => decideRequest(r.id, true)} className="btn-primary !py-1.5 text-sm">
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </button>
                  <button type="button" onClick={() => decideRequest(r.id, false)} className="btn-secondary !py-1.5 text-sm">
                    <X className="h-4 w-4 mr-1" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
