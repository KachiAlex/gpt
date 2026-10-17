import { X, FileText, Calendar, User, MapPin, TrendingUp, Shield, AlertTriangle, Star, Clock, CheckCircle } from 'lucide-react';

const formatNaira = (value) => {
 const n = Number(value || 0);
 if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
 if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
 return n > 0 ? `₦${n.toLocaleString()}` : '₦0';
};

export default function ReportDetailModal({ report, isOpen, onClose }) {
 if (!isOpen || !report) return null;

 const renderStars = (rating) => {
 return Array.from({ length: 5 }, (_, i) => (
 <Star
 key={i}
 className={`h-4 w-4 ${
 i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-muted'
 }`}
 />
 ));
 };

 const getTypeColor = (type) => {
 const colors = {
 milestone: 'bg-green-50 dark:bg-green-950/40 text-green-700 border-green-200',
 MILESTONE: 'bg-green-50 dark:bg-green-950/40 text-green-700 border-green-200',
 progress: 'bg-soft text-soft-fg border-border',
 PROGRESS: 'bg-soft text-soft-fg border-border',
 issue: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200',
 ISSUE: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200',
 safety: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200',
 SAFETY: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200',
 QUALITY: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200',
 DELAY: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 border-orange-200',
 };
 return colors[type] || 'bg-bg text-ink border-border';
 };

 const getPriorityColor = (priority) => {
 const colors = {
 High: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300',
 HIGH: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300',
 Medium: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300',
 MEDIUM: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300',
 Low: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300',
 LOW: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300',
 CRITICAL: 'bg-red-200 text-red-900',
 };
 return colors[priority] || 'bg-hoverbg text-ink';
 };

 const getTypeIcon = (type) => {
 const icons = {
 milestone: CheckCircle,
 MILESTONE: CheckCircle,
 progress: FileText,
 PROGRESS: FileText,
 issue: AlertTriangle,
 ISSUE: AlertTriangle,
 safety: Shield,
 SAFETY: Shield,
 };
 return icons[type] || FileText;
 };

 const formatDate = (dateString) => {
 if (!dateString) return '—';
 const d = new Date(dateString);
 return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 });
 };

 const getComplianceColor = (compliance) => {
 const colors = {
 'Outstanding': 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40',
 'Excellent': 'text-soft-fg bg-soft',
 'Good': 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40',
 'Fair': 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40',
 'Poor': 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
 };
 return colors[compliance] || 'text-muted bg-bg';
 };

 const TypeIcon = getTypeIcon(report.type);
 const typeLabel = String(report.type || 'report').toLowerCase();

 // SubmissionListItem relations come back as objects
 const projectName = report.project?.name || report.projectName || '—';
 const projectId = report.project?.id || report.projectId || '—';
 const contractorName = report.contractor?.companyName || report.contractorName || '—';
 const submitterName = report.submitter
 ? `${report.submitter.firstName || ''} ${report.submitter.lastName || ''}`.trim() || report.submitter.email
 : report.submittedBy || '—';
 const locationLabel = Array.isArray(report.project?.lga)
 ? report.project.lga.join(', ')
 : report.location || '—';

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className="bg-surface rounded-lg shadow-sm max-w-5xl w-full max-h-[90vh] overflow-hidden">
 {/* Header */}
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${getTypeColor(report.type)}`}>
 <TypeIcon className="h-6 w-6" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-ink">{report.title}</h2>
 <div className="flex items-center space-x-4 mt-1">
 <span className="text-sm text-muted font-mono">{report.id}</span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(report.type)}`}>
 {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
 </span>
 {report.priority && (
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
 {report.priority} Priority
 </span>
 )}
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

 {/* Report Description */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Report Description</h3>
 <div className="bg-bg p-4 rounded-lg">
 <p className="text-ink leading-relaxed">{report.description || 'No description provided.'}</p>
 </div>
 </div>

 {/* Project Information */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Project Information</h3>
 <div className="bg-soft p-4 rounded-lg">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <p className="text-sm font-medium text-blue-900">Project Name</p>
 <p className="text-sm text-soft-fg">{projectName}</p>
 </div>
 <div>
 <p className="text-sm font-medium text-blue-900">Project ID</p>
 <p className="text-sm text-soft-fg font-mono">{projectId}</p>
 </div>
 <div>
 <p className="text-sm font-medium text-blue-900">Contractor</p>
 <p className="text-sm text-soft-fg">{contractorName}</p>
 </div>
 <div>
 <p className="text-sm font-medium text-blue-900">Location</p>
 <p className="text-sm text-soft-fg">{locationLabel}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Progress and Metrics */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Progress & Metrics</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-400" />
 <span className="text-sm font-medium text-green-900">Progress</span>
 </div>
 <div className="text-2xl font-bold text-green-700 dark:text-green-400">{report.progress ?? 0}%</div>
 <div className="w-full bg-green-200 rounded-full h-2 mt-2">
 <div
 className="bg-green-600 h-2 rounded-full transition-all duration-300"
 style={{ width: `${report.progress ?? 0}%` }}
 ></div>
 </div>
 </div>

 <div className="bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <Star className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
 <span className="text-sm font-medium text-yellow-900">Quality Score</span>
 </div>
 <div className="flex items-center space-x-1">
 <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{report.qualityScore ?? '—'}</span>
 {report.qualityScore != null && (
 <div className="flex">
 {renderStars(report.qualityScore)}
 </div>
 )}
 </div>
 </div>

 <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <Shield className="h-5 w-5 text-purple-700 dark:text-purple-400" />
 <span className="text-sm font-medium text-purple-900">Safety</span>
 </div>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplianceColor(report.safetyCompliance)}`}>
 {report.safetyCompliance || 'Not assessed'}
 </span>
 </div>
 </div>
 </div>

 {/* Media Attachments */}
 {report.mediaCount > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Attachments</h3>
 <div className="bg-bg p-4 rounded-lg">
 <div className="flex items-center space-x-3">
 <div className="w-10 h-10 bg-soft rounded-lg flex items-center justify-center">
 <FileText className="h-5 w-5 text-soft-fg" />
 </div>
 <div>
 <p className="text-sm font-medium text-ink">{report.mediaCount} files attached</p>
 <p className="text-xs text-muted">Photos, documents, and reports</p>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Review Comments */}
 {report.reviewComments && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Review Comments</h3>
 <div className="bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-lg">
 <p className="text-sm text-yellow-800 dark:text-yellow-300">{report.reviewComments}</p>
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
 <p className="text-sm font-medium text-ink">Submitted Date</p>
 <p className="text-sm text-muted">{formatDate(report.submittedAt)}</p>
 </div>
 </div>

 <div className="flex items-center space-x-3">
 <Clock className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Due Date</p>
 <p className="text-sm text-muted">{formatDate(report.dueDate)}</p>
 </div>
 </div>

 <div className="flex items-center space-x-3">
 <User className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Submitted By</p>
 <p className="text-sm text-muted">{submitterName}</p>
 </div>
 </div>

 <div className="flex items-center space-x-3">
 <MapPin className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Status</p>
 <p className="text-sm text-muted">{String(report.status || '').replace(/_/g, ' ')}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Financial Information */}
 {Number(report.estimatedValue) > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Financial Information</h3>
 <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2 mb-2">
 <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-400" />
 <span className="text-sm font-medium text-green-900">Estimated Value</span>
 </div>
 <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatNaira(report.estimatedValue)}</div>
 </div>
 </div>
 )}

 {/* Weather Impact */}
 {report.weatherImpact && report.weatherImpact !== 'None' && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">Weather Impact</h3>
 <div className="bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-lg">
 <div className="flex items-center space-x-2">
 <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
 <span className="text-sm text-yellow-800 dark:text-yellow-300">{report.weatherImpact}</span>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border bg-bg">
 <div className="flex items-center justify-between">
 <div className="text-sm text-muted">
 Report ID: {report.id} • Submitted: {formatDate(report.submittedAt)}
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
