import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  Filter,
  Layers,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Info,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import { projectAPI, contractorAPI } from '../services/api';

const STATUS_META = {
  NOT_STARTED: { label: 'Not Started', color: '#6b7280' },
  IN_PROGRESS: { label: 'In Progress', color: '#3b82f6' },
  NEAR_COMPLETION: { label: 'Near Completion', color: '#8b5cf6' },
  COMPLETED: { label: 'Completed', color: '#10b981' },
  DELAYED: { label: 'Delayed', color: '#ef4444' },
  ON_HOLD: { label: 'On Hold', color: '#f59e0b' },
  CANCELLED: { label: 'Cancelled', color: '#9ca3af' },
};

const CATEGORY_META = {
  TRANSPORTATION: { label: 'Transportation', icon: '🛣️' },
  HEALTHCARE: { label: 'Healthcare', icon: '🏥' },
  WATER_SANITATION: { label: 'Water & Sanitation', icon: '💧' },
  EDUCATION: { label: 'Education', icon: '🏫' },
  HOUSING: { label: 'Housing', icon: '🏠' },
  AGRICULTURE: { label: 'Agriculture', icon: '🌾' },
  ENERGY: { label: 'Energy', icon: '⚡' },
  ICT: { label: 'ICT', icon: '💻' },
  TOURISM: { label: 'Tourism', icon: '🏖️' },
  ENVIRONMENT: { label: 'Environment', icon: '🌳' },
};

const PRIORITY_LABELS = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
};

const lgas = ['All LGAs', 'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi'];

