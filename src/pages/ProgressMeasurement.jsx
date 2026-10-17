import { useState, useEffect } from 'react';
import {
 Target,
 CheckCircle,
 TrendingUp,
 Award,
 FileText,
 Users,
 Calendar,
 Download,
 Eye,
 AlertTriangle,
 RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import ProgressTracker from '../components/Progress/ProgressTracker';
import { projectAPI, submissionAPI, reportAPI } from '../services/api';

const STATUS_LABELS = {
 NOT_STARTED: 'Not Started',
 IN_PROGRESS: 'In Progress',
 NEAR_COMPLETION: 'Near Completion',
 COMPLETED: 'Completed',
 DELAYED: 'Delayed',
 ON_HOLD: 'On Hold',
 CANCELLED: 'Cancelled',
};

export default function ProgressMeasurement() {
 const [projects, setProjects] = useState([]);
 const [selectedProject, setSelectedProject] = useState(null);
 const [projectDetails, setProjectDetails] = useState(null);
 const [submissions, setSubmissions] = useState([]);
 const [timeframe, setTimeframe] = useState('current');
 const [loadingProjects, setLoadingProjects] = useState(true);
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [error, setError] = useState(null);

 useEffect(() => {
 const loadProjects = async () => {
 setLoadingProjects(true);
 setError(null);
 try {
 const res = await projectAPI.getAll({ limit: 100 });
 const list = res.data?.projects || [];
 setProjects(list);
 if (list.length > 0) {
 setSelectedProject(list[0].id);
 }
 } catch (err) {
 console.error('Failed to load projects:', err);
 setError(err.message || 'Failed to load projects');
 } finally {
 setLoadingProjects(false);
 }
 };
 loadProjects();
 }, []);

 useEffect(() => {
 if (!selectedProject) return;

 const loadDetails = async () => {
 setLoadingDetails(true);
 try {
 const [projectRes, submissionsRes] = await Promise.all([
 projectAPI.getById(selectedProject),
 submissionAPI.getAll({ projectId: selectedProject, limit: 100 }),
 ]);
 setProjectDetails(projectRes.data?.project || null);
 setSubmissions(submissionsRes.data?.submissions || []);
 } catch (err) {
 console.error('Failed to load project details:', err);
 toast.error(err.message || 'Failed to load project details');
 } finally {
 setLoadingDetails(false);
 }
 };
 loadDetails();
 }, [selectedProject]);

 const milestones = projectDetails?.milestones || [];

 const handleExport = async () => {
 const project = projects.find((p) => p.id === selectedProject);
 try {
 await reportAPI.generate({
 title: `Progress Report - ${project?.name || 'Project'}`,
 type: 'CUSTOM',
 category: 'Progress',
 includeFinancials: true,
 });
 toast.success('Report generated');
 } catch (err) {
 toast.error(err.message || 'Export failed');
 }
 };

 const progressMethodology = [
 {
 title: 'Contractor Updates',
 weight: '20%',
 description: 'Regular progress submissions with photos and documentation',
 icon: Users,
 color: 'bg-soft text-soft-fg',
 criteria: [
 'Weekly progress reports',
 'Milestone completion claims',
 'Photo/video documentation',
 'Quality self-assessments'
 ]
 },
 {
 title: 'Milestone Verification',
 weight: '70%',
 description: 'M&E verified completion of major project milestones',
 icon: Target,
 color: 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400',
 criteria: [
 'Site inspection verification',
 'Quality standards compliance',
 'Milestone deliverable review',
 'Technical specification adherence'
 ]
 },
 {
 title: 'Quality Assurance',
 weight: '10%',
 description: 'Overall quality and compliance verification',
 icon: Award,
 color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400',
 criteria: [
 'Safety compliance checks',
 'Environmental standards',
 'Material quality verification',
 'Workmanship assessment'
 ]
 }
 ];

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-ink">Progress Measurement System</h1>
 <p className="text-muted">Advanced progress tracking based on contractor updates and M&E verification.</p>
 </div>
 <div className="mt-4 sm:mt-0 flex space-x-3">
 <select
 value={timeframe}
 onChange={(e) => setTimeframe(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 <option value="current">Current Status</option>
 <option value="1month">Last Month</option>
 <option value="3months">Last 3 Months</option>
 <option value="6months">Last 6 Months</option>
 </select>
 <button onClick={handleExport} className="btn-secondary flex items-center space-x-2">
 <Download className="h-4 w-4" />
 <span>Export Report</span>
 </button>
 </div>
 </div>

 {/* Project Selection */}
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-4">Select Project for Analysis</h3>
 {loadingProjects ? (
 <div className="flex items-center justify-center py-8">
 <RefreshCw className="h-5 w-5 text-muted animate-spin mr-2" />
 <span className="text-muted">Loading projects...</span>
 </div>
 ) : error ? (
 <div className="text-center py-8">
 <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
 <p className="text-muted">{error}</p>
 </div>
 ) : projects.length === 0 ? (
 <p className="text-sm text-muted text-center py-8">No projects available.</p>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {projects.map((project) => (
 <button
 key={project.id}
 onClick={() => setSelectedProject(project.id)}
 className={clsx(
 'text-left p-4 rounded-lg border-2 transition-colors',
 selectedProject === project.id
 ? 'border-primary-300 bg-soft'
 : 'border-border hover:border-border'
 )}
 >
 <h4 className="font-medium text-ink mb-2">{project.name}</h4>
 <div className="flex items-center justify-between">
 <span className={`status-badge ${
 project.status === 'COMPLETED' ? 'status-completed' :
 project.status === 'IN_PROGRESS' || project.status === 'NEAR_COMPLETION' ? 'status-in-progress' :
 project.status === 'DELAYED' || project.status === 'ON_HOLD' ? 'status-delayed' :
 'status-not-started'
 }`}>
 {STATUS_LABELS[project.status] || project.status}
 </span>
 <span className="text-lg font-bold text-ink">{Number(project.progress || 0)}%</span>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Progress Measurement Methodology */}
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Progress Measurement Methodology</h3>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {progressMethodology.map((method, index) => {
 const Icon = method.icon;
 return (
 <div key={index} className="border border-border rounded-lg p-6">
 <div className="flex items-center space-x-3 mb-4">
 <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${method.color}`}>
 <Icon className="h-6 w-6" />
 </div>
 <div>
 <h4 className="font-semibold text-ink">{method.title}</h4>
 <p className="text-sm text-muted">Weight: {method.weight}</p>
 </div>
 </div>
 <p className="text-sm text-ink mb-4">{method.description}</p>
 <div className="space-y-2">
 <h5 className="text-xs font-medium text-ink uppercase tracking-wider">Criteria:</h5>
 <ul className="space-y-1">
 {method.criteria.map((criterion, idx) => (
 <li key={idx} className="flex items-center text-xs text-muted">
 <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
 {criterion}
 </li>
 ))}
 </ul>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Progress Tracker Component */}
 {loadingDetails ? (
 <div className="card">
 <div className="flex items-center justify-center py-8">
 <RefreshCw className="h-6 w-6 text-muted animate-spin mr-2" />
 <span className="text-muted">Loading project progress...</span>
 </div>
 </div>
 ) : selectedProject ? (
 <ProgressTracker
 projectId={selectedProject}
 project={projectDetails}
 milestones={milestones}
 submissions={submissions}
 />
 ) : null}

 {/* Progress Verification Workflow */}
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Progress Verification Workflow</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div>
 <h4 className="font-medium text-ink mb-4">Contractor Responsibilities</h4>
 <div className="space-y-3">
 <div className="flex items-start space-x-3">
 <FileText className="h-5 w-5 text-soft-fg mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Submit Regular Updates</h5>
 <p className="text-sm text-muted">Weekly progress reports with photos and metrics</p>
 </div>
 </div>
 <div className="flex items-start space-x-3">
 <Target className="h-5 w-5 text-green-700 dark:text-green-400 mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Milestone Completion</h5>
 <p className="text-sm text-muted">Submit milestone completion with evidence</p>
 </div>
 </div>
 <div className="flex items-start space-x-3">
 <Award className="h-5 w-5 text-purple-700 dark:text-purple-400 mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Quality Documentation</h5>
 <p className="text-sm text-muted">Provide quality assessments and compliance reports</p>
 </div>
 </div>
 </div>
 </div>

 <div>
 <h4 className="font-medium text-ink mb-4">M&E Verification Process</h4>
 <div className="space-y-3">
 <div className="flex items-start space-x-3">
 <Eye className="h-5 w-5 text-soft-fg mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Review Submissions</h5>
 <p className="text-sm text-muted">Evaluate contractor updates and documentation</p>
 </div>
 </div>
 <div className="flex items-start space-x-3">
 <Calendar className="h-5 w-5 text-green-700 dark:text-green-400 mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Site Inspections</h5>
 <p className="text-sm text-muted">Conduct on-site verification and quality checks</p>
 </div>
 </div>
 <div className="flex items-start space-x-3">
 <CheckCircle className="h-5 w-5 text-purple-700 dark:text-purple-400 mt-0.5" />
 <div>
 <h5 className="text-sm font-medium text-ink">Approve/Reject</h5>
 <p className="text-sm text-muted">Confirm or reject progress claims with feedback</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
