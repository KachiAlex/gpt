import { X, FileText, Calendar, User, TrendingUp, Download, BarChart3 } from 'lucide-react';
import { fmtNairaCompact } from '../../utils/statusMap';

const STATUS_LABELS = {
 NOT_STARTED: 'Not Started',
 IN_PROGRESS: 'In Progress',
 NEAR_COMPLETION: 'Near Completion',
 COMPLETED: 'Completed',
 DELAYED: 'Delayed',
 ON_HOLD: 'On Hold',
 CANCELLED: 'Cancelled',
};

const CATEGORY_LABELS = {
 TRANSPORTATION: 'Transportation',
 HEALTHCARE: 'Healthcare',
 EDUCATION: 'Education',
 WATER_SANITATION: 'Water & Sanitation',
 HOUSING: 'Housing',
 AGRICULTURE: 'Agriculture',
 ENERGY: 'Energy',
 ICT: 'ICT',
 TOURISM: 'Tourism',
 ENVIRONMENT: 'Environment',
};

const typeColors = {
 MONTHLY: 'bg-soft text-soft-fg border-border',
 QUARTERLY: 'bg-green-50 dark:bg-green-950/40 text-green-700 border-green-200',
 ANNUAL: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200',
 SPECIAL: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200',
 CUSTOM: 'bg-bg text-ink border-border',
};

const formatNaira = fmtNairaCompact;

const formatDate = (value) => {
 if (!value) return '—';
 const d = new Date(value);
 return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', {
 year: 'numeric', month: 'long', day: 'numeric',
 });
};

const titleCase = (value) =>
 value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';

