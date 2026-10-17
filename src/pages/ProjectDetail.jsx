import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil, FileText, Check, X, HardHat, ShieldCheck, Download, Plus, Trash2, Globe } from 'lucide-react';
import clsx from 'clsx';
import { projectAPI, contractorAPI, documentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusPill from '../components/ui/StatusPill';
import ProgressBar from '../components/ui/ProgressBar';
import { categoryLabel, fmtNaira, fmtDate, areaLabel, currency } from '../utils/statusMap';
import { showSuccess, showError } from '../utils/toast';

// Map a milestone + its submissions to a review state for the timeline
const milestoneState = (m, submissions) => {
  if (m.status === 'COMPLETED') return 'approved';
  const hasPending = submissions.some(
    (s) => (s.milestoneId === m.id || s.milestone?.id === m.id) && ['PENDING', 'UNDER_REVIEW'].includes(s.status)
  );
  if (hasPending || m.status === 'IN_PROGRESS') return 'awaiting';
  return 'not-started';
};

const milestoneStatusLabel = { approved: 'Approved', awaiting: 'Awaiting review', 'not-started': 'Not started' };
const milestoneStatusClass = { approved: 'status-completed', awaiting: 'status-in-progress', 'not-started': 'status-not-started' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, canAccessAdminFeatures } = useAuth();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(null); // { mode: 'create'|'edit', milestone? }
  const [milestoneForm, setMilestoneForm] = useState({});
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [deletingMilestone, setDeletingMilestone] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    try {
      const res = await projectAPI.getById(id);
      if (res?.success) {
        const p = res.data.project;
        setProject(p);
        if (p.contractorId) {
          contractorAPI.getPerformance(p.contractorId)
            .then((r) => r?.success && setPerformance(r.data?.performance || r.data))
            .catch(() => {});
        }
      } else {
        setError('Project not found');
      }
      documentAPI.getByProject(id)
        .then((r) => r?.success && setDocuments(r.data?.documents || []))
        .catch(() => {});
    } catch (e) {
      setError(e.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="py-12 text-center text-muted">Loading project…</div>;
  }

  if (error || !project) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold text-ink">Project not found</h2>
        <p className="text-muted mt-2">{error || "The project you're looking for doesn't exist."}</p>
        <Link to="/projects" className="btn-primary mt-4">Back to Projects</Link>
      </div>
    );
  }

  const milestones = (project.milestones || []).slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const submissions = project.recentSubmissions || [];
  const approvedCount = milestones.filter((m) => m.status === 'COMPLETED').length;
  const lgaText = Array.isArray(project.lga) ? project.lga.join(', ') : project.lga;
  const contractor = project.contractor;

  const openEdit = () => {
    setEditForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      progress: project.progress,
    });
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await projectAPI.update(id, { ...editForm, progress: Number(editForm.progress) });
      if (res?.success) {
        showSuccess('Project updated');
        setIsEditOpen(false);
        await load();
      }
    } catch (e) {
      showError(e.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const canManage = canAccessAdminFeatures() || project.projectManagerId === user?.id;
  const canPublish = user && ['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER'].includes(user.role);

  const togglePublish = async () => {
    setPublishing(true);
    try {
      const res = project.isPublic ? await projectAPI.unpublish(id) : await projectAPI.publish(id);
      if (res?.success) {
        setProject({ ...project, ...res.data.project });
        showSuccess(project.isPublic ? 'Removed from the public portal' : 'Published to the public portal');
      }
    } catch (e) {
      showError(e.message || 'Publication update failed');
    } finally {
      setPublishing(false);
    }
  };

  const openMilestoneModal = (mode, milestone) => {
    setMilestoneForm(mode === 'edit'
      ? {
          name: milestone.name,
          description: milestone.description || '',
          dueDate: milestone.dueDate ? String(milestone.dueDate).slice(0, 10) : '',
          status: milestone.status,
          progress: milestone.progress ?? 0,
          budget: milestone.budget ?? '',
          orderIndex: milestone.orderIndex ?? '',
        }
      : { name: '', description: '', dueDate: '', budget: '', orderIndex: '' });
    setMilestoneModal({ mode, milestone });
  };

  const saveMilestone = async () => {
    if (!milestoneForm.name?.trim()) {
      showError('Milestone name is required');
      return;
    }
    setSavingMilestone(true);
    try {
      const payload = {
        name: milestoneForm.name.trim(),
        description: milestoneForm.description || null,
        dueDate: milestoneForm.dueDate || null,
        budget: milestoneForm.budget !== '' && milestoneForm.budget != null ? Number(milestoneForm.budget) : null,
        orderIndex: milestoneForm.orderIndex !== '' ? Number(milestoneForm.orderIndex) : undefined,
      };
      if (milestoneModal.mode === 'edit') {
        payload.status = milestoneForm.status;
        payload.progress = milestoneForm.progress !== '' ? Number(milestoneForm.progress) : 0;
      }
      const res = milestoneModal.mode === 'edit'
        ? await projectAPI.updateMilestone(id, milestoneModal.milestone.id, payload)
        : await projectAPI.addMilestone(id, payload);
      if (res?.success) {
        showSuccess(milestoneModal.mode === 'edit' ? 'Milestone updated' : 'Milestone added');
        setMilestoneModal(null);
        await load();
      }
    } catch (e) {
      showError(e.message || 'Failed to save milestone');
    } finally {
      setSavingMilestone(false);
    }
  };

  const deleteMilestone = async (milestone) => {
    if (!window.confirm(`Delete milestone "${milestone.name}"? This cannot be undone.`)) return;
    setDeletingMilestone(milestone.id);
    try {
      const res = await projectAPI.deleteMilestone(id, milestone.id);
      if (res?.success) {
        showSuccess('Milestone deleted');
        await load();
      }
    } catch (e) {
      showError(e.message || 'Failed to delete milestone');
    } finally {
      setDeletingMilestone(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted flex flex-wrap gap-1.5 items-center">
        <Link to="/projects" className="text-soft-fg font-medium">Projects</Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink font-semibold">{project.name}</span>
      </nav>

      {/* Title + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill status={project.status} />
            <span className="status-badge text-primary-800 bg-primary-100 dark:bg-soft dark:text-soft-fg">{categoryLabel(project.category)}</span>
            {project.isPublic
              ? <span className="status-badge text-green-800 bg-green-100 dark:bg-green-950/40 dark:text-green-300">Public</span>
              : <span className="status-badge text-muted bg-hoverbg">Internal — not public</span>}
          </div>
          <h1 className="mt-2.5 mb-0 font-extrabold text-[32px] leading-tight tracking-[-0.015em] text-brand">{project.name}</h1>
          {project.description && (
            <p className="mt-1.5 mb-0 text-muted text-base max-w-[680px]">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canPublish && (
            <button type="button" onClick={togglePublish} disabled={publishing} className="btn-secondary">
              <Globe className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {publishing ? 'Updating…' : project.isPublic ? 'Unpublish' : 'Publish'}
            </button>
          )}
          {canManage && (
            <button type="button" onClick={openEdit} className="btn-secondary">
              <Pencil className="w-[18px] h-[18px]" strokeWidth={1.75} />
              Edit project
            </button>
          )}
          <Link to="/reports" className="btn-primary">
            <FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />
            Generate report
          </Link>
        </div>
      </div>

      {/* Facts strip */}
      <section className="bg-surface border border-border rounded-2xl px-6 py-[22px] grid grid-cols-2 md:grid-cols-5 gap-5">
        <div>
          <div className="text-[13px] text-muted">{areaLabel()}</div>
          <div className="mt-0.5 font-semibold">{lgaText || '—'}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Budget</div>
          <div className="mt-0.5 font-extrabold text-xl text-brand">{fmtNaira(project.allocatedBudget || project.budget)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Start date</div>
          <div className="mt-0.5 font-semibold">{fmtDate(project.startDate)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Planned end</div>
          <div className="mt-0.5 font-semibold">{fmtDate(project.expectedEndDate)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Contractor</div>
          <div className="mt-0.5 font-semibold flex items-center gap-1.5">
            {contractor?.companyName || '—'}
            {contractor?.isVerified && (
              <ShieldCheck className="w-4 h-4 text-green-700" aria-label="Verified contractor" />
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-6 items-start">
        {/* Left column */}
        <div className="flex-[3_1_520px] min-w-0 flex flex-col gap-6">
          {/* Verified progress */}
          <section className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-title">Verified progress</h2>
              <span className="font-extrabold text-[30px] text-brand">{project.progress || 0}%</span>
            </div>
            <ProgressBar progress={project.progress} status={project.status} height={14} className="mt-3.5" />
            <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span>Based on {approvedCount} approved milestone{approvedCount === 1 ? '' : 's'} of {milestones.length}</span>
              <span>{project.expectedEndDate ? `Due ${fmtDate(project.expectedEndDate)}` : ''}</span>
            </div>
          </section>

          {/* Milestones timeline */}
          <section className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Milestones</h2>
              {canManage && (
                <button type="button" onClick={() => openMilestoneModal('create')} className="btn-secondary !min-h-[38px] !px-3 text-sm">
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                  Add milestone
                </button>
              )}
            </div>
            {milestones.length === 0 ? (
              <p className="mt-4 text-muted text-sm">No milestones defined yet.{canManage ? ' Add one to start tracking verified progress.' : ''}</p>
            ) : (
              <ol className="list-none m-0 mt-5 p-0 flex flex-col">
                {milestones.map((m, i) => {
                  const state = milestoneState(m, submissions);
                  const last = i === milestones.length - 1;
                  return (
                    <li key={m.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        {state === 'approved' ? (
                          <span className="w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center flex-none">
                            <Check className="w-[18px] h-[18px]" strokeWidth={3} />
                          </span>
                        ) : state === 'awaiting' ? (
                          <span className="w-8 h-8 rounded-full bg-surface border-[3px] border-primary-600 flex items-center justify-center flex-none">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />
                          </span>
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-surface border-2 border-slate-300 dark:border-border flex-none" />
                        )}
                        {!last && (
                          <span className={clsx('flex-1 w-0.5 my-1', state === 'approved' ? 'bg-green-700' : 'bg-slate-300 dark:bg-border')} />
                        )}
                      </div>
                      <div className={clsx('flex-1 min-w-0', !last && 'pb-[22px]')}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className={clsx('font-semibold', state === 'not-started' && 'text-muted')}>
                            {i + 1} · {m.name}
                          </span>
                          <span className={milestoneStatusClass[state]}>{milestoneStatusLabel[state]}</span>
                        </div>
                        <div className="text-sm text-muted">
                          {m.completedDate
                            ? `Completed ${fmtDate(m.completedDate)} · reviewed by M&E`
                            : m.dueDate
                              ? `Due ${fmtDate(m.dueDate)}`
                              : ''}
                          {m.description ? ` — ${m.description}` : ''}
                        </div>
                        {canManage && (
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openMilestoneModal('edit', m)}
                              className="inline-flex items-center gap-1 text-[13px] font-semibold text-soft-fg min-h-[32px] px-1.5 rounded-md hover:bg-hoverbg"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMilestone(m)}
                              disabled={deletingMilestone === m.id}
                              className="inline-flex items-center gap-1 text-[13px] font-semibold text-red-700 dark:text-red-400 min-h-[32px] px-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {deletingMilestone === m.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="flex-[2_1_300px] min-w-0 flex flex-col gap-6">
          {/* Contractor */}
          <section className="bg-surface border border-border rounded-2xl px-6 py-[22px]">
            <h2 className="section-title">Contractor</h2>
            {contractor ? (
              <>
                <div className="mt-3.5 flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-soft text-soft-fg flex items-center justify-center">
                    <HardHat className="w-[22px] h-[22px]" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="font-semibold">{contractor.companyName}</div>
                    {contractor.isVerified && <div className="text-[13.5px] text-green-700 dark:text-green-400 font-semibold">Verified</div>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-bg rounded-xl p-3">
                    <div className="font-extrabold text-xl text-brand">{performance?.completionRate ?? '—'}%</div>
                    <div className="text-[13px] text-muted">Completion rate</div>
                  </div>
                  <div className="bg-bg rounded-xl p-3">
                    <div className="font-extrabold text-xl text-brand">{performance?.approvalRate ?? '—'}%</div>
                    <div className="text-[13px] text-muted">Approval rate</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-muted text-sm">No contractor assigned yet.</p>
            )}
          </section>

          {/* Documents */}
          <section className="bg-surface border border-border rounded-2xl px-6 py-[22px]">
            <h2 className="section-title">Documents</h2>
            {documents.length === 0 ? (
              <p className="mt-3 text-muted text-sm">No documents uploaded.</p>
            ) : (
              <div className="mt-2.5 flex flex-col">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => documentAPI.download(doc.id, doc.originalName || doc.fileName || 'document')}
                    className="min-h-[52px] flex items-center gap-3 border-t border-border first:border-t-0 text-left w-full"
                  >
                    <FileText className="w-5 h-5 text-soft-fg flex-none" strokeWidth={1.75} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{doc.originalName || doc.fileName}</span>
                      <span className="text-[13px] text-muted">Uploaded {fmtDate(doc.createdAt)}</span>
                    </span>
                    <Download className="w-4 h-4 text-muted flex-none" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Edit modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsEditOpen(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="m-0 font-bold text-xl">Edit project</h2>
              <button onClick={() => setIsEditOpen(false)} className="w-11 h-11 rounded-xl text-muted hover:bg-hoverbg flex items-center justify-center" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label" htmlFor="ep-name">Name</label>
                <input id="ep-name" className="input" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="ep-desc">Description</label>
                <textarea id="ep-desc" rows={3} className="input h-auto py-3 resize-y" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="ep-status">Status</label>
                  <select id="ep-status" className="select" value={editForm.status || ''} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    {['NOT_STARTED', 'IN_PROGRESS', 'NEAR_COMPLETION', 'COMPLETED', 'DELAYED', 'ON_HOLD', 'CANCELLED'].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ep-progress">Progress %</label>
                  <input id="ep-progress" type="number" min={0} max={100} className="input" value={editForm.progress ?? 0} onChange={(e) => setEditForm({ ...editForm, progress: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone modal */}
      {milestoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMilestoneModal(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="m-0 font-bold text-xl">{milestoneModal.mode === 'edit' ? 'Edit milestone' : 'Add milestone'}</h2>
              <button onClick={() => setMilestoneModal(null)} className="w-11 h-11 rounded-xl text-muted hover:bg-hoverbg flex items-center justify-center" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label" htmlFor="ms-name">Name</label>
                <input id="ms-name" className="input" value={milestoneForm.name || ''} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} placeholder="e.g. Foundation works" />
              </div>
              <div>
                <label className="label" htmlFor="ms-desc">Description</label>
                <textarea id="ms-desc" rows={2} className="input h-auto py-3 resize-y" value={milestoneForm.description || ''} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="ms-due">Due date</label>
                  <input id="ms-due" type="date" className="input" value={milestoneForm.dueDate || ''} onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="ms-order">Order</label>
                  <input id="ms-order" type="number" min={0} className="input" value={milestoneForm.orderIndex ?? ''} onChange={(e) => setMilestoneForm({ ...milestoneForm, orderIndex: e.target.value })} placeholder="Auto" />
                </div>
                <div>
                  <label className="label" htmlFor="ms-budget">Budget ({currency()})</label>
                  <input id="ms-budget" type="number" min={0} className="input" value={milestoneForm.budget ?? ''} onChange={(e) => setMilestoneForm({ ...milestoneForm, budget: e.target.value })} placeholder="Optional" />
                </div>
                {milestoneModal.mode === 'edit' && (
                  <>
                    <div>
                      <label className="label" htmlFor="ms-status">Status</label>
                      <select id="ms-status" className="select" value={milestoneForm.status || 'PENDING'} onChange={(e) => setMilestoneForm({ ...milestoneForm, status: e.target.value })}>
                        {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED'].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="ms-progress">Progress %</label>
                      <input id="ms-progress" type="number" min={0} max={100} className="input" value={milestoneForm.progress ?? 0} onChange={(e) => setMilestoneForm({ ...milestoneForm, progress: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setMilestoneModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={saveMilestone} disabled={savingMilestone} className="btn-primary flex-1">
                  {savingMilestone ? 'Saving…' : milestoneModal.mode === 'edit' ? 'Save changes' : 'Add milestone'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
