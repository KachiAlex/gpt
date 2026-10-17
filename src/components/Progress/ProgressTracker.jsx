import { useState, useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  RefreshCw,
  BarChart3,
  FileText,
  Shield,
  XCircle
} from 'lucide-react';
import clsx from 'clsx';

const MILESTONE_STATUS_LABELS = {
  COMPLETED: 'Completed & Verified',
  IN_PROGRESS: 'In Progress',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-NG');
};

export default function ProgressTracker({ projectId, project, milestones = [], submissions = [] }) {
  const progressData = useMemo(() => {
    // --- Milestones ---
    const ms = Array.isArray(milestones) ? milestones : [];
    const totalMilestones = ms.length;
    const completedMilestones = ms.filter((m) => m.status === 'COMPLETED').length;
    const delayedMilestones = ms.filter((m) => m.status === 'DELAYED').length;
    const milestoneProgress = totalMilestones > 0
      ? ms.reduce((sum, m) => sum + (m.status === 'COMPLETED' ? 100 : Number(m.progress || 0)), 0) / totalMilestones
      : 0;

    // --- Submissions ---
    const subs = Array.isArray(submissions) ? submissions : [];
    const approved = subs.filter((s) => s.status === 'APPROVED').length;
    const rejected = subs.filter((s) => s.status === 'REJECTED' || s.status === 'FLAGGED').length;
    const pending = subs.length - approved - rejected;
    const approvalRate = subs.length > 0 ? (approved / subs.length) * 100 : 0;

    const sorted = [...subs].sort(
      (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    );
    const latestWithProgress = sorted.find((s) => s.progress !== null && s.progress !== undefined);
    const physicalProgress = latestWithProgress
      ? Number(latestWithProgress.progress)
      : Number(project?.progress || 0);

    // --- Trend: progress reported this month vs. earlier ---
    const now = new Date();
    const thisMonth = now.getFullYear() * 12 + now.getMonth();
    const thisMonthSubs = sorted.filter((s) => {
      const d = new Date(s.submittedAt || 0);
      return d.getFullYear() * 12 + d.getMonth() === thisMonth && s.progress != null;
    });
    const earlierSubs = sorted.filter((s) => {
      const d = new Date(s.submittedAt || 0);
      return d.getFullYear() * 12 + d.getMonth() < thisMonth && s.progress != null;
    });
    const avgThis = thisMonthSubs.length
      ? thisMonthSubs.reduce((sum, s) => sum + Number(s.progress), 0) / thisMonthSubs.length
      : physicalProgress;
    const avgPrev = earlierSubs.length
      ? earlierSubs.reduce((sum, s) => sum + Number(s.progress), 0) / earlierSubs.length
      : avgThis;
    const change = Math.round(avgThis - avgPrev);

    // --- Quality ---
    const scored = subs.filter((s) => s.qualityScore !== null && s.qualityScore !== undefined);
    const qualityScore = scored.length
      ? scored.reduce((sum, s) => sum + Number(s.qualityScore), 0) / scored.length
      : Number(project?.qualityScore || 0);

    // --- Timeline adherence: completed milestones on/before due date ---
    const completedWithDates = ms.filter((m) => m.status === 'COMPLETED' && m.dueDate && m.completedDate);
    const onTime = completedWithDates.filter(
      (m) => new Date(m.completedDate) <= new Date(m.dueDate)
    ).length;
    const timelineAdherence = completedWithDates.length > 0
      ? Math.round((onTime / completedWithDates.length) * 100)
      : delayedMilestones === 0 ? 100 : Math.max(0, 100 - delayedMilestones * 25);

    // --- Weighted overall ---
    const hasData = totalMilestones > 0 || subs.length > 0;
    const verifiedProgress = subs.length > 0 ? approvalRate : Number(project?.progress || 0);
    const overallProgress = hasData
      ? Math.round(milestoneProgress * 0.7 + physicalProgress * 0.2 + verifiedProgress * 0.1)
      : Number(project?.progress || 0);

    const confidence =
      subs.length >= 5 && approvalRate >= 70 ? 'HIGH'
      : subs.length >= 2 && approvalRate >= 40 ? 'MEDIUM'
      : 'LOW';

    return {
      overallProgress,
      milestoneProgress: Math.round(milestoneProgress),
      physicalProgress: Math.round(physicalProgress),
      verifiedProgress: Math.round(verifiedProgress),
      confidence,
      lastUpdate: sorted[0]?.submittedAt ? new Date(sorted[0].submittedAt) : null,
      breakdown: {
        milestones: {
          total: totalMilestones,
          completed: completedMilestones,
          pending: ms.filter((m) => m.status === 'PENDING').length,
          delayed: delayedMilestones,
        },
        submissions: { total: subs.length, approved, pending, rejected },
        verifications: {
          qualityScore: Number(qualityScore.toFixed(1)),
          timelineAdherence,
          approvalRate: Math.round(approvalRate),
        },
      },
      trends: { change },
    };
  }, [project, milestones, submissions]);

  const [activeView, setActiveView] = useState('overview');
  const [, setTick] = useState(0);
  const recalculate = () => setTick((t) => t + 1); // re-render (memo recomputes on prop change)

  const sortedMilestones = useMemo(
    () =>
      [...milestones].sort((a, b) => {
        const ao = a.orderIndex ?? a.order ?? 0;
        const bo = b.orderIndex ?? b.order ?? 0;
        return ao - bo;
      }),
    [milestones]
  );

  const timelineRows = sortedMilestones.map((m, i) => ({
    name: m.name,
    status:
      m.status === 'COMPLETED' ? 'completed'
      : m.status === 'IN_PROGRESS' ? 'in-progress'
      : m.status === 'DELAYED' ? 'delayed'
      : 'pending',
    statusLabel: MILESTONE_STATUS_LABELS[m.status] || m.status || 'Pending',
    date: formatDate(m.completedDate || m.dueDate),
    progress: Number(m.progress || 0),
    index: i,
  }));

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Progress Measurement</h3>
          <div className="flex items-center space-x-2">
            <span className={clsx(
              'px-2 py-1 rounded-full text-xs font-medium',
              progressData.confidence === 'HIGH' ? 'bg-green-100 text-green-800' :
              progressData.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            )}>
              {progressData.confidence} Confidence
            </span>
            <button
              onClick={recalculate}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Progress Display */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-200"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressData.overallProgress / 100)}`}
                  className="text-abia-600 transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{progressData.overallProgress}%</span>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900">Overall Progress</h4>
            <div className="flex items-center justify-center space-x-1 mt-1">
              {progressData.trends.change > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : progressData.trends.change < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
              <span className={clsx(
                'text-sm font-medium',
                progressData.trends.change > 0 ? 'text-green-600' :
                progressData.trends.change < 0 ? 'text-red-600' : 'text-gray-500'
              )}>
                {progressData.trends.change > 0 ? '+' : ''}{progressData.trends.change}% this month
              </span>
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Milestone Progress</h4>
            <p className="text-2xl font-bold text-blue-600">{progressData.milestoneProgress}%</p>
            <p className="text-sm text-gray-600">{progressData.breakdown.milestones.completed}/{progressData.breakdown.milestones.total} completed</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Physical Progress</h4>
            <p className="text-2xl font-bold text-green-600">{progressData.physicalProgress}%</p>
            <p className="text-sm text-gray-600">Contractor reported</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900">M&E Verified</h4>
            <p className="text-2xl font-bold text-purple-600">{progressData.verifiedProgress}%</p>
            <p className="text-sm text-gray-600">Approval rate</p>
          </div>
        </div>

        {/* Progress Breakdown */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="font-medium text-gray-900 mb-4">Progress Calculation Breakdown</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Milestone Completion</span>
                <span className="text-sm text-blue-700">70% weight</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${progressData.milestoneProgress}%` }}
                />
              </div>
              <p className="text-xs text-blue-700 mt-1">{progressData.milestoneProgress}% of milestones completed</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-900">Physical Progress</span>
                <span className="text-sm text-green-700">20% weight</span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${progressData.physicalProgress}%` }}
                />
              </div>
              <p className="text-xs text-green-700 mt-1">Latest contractor update</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">Quality Verification</span>
                <span className="text-sm text-purple-700">10% weight</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${progressData.verifiedProgress}%` }}
                />
              </div>
              <p className="text-xs text-purple-700 mt-1">M&E approval rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Status */}
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-4">Submission Status</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Submissions</span>
              <span className="font-semibold">{progressData.breakdown.submissions.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approved by M&E</span>
              <span className="font-semibold text-green-600">{progressData.breakdown.submissions.approved}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending Review</span>
              <span className="font-semibold text-yellow-600">{progressData.breakdown.submissions.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Rejected</span>
              <span className="font-semibold text-red-600">{progressData.breakdown.submissions.rejected}</span>
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-4">Quality Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Quality Score</span>
              <div className="flex items-center space-x-1">
                <Award className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold">{progressData.breakdown.verifications.qualityScore}/5.0</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Timeline Adherence</span>
              <span className="font-semibold">{progressData.breakdown.verifications.timelineAdherence}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approval Rate</span>
              <span className="font-semibold">{progressData.breakdown.verifications.approvalRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="font-semibold">
                {progressData.lastUpdate ? progressData.lastUpdate.toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Formula Explanation */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-4">How Progress is Measured</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Contractor Submissions</h5>
                <p className="text-sm text-gray-600">
                  Contractors submit progress updates, milestone completions, and quality reports with photos and documentation.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-green-600 font-bold text-xs">2</span>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">M&E Verification</h5>
                <p className="text-sm text-gray-600">
                  M&E officers review submissions, conduct site inspections, and approve or reject progress claims.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-purple-600 font-bold text-xs">3</span>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Weighted Calculation</h5>
                <p className="text-sm text-gray-600">
                  Overall progress = (Milestone Completion × 70%) + (Physical Progress × 20%) + (Quality Verification × 10%)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-900">Confidence Level: {progressData.confidence}</h5>
              <p className="text-sm text-blue-700">
                Based on submission frequency, approval rates, and recent activity.
                {progressData.confidence === 'HIGH' ? ' Regular updates with high approval rates.' :
                 progressData.confidence === 'MEDIUM' ? ' Moderate activity with some concerns.' :
                 ' Limited data or low approval rates - requires attention.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-6">Milestone Progress Timeline</h4>
        {timelineRows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No milestones defined for this project yet.</p>
        ) : (
          <div className="space-y-4">
            {timelineRows.map((milestone) => (
              <div key={milestone.index} className="flex items-center space-x-4">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  milestone.status === 'completed' ? 'bg-green-500 text-white' :
                  milestone.status === 'in-progress' ? 'bg-yellow-500 text-white' :
                  milestone.status === 'delayed' ? 'bg-red-500 text-white' :
                  'bg-gray-200 text-gray-500'
                )}>
                  {milestone.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : milestone.status === 'in-progress' ? (
                    <Clock className="h-4 w-4" />
                  ) : milestone.status === 'delayed' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-xs">{milestone.index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-900">{milestone.name}</h5>
                    <span className="text-xs text-gray-500">{milestone.progress}% complete</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={clsx(
                      'text-sm',
                      milestone.status === 'completed' ? 'text-green-600' :
                      milestone.status === 'in-progress' ? 'text-yellow-600' :
                      milestone.status === 'delayed' ? 'text-red-600' :
                      'text-gray-500'
                    )}>
                      {milestone.statusLabel}
                    </span>
                    <span className="text-sm text-gray-500">{milestone.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
