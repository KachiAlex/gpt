import { useState, useEffect, useCallback } from 'react';
import { 
 Upload, 
 Camera, 
 FileText, 
 MapPin, 
 CheckCircle,
 Eye,
 TrendingUp,
 Users,
 Award,
 Bell,
 Send,
 Star,
 Target,
 BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { projectAPI, submissionAPI, contractorAPI, documentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { fmtNairaCompact } from '../utils/statusMap';

// Mock data removed - now using API calls

const statusStyles = {
 COMPLETED: 'status-completed',
 IN_PROGRESS: 'status-in-progress',
 NEAR_COMPLETION: 'bg-soft text-brand',
 DELAYED: 'status-delayed',
 ON_HOLD: 'status-delayed',
 CANCELLED: 'status-not-started',
 NOT_STARTED: 'status-not-started',
};

const statusLabels = {
 COMPLETED: 'Completed',
 IN_PROGRESS: 'In Progress',
 NEAR_COMPLETION: 'Near Completion',
 DELAYED: 'Delayed',
 ON_HOLD: 'On Hold',
 CANCELLED: 'Cancelled',
 NOT_STARTED: 'Not Started',
};

export default function ContractorDashboard() {
 const { user } = useAuth();
 const [showUploadModal, setShowUploadModal] = useState(false);
 const [selectedProject, setSelectedProject] = useState('');
 const [activeTab, setActiveTab] = useState('overview');
 const [showNotifications, setShowNotifications] = useState(false);
 const [contractorProjects, setContractorProjects] = useState([]);
 const [contractorProfile, setContractorProfile] = useState(null);
 const [loading, setLoading] = useState(true);
 const [notifications] = useState([]);
 const [attachmentFiles, setAttachmentFiles] = useState([]);

 // Form state for submission modal
 const [submissionType, setSubmissionType] = useState('progress');
 const [submissionDescription, setSubmissionDescription] = useState('');
 const [submissionProgress, setSubmissionProgress] = useState(0);
 const [submitting, setSubmitting] = useState(false);

 const loadProjects = useCallback(async () => {
 try {
 // Scope to this contractor's assigned projects — the contractor profile
 // id rides on the session user object (set at login).
 const res = await projectAPI.getAll(user?.contractorId ? { contractorId: user.contractorId, limit: 100 } : { limit: 100 });
 if (res?.success) {
 const list = res.data?.projects || [];
 // Pull each project's detail for real milestone + submission data
 const detailed = await Promise.all(
   list.map((p) => projectAPI.getById(p.id).then((r) => r?.data?.project || p).catch(() => p))
 );
 setContractorProjects(detailed);
 }
 if (user?.contractorId) {
 try {
 const prof = await contractorAPI.getById(user.contractorId);
 if (prof?.success) setContractorProfile(prof.data?.contractor || null);
 } catch { /* profile optional — header falls back to user name */ }
 }
 } catch (e) {
 console.error('Failed to load contractor projects:', e);
 setContractorProjects([]);
 }
 }, [user?.contractorId]);

 useEffect(() => {
 let isMounted = true;
 (async () => {
 setLoading(true);
 await loadProjects();
 if (isMounted) setLoading(false);
 })();
 return () => { isMounted = false; };
 }, [loadProjects]);

 const totalBudget = contractorProjects.reduce((sum, project) => sum + (project.budget || 0), 0);
 const avgProgress = contractorProjects.length > 0 ? Math.round(contractorProjects.reduce((sum, project) => sum + (project.progress || 0), 0) / contractorProjects.length) : 0;
 const allMilestones = contractorProjects.flatMap((p) => (p.milestones || []).map((m) => ({ ...m, projectName: p.name })));
 const totalMilestones = allMilestones.filter((m) => m.status !== 'CANCELLED').length;
 const completedMilestones = allMilestones.filter((m) => m.status === 'COMPLETED').length;
 const stalledCount = contractorProjects.filter((p) => p.status === 'DELAYED' || p.status === 'ON_HOLD').length;

 // Earliest open milestone per project — drives the "Next Milestone" block
 const nextMilestoneFor = (project) =>
   (project.milestones || [])
     .filter((m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED')
     .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))[0] || null;

 // Upcoming deadlines = open milestones with a due date, soonest first
 const upcomingDeadlines = allMilestones
   .filter((m) => m.dueDate && m.status !== 'COMPLETED' && m.status !== 'CANCELLED')
   .map((m) => {
     const daysLeft = Math.ceil((new Date(m.dueDate).getTime() - Date.now()) / 86400000);
     return {
       milestone: m.name,
       project: m.projectName,
       dueDate: m.dueDate,
       daysLeft,
       status: daysLeft < 0 ? 'at-risk' : daysLeft <= 14 ? 'at-risk' : 'ahead',
     };
   })
   .sort((a, b) => a.daysLeft - b.daysLeft)
   .slice(0, 10);

 // Activity feed = this contractor's recent submissions across projects
 const recentActivities = contractorProjects
   .flatMap((p) =>
     (p.recentSubmissions || []).map((s) => ({
       id: s.id,
       title: s.title,
       project: p.name,
       status: s.status,
       ts: s.submittedAt ? new Date(s.submittedAt).getTime() : 0,
       date: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '—',
     }))
   )
   .sort((a, b) => b.ts - a.ts)
   .slice(0, 10);

 const handleSubmitUpdate = async () => {
 if (!selectedProject || !submissionDescription.trim()) {
 showError('Please select a project and provide a description');
 return;
 }

 try {
 setSubmitting(true);
 
 // Map submission type to API type
 const typeMap = {
 progress: 'PROGRESS',
 milestone: 'MILESTONE',
 issue: 'ISSUE',
 delay: 'ISSUE',
 safety: 'SAFETY',
 quality: 'QUALITY'
 };

 const submissionData = {
 projectId: selectedProject,
 type: typeMap[submissionType] || 'PROGRESS',
 title: `${typeMap[submissionType] || 'PROGRESS'} Update - ${contractorProjects.find(p => p.id === selectedProject)?.name || ''}`,
 description: submissionDescription,
 progress: submissionProgress,
 priority: submissionType === 'delay' || submissionType === 'issue' ? 'HIGH' : 'MEDIUM'
 };

 const res = await submissionAPI.create(submissionData);
 
 if (res?.success) {
 // Attach any selected files to the new submission
 if (attachmentFiles.length > 0 && res.data?.submission?.id) {
 try {
 const fd = new FormData();
 attachmentFiles.forEach((f) => fd.append('files', f));
 fd.append('category', 'PHOTO');
 fd.append('submissionId', res.data.submission.id);
 await documentAPI.uploadMultiple(fd);
 showSuccess('Update submitted successfully!');
 } catch (uploadErr) {
 console.error('Attachment upload failed:', uploadErr);
 showError('Update submitted, but file attachments failed to upload');
 }
 } else {
 showSuccess('Update submitted successfully!');
 }
 // Reset form
 setSelectedProject('');
 setSubmissionType('progress');
 setSubmissionDescription('');
 setSubmissionProgress(0);
 setAttachmentFiles([]);
 setShowUploadModal(false);
 
 // Reload this contractor's projects (scoped — never the full registry)
 await loadProjects();
 } else {
 throw new Error(res?.message || 'Failed to submit update');
 }
 } catch (error) {
 console.error('Failed to submit update:', error);
 showError(error.message || 'Failed to submit update. Please try again.');
 } finally {
 setSubmitting(false);
 }
 };

 if (loading) {
 return <div className="flex items-center justify-center h-screen">Loading...</div>;
 }

 return (
 <div className="space-y-6">
 {/* Enhanced Header */}
 <div className="card">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
 <div className="mb-4 lg:mb-0">
 <div className="flex items-center space-x-3 mb-2">
 <div className="w-12 h-12 bg-soft rounded-full flex items-center justify-center">
 <span className="text-soft-fg font-bold text-lg">
 {(contractorProfile?.companyName || user?.firstName || 'C').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
 </span>
 </div>
 <div>
 <h1 className="text-2xl font-bold text-ink">{contractorProfile?.companyName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Contractor'}</h1>
 <p className="text-muted">Contractor Dashboard</p>
 </div>
 </div>
 <div className="flex items-center space-x-4 text-sm text-muted">
 {contractorProfile?.rating != null && (
 <div className="flex items-center space-x-1">
 <Star className="h-4 w-4 text-yellow-500" />
 <span>{Number(contractorProfile.rating).toFixed(1)} Rating</span>
 </div>
 )}
 {contractorProfile?.isCertified && (
 <div className="flex items-center space-x-1">
 <Award className="h-4 w-4 text-green-500" />
 <span>Certified Contractor</span>
 </div>
 )}
 {contractorProfile?.yearsExperience != null && (
 <div className="flex items-center space-x-1">
 <Users className="h-4 w-4 text-blue-500" />
 <span>{contractorProfile.yearsExperience}+ Years Experience</span>
 </div>
 )}
 </div>
 </div>
 <div className="flex items-center space-x-4">
 <button 
 onClick={() => setShowNotifications(!showNotifications)}
 className="relative p-2 text-muted hover:text-muted rounded-lg hover:bg-hoverbg"
 >
 <Bell className="h-5 w-5" />
 <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
 </button>
 <div className="text-right">
 <p className="text-sm text-muted">Contract Value</p>
 <p className="text-2xl font-bold text-green-700 dark:text-green-400">{fmtNairaCompact(totalBudget)}</p>
 </div>
 </div>
 </div>

 {/* Notifications Dropdown */}
 {showNotifications && (
 <div className="absolute right-4 top-16 w-80 bg-surface rounded-lg shadow-sm border z-50 max-h-96 overflow-y-auto">
 <div className="p-4 border-b border-border">
 <h3 className="font-semibold text-ink">Notifications</h3>
 </div>
 <div className="divide-y divide-border">
 {notifications.map((notification) => (
 <div key={notification.id} className={`p-4 hover:bg-bg ${notification.urgent ? 'bg-red-50 dark:bg-red-950/40' : ''}`}>
 <div className="flex items-start space-x-3">
 <div className={`w-2 h-2 rounded-full mt-2 ${
 notification.urgent ? 'bg-red-500' : 'bg-blue-500'
 }`} />
 <div className="flex-1">
 <h4 className="text-sm font-medium text-ink">{notification.title}</h4>
 <p className="text-sm text-muted mt-1">{notification.message}</p>
 <p className="text-xs text-muted mt-1">{notification.time}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Enhanced Stats Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Active Projects</p>
 <p className="text-2xl font-bold text-soft-fg">{contractorProjects.length}</p>
 <div className="flex items-center text-sm text-green-700 dark:text-green-400 mt-1">
 <TrendingUp className="h-4 w-4 mr-1" />
 <span>{stalledCount > 0 ? `${stalledCount} delayed/on hold` : 'All on track'}</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-soft rounded-lg flex items-center justify-center">
 <FileText className="h-6 w-6 text-soft-fg" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Avg Progress</p>
 <p className="text-2xl font-bold text-green-700 dark:text-green-400">{avgProgress}%</p>
 <div className="flex items-center text-sm text-green-700 dark:text-green-400 mt-1">
 <Target className="h-4 w-4 mr-1" />
 <span>Across {contractorProjects.length} project{contractorProjects.length === 1 ? '' : 's'}</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-green-100 dark:bg-green-950/50 rounded-lg flex items-center justify-center">
 <BarChart3 className="h-6 w-6 text-green-700 dark:text-green-400" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Milestones</p>
 <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{completedMilestones}/{totalMilestones}</p>
 <div className="flex items-center text-sm text-purple-700 dark:text-purple-400 mt-1">
 <CheckCircle className="h-4 w-4 mr-1" />
 <span>{totalMilestones > 0 ? Math.round((completedMilestones/totalMilestones)*100) : 0}% complete</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/50 rounded-lg flex items-center justify-center">
 <Award className="h-6 w-6 text-purple-700 dark:text-purple-400" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Quality Score</p>
 <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
 {contractorProfile?.rating != null ? `${Number(contractorProfile.rating).toFixed(1)}/5` : '—'}
 </p>
 <div className="flex items-center text-sm text-yellow-700 dark:text-yellow-400 mt-1">
 <Star className="h-4 w-4 mr-1" />
 <span>{contractorProfile?.rating != null ? 'Verified rating' : 'Not yet rated'}</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-950/50 rounded-lg flex items-center justify-center">
 <Star className="h-6 w-6 text-yellow-700 dark:text-yellow-400" />
 </div>
 </div>
 </div>
 </div>

 {/* Enhanced Quick Actions */}
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-4">Quick Actions</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
 <button 
 onClick={() => setShowUploadModal(true)}
 className="btn-primary flex flex-col items-center space-y-2 py-4"
 >
 <Upload className="h-6 w-6" />
 <span className="text-sm">Submit Update</span>
 </button>
 <Link
 to="/map"
 className="btn-secondary flex flex-col items-center space-y-2 py-4"
 >
 <MapPin className="h-6 w-6" />
 <span className="text-sm">Project Map</span>
 </Link>
 </div>
 </div>

 {/* Tab Navigation */}
 <div className="card">
 <div className="border-b border-border">
 <nav className="-mb-px flex space-x-8">
 {[
 { id: 'overview', name: 'Project Overview' },
 { id: 'milestones', name: 'Milestones' },
 { id: 'activity', name: 'Recent Activity' },
 { id: 'deadlines', name: 'Deadlines' }
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={clsx(
 'py-2 px-1 border-b-2 font-medium text-sm',
 activeTab === tab.id
 ? 'border-primary-500 text-soft-fg'
 : 'border-transparent text-muted hover:text-ink hover:border-border'
 )}
 >
 {tab.name}
 </button>
 ))}
 </nav>
 </div>

 <div className="p-6">
 {/* Overview Tab */}
 {activeTab === 'overview' && (
 <div className="space-y-6">
 {contractorProjects.map((project) => (
 <div key={project.id} className="border border-border rounded-lg p-6">
 <div className="flex items-start justify-between mb-4">
 <div className="flex-1">
 <div className="flex items-center space-x-3 mb-2">
 <h3 className="text-lg font-semibold text-ink">{project.name}</h3>
 <span className={clsx('status-badge', statusStyles[project.status] || 'status-not-started')}>
 {statusLabels[project.status] || project.status}
 </span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 project.priority === 'HIGH' || project.priority === 'CRITICAL' ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300' :
 project.priority === 'MEDIUM' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300' :
 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
 }`}>
 {project.priority} Priority
 </span>
 </div>
 <p className="text-sm text-muted mb-3">{project.category} • {Array.isArray(project.lga) ? project.lga.join(', ') : project.lga}</p>
 </div>
 <div className="flex space-x-2">
 <Link
 to={`/projects/${project.id}`}
 className="text-soft-fg hover:text-soft-fg p-2 rounded-lg hover:bg-soft"
 >
 <Eye className="h-4 w-4" />
 </Link>
 </div>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div className="text-sm">
 <span className="text-muted">Budget:</span>
 <p className="font-semibold text-ink">{fmtNairaCompact(project.budget)}</p>
 </div>
 <div className="text-sm">
 <span className="text-muted">Contractor:</span>
 <p className="font-semibold text-ink">{contractorProfile?.companyName || '—'}</p>
 </div>
 <div className="text-sm">
 <span className="text-muted">Expected End:</span>
 <p className="font-semibold text-ink">{project.expectedEndDate ? new Date(project.expectedEndDate).toLocaleDateString() : '—'}</p>
 </div>
 <div className="text-sm">
 <span className="text-muted">Quality Score:</span>
 <div className="flex items-center space-x-1">
 <Star className="h-4 w-4 text-yellow-500" />
 <span className="font-semibold text-ink">{project.qualityScore != null ? `${Number(project.qualityScore).toFixed(1)}/5` : '—'}</span>
 </div>
 </div>
 </div>

 <div className="mb-4">
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="text-muted">Overall Progress</span>
 <span className="font-semibold">{project.progress}%</span>
 </div>
 <div className="w-full bg-track rounded-full h-3">
 <div 
 className="bg-brand h-3 rounded-full transition-all duration-300"
 style={{ width: `${project.progress}%` }}
 />
 </div>
 </div>

 {(() => {
 const nextMilestone = nextMilestoneFor(project);
 if (!nextMilestone) {
 return (project.milestones || []).length > 0 ? (
 <div className="bg-bg rounded-lg p-4">
 <p className="text-sm text-muted">All milestones completed</p>
 </div>
 ) : null;
 }
 return (
 <div className="bg-bg rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-medium text-ink">Next Milestone</h4>
 <span className="text-sm text-muted">{nextMilestone.progress ?? 0}%</span>
 </div>
 <p className="text-sm text-ink mb-3">{nextMilestone.name}</p>
 <div className="w-full bg-track rounded-full h-2">
 <div 
 className="bg-yellow-500 h-2 rounded-full"
 style={{ width: `${nextMilestone.progress ?? 0}%` }}
 />
 </div>
 </div>
 );
 })()}
 </div>
 ))}
 </div>
 )}

 {/* Milestones Tab */}
 {activeTab === 'milestones' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-ink">Milestone Progress</h3>

 {contractorProjects.map((project) => {
 const milestones = project.milestones || [];
 return (
 <div key={project.id} className="border border-border rounded-lg p-6">
 <h4 className="font-semibold text-ink mb-4">{project.name}</h4>
 {milestones.length === 0 ? (
 <p className="text-sm text-muted">No milestones defined for this project yet.</p>
 ) : (
 <div className="space-y-4">
 {milestones.map((m, i) => (
 <div key={m.id || i} className="flex items-center space-x-4">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
 m.status === 'COMPLETED' ? 'bg-green-500 text-white' :
 m.status === 'IN_PROGRESS' ? 'bg-yellow-500 text-white' :
 m.status === 'CANCELLED' ? 'bg-track text-muted line-through' :
 'bg-track text-muted'
 }`}>
 {m.status === 'COMPLETED' ? (
 <CheckCircle className="h-4 w-4" />
 ) : (
 <span>{i + 1}</span>
 )}
 </div>
 <div className="flex-1">
 <p className="font-medium text-ink">{m.name}</p>
 <p className="text-sm text-muted">
 {statusLabels[m.status] || m.status}
 {m.dueDate ? ` — due ${new Date(m.dueDate).toLocaleDateString()}` : ''}
 {m.status === 'IN_PROGRESS' && m.progress != null ? ` (${m.progress}%)` : ''}
 </p>
 </div>
 {m.status === 'COMPLETED' && (
 <span className="text-green-700 dark:text-green-400 text-sm">✓ Completed</span>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* Activity Tab */}
 {activeTab === 'activity' && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-ink">Recent Activity</h3>
 {recentActivities.length === 0 ? (
 <p className="text-sm text-muted">No submissions yet — use "Submit Update" to log your first progress report.</p>
 ) : recentActivities.map((activity) => (
 <div key={activity.id} className="flex items-start space-x-4 p-4 bg-bg rounded-lg">
 <div className="p-2 rounded-lg bg-soft">
 <FileText className="h-5 w-5 text-soft-fg" />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between">
 <h4 className="font-medium text-ink">{activity.title}</h4>
 <span className="text-sm text-muted">{activity.date}</span>
 </div>
 <p className="text-sm text-muted mt-1">{activity.project}</p>
 <div className="mt-2">
 <span className={clsx(
 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
 activity.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' :
 activity.status === 'REJECTED' || activity.status === 'FLAGGED' ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300' :
 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300'
 )}>
 {activity.status}
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Deadlines Tab */}
 {activeTab === 'deadlines' && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-ink">Upcoming Deadlines</h3>
 {upcomingDeadlines.length === 0 ? (
 <p className="text-sm text-muted">No upcoming milestone deadlines.</p>
 ) : upcomingDeadlines.map((deadline, index) => (
 <div key={index} className={`p-4 rounded-lg border-l-4 ${
 deadline.status === 'at-risk' ? 'bg-red-50 dark:bg-red-950/40 border-red-500' :
 deadline.status === 'ahead' ? 'bg-green-50 dark:bg-green-950/40 border-green-500' :
 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-500'
 }`}>
 <div className="flex items-center justify-between">
 <div>
 <h4 className="font-medium text-ink">{deadline.milestone}</h4>
 <p className="text-sm text-muted">{deadline.project}</p>
 <p className="text-sm text-muted">Due: {new Date(deadline.dueDate).toLocaleDateString()}</p>
 </div>
 <div className="text-right">
 <p className={`text-lg font-bold ${
 deadline.status === 'at-risk' ? 'text-red-700 dark:text-red-400' :
 deadline.status === 'ahead' ? 'text-green-700' :
 'text-yellow-700 dark:text-yellow-400'
 }`}>
 {deadline.daysLeft < 0 ? `${Math.abs(deadline.daysLeft)} days overdue` : `${deadline.daysLeft} days`}
 </p>
 <p className="text-sm text-muted">{deadline.daysLeft < 0 ? '' : 'remaining'}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Enhanced Upload Modal */}
 {showUploadModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
 <div role="dialog" aria-modal="true" aria-label="Submit project update" className="bg-surface rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
 <h3 className="text-xl font-semibold text-ink mb-6">Submit Project Update</h3>
 
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Select Project *
 </label>
 <select 
 value={selectedProject}
 onChange={(e) => setSelectedProject(e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 <option value="">Choose project...</option>
 {contractorProjects.map(project => (
 <option key={project.id} value={project.id}>
 {project.name}
 </option>
 ))}
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Update Type *
 </label>
 <select 
 value={submissionType}
 onChange={(e) => setSubmissionType(e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 <option value="progress">Progress Update</option>
 <option value="milestone">Milestone Completion</option>
 <option value="issue">Report Issue</option>
 <option value="delay">Report Delay</option>
 <option value="safety">Safety Report</option>
 <option value="quality">Quality Update</option>
 </select>
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Progress Percentage
 </label>
 <div className="flex items-center space-x-4">
 <input 
 type="range" 
 min="0" 
 max="100" 
 value={submissionProgress}
 onChange={(e) => setSubmissionProgress(parseInt(e.target.value))}
 className="flex-1"
 />
 <span className="text-sm font-medium text-ink w-12 text-right">{submissionProgress}%</span>
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Description *
 </label>
 <textarea 
 value={submissionDescription}
 onChange={(e) => setSubmissionDescription(e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 rows="4"
 placeholder="Describe the update, progress made, or issues encountered..."
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Attach Files
 </label>
 <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
 <Camera className="h-12 w-12 text-muted mx-auto mb-3" />
 <p className="text-muted mb-2">Attach photos or documents to this update</p>
 <p className="text-sm text-muted">PNG, JPG, PDF up to 10MB each — max 10 files</p>
 <input
 type="file"
 multiple
 accept="image/png,image/jpeg,application/pdf"
 onChange={(e) => setAttachmentFiles(Array.from(e.target.files || []).slice(0, 10))}
 className="mt-3 text-sm text-muted"
 />
 {attachmentFiles.length > 0 && (
 <p className="mt-2 text-sm text-ink">{attachmentFiles.length} file{attachmentFiles.length === 1 ? '' : 's'} selected</p>
 )}
 </div>
 </div>

 <div className="bg-soft rounded-lg p-4">
 <h4 className="font-medium text-blue-900 mb-2">Submission Guidelines</h4>
 <ul className="text-sm text-brand space-y-1">
 <li>• Include clear, high-quality photos of work progress</li>
 <li>• Provide detailed descriptions of completed activities</li>
 <li>• Report any delays or issues immediately</li>
 <li>• Ensure all safety protocols are documented</li>
 </ul>
 </div>
 </div>
 
 <div className="flex space-x-3 mt-8">
 <button 
 onClick={() => {
 setShowUploadModal(false);
 setSelectedProject('');
 setSubmissionType('progress');
 setSubmissionDescription('');
 setSubmissionProgress(0);
 setAttachmentFiles([]);
 }}
 className="flex-1 btn-secondary"
 disabled={submitting}
 >
 Cancel
 </button>
 <button 
 onClick={handleSubmitUpdate}
 className="flex-1 btn-primary flex items-center justify-center space-x-2"
 disabled={submitting || !selectedProject || !submissionDescription.trim()}
 >
 <Send className="h-4 w-4" />
 <span>{submitting ? 'Submitting...' : 'Submit Update'}</span>
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}