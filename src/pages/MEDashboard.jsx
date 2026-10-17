import { useState, useEffect, useMemo } from 'react';
import { Check, X, FileText, ClipboardCheck, Inbox } from 'lucide-react';
import clsx from 'clsx';
import { submissionAPI, documentAPI, projectAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useInstance } from '../contexts/InstanceContext';
import EmptyState from '../components/ui/EmptyState';
import { statusLabel, fmtNairaCompact, fmtAgo } from '../utils/statusMap';
import { stageLabel } from '../services/instance';
import { showSuccess, showError } from '../utils/toast';

const QUEUE_STATUSES = ['PENDING', 'UNDER_REVIEW', 'REQUIRES_CLARIFICATION'];
const DECIDED = { APPROVED: 'Approved', REJECTED: 'Returned', FLAGGED: 'Flagged' };

const subStatusClass = (s) =>
  s === 'APPROVED' ? 'status-completed'
  : s === 'REJECTED' || s === 'FLAGGED' ? 'status-delayed'
  : 'status-in-progress';

export default function MEDashboard() {
  const { user } = useAuth();
  const { stages = [] } = useInstance();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      const res = await submissionAPI.getAll();
      const list = res?.data?.submissions || [];
      list.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
      setSubmissions(list);
      return list;
    } catch (e) {
      showError(e.message || 'Failed to load submissions');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().then((list) => {
      const first = list.find((s) => QUEUE_STATUSES.includes(s.status));
      if (first) setSelectedId(first.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch full submission details (milestone, documents) + project facts on selection
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let isMounted = true;
    setDetail(null);
    submissionAPI.getById(selectedId)
      .then(async (res) => {
        const d = res?.data?.submission;
        if (!isMounted || !d) return;
        let projectFacts = null;
        if (d.project?.id) {
          try {
            const pRes = await projectAPI.getById(d.project.id);
            const p = pRes?.data?.project;
            if (p) {
              projectFacts = {
                progress: p.progress,
                budget: p.allocatedBudget || p.budget,
              };
            }
          } catch { /* facts stay null */ }
        }
        if (isMounted) {
          setDetail({ ...d, projectFacts });
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [selectedId]);

  const selected = submissions.find((s) => s.id === selectedId) || null;

  // Workflow-driven: resolve the submission's stage and the configured next step
  const chain = stages.filter((s) => s.mapsToStatus !== 'REJECTED');
  const stageOf = (s) =>
    s.stage || (s.status === 'APPROVED' ? 'APPROVED' : s.status === 'REJECTED' ? 'REJECTED' : 'SUBMITTED');
  const isTerminal = (s) =>
    stages.find((st) => st.key === stageOf(s))?.isTerminal ?? ['APPROVED', 'REJECTED', 'FLAGGED'].includes(s.status);
  const undecided = selected && !isTerminal(selected);
  const next = selected && undecided
    ? chain[chain.findIndex((s) => s.key === stageOf(selected)) + 1] || null
    : null;

  const stats = useMemo(() => {
    const pending = submissions.filter((s) => QUEUE_STATUSES.includes(s.status)).length;
    const weekAgo = Date.now() - 7 * 864e5;
    const reviewedWeek = submissions.filter(
      (s) => ['APPROVED', 'REJECTED'].includes(s.status) && new Date(s.reviewedAt || s.updatedAt || 0).getTime() > weekAgo
    ).length;
    const decided = submissions.filter((s) => ['APPROVED', 'REJECTED'].includes(s.status));
    const rate = decided.length ? Math.round((decided.filter((s) => s.status === 'APPROVED').length / decided.length) * 100) : null;
    return { pending, reviewedWeek, rate };
  }, [submissions]);

  const act = async (toStage) => {
    if (!selected) return;
    if (toStage === 'REJECTED' && !comments.trim()) {
      showError('Add a comment explaining what to fix before returning.');
      return;
    }
    setActing(true);
    try {
      const res = await submissionAPI.transition(selected.id, toStage, comments.trim() || undefined);
      if (res?.success) {
        showSuccess(toStage === 'APPROVED' ? 'Submission approved' : toStage === 'REJECTED' ? 'Returned to the contractor' : `Moved to ${toStage.toLowerCase().replace('_', ' ')}`);
        setComments('');
        await load();
      }
    } catch (e) {
      showError(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted">Loading review queue…</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="page-title">Review queue</h1>
        <p className="mt-1 text-muted text-base">
          Check each contractor submission against its documents, then approve it or send it back with comments.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <section className="bg-surface border border-border rounded-[14px] px-5 py-4">
          <div className="text-sm text-muted">Awaiting review</div>
          <div className="mt-0.5 font-extrabold text-[28px] text-brand">{stats.pending}</div>
        </section>
        <section className="bg-surface border border-border rounded-[14px] px-5 py-4">
          <div className="text-sm text-muted">Reviewed this week</div>
          <div className="mt-0.5 font-extrabold text-[28px]">{stats.reviewedWeek}</div>
        </section>
        <section className="bg-surface border border-border rounded-[14px] px-5 py-4">
          <div className="text-sm text-muted">Approval rate</div>
          <div className="mt-0.5 font-extrabold text-[28px]">{stats.rate === null ? '—' : `${stats.rate}%`}</div>
        </section>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          body="There are no contractor submissions yet. When contractors report progress on their milestones, the submissions will appear here for review."
        />
      ) : (
        <div className="flex flex-wrap gap-6 items-start">
          {/* Queue */}
          <section aria-label="Submissions" className="flex-[2_1_340px] min-w-0 bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border font-bold text-base">Submissions</div>
            {submissions.map((s) => {
              const sel = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-pressed={sel}
                  className={clsx(
                    'w-full text-left border-b border-border border-l-4 px-5 py-4 cursor-pointer flex flex-col gap-1.5 text-ink min-h-[44px]',
                    sel ? 'bg-soft border-l-primary-600' : 'border-l-transparent hover:bg-hoverbg'
                  )}
                >
                  <span className="flex items-center justify-between gap-2.5">
                    <span className="font-bold truncate">{s.project?.name || 'Project'}</span>
                    <span className={clsx('flex-none', subStatusClass(s.status))}>{s.stage ? stageLabel(s.stage) : DECIDED[s.status] || statusLabel(s.status)}</span>
                  </span>
                  <span className="text-sm text-muted truncate">
                    {s.milestone?.name || s.title} · {s.contractor?.companyName || '—'}
                  </span>
                  <span className="text-[13px] text-muted">{fmtAgo(s.submittedAt || s.createdAt)}</span>
                </button>
              );
            })}
          </section>

          {/* Review panel */}
          <section aria-label="Review submission" className="flex-[3_1_460px] min-w-0 bg-surface border border-border rounded-2xl px-7 py-[26px] flex flex-col gap-5">
            {!selected ? (
              <EmptyState icon={ClipboardCheck} title="Select a submission" body="Pick a submission from the queue to review it." />
            ) : (
              <>
                <div>
                  <div className="text-[13px] font-semibold text-soft-fg tracking-[0.04em] uppercase">
                    {detail?.milestone?.name || selected.type || 'Submission'}
                  </div>
                  <h2 className="mt-1 mb-0 font-extrabold text-2xl leading-snug text-brand">
                    {selected.project?.name || selected.title}
                  </h2>
                  <div className="mt-1 text-muted text-[15px]">
                    {Array.isArray(selected.project?.lga) ? selected.project.lga.join(', ') : selected.project?.lga || '—'}
                    {' · '}{selected.contractor?.companyName || '—'}
                    {' · '}{fmtAgo(selected.submittedAt || selected.createdAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-bg rounded-xl px-3.5 py-3">
                    <div className="text-[13px] text-muted">Progress claimed</div>
                    <div className="font-extrabold text-[22px] text-brand">{selected.progress ?? '—'}%</div>
                  </div>
                  <div className="bg-bg rounded-xl px-3.5 py-3">
                    <div className="text-[13px] text-muted">Last verified</div>
                    <div className="font-extrabold text-[22px]">{detail?.projectFacts?.progress ?? '…'}%</div>
                  </div>
                  <div className="bg-bg rounded-xl px-3.5 py-3">
                    <div className="text-[13px] text-muted">Budget</div>
                    <div className="font-extrabold text-[22px]">{detail?.projectFacts ? fmtNairaCompact(detail.projectFacts.budget) : '…'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="m-0 font-bold text-base">Contractor's note</h3>
                  <p className="mt-1.5 mb-0 text-ink text-base">
                    {selected.description || 'No note provided.'}
                  </p>
                </div>

                {(detail?.documents?.length || selected.documents?.length || selected.files?.length) ? (
                  <div>
                    <h3 className="m-0 font-bold text-base">Documents</h3>
                    <div className="mt-2 flex flex-col gap-2">
                      {(detail?.documents || selected.documents || selected.files || []).map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => documentAPI.download(doc.id, doc.originalName || doc.fileName || 'document')}
                          className="min-h-[48px] flex items-center gap-3 px-3.5 border border-border rounded-xl hover:bg-hoverbg text-left"
                        >
                          <FileText className="w-5 h-5 text-soft-fg flex-none" strokeWidth={1.75} />
                          <span className="flex-1 font-medium truncate">{doc.originalName || doc.fileName}</span>
                          <span className="text-[13px] text-muted">Download</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {undecided ? (
                  <div>
                    <label htmlFor="rv-comment" className="font-bold text-base">Comments</label>
                    <textarea
                      id="rv-comment"
                      rows={3}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Required if you return the submission. Optional when approving."
                      className="input mt-2 w-full h-auto py-3 resize-y"
                    />
                    <div className="mt-3.5 flex flex-wrap gap-3">
                      {next && (
                        <button
                          type="button"
                          onClick={() => act(next.key)}
                          disabled={acting}
                          className="min-h-[50px] inline-flex items-center gap-2 px-[26px] rounded-xl bg-green-700 text-white text-base font-bold hover:bg-green-800 disabled:opacity-50"
                        >
                          <Check className="w-5 h-5" strokeWidth={2.5} />
                          {next.mapsToStatus === 'APPROVED' ? 'Approve' : `Move to ${next.label.toLowerCase()}`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => act('REJECTED')}
                        disabled={acting}
                        className="min-h-[50px] inline-flex items-center gap-2 px-[26px] rounded-xl border-[1.5px] border-red-800 bg-surface text-red-900 dark:text-red-300 text-base font-bold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                      >
                        <X className="w-5 h-5" strokeWidth={2.5} />
                        Return with comments
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    role="status"
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-4 py-3.5',
                      selected.status === 'APPROVED' ? 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200' : 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                    )}
                  >
                    <span className="font-bold text-base">
                      {selected.status === 'APPROVED'
                        ? 'Approved. The contractor and the public portal will see the verified progress.'
                        : 'Returned to the contractor with your comments.'}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
