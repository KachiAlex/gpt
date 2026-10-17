import { useState, useEffect } from 'react';
import { 
  Upload, 
  Camera, 
  FileText, 
  Calendar, 
  MapPin, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Eye,
  MessageSquare,
  TrendingUp,
  Users,
  Award,
  Bell,
  Download,
  Edit,
  Send,
  Filter,
  Search,
  Star,
  Target,
  BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { projectAPI, submissionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Mock data removed - now using API calls

const statusStyles = {
  'Completed': 'status-completed',
  'In Progress': 'status-in-progress',
  'Near Completion': 'bg-blue-100 text-blue-800',
  'Delayed': 'status-delayed',
  'Not Started': 'status-not-started'
};

export default function ContractorDashboard() {
  const { user } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showNotifications, setShowNotifications] = useState(false);
  const [contractorProjects, setContractorProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentActivities] = useState([]);
  const [notifications] = useState([]);
  const [upcomingDeadlines] = useState([]);
  
  // Form state for submission modal
  const [submissionType, setSubmissionType] = useState('progress');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProjects = async () => {
      try {
        setLoading(true);
        const res = await projectAPI.getAll();
        if (res?.success && isMounted) {
          setContractorProjects(res.data?.projects || []);
        }
      } catch (e) {
        console.error('Failed to load contractor projects:', e);
        setContractorProjects([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProjects();
    return () => { isMounted = false; };
  }, []);

  const totalBudget = contractorProjects.reduce((sum, project) => sum + (project.budget || 0), 0);
  const avgProgress = contractorProjects.length > 0 ? Math.round(contractorProjects.reduce((sum, project) => sum + (project.progress || 0), 0) / contractorProjects.length) : 0;
  const totalMilestones = 0; // Will be calculated from actual milestones data
  const completedMilestones = 0; // Will be calculated from actual milestones data

  const handleSubmitUpdate = async () => {
    if (!selectedProject || !submissionDescription.trim()) {
      alert('Please select a project and provide a description');
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
        alert('Update submitted successfully!');
        // Reset form
        setSelectedProject('');
        setSubmissionType('progress');
        setSubmissionDescription('');
        setSubmissionProgress(0);
        setShowUploadModal(false);
        
        // Optionally reload projects to show updated progress
        const refreshRes = await projectAPI.getAll();
        if (refreshRes?.success) {
          setContractorProjects(refreshRes.data?.projects || []);
        }
      } else {
        throw new Error(res?.message || 'Failed to submit update');
      }
    } catch (error) {
      console.error('Failed to submit update:', error);
      alert(error.message || 'Failed to submit update. Please try again.');
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
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">KI</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Kreatix Infrastructure Ltd</h1>
                <p className="text-gray-600">Contractor Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>4.5 Rating</span>
              </div>
              <div className="flex items-center space-x-1">
                <Award className="h-4 w-4 text-green-500" />
                <span>Certified Contractor</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span>15+ Years Experience</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-600">Contract Value</p>
              <p className="text-2xl font-bold text-green-600">₦{(totalBudget / 1000000000).toFixed(1)}B</p>
            </div>
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute right-4 top-16 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div key={notification.id} className={`p-4 hover:bg-gray-50 ${notification.urgent ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      notification.urgent ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
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
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-blue-600">{contractorProjects.length}</p>
              <div className="flex items-center text-sm text-green-600 mt-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>All on track</span>
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
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold text-green-600">{avgProgress}%</p>
              <div className="flex items-center text-sm text-green-600 mt-1">
                <Target className="h-4 w-4 mr-1" />
                <span>Above target</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Milestones</p>
              <p className="text-2xl font-bold text-purple-600">{completedMilestones}/{totalMilestones}</p>
              <div className="flex items-center text-sm text-purple-600 mt-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>{Math.round((completedMilestones/totalMilestones)*100)}% complete</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Quality Score</p>
              <p className="text-2xl font-bold text-yellow-600">4.5/5</p>
              <div className="flex items-center text-sm text-yellow-600 mt-1">
                <Star className="h-4 w-4 mr-1" />
                <span>Excellent rating</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-primary flex flex-col items-center space-y-2 py-4"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm">Submit Update</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <Camera className="h-6 w-6" />
            <span className="text-sm">Upload Photos</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <FileText className="h-6 w-6" />
            <span className="text-sm">Submit Report</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <MessageSquare className="h-6 w-6" />
            <span className="text-sm">Contact M&E</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <Download className="h-6 w-6" />
            <span className="text-sm">Download Forms</span>
          </button>
          <button className="btn-secondary flex flex-col items-center space-y-2 py-4">
            <Calendar className="h-6 w-6" />
            <span className="text-sm">Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div className="border-b border-gray-200">
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
                    ? 'border-abia-500 text-abia-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <div key={project.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <span className={clsx('status-badge', statusStyles[project.status])}>
                          {project.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.priority === 'High' ? 'bg-red-100 text-red-800' :
                          project.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {project.priority} Priority
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{project.id} • {project.category} • {project.lga}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-abia-600 hover:text-abia-700 p-2 rounded-lg hover:bg-abia-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-50">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-sm">
                      <span className="text-gray-600">Budget:</span>
                      <p className="font-semibold text-gray-900">{project.budget}</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Manager:</span>
                      <p className="font-semibold text-gray-900">{project.manager}</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Due Date:</span>
                      <p className="font-semibold text-gray-900">{new Date(project.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Quality Score:</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold text-gray-900">{project.qualityScore}/5</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Overall Progress</span>
                      <span className="font-semibold">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-abia-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">Next Milestone</h4>
                      <span className="text-sm text-gray-600">{project.milestoneProgress}%</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{project.nextMilestone}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${project.milestoneProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Milestone Progress</h3>
                <button className="btn-primary flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Submit Milestone</span>
                </button>
              </div>

              {contractorProjects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">{project.name}</h4>
                  <div className="space-y-4">
                    {Array.from({ length: project.totalMilestones }, (_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          i < project.completedMilestones ? 'bg-green-500 text-white' :
                          i === project.completedMilestones ? 'bg-yellow-500 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {i < project.completedMilestones ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {i === 0 ? 'Project Initiation' :
                             i === 1 ? 'Foundation & Preparation' :
                             i === 2 ? 'Main Construction Phase' :
                             i === 3 ? 'Quality Testing' :
                             'Final Completion'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {i < project.completedMilestones ? 'Completed' :
                             i === project.completedMilestones ? 'In Progress' :
                             'Pending'}
                          </p>
                        </div>
                        {i < project.completedMilestones && (
                          <span className="text-green-600 text-sm">✓ Approved</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              {recentActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${activity.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{activity.title}</h4>
                        <span className="text-sm text-gray-500">{activity.date}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{activity.project}</p>
                      <p className="text-sm text-gray-700 mt-1">{activity.description}</p>
                      <div className="mt-2">
                        <span className={clsx(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          activity.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          activity.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        )}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deadlines Tab */}
          {activeTab === 'deadlines' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
              {upcomingDeadlines.map((deadline, index) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  deadline.status === 'at-risk' ? 'bg-red-50 border-red-500' :
                  deadline.status === 'ahead' ? 'bg-green-50 border-green-500' :
                  'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{deadline.milestone}</h4>
                      <p className="text-sm text-gray-600">{deadline.project}</p>
                      <p className="text-sm text-gray-500">Due: {new Date(deadline.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        deadline.status === 'at-risk' ? 'text-red-700' :
                        deadline.status === 'ahead' ? 'text-green-700' :
                        'text-yellow-700'
                      }`}>
                        {deadline.daysLeft} days
                      </p>
                      <p className="text-sm text-gray-600">remaining</p>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Submit Project Update</h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Project *
                  </label>
                  <select 
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Update Type *
                  </label>
                  <select 
                    value={submissionType}
                    onChange={(e) => setSubmissionType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{submissionProgress}%</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea 
                  value={submissionDescription}
                  onChange={(e) => setSubmissionDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  rows="4"
                  placeholder="Describe the update, progress made, or issues encountered..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to select</p>
                  <p className="text-sm text-gray-500">PNG, JPG, PDF up to 10MB each</p>
                  <button className="mt-3 btn-secondary">
                    Choose Files
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Submission Guidelines</h4>
                <ul className="text-sm text-blue-800 space-y-1">
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