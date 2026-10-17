import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Camera,
  FileText,
  MapPin,
  Calendar,
  User,
  Download,
  Filter,
  Search,
  MessageSquare,
  Flag,
  Zap,
  TrendingUp,
  BarChart3,
  Shield,
  Award,
  Bell,
  Send,
  Edit,
  Star,
  Target,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { submissionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ReportDetailModal from '../components/Reports/ReportDetailModal';

// Mock data removed - now using API calls

const typeStyles = {
  milestone: 'bg-green-50 text-green-700 border-green-200',
  progress: 'bg-blue-50 text-blue-700 border-blue-200',
  issue: 'bg-red-50 text-red-700 border-red-200',
  safety: 'bg-purple-50 text-purple-700 border-purple-200'
};

const priorityStyles = {
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800'
};

const typeIcons = {
  milestone: CheckCircle,
  progress: FileText,
  issue: AlertTriangle,
  safety: Shield
};

export default function MEDashboard() {
  const { user } = useAuth();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filterType, setFilterType] = useState('All Types');
  const [filterPriority, setFilterPriority] = useState('All Priorities');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // week or month
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, underReview: 0, approved: 0, rejected: 0 });
  const [recentActivities] = useState([]);
  const [upcomingInspections] = useState([]);
  const [performanceMetrics] = useState({
    thisWeek: { reviewsCompleted: 0, approvalsGiven: 0, issuesFlagged: 0, siteVisits: 0, averageReviewTime: '0 hours', qualityScore: 0 },
    thisMonth: { reviewsCompleted: 0, approvalsGiven: 0, issuesFlagged: 0, siteVisits: 0, averageReviewTime: '0 hours', qualityScore: 0 }
  });

  useEffect(() => {
    let isMounted = true;
    const loadSubmissions = async () => {
      try {
        setLoading(true);
        const res = await submissionAPI.getAll();
        if (res?.success && isMounted) {
          setSubmissions(res.data?.submissions || []);
          // Calculate stats from actual data
          const all = res.data?.submissions || [];
          setStats({
            pending: all.filter(s => s.status === 'PENDING').length,
            underReview: all.filter(s => s.status === 'UNDER_REVIEW').length,
            approved: all.filter(s => s.status === 'APPROVED').length,
            rejected: all.filter(s => s.status === 'REJECTED').length
          });
        }
      } catch (e) {
        console.error('Failed to load submissions:', e);
        setSubmissions([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadSubmissions();
    return () => { isMounted = false; };
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const projectName = submission.project?.name || '';
    const contractorName = submission.contractor?.companyName || '';
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All Types' || submission.type === filterType;
    const matchesPriority = filterPriority === 'All Priorities' || submission.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesPriority;
  });

  const handleApprove = async (submissionId) => {
    try {
      const res = await submissionAPI.review(submissionId, {
        action: 'APPROVED',
        comments: 'Submission approved',
      });
      if (res?.success) {
        // Reload submissions to reflect the change
        const refreshRes = await submissionAPI.getAll();
        if (refreshRes?.success) {
          setSubmissions(refreshRes.data?.submissions || []);
          const all = refreshRes.data?.submissions || [];
          setStats({
            pending: all.filter(s => s.status === 'PENDING').length,
            underReview: all.filter(s => s.status === 'UNDER_REVIEW').length,
            approved: all.filter(s => s.status === 'APPROVED').length,
            rejected: all.filter(s => s.status === 'REJECTED').length
          });
        }
      }
    } catch (error) {
      console.error('Failed to approve submission:', error);
      alert(error.message || 'Failed to approve submission');
    }
  };

  const handleReject = async (submissionId) => {
    const comments = prompt('Enter rejection reason:');
    if (!comments) return;
    
    try {
      const res = await submissionAPI.review(submissionId, {
        action: 'REJECTED',
        comments,
      });
      if (res?.success) {
        // Reload submissions to reflect the change
        const refreshRes = await submissionAPI.getAll();
        if (refreshRes?.success) {
          setSubmissions(refreshRes.data?.submissions || []);
          const all = refreshRes.data?.submissions || [];
          setStats({
            pending: all.filter(s => s.status === 'PENDING').length,
            underReview: all.filter(s => s.status === 'UNDER_REVIEW').length,
            approved: all.filter(s => s.status === 'APPROVED').length,
            rejected: all.filter(s => s.status === 'REJECTED').length
          });
        }
      }
    } catch (error) {
      console.error('Failed to reject submission:', error);
      alert(error.message || 'Failed to reject submission');
    }
  };

  const handleFlag = async (submissionId) => {
    const comments = prompt('Enter flag reason:');
    if (!comments) return;
    
    try {
      const res = await submissionAPI.review(submissionId, {
        action: 'FLAGGED',
        comments,
      });
      if (res?.success) {
        // Reload submissions to reflect the change
        const refreshRes = await submissionAPI.getAll();
        if (refreshRes?.success) {
          setSubmissions(refreshRes.data?.submissions || []);
          const all = refreshRes.data?.submissions || [];
          setStats({
            pending: all.filter(s => s.status === 'PENDING').length,
            underReview: all.filter(s => s.status === 'UNDER_REVIEW').length,
            approved: all.filter(s => s.status === 'APPROVED').length,
            rejected: all.filter(s => s.status === 'REJECTED').length
          });
        }
      }
    } catch (error) {
      console.error('Failed to flag submission:', error);
      alert(error.message || 'Failed to flag submission');
    }
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setSelectedReport(null);
    setShowReportModal(false);
  };

  const currentMetrics = viewMode === 'week' ? performanceMetrics.thisWeek : performanceMetrics.thisMonth;

  return (
    <div className="space-y-6">
      {/* Enhanced M&E Officer Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold text-lg">JD</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">John Doe - Senior M&E Officer</h1>
                <p className="text-gray-600">Monitoring & Evaluation Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Award className="h-4 w-4 text-yellow-500" />
                <span>Level 3 Certified</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span>Abia State PMU</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-green-500" />
                <span>{currentMetrics.qualityScore}/5.0 Performance</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{filteredSubmissions.length}</p>
              <p className="text-sm text-gray-600">Pending Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {filteredSubmissions.filter(p => p.priority === 'High').length}
              </p>
              <p className="text-sm text-gray-600">High Priority</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{currentMetrics.approvalsGiven}</p>
              <p className="text-sm text-gray-600">Approved {viewMode === 'week' ? 'This Week' : 'This Month'}</p>
            </div>
            <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviews Completed</p>
              <p className="text-2xl font-bold text-blue-600">{currentMetrics.reviewsCompleted}</p>
              <div className="flex items-center text-sm text-green-600 mt-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>+15% from last {viewMode}</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approval Rate</p>
              <p className="text-2xl font-bold text-green-600">{Math.round((currentMetrics.approvalsGiven / currentMetrics.reviewsCompleted) * 100)}%</p>
              <div className="flex items-center text-sm text-green-600 mt-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>High quality rate</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Review Time</p>
              <p className="text-2xl font-bold text-purple-600">{currentMetrics.averageReviewTime}</p>
              <div className="flex items-center text-sm text-purple-600 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                <span>Efficient processing</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Site Visits</p>
              <p className="text-2xl font-bold text-yellow-600">{currentMetrics.siteVisits}</p>
              <div className="flex items-center text-sm text-yellow-600 mt-1">
                <Target className="h-4 w-4 mr-1" />
                <span>Field inspections</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <MapPin className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button 
            onClick={() => setShowInspectionModal(true)}
            className="btn-primary flex flex-col items-center space-y-2 py-4"
          >
            <Eye className="h-6 w-6" />
            <span className="text-sm">Site Inspection</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <FileText className="h-6 w-6" />
            <span className="text-sm">Generate Report</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <Flag className="h-6 w-6" />
            <span className="text-sm">Flag Issues</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <Download className="h-6 w-6" />
            <span className="text-sm">Export Data</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <BarChart3 className="h-6 w-6" />
            <span className="text-sm">Analytics</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <MessageSquare className="h-6 w-6" />
            <span className="text-sm">Send Message</span>
          </button>
        </div>
      </div>

      {/* Performance View Toggle */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={clsx(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              )}
            >
              This Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={clsx(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                viewMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              )}
            >
              This Month
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{currentMetrics.reviewsCompleted}</p>
            <p className="text-sm text-gray-600">Reviews Completed</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{currentMetrics.approvalsGiven}</p>
            <p className="text-sm text-gray-600">Approvals Given</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{currentMetrics.issuesFlagged}</p>
            <p className="text-sm text-gray-600">Issues Flagged</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enhanced Pending Approvals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search submissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option>All Types</option>
                  <option>Milestone</option>
                  <option>Progress</option>
                  <option>Issue</option>
                  <option>Safety</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option>All Priorities</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredSubmissions.map((submission) => {
                const Icon = typeIcons[submission.type];
                return (
                  <div key={submission.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4">
                        <div className={clsx('p-3 rounded-lg border', typeStyles[submission.type])}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{submission.title}</h3>
                            <span className={clsx('status-badge', priorityStyles[submission.priority])}>
                              {submission.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{submission.project}</p>
                          <p className="text-sm text-gray-700 mb-3">{submission.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 mb-4">
                            <div className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {submission.contractor}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {submission.location}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Due: {new Date(submission.dueDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Camera className="h-3 w-3 mr-1" />
                              {submission.mediaCount} files
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-gray-600">Quality Score:</span>
                              <div className="flex items-center space-x-1">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium">{submission.qualityScore}/5</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Safety:</span>
                              <p className="font-medium text-green-600">{submission.safetyCompliance}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Weather Impact:</span>
                              <p className="font-medium">{submission.weatherImpact}</p>
                            </div>
                          </div>

                          {submission.type === 'milestone' && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">Progress Claimed</span>
                                <span className="font-semibold">{submission.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${submission.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Submitted {new Date(submission.submittedDate).toLocaleDateString()} by {submission.submittedBy}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewReport(submission)}
                          className="text-abia-600 hover:text-abia-700 text-sm font-medium flex items-center px-3 py-1 rounded-lg hover:bg-abia-50"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Report
                        </button>
                        <button
                          onClick={() => handleApprove(submission.id)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center px-3 py-1 rounded-lg hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleFlag(submission.id)}
                          className="text-yellow-600 hover:text-yellow-700 text-sm font-medium flex items-center px-3 py-1 rounded-lg hover:bg-yellow-50"
                        >
                          <Flag className="h-4 w-4 mr-1" />
                          Flag
                        </button>
                        <button
                          onClick={() => handleReject(submission.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-3 py-1 rounded-lg hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Enhanced Sidebar */}
        <div className="space-y-6">
          {/* Recent M&E Activity */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Recent M&E Activity</h3>
            <div className="space-y-3">
              {recentActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      activity.action === 'approved' ? 'bg-green-100' :
                      activity.action === 'flagged' ? 'bg-red-100' :
                      activity.action === 'inspected' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.officer}</span> {activity.action} 
                        <span className="font-medium"> {activity.item}</span>
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">{activity.date}</p>
                        {activity.value !== '₦0' && (
                          <span className="text-xs font-medium text-green-600">{activity.value}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Inspections */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Upcoming Inspections</h3>
              <button 
                onClick={() => setShowInspectionModal(true)}
                className="text-abia-600 hover:text-abia-700 text-sm font-medium"
              >
                Schedule New
              </button>
            </div>
            <div className="space-y-3">
              {upcomingInspections.map((inspection) => (
                <div key={inspection.id} className={`p-3 rounded-lg border-l-4 ${
                  inspection.status === 'confirmed' ? 'bg-green-50 border-green-500' :
                  inspection.status === 'scheduled' ? 'bg-blue-50 border-blue-500' :
                  'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900">{inspection.type}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      inspection.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      inspection.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {inspection.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{inspection.project}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(inspection.date).toLocaleDateString()} at {inspection.time}</span>
                    <span>Inspector: {inspection.inspector}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Overview */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">System Overview</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Projects</span>
                <span className="font-semibold text-gray-900">24</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">On Schedule</span>
                <span className="font-semibold text-green-600">18</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Delayed</span>
                <span className="font-semibold text-red-600">4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">At Risk</span>
                <span className="font-semibold text-yellow-600">2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Budget Utilization</span>
                <span className="font-semibold text-blue-600">73%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Review Submission</h3>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Submission Details</h4>
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">Project:</span>
                        <p className="font-medium">{selectedSubmission.project}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Contractor:</span>
                        <p className="font-medium">{selectedSubmission.contractor}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">Submitted by:</span>
                        <p className="font-medium">{selectedSubmission.submittedBy}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Location:</span>
                        <p className="font-medium">{selectedSubmission.location}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-600">Description:</span>
                      <p className="text-gray-900 mt-1">{selectedSubmission.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">Estimated Value:</span>
                        <p className="font-medium">{selectedSubmission.estimatedValue}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Quality Score:</span>
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{selectedSubmission.qualityScore}/5</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">Safety Compliance:</span>
                        <p className="font-medium text-green-600">{selectedSubmission.safetyCompliance}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Weather Impact:</span>
                        <p className="font-medium">{selectedSubmission.weatherImpact}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">M&E Review</h4>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      rows="4"
                      placeholder="Add your review comments, recommendations, or concerns..."
                    />
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">Review Checklist</h4>
                    <div className="space-y-2">
                      {[
                        'Documentation is complete and accurate',
                        'Progress photos are clear and relevant',
                        'Work quality meets specifications',
                        'Safety protocols have been followed',
                        'Environmental guidelines are adhered to'
                      ].map((item, index) => (
                        <label key={index} className="flex items-center">
                          <input type="checkbox" className="rounded border-gray-300 text-abia-600 focus:ring-abia-500" />
                          <span className="ml-2 text-sm text-gray-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Media & Documents ({selectedSubmission.mediaCount} files)</h4>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[...Array(Math.min(selectedSubmission.mediaCount, 8))].map((_, i) => (
                      <div key={i} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center relative group cursor-pointer">
                        <Camera className="h-8 w-8 text-gray-400" />
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedSubmission.mediaCount > 8 && (
                    <p className="text-sm text-gray-600 mb-6">
                      +{selectedSubmission.mediaCount - 8} more files
                    </p>
                  )}

                  <div className="space-y-3">
                    <button className="w-full btn-primary flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve Submission</span>
                    </button>
                    <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                      <Flag className="h-4 w-4" />
                      <span>Request Clarification</span>
                    </button>
                    <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Schedule Site Visit</span>
                    </button>
                    <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg flex items-center justify-center space-x-2">
                      <XCircle className="h-4 w-4" />
                      <span>Reject Submission</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Inspection Modal */}
      {showInspectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Site Inspection</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500">
                  <option>Aba North Road Network Expansion</option>
                  <option>Umuahia Healthcare Complex</option>
                  <option>Aba South Water Treatment Plant</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inspection Type
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500">
                  <option>Quality Inspection</option>
                  <option>Safety Audit</option>
                  <option>Progress Review</option>
                  <option>Final Inspection</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input 
                    type="date" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input 
                    type="time" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  rows="3"
                  placeholder="Add any specific requirements or notes..."
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowInspectionModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowInspectionModal(false)}
                className="flex-1 btn-primary"
              >
                Schedule Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      <ReportDetailModal
        report={selectedReport}
        isOpen={showReportModal}
        onClose={handleCloseReportModal}
      />
    </div>
  );
}