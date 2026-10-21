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
 FolderOpen,
 AlertTriangle,
 Globe,
 Trash2
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { projectAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { invalidateCache, CACHE_KEYS } from '../utils/cache';
import { collectAreas, areaLabel, areasLabel, fmtNairaCompact, fmtDate } from '../utils/statusMap';

const statusMap = {
 NOT_STARTED: 'Not Started',
 IN_PROGRESS: 'In Progress',
 NEAR_COMPLETION: 'Near Completion',
 COMPLETED: 'Completed',
 DELAYED: 'Delayed',
 ON_HOLD: 'On Hold',
 CANCELLED: 'Cancelled',
};

const statusOptions = [
 { value: '', label: 'All Statuses' },
 ...Object.entries(statusMap).map(([value, label]) => ({ value, label })),
];

const statusStyles = {
 COMPLETED: 'status-completed',
 IN_PROGRESS: 'status-in-progress',
 DELAYED: 'status-delayed',
 NOT_STARTED: 'status-not-started',
 ON_HOLD: 'status-delayed',
 CANCELLED: 'status-delayed',
};

const PAGE_SIZE = 20;

export default function Projects() {
 const { user } = useAuth();
 const [searchParams] = useSearchParams();
 const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
 const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
 const [statusFilter, setStatusFilter] = useState('');
 const [selectedLGAs, setSelectedLGAs] = useState([]); // Changed to array for multiple selection
 const [showFilters, setShowFilters] = useState(false);
 const [showLGADropdown, setShowLGADropdown] = useState(false);
 const [projects, setProjects] = useState([]);
 const [pagination, setPagination] = useState(null);
 const [page, setPage] = useState(1);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [allLgaOptions, setAllLgaOptions] = useState([]);
 const [deletingId, setDeletingId] = useState(null);
 const isAdmin = user?.role === 'GOVERNMENT_ADMIN';

 // Sync search box when arriving via header search (/projects?search=...)
 useEffect(() => {
 const q = searchParams.get('search');
 if (q !== null) setSearchTerm(q);
 }, [searchParams]);

 // Debounce the search box so we don't fire a request per keystroke
 useEffect(() => {
 const t = setTimeout(() => {
 setDebouncedSearch(searchTerm);
 setPage(1);
 }, 350);
 return () => clearTimeout(t);
 }, [searchTerm]);

 // Server-side filtering + pagination — client-side filters would only see
 // the current page, silently hiding every other result
 useEffect(() => {
 let isMounted = true;
 const load = async () => {
 const filters = { page, limit: PAGE_SIZE };
 if (statusFilter) filters.status = statusFilter;
 if (debouncedSearch) filters.search = debouncedSearch;
 if (selectedLGAs.length > 0) filters.lga = selectedLGAs;

 // Cache only the default view (page 1, no filters), keyed per user
 const isDefaultView = page === 1 && !statusFilter && !debouncedSearch && selectedLGAs.length === 0;
 const cacheKey = `projects_list_cache_${user?.id || 'anon'}`;
 try {
 if (isDefaultView) {
 const cached = localStorage.getItem(cacheKey);
 if (cached) {
 const { data, timestamp } = JSON.parse(cached);
 if (Date.now() - timestamp < 5 * 60 * 1000) {
 if (isMounted) {
 setProjects(data.projects);
 setPagination(data.pagination);
 setAllLgaOptions(data.lgaOptions || []);
 setLoading(false);
 return;
 }
 }
 }
 }

 const res = await projectAPI.getAll(filters);
 if (res?.success && isMounted) {
 const projectsData = res.data?.projects || [];
 const pg = res.data?.pagination || null;
 setProjects(projectsData);
 setPagination(pg);
 if (isDefaultView) {
 const lgaOptions = collectAreas(projectsData);
 setAllLgaOptions(lgaOptions);
 localStorage.setItem(cacheKey, JSON.stringify({
 data: { projects: projectsData, pagination: pg, lgaOptions },
 timestamp: Date.now()
 }));
 }
 }
 } catch (e) {
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
 setLoading(true);
 setError('');
 load();
 return () => { isMounted = false; };
 }, [page, statusFilter, debouncedSearch, selectedLGAs, user?.id]);

 const filteredProjects = projects;
 const lgaOptions = allLgaOptions;

 const deleteProject = async (project) => {
 if (!window.confirm(`Delete project "${project.name}"? This permanently removes its milestones, submissions, and documents. This cannot be undone.`)) return;
 setDeletingId(project.id);
 try {
 const res = await projectAPI.delete(project.id);
 if (res?.success) {
 // Drop it from state + every cache that could hold it
 setProjects((prev) => prev.filter((p) => p.id !== project.id));
 setPagination((prev) => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
 invalidateCache(`projects_list_cache_${user?.id}`);
 invalidateCache(`recent_projects_cache_${user?.id}`);
 invalidateCache(CACHE_KEYS.DASHBOARD_STATS);
 showSuccess('Project deleted');
 }
 } catch (e) {
 showError(e.message || 'Failed to delete project');
 } finally {
 setDeletingId(null);
 }
 };

 const exportCsv = () => {
 const rows = [
 ['ID', 'Name', 'Category', 'Status', 'Progress %', 'Budget', 'Contractor', 'LGA', 'Start', 'Expected End'],
 ...filteredProjects.map((p) => [
 p.id, p.name, p.category, statusMap[p.status] || p.status, p.progress ?? '',
 p.budget ?? '', p.contractor || '', Array.isArray(p.lga) ? p.lga.join('; ') : p.lga || '',
 p.startDate ? fmtDate(p.startDate) : '', p.expectedEndDate ? fmtDate(p.expectedEndDate) : '',
 ]),
 ];
 const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
 const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
 const a = document.createElement('a');
 a.href = url;
 a.download = `projects-page-${page}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 };

 const handleLGAToggle = (lga) => {
 setSelectedLGAs(prev => 
 prev.includes(lga) 
 ? prev.filter(item => item !== lga) 
 : [...prev, lga]
 );
 setPage(1);
 };

 return (
 <div className="space-y-8">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-3xl font-bold text-ink mb-2">Projects</h1>
 <p className="text-lg text-muted">Manage and monitor all projects.</p>
 </div>
 <div className="mt-4 sm:mt-0 flex space-x-4">
 <button onClick={exportCsv} className="btn-secondary flex items-center space-x-2" disabled={filteredProjects.length === 0}>
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
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="text"
 placeholder="Search projects..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 pr-4 py-2 w-full border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
 onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 {statusOptions.map(option => (
 <option key={option.value} value={option.value}>{option.label}</option>
 ))}
 </select>

 {/* Area multi-select dropdown */}
 <div className="relative">
 <select
 onChange={() => {}} // Prevent default behavior
 value=""
 onClick={() => setShowLGADropdown(!showLGADropdown)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
 >
 <option value="">
 {selectedLGAs.length === 0 
 ? `All ${areasLabel()}` 
 : `${selectedLGAs.length} selected`}
 </option>
 </select>
 {showLGADropdown && (
 <div className="absolute top-full left-0 mt-2 bg-surface border border-border rounded-lg shadow-sm z-50 w-64 max-h-96 overflow-y-auto">
 <div className="p-4 space-y-2">
 {lgaOptions.map(lga => (
 <label key={lga} className="flex items-center space-x-2 cursor-pointer hover:bg-bg p-2 rounded">
 <input
 type="checkbox"
 checked={selectedLGAs.includes(lga)}
 onChange={() => handleLGAToggle(lga)}
 className="w-4 h-4 text-soft-fg border-border rounded focus:ring-primary-500"
 />
 <span className="text-sm text-ink">{lga}</span>
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

 {/* Projects Overview Stats — scoped to the current filter set */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <div className="card text-center">
 <h3 className="text-3xl font-bold text-ink">{pagination?.total ?? projects.length}</h3>
 <p className="text-base text-muted mt-2">Total Projects</p>
 </div>
 <div className="card text-center">
 <h3 className="text-3xl font-bold text-green-700 dark:text-green-400">
 {projects.filter(p => p.status === 'COMPLETED').length}
 </h3>
 <p className="text-base text-muted mt-2">Completed (this page)</p>
 </div>
 <div className="card text-center">
 <h3 className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
 {projects.filter(p => p.status === 'IN_PROGRESS').length}
 </h3>
 <p className="text-base text-muted mt-2">In Progress (this page)</p>
 </div>
 <div className="card text-center">
 <h3 className="text-3xl font-bold text-red-700 dark:text-red-400">
 {projects.filter(p => p.status === 'DELAYED' || p.status === 'ON_HOLD').length}
 </h3>
 <p className="text-base text-muted mt-2">Delayed (this page)</p>
 </div>
 </div>

 {/* Error Message */}
 {error && (
 <div className="card bg-red-50 dark:bg-red-950/40 border border-red-200">
 <div className="flex items-center space-x-3">
 <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-400" />
 <div>
 <h3 className="text-sm font-medium text-red-900">Error Loading Projects</h3>
 <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
 </div>
 </div>
 </div>
 )}

 {/* Projects Table */}
 <div className="card">
 <div className="mb-6">
 <h3 className="text-xl font-semibold text-ink">All Projects</h3>
 <p className="text-base text-muted mt-1">A comprehensive list of all projects in the Government Project Tracker system.</p>
 </div>

 {/* Desktop Table */}
 <div className="hidden lg:block overflow-x-auto">
 <table className="min-w-full">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-4 px-4 font-semibold text-ink">ID</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Project Name</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">{areaLabel()}</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Contractor</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Timeline</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Budget</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Status</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Progress</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredProjects.map((project) => (
 <tr key={project.id} className="border-b border-border hover:bg-bg transition-colors">
 <td className="py-5 px-4 text-base font-mono text-muted">{project.id}</td>
 <td className="py-5 px-4">
 <div>
 <p className="font-semibold text-ink text-base flex items-center gap-1.5">
 {project.name}
 {project.isPublic && <Globe className="w-4 h-4 text-green-600" aria-label="Public" />}
 </p>
 <p className="text-sm text-muted mt-1">Updated: {fmtDate(project.updatedAt)}</p>
 </div>
 </td>
 <td className="py-5 px-4 text-base text-muted">
 {Array.isArray(project.lga) ? project.lga.join(', ') : project.lga}
 </td>
 <td className="py-5 px-4 text-base text-muted">{project.contractor || '—'}</td>
 <td className="py-5 px-4 text-base text-muted">{project.startDate && project.expectedEndDate ? `${fmtDate(project.startDate)} – ${fmtDate(project.expectedEndDate)}` : '—'}</td>
 <td className="py-5 px-4 text-base font-medium text-ink">{fmtNairaCompact(project.budget)}</td>
 <td className="py-5 px-4">
 <span className={clsx('status-badge', statusStyles[project.status])}>
 {statusMap[project.status] || project.status}
 </span>
 </td>
 <td className="py-5 px-4">
 <div className="flex items-center space-x-3">
 <div className="flex-1 bg-track rounded-full h-3 max-w-[100px]">
 <div 
 className={clsx(
 'h-3 rounded-full',
 project.status === 'COMPLETED' ? 'bg-green-500' :
 project.status === 'DELAYED' || project.status === 'ON_HOLD' ? 'bg-red-500' : 'bg-yellow-500'
 )}
 style={{ width: `${project.progress}%` }}
 />
 </div>
 <span className="text-sm text-muted min-w-[40px] font-medium">{project.progress}%</span>
 </div>
 </td>
 <td className="py-5 px-4">
 <div className="flex items-center space-x-1">
 <Link
 to={`/projects/${project.id}`}
 className="text-soft-fg hover:text-soft-fg p-2 rounded-lg hover:bg-soft transition-colors"
 >
 <Eye className="h-5 w-5" />
 </Link>
 {isAdmin && (
 <button
 type="button"
 onClick={() => deleteProject(project)}
 disabled={deletingId === project.id}
 className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
 title="Delete project"
 aria-label={`Delete ${project.name}`}
 >
 <Trash2 className="h-5 w-5" />
 </button>
 )}
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
 <div key={project.id} className="border border-border rounded-lg p-4">
 <div className="flex items-start justify-between mb-3">
 <div>
 <h4 className="font-medium text-ink flex items-center gap-1.5">
 {project.name}
 {project.isPublic && <Globe className="w-4 h-4 text-green-600" aria-label="Public" />}
 </h4>
 <p className="text-sm text-muted font-mono">{project.id}</p>
 </div>
 <span className={clsx('status-badge', statusStyles[project.status])}>
 {statusMap[project.status] || project.status}
 </span>
 </div>
 
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div className="flex items-center text-muted">
 <MapPin className="h-3 w-3 mr-1" />
 {Array.isArray(project.lga) ? project.lga.join(', ') : project.lga}
 </div>
 <div className="flex items-center text-muted">
 <User className="h-3 w-3 mr-1" />
 {project.contractor}
 </div>
 <div className="flex items-center text-muted">
 <DollarSign className="h-3 w-3 mr-1" />
 {fmtNairaCompact(project.budget)}
 </div>
 <div className="flex items-center text-muted">
 <Calendar className="h-3 w-3 mr-1" />
 {fmtDate(project.updatedAt)}
 </div>
 </div>
 
 <div className="mt-3">
 <div className="flex items-center justify-between text-sm mb-1">
 <span className="text-muted">Progress</span>
 <span className="font-medium">{project.progress}%</span>
 </div>
 <div className="w-full bg-track rounded-full h-2">
 <div 
 className={clsx(
 'h-2 rounded-full',
 project.status === 'COMPLETED' ? 'bg-green-500' :
 project.status === 'DELAYED' ? 'bg-red-500' : 'bg-yellow-500'
 )}
 style={{ width: `${project.progress}%` }}
 />
 </div>
 </div>
 
 <div className="mt-3 flex justify-end items-center space-x-3">
 {isAdmin && (
 <button
 type="button"
 onClick={() => deleteProject(project)}
 disabled={deletingId === project.id}
 className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center disabled:opacity-50"
 >
 <Trash2 className="h-4 w-4 mr-1" />
 {deletingId === project.id ? 'Deleting…' : 'Delete'}
 </button>
 )}
 <Link
 to={`/projects/${project.id}`}
 className="text-soft-fg hover:text-soft-fg text-sm font-medium flex items-center"
 >
 <Eye className="h-4 w-4 mr-1" />
 View Details
 </Link>
 </div>
 </div>
 ))}
 </div>

 {filteredProjects.length === 0 && !loading && (
 <div className="text-center py-12">
 <div className="text-muted mb-4">
 <FolderOpen className="h-12 w-12 mx-auto" />
 </div>
 <h3 className="text-lg font-medium text-ink mb-2">No projects found</h3>
 <p className="text-muted mb-4">Try adjusting your search or filter criteria.</p>
 <Link to="/projects/new" className="btn-primary inline-flex items-center space-x-2">
 <Plus className="h-4 w-4" />
 <span>Add New Project</span>
 </Link>
 </div>
 )}

 {/* Pagination — filters run server-side so paging is real */}
 {pagination && pagination.pages > 1 && (
 <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
 <p className="text-sm text-muted">
 Page {pagination.page} of {pagination.pages} — {pagination.total} project{pagination.total === 1 ? '' : 's'}
 </p>
 <div className="flex space-x-2">
 <button
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="btn-secondary text-sm py-1.5 disabled:opacity-50"
 >
 Previous
 </button>
 <button
 onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
 disabled={page >= pagination.pages}
 className="btn-secondary text-sm py-1.5 disabled:opacity-50"
 >
 Next
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
