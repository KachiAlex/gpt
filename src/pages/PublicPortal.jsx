import { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Eye,
  Filter,
  TrendingUp,
  Users,
  Building,
  Award,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { publicAPI } from '../services/api';

const categories = ['All Categories', 'Transportation', 'Healthcare', 'Water & Sanitation', 'Education', 'Housing'];
const lgas = ['All LGAs', 'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi'];

const statusStyles = {
  'COMPLETED': 'status-completed',
  'IN_PROGRESS': 'status-in-progress',
  'DELAYED': 'status-delayed',
  'NOT_STARTED': 'status-not-started'
};

export default function PublicPortal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [lgaFilter, setLgaFilter] = useState('All LGAs');
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalBudget: 0 });

  useEffect(() => {
    let isMounted = true;
    const loadProjects = async () => {
      try {
        const filters = {};
        if (categoryFilter !== 'All Categories') {
          filters.category = categoryFilter.toUpperCase().replace(' ', '_');
        }
        if (lgaFilter !== 'All LGAs') {
          filters.lga = lgaFilter;
        }
        const res = await publicAPI.getProjects(filters);
        if (res?.success && isMounted) {
          setProjects(res.data?.projects || []);
          // Calculate stats
          const allProjects = res.data?.projects || [];
          const totalBudget = allProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
          const active = allProjects.filter(p => p.status === 'IN_PROGRESS').length;
          const completed = allProjects.filter(p => p.status === 'COMPLETED').length;
          setStats({ total: allProjects.length, active, completed, totalBudget });
        }
      } catch (e) {
        console.error('Failed to load public projects:', e);
        if (isMounted) {
          let errorMessage = e.message || 'Failed to load projects';
          if (e.message && e.message.includes('Service Unavailable')) {
            errorMessage = 'Unable to connect to the server. Please check if the API server is running.';
          } else if (e.message && e.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again later.';
          }
          setError(errorMessage);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProjects();
    return () => { isMounted = false; };
  }, [categoryFilter, lgaFilter]);

  const filteredProjects = projects.filter(project => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return project.name.toLowerCase().includes(searchLower) ||
           project.description.toLowerCase().includes(searchLower);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Public Header */}
      <header className="bg-abia-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-abia-600 font-bold text-sm">GPT</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Government Project Tracker</h1>
                <p className="text-abia-100 text-sm">Public Transparency Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-abia-100 hover:text-white text-sm">
                Government Portal
              </Link>
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>+234 800 ABIA GOV</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Transparency in Action
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Track the progress of government projects across Abia State. See how your tax money is being used to build a better future for all citizens.
          </p>
          
          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.total}</p>
              <p className="text-gray-600">Total Projects</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{loading ? '...' : stats.completed}</p>
              <p className="text-gray-600">Completed</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-600">{loading ? '...' : `₦${(stats.totalBudget / 1000000000).toFixed(1)}B`}</p>
              <p className="text-gray-600">Total Investment</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-yellow-600">4.5M</p>
              <p className="text-gray-600">Citizens Benefited</p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex space-x-4">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={lgaFilter}
                onChange={(e) => setLgaFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
              >
                {lgas.map(lga => (
                  <option key={lga} value={lga}>{lga}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-900">Error Loading Projects</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {loading ? (
            <div className="col-span-3 text-center py-12 text-gray-500">Loading...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-gray-500">No projects found</div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <Building className="h-16 w-16 text-gray-400" />
                </div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{project.category} • {project.lga}</p>
                    </div>
                    <span className={clsx('status-badge ml-2', statusStyles[project.status])}>
                      {project.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">{project.description}</p>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={clsx(
                          'h-2 rounded-full',
                          project.status === 'COMPLETED' ? 'bg-green-500' :
                          project.status === 'DELAYED' ? 'bg-red-500' : 'bg-abia-600'
                        )}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <DollarSign className="h-3 w-3 mr-1" />
                      ₦{(project.budget || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {project.beneficiaries || 'N/A'}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {project.expectedEndDate ? new Date(project.expectedEndDate.toDate()).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="flex items-center">
                      <Building className="h-3 w-3 mr-1" />
                      {project.contractor?.companyName || 'N/A'}
                    </div>
                  </div>

                <button
                  onClick={() => setSelectedProject(project)}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
              ))
            )}
          </div>

        {/* Footer */}
        <footer className="bg-white rounded-lg shadow-sm border p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">About GPT</h3>
              <p className="text-gray-600 text-sm mb-4">
                The Government Project Tracker promotes transparency and accountability in government projects across Abia State.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-abia-600 hover:text-abia-700">
                  <Globe className="h-5 w-5" />
                </a>
                <a href="#" className="text-abia-600 hover:text-abia-700">
                  <Mail className="h-5 w-5" />
                </a>
                <a href="#" className="text-abia-600 hover:text-abia-700">
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-gray-600 hover:text-abia-600">All Projects</a></li>
                <li><a href="#" className="text-gray-600 hover:text-abia-600">Project Reports</a></li>
                <li><a href="#" className="text-gray-600 hover:text-abia-600">Budget Information</a></li>
                <li><a href="#" className="text-gray-600 hover:text-abia-600">Contact Government</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Abia State Government</p>
                <p>Government House, Umuahia</p>
                <p>Phone: +234 800 ABIA GOV</p>
                <p>Email: info@abiastate.gov.ng</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-500">
              © 2024 Abia State Government. All rights reserved. | Powered by Kreatix Technologies
            </p>
          </div>
        </footer>
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center mb-6">
                    <Building className="h-20 w-20 text-gray-400" />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Project Description</h3>
                      <p className="text-gray-700">{selectedProject.description}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Expected Impact</h3>
                      <p className="text-gray-700">
                        This project will directly benefit {selectedProject.beneficiaries} in {selectedProject.lga} LGA, 
                        improving quality of life and supporting economic development in the region.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={clsx('status-badge', statusStyles[selectedProject.status])}>
                            {selectedProject.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Budget:</span>
                          <span className="font-semibold">{selectedProject.budget}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-semibold">{selectedProject.lga} LGA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contractor:</span>
                          <span className="font-semibold">{selectedProject.contractor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Date:</span>
                          <span className="font-semibold">{new Date(selectedProject.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expected Completion:</span>
                          <span className="font-semibold">{new Date(selectedProject.expectedCompletion).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Progress Tracking</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Overall Progress</span>
                          <span className="font-bold text-lg">{selectedProject.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={clsx(
                              'h-3 rounded-full',
                              selectedProject.status === 'Completed' ? 'bg-green-500' :
                              selectedProject.status === 'Delayed' ? 'bg-red-500' : 'bg-abia-600'
                            )}
                            style={{ width: `${selectedProject.progress}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-600">
                          Last updated: {selectedProject.lastUpdate}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Transparency Note</h4>
                      <p className="text-sm text-gray-600">
                        This information is updated regularly based on contractor submissions and M&E team verifications. 
                        For questions or concerns, contact the Abia State Government directly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
