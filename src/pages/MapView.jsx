import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
 Search,
 Filter,
 Layers,
 Eye,
 Info,
 Calendar,
 AlertTriangle,
 RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import { projectAPI, contractorAPI } from '../services/api';
import { collectAreas, areasLabel, fmtNairaCompact } from '../utils/statusMap';

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

const formatNaira = fmtNairaCompact;

export const getCoords = (location) => {
 if (!location || typeof location !== 'object') return null;
 const lat = Number(location.lat ?? location.latitude);
 const lng = Number(location.lng ?? location.lon ?? location.longitude);
 if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
 return null;
};

const TILE_LAYERS = {
 street: {
   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
   attribution: '&copy; OpenStreetMap contributors',
 },
 satellite: {
   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
   attribution: 'Esri, Maxar, Earthstar Geographics',
 },
 terrain: {
   url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
   attribution: '&copy; OpenTopoMap (CC-BY-SA)',
 },
};

// Re-frames the map whenever the set of geocoded projects changes.
function FitBounds({ points }) {
 const map = useMap();
 useEffect(() => {
   if (!points.length) return;
   const lats = points.map((p) => p.lat);
   const lngs = points.map((p) => p.lng);
   if (points.length === 1) {
     map.setView([points[0].lat, points[0].lng], 12);
   } else {
     map.fitBounds(
       [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
       { padding: [40, 40] }
     );
   }
 }, [points, map]);
 return null;
}

export default function MapView() {
 const [projects, setProjects] = useState([]);
 const [contractorNames, setContractorNames] = useState({});
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [selectedProject, setSelectedProject] = useState(null);
 const [categoryFilter, setCategoryFilter] = useState('All Categories');
 const [statusFilter, setStatusFilter] = useState('All Status');
 const [lgaFilter, setLgaFilter] = useState('ALL');
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

 const categories = useMemo(
 () => ['All Categories', ...new Set(projectLocations.map((p) => p.categoryLabel))],
 [projectLocations]
 );

 const filteredProjects = projectLocations.filter(project => {
 const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 project.lga.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesCategory = categoryFilter === 'All Categories' || project.categoryLabel === categoryFilter;
 const matchesStatus = statusFilter === 'All Status' || project.statusLabel === statusFilter;
 const matchesLGA = lgaFilter === 'ALL' || project.lga.includes(lgaFilter);

 return matchesSearch && matchesCategory && matchesStatus && matchesLGA;
 });

 const statusOptions = ['All Status', ...new Set(projectLocations.map((p) => p.statusLabel))];

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-ink">Project Map View</h1>
 <p className="text-muted">Interactive map showing project locations.</p>
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
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
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
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="text"
 placeholder="Search projects or locations..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 pr-4 py-2 w-full border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 {/* Filter Dropdowns */}
 <div className="flex flex-wrap gap-3">
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 {categories.map(category => (
 <option key={category} value={category}>{category}</option>
 ))}
 </select>

 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 {statusOptions.map(status => (
 <option key={status} value={status}>{status}</option>
 ))}
 </select>

 <select
 value={lgaFilter}
 onChange={(e) => setLgaFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 >
 {['ALL', ...collectAreas(projects)].map(lga => (
 <option key={lga} value={lga}>{lga === 'ALL' ? `All ${areasLabel()}` : lga}</option>
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
 <div className="relative h-[600px]">
 <MapContainer
   center={[9.0, 7.5]}
   zoom={5}
   className="absolute inset-0 h-full w-full z-0"
   scrollWheelZoom
 >
   <TileLayer
     key={mapView}
     url={TILE_LAYERS[mapView]?.url || TILE_LAYERS.street.url}
     attribution={TILE_LAYERS[mapView]?.attribution || TILE_LAYERS.street.attribution}
   />
   <FitBounds points={filteredProjects.map((p) => p.coords).filter(Boolean)} />
   {!loading && !error && filteredProjects.filter((p) => p.coords).map((project) => (
     <CircleMarker
       key={project.id}
       center={[project.coords.lat, project.coords.lng]}
       radius={9}
       pathOptions={{
         color: '#ffffff',
         weight: 2,
         fillColor: project.statusColor,
         fillOpacity: 0.9,
       }}
       eventHandlers={{ click: () => setSelectedProject(project) }}
     >
       <Popup>
         <div className="text-sm">
           <div className="font-semibold">{project.name}</div>
           <div>{project.statusLabel} · {project.progress}%</div>
           <div>{project.lga}</div>
         </div>
       </Popup>
     </CircleMarker>
   ))}
 </MapContainer>

 {loading && (
 <div className="absolute inset-0 bg-surface bg-opacity-70 flex items-center justify-center z-[1000]">
 <RefreshCw className="h-6 w-6 text-muted animate-spin mr-2" />
 <span className="text-muted">Loading projects...</span>
 </div>
 )}

 {error && !loading && (
 <div className="absolute inset-0 bg-surface bg-opacity-80 flex items-center justify-center z-[1000]">
 <div className="text-center">
 <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
 <p className="text-ink mb-3">{error}</p>
 <button onClick={fetchData} className="btn-primary">Try Again</button>
 </div>
 </div>
 )}

 {!loading && !error && filteredProjects.every((p) => !p.coords) && (
 <div className="absolute inset-x-0 bottom-4 flex justify-center z-[1000] pointer-events-none">
   <span className="bg-surface shadow rounded-lg px-4 py-2 text-sm text-muted">
     No coordinates yet — set a project's location to place it on the map
   </span>
 </div>
 )}

 {/* Legend */}
 {showLegend && (
 <div className="absolute bottom-4 left-4 bg-surface rounded-lg shadow-sm p-4 max-w-xs z-[1000]">
 <h4 className="font-semibold text-ink mb-3">Map Legend</h4>
 <div className="space-y-2">
 <div className="text-sm font-medium text-ink mb-1">Status</div>
 {Object.values(STATUS_META).map(({ label, color }) => (
 <div key={label} className="flex items-center space-x-2 text-sm">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: color }}
 />
 <span className="text-muted">{label}</span>
 </div>
 ))}
 <div className="text-sm font-medium text-ink mt-3 mb-1">Categories</div>
 {Object.values(CATEGORY_META).map(({ label, icon }) => (
 <div key={label} className="flex items-center space-x-2 text-sm">
 <span>{icon}</span>
 <span className="text-muted">{label}</span>
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
 <h3 className="font-semibold text-ink">Projects ({filteredProjects.length})</h3>
 <Filter className="h-4 w-4 text-muted" />
 </div>

 <div className="space-y-3 max-h-[500px] overflow-y-auto">
 {filteredProjects.map((project) => (
 <div
 key={project.id}
 className={clsx(
 'p-3 rounded-lg border cursor-pointer transition-colors',
 selectedProject?.id === project.id
 ? 'border-primary-300 bg-soft'
 : 'border-border hover:border-border hover:bg-bg'
 )}
 onClick={() => setSelectedProject(project)}
 >
 <div className="flex items-start space-x-2">
 <div
 className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
 style={{ backgroundColor: project.statusColor }}
 />
 <div className="flex-1 min-w-0">
 <h4 className="text-sm font-medium text-ink truncate">
 {project.name}
 </h4>
 <p className="text-xs text-muted mt-1">{project.lga} • {project.categoryLabel}</p>
 <div className="flex items-center justify-between mt-2">
 <span className="text-xs text-muted">{project.progress}% complete</span>
 <span className="text-xs font-medium text-ink">{project.budget}</span>
 </div>
 </div>
 </div>
 </div>
 ))}

 {!loading && !error && filteredProjects.length === 0 && (
 <p className="text-sm text-muted text-center py-6">No projects match the current filters.</p>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Project Details Modal */}
 {selectedProject && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className="bg-surface rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
 <div className="p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center space-x-3">
 <div
 className="w-4 h-4 rounded-full"
 style={{ backgroundColor: selectedProject.statusColor }}
 />
 <h2 className="text-xl font-bold text-ink">{selectedProject.name}</h2>
 </div>
 <button
 onClick={() => setSelectedProject(null)}
 className="text-muted hover:text-muted"
 >
 <span className="sr-only">Close</span>
 <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h3 className="font-semibold text-ink mb-3">Project Information</h3>
 <div className="space-y-3 text-sm">
 <div className="flex items-center justify-between">
 <span className="text-muted">Status:</span>
 <span className={`status-badge ${
 selectedProject.status === 'COMPLETED' ? 'status-completed' :
 selectedProject.status === 'IN_PROGRESS' || selectedProject.status === 'NEAR_COMPLETION' ? 'status-in-progress' :
 selectedProject.status === 'DELAYED' || selectedProject.status === 'ON_HOLD' ? 'status-delayed' : 'status-not-started'
 }`}>
 {selectedProject.statusLabel}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted">Budget:</span>
 <span className="font-semibold">{selectedProject.budget}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted">Location:</span>
 <span className="font-semibold">{Array.isArray(selectedProject.lga) ? selectedProject.lga.join(', ') : selectedProject.lga}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted">Category:</span>
 <span className="font-semibold">{selectedProject.categoryLabel}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted">Contractor:</span>
 <span className="font-semibold">{selectedProject.contractor}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted">Priority:</span>
 <span className={`status-badge ${
 selectedProject.priority === 'High' || selectedProject.priority === 'Critical' ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300' :
 selectedProject.priority === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300' :
 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
 }`}>
 {selectedProject.priority}
 </span>
 </div>
 </div>
 </div>

 <div>
 <h3 className="font-semibold text-ink mb-3">Progress Tracking</h3>
 <div className="space-y-4">
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-muted text-sm">Overall Progress</span>
 <span className="font-bold text-lg">{selectedProject.progress}%</span>
 </div>
 <div className="w-full bg-track rounded-full h-3">
 <div
 className="h-3 rounded-full"
 style={{
 width: `${selectedProject.progress}%`,
 backgroundColor: selectedProject.statusColor
 }}
 />
 </div>
 </div>

 <div className="pt-4 border-t border-border">
 <h4 className="font-medium text-ink mb-3">Quick Actions</h4>
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

 <div className="mt-6 pt-6 border-t border-border">
 <div className="flex items-center justify-between">
 <div className="text-sm text-muted">
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
