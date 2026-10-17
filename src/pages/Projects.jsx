import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  MapPin, 
  Calendar, 
  DollarSign,
  User,
  MoreHorizontal,
  FolderOpen,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { projectAPI } from '../services/api';

const statusMap = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  NEAR_COMPLETION: 'Near Completion',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
};

const statusOptions = ['All Statuses', 'In Progress', 'Completed', 'Delayed', 'Not Started'];
const lgaOptions = ['All LGAs', 'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi'];

const statusStyles = {
  'Completed': 'status-completed',
  'In Progress': 'status-in-progress',
  'Delayed': 'status-delayed',
  'Not Started': 'status-not-started'
};

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [selectedLGAs, setSelectedLGAs] = useState([]); // Changed to array for multiple selection
  const [showFilters, setShowFilters] = useState(false);
  const [showLGADropdown, setShowLGADropdown] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      // Check cache first (5 minute cache for projects list)
      const cacheKey = 'projects_list_cache';
      const cacheTime = 5 * 60 * 1000; // 5 minutes
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            if (isMounted) {
              setProjects(data);
              setLoading(false);
              return;
            }
          }
        }

        const res = await projectAPI.getAll();
        if (res?.success && isMounted) {
          const projectsData = res.data?.projects || [];
          setProjects(projectsData);
          // Cache the result
          localStorage.setItem(cacheKey, JSON.stringify({
            data: projectsData,
            timestamp: Date.now()
          }));
        }
      } catch (e) {
        if (isMounted) {
          let errorMessage = e.message || 'Failed to load projects';
          // Provide user-friendly error messages
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
    load();
    return () => { isMounted = false; };
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.contractor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Statuses' || project.status === statusFilter;
    // Allow matching if no LGAs selected (show all) or if project's LGA (array or string) intersects with selected list
    let matchesLGA = true;
    if (selectedLGAs.length > 0) {
      if (Array.isArray(project.lga)) {
        matchesLGA = project.lga.some(lga => selectedLGAs.includes(lga));
      } else {
        matchesLGA = selectedLGAs.includes(project.lga);
      }
    }
    
    return matchesSearch && matchesStatus && matchesLGA;
  });

  const handleLGAToggle = (lga) => {
    setSelectedLGAs(prev => 
      prev.includes(lga) 
        ? prev.filter(item => item !== lga) 
        : [...prev, lga]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
          <p className="text-lg text-gray-600">Manage and monitor all projects across Abia State.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-4">
          <button className="btn-secondary flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <Link to="/projects/new" className="btn-primary flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add New Project</span>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center space-x-2 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>

            <div className={clsx(
              'flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4',
              showFilters ? 'block' : 'hidden lg:flex'
            )}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
              >
                {statusOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              {/* LGA Multi-select dropdown */}
              <div className="relative">
                <select
                  onChange={() => {}} // Prevent default behavior
                  value=""
                  onClick={() => setShowLGADropdown(!showLGADropdown)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent cursor-pointer"
                >
                  <option value="">
                    {selectedLGAs.length === 0 
                      ? 'All LGAs' 
                      : `${selectedLGAs.length} selected`}
                  </option>
                </select>
                {showLGADropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-64 max-h-96 overflow-y-auto">
                    <div className="p-4 space-y-2">
                      {lgaOptions.slice(1).map(lga => (
                        <label key={lga} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedLGAs.includes(lga)}
                            onChange={() => handleLGAToggle(lga)}
                            className="w-4 h-4 text-abia-600 border-gray-300 rounded focus:ring-abia-500"
                          />
                          <span className="text-sm text-gray-700">{lga}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-gray-900">{projects.length}</h3>
          <p className="text-base text-gray-600 mt-2">Total Projects</p>
        </div>
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-green-600">
            {projects.filter(p => p.status === 'COMPLETED' || p.status === 'Completed').length}
          </h3>
          <p className="text-base text-gray-600 mt-2">Completed</p>
        </div>
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-yellow-600">
            {projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'In Progress').length}
          </h3>
          <p className="text-base text-gray-600 mt-2">In Progress</p>
        </div>
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-red-600">
            {projects.filter(p => p.status === 'DELAYED' || p.status === 'Delayed').length}
          </h3>
          <p className="text-base text-gray-600 mt-2">Delayed</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card bg-red-50 border border-red-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-900">Error Loading Projects</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="card">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900">All Projects</h3>
          <p className="text-base text-gray-600 mt-1">A comprehensive list of all projects in the Government Project Tracker system.</p>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-4 font-semibold text-gray-900">ID</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Project Name</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">LGA</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Contractor</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Timeline</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Budget</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Progress</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-4 text-base font-mono text-gray-600">{project.id}</td>
                  <td className="py-5 px-4">
                    <div>
                      <p className="font-semibold text-gray-900 text-base">{project.name}</p>
                      <p className="text-sm text-gray-500 mt-1">Updated: {project.lastUpdate}</p>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-base text-gray-600">
                    {Array.isArray(project.lga) ? project.lga.join(', ') : project.lga}
                  </td>
                  <td className="py-5 px-4 text-base text-gray-600">{project.contractor}</td>
                  <td className="py-5 px-4 text-base text-gray-600">{project.timeline}</td>
                  <td className="py-5 px-4 text-base font-medium text-gray-900">{project.budget}</td>
                  <td className="py-5 px-4">
                    <span className={clsx('status-badge', statusStyles[project.status])}>
                      {project.status}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-3 max-w-[100px]">
                        <div 
                          className={clsx(
                            'h-3 rounded-full',
                            project.status === 'COMPLETED' ? 'bg-green-500' :
                            project.status === 'DELAYED' ? 'bg-red-500' : 
                            project.status === 'Completed' ? 'bg-green-500' :
                            project.status === 'Delayed' ? 'bg-red-500' : 'bg-yellow-500'
                          )}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 min-w-[40px] font-medium">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center space-x-3">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-abia-600 hover:text-abia-700 p-2 rounded-lg hover:bg-abia-50 transition-colors"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                      <button className="text-gray-400 hover:text-gray-600 p-1 rounded">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {filteredProjects.map((project) => (
            <div key={project.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-500 font-mono">{project.id}</p>
                </div>
                <span className={clsx('status-badge', statusStyles[project.status])}>
                  {project.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-3 w-3 mr-1" />
                  {Array.isArray(project.lga) ? project.lga.join(', ') : project.lga}
                </div>
                <div className="flex items-center text-gray-600">
                  <User className="h-3 w-3 mr-1" />
                  {project.contractor}
                </div>
                <div className="flex items-center text-gray-600">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {project.budget}
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-3 w-3 mr-1" />
                  {project.lastUpdate}
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={clsx(
                      'h-2 rounded-full',
                      project.status === 'Completed' ? 'bg-green-500' :
                      project.status === 'Delayed' ? 'bg-red-500' : 'bg-yellow-500'
                    )}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
              
              <div className="mt-3 flex justify-end">
                <Link
                  to={`/projects/${project.id}`}
                  className="text-abia-600 hover:text-abia-700 text-sm font-medium flex items-center"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FolderOpen className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria.</p>
            <Link to="/projects/new" className="btn-primary inline-flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add New Project</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