const formatNaira = (value) => {
  const n = Number(value || 0);
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(0)}M`;
  return `₦${n.toLocaleString()}`;
};

const getCoords = (location) => {
  if (!location || typeof location !== 'object') return null;
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.lon ?? location.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
};

export default function MapView() {
  const [projects, setProjects] = useState([]);
  const [contractorNames, setContractorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [lgaFilter, setLgaFilter] = useState('All LGAs');
  const [searchTerm, setSearchTerm] = useState('');
  const [mapView, setMapView] = useState('satellite'); // satellite, street, terrain
  const [showLegend, setShowLegend] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsRes, contractorsRes] = await Promise.all([
        projectAPI.getAll({ limit: 100 }),
        contractorAPI.getAll({ limit: 100 }),
      ]);
      setProjects(projectsRes.data?.projects || []);

      const nameMap = {};
      (contractorsRes.data?.contractors || []).forEach((c) => {
        nameMap[c.id] = c.companyName;
      });
      setContractorNames(nameMap);
    } catch (err) {
      console.error('Failed to load map data:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const projectLocations = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        statusLabel: STATUS_META[p.status]?.label || p.status,
        statusColor: STATUS_META[p.status]?.color || '#6b7280',
        progress: Number(p.progress || 0),
        budget: formatNaira(p.budget),
        lga: Array.isArray(p.lga) ? p.lga.join(', ') : p.lga || '—',
        category: p.category,
        categoryLabel: CATEGORY_META[p.category]?.label || p.category,
        categoryIcon: CATEGORY_META[p.category]?.icon || '📍',
        priority: PRIORITY_LABELS[p.priority] || p.priority,
        contractor: contractorNames[p.contractorId] || 'Unassigned',
        coords: getCoords(p.location),
      })),
    [projects, contractorNames]
  );

  // Bounding box for geo-positioned markers (falls back to index scatter)
  const bounds = useMemo(() => {
    const coords = projectLocations.map((p) => p.coords).filter(Boolean);
    if (coords.length === 0) return null;
    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    return {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    };
  }, [projectLocations]);

  const markerPosition = (project, index) => {
    if (project.coords && bounds) {
      const latSpan = bounds.maxLat - bounds.minLat || 0.01;
      const lngSpan = bounds.maxLng - bounds.minLng || 0.01;
      const left = 10 + ((project.coords.lng - bounds.minLng) / lngSpan) * 80;
      const top = 90 - ((project.coords.lat - bounds.minLat) / latSpan) * 80;
      return { left: `${left}%`, top: `${top}%` };
    }
    return {
      left: `${20 + (index * 15) % 60}%`,
      top: `${30 + (index * 12) % 40}%`,
    };
  };

  const categories = useMemo(
    () => ['All Categories', ...new Set(projectLocations.map((p) => p.categoryLabel))],
    [projectLocations]
  );

  const filteredProjects = projectLocations.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.lga.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All Categories' || project.categoryLabel === categoryFilter;
    const matchesStatus = statusFilter === 'All Status' || project.statusLabel === statusFilter;
    const matchesLGA = lgaFilter === 'All LGAs' || project.lga.includes(lgaFilter);

    return matchesSearch && matchesCategory && matchesStatus && matchesLGA;
  });

  const statusOptions = ['All Status', ...new Set(projectLocations.map((p) => p.statusLabel))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Map View</h1>
          <p className="text-gray-600">Interactive map showing project locations across Abia State.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={fetchData}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Layers className="h-4 w-4" />
            <span>Legend</span>
          </button>
          <select
            value={mapView}
            onChange={(e) => setMapView(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
          >
            <option value="satellite">Satellite</option>
            <option value="street">Street</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects or locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={lgaFilter}
              onChange={(e) => setLgaFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
            >
              {lgas.map(lga => (
                <option key={lga} value={lga}>{lga}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3">
          <div className="card p-0 overflow-hidden">
            <div className="relative bg-gradient-to-br from-blue-50 to-green-50 h-[600px]">
              {/* Map Background */}
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Interactive Map</p>
                  <p className="text-sm text-gray-500">Abia State Project Locations</p>
                </div>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
                  <RefreshCw className="h-6 w-6 text-gray-400 animate-spin mr-2" />
                  <span className="text-gray-600">Loading projects...</span>
                </div>
              )}

              {error && !loading && (
                <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
                  <div className="text-center">
                    <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-gray-700 mb-3">{error}</p>
                    <button onClick={fetchData} className="btn-primary">Try Again</button>
                  </div>
                </div>
              )}

              {/* Map Controls */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
                  <ZoomIn className="h-4 w-4 text-gray-600" />
                </button>
                <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
                  <ZoomOut className="h-4 w-4 text-gray-600" />
                </button>
                <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
                  <Navigation className="h-4 w-4 text-gray-600" />
                </button>
                <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
                  <RotateCcw className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              {/* Project Markers */}
              {!loading && !error && filteredProjects.map((project, index) => (
                <div
                  key={project.id}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                  style={markerPosition(project, index)}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="relative">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                      style={{ backgroundColor: project.statusColor }}
                    />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full flex items-center justify-center text-xs">
                      {project.categoryIcon}
                    </div>
                  </div>
                </div>
              ))}

              {/* Legend */}
              {showLegend && (
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
                  <h4 className="font-semibold text-gray-900 mb-3">Map Legend</h4>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700 mb-1">Status</div>
                    {Object.values(STATUS_META).map(({ label, color }) => (
                      <div key={label} className="flex items-center space-x-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-600">{label}</span>
                      </div>
                    ))}
                    <div className="text-sm font-medium text-gray-700 mt-3 mb-1">Categories</div>
                    {Object.values(CATEGORY_META).map(({ label, icon }) => (
                      <div key={label} className="flex items-center space-x-2 text-sm">
                        <span>{icon}</span>
                        <span className="text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project List Sidebar */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Projects ({filteredProjects.length})</h3>
              <Filter className="h-4 w-4 text-gray-400" />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={clsx(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedProject?.id === project.id
                      ? 'border-abia-300 bg-abia-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex items-start space-x-2">
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: project.statusColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {project.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">{project.lga} • {project.categoryLabel}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-600">{project.progress}% complete</span>
                        <span className="text-xs font-medium text-gray-900">{project.budget}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!loading && !error && filteredProjects.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No projects match the current filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedProject.statusColor }}
                  />
                  <h2 className="text-xl font-bold text-gray-900">{selectedProject.name}</h2>
                </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Project Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`status-badge ${
                        selectedProject.status === 'COMPLETED' ? 'status-completed' :
                        selectedProject.status === 'IN_PROGRESS' || selectedProject.status === 'NEAR_COMPLETION' ? 'status-in-progress' :
                        selectedProject.status === 'DELAYED' || selectedProject.status === 'ON_HOLD' ? 'status-delayed' : 'status-not-started'
                      }`}>
                        {selectedProject.statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Budget:</span>
                      <span className="font-semibold">{selectedProject.budget}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-semibold">{selectedProject.lga} LGA</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-semibold">{selectedProject.categoryLabel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Contractor:</span>
                      <span className="font-semibold">{selectedProject.contractor}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Priority:</span>
                      <span className={`status-badge ${
                        selectedProject.priority === 'High' || selectedProject.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                        selectedProject.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {selectedProject.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Progress Tracking</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600 text-sm">Overall Progress</span>
                        <span className="font-bold text-lg">{selectedProject.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${selectedProject.progress}%`,
                            backgroundColor: selectedProject.statusColor
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Link to={`/projects/${selectedProject.id}`} className="btn-secondary text-sm py-2 text-center">
                          <Eye className="h-4 w-4 mr-1 inline" />
                          View Details
                        </Link>
                        <button className="btn-secondary text-sm py-2">
                          <Info className="h-4 w-4 mr-1 inline" />
                          Project Info
                        </button>
                        <button className="btn-secondary text-sm py-2">
                          <Calendar className="h-4 w-4 mr-1 inline" />
                          Timeline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Project ID: {selectedProject.id}
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="btn-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