export default function GeneratedReportModal({ report, isOpen, onClose, onDownload }) {
 if (!isOpen || !report) return null;

 const data = report.data || {};
 const statusEntries = Object.entries(data.byStatus || {});
 const categoryEntries = Object.entries(data.byCategory || {});
 const projects = Array.isArray(data.projects) ? data.projects : [];
 const financials = data.financials;
 const contractors = Array.isArray(data.contractors) ? data.contractors : [];

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className="bg-surface rounded-lg shadow-sm max-w-5xl w-full max-h-[90vh] overflow-hidden">
 {/* Header */}
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${typeColors[report.type] || typeColors.CUSTOM}`}>
 <FileText className="h-6 w-6" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-ink">{report.title}</h2>
 <div className="flex items-center space-x-4 mt-1">
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[report.type] || typeColors.CUSTOM}`}>
 {titleCase(report.type)}
 </span>
 {report.category && (
 <span className="px-2 py-1 rounded-full text-xs font-medium bg-hoverbg text-ink">
 {report.category}
 </span>
 )}
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${report.isPublic ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300'}`}>
 {report.isPublic ? 'Published' : 'Draft'}
 </span>
 </div>
 </div>
 </div>
 <button
 onClick={onClose}
 className="text-muted hover:text-muted transition-colors"
 >
 <X className="h-6 w-6" />
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

 {/* Main Content */}
 <div className="lg:col-span-2 space-y-6">

 {/* Summary */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Summary</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-soft p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <BarChart3 className="h-5 w-5 text-soft-fg" />
 <span className="text-sm font-medium text-blue-900">Projects Covered</span>
 </div>
 <div className="text-2xl font-bold text-soft-fg">{data.projectCount ?? 0}</div>
 </div>
 <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-400" />
 <span className="text-sm font-medium text-green-900">Avg. Progress</span>
 </div>
 <div className="text-2xl font-bold text-green-700 dark:text-green-400">
 {Number(data.averageProgress || 0).toFixed(1)}%
 </div>
 </div>
 <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <Calendar className="h-5 w-5 text-purple-700 dark:text-purple-400" />
 <span className="text-sm font-medium text-purple-900">Scope</span>
 </div>
 <div className="text-lg font-bold text-purple-700 dark:text-purple-400">{titleCase(data.scope || 'all')}</div>
 </div>
 </div>
 </div>

 {/* Status / Category breakdown */}
 {(statusEntries.length > 0 || categoryEntries.length > 0) && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Breakdown</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {statusEntries.length > 0 && (
 <div className="bg-bg p-4 rounded-lg">
 <h4 className="text-sm font-medium text-ink mb-3">By Status</h4>
 <div className="space-y-2">
 {statusEntries.map(([status, count]) => (
 <div key={status} className="flex items-center justify-between text-sm">
 <span className="text-muted">{STATUS_LABELS[status] || status}</span>
 <span className="font-semibold text-ink">{count}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 {categoryEntries.length > 0 && (
 <div className="bg-bg p-4 rounded-lg">
 <h4 className="text-sm font-medium text-ink mb-3">By Category</h4>
 <div className="space-y-2">
 {categoryEntries.map(([category, count]) => (
 <div key={category} className="flex items-center justify-between text-sm">
 <span className="text-muted">{CATEGORY_LABELS[category] || category}</span>
 <span className="font-semibold text-ink">{count}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Projects table */}
 {projects.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Projects ({projects.length})</h3>
 <div className="border border-border rounded-lg overflow-hidden">
 <div className="max-h-64 overflow-y-auto">
 <table className="min-w-full text-sm">
 <thead className="bg-bg sticky top-0">
 <tr>
 <th className="text-left py-2 px-3 font-medium text-ink">Project</th>
 <th className="text-left py-2 px-3 font-medium text-ink">Status</th>
 <th className="text-left py-2 px-3 font-medium text-ink">Progress</th>
 <th className="text-left py-2 px-3 font-medium text-ink">Budget</th>
 </tr>
 </thead>
 <tbody>
 {projects.map((p) => (
 <tr key={p.id} className="border-t border-border">
 <td className="py-2 px-3 text-ink">{p.name}</td>
 <td className="py-2 px-3 text-muted">{STATUS_LABELS[p.status] || p.status}</td>
 <td className="py-2 px-3 text-muted">{p.progress}%</td>
 <td className="py-2 px-3 text-muted">{formatNaira(p.budget)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Contractors */}
 {contractors.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Contractors ({contractors.length})</h3>
 <div className="border border-border rounded-lg overflow-hidden">
 <div className="max-h-48 overflow-y-auto">
 <table className="min-w-full text-sm">
 <thead className="bg-bg sticky top-0">
 <tr>
 <th className="text-left py-2 px-3 font-medium text-ink">Company</th>
 <th className="text-left py-2 px-3 font-medium text-ink">Rating</th>
 <th className="text-left py-2 px-3 font-medium text-ink">Verified</th>
 </tr>
 </thead>
 <tbody>
 {contractors.map((c) => (
 <tr key={c.id} className="border-t border-border">
 <td className="py-2 px-3 text-ink">{c.companyName || '—'}</td>
 <td className="py-2 px-3 text-muted">{Number(c.rating || 0).toFixed(1)}/5</td>
 <td className="py-2 px-3">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isVerified ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' : 'bg-hoverbg text-muted'}`}>
 {c.isVerified ? 'Verified' : 'Pending'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Sidebar */}
 <div className="space-y-6">

 {/* Report Details */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Report Details</h3>
 <div className="space-y-3">
 <div className="flex items-center space-x-3">
 <Calendar className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Generated</p>
 <p className="text-sm text-muted">{formatDate(report.createdAt)}</p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <User className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Generated By</p>
 <p className="text-sm text-muted">{report.generatedByName || 'System'}</p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <Calendar className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Date Range</p>
 <p className="text-sm text-muted">
 {formatDate(report.startDate)} – {formatDate(report.endDate)}
 </p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <Download className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Downloads</p>
 <p className="text-sm text-muted">{report.downloads || 0}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Financial Information */}
 {financials && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Financial Summary</h3>
 <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="text-green-900">Total Budget</span>
 <span className="font-semibold text-green-900">{formatNaira(financials.totalBudget)}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-green-900">Spent</span>
 <span className="font-semibold text-green-900">{formatNaira(financials.spentBudget)}</span>
 </div>
 <div className="flex items-center justify-between text-sm border-t border-green-200 pt-2">
 <span className="text-green-900">Remaining</span>
 <span className="font-semibold text-green-900">{formatNaira(financials.remainingBudget)}</span>
 </div>
 </div>
 </div>
 )}

 {/* Actions */}
 {onDownload && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Actions</h3>
 <button
 onClick={onDownload}
 className="w-full bg-brand text-white py-2 px-4 rounded-lg hover:bg-brand transition-colors flex items-center justify-center space-x-2"
 >
 <Download className="h-4 w-4" />
 <span>Download Report</span>
 </button>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border bg-bg">
 <div className="flex items-center justify-between">
 <div className="text-sm text-muted">
 Report ID: {report.id} • Generated: {formatDate(report.createdAt)}
 </div>
 <button
 onClick={onClose}
 className="px-4 py-2 text-ink bg-surface border border-border rounded-lg hover:bg-bg transition-colors"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
