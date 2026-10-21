import { useState, useEffect } from 'react';
import { 
 Plus, 
 Search, 
 Filter, 
 Download, 
 Eye, 
 Star,
 Phone,
 Mail,
 MapPin,
 Building,
 User,
 Award,
 TrendingUp,
 AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useContractors } from '../contexts/ContractorsContext';
import ContractorDetailModal from '../components/Contractors/ContractorDetailModal';
import { contractorAPI } from '../services/api';

const RISK_STYLES = {
 LOW: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
 MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
 HIGH: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};


const specializationOptions = ['All Specializations', 'Road Construction', 'Healthcare Infrastructure', 'Water Infrastructure', 'Marine Infrastructure'];
const statusOptions = ['All Statuses', 'Active', 'Inactive'];

const statusStyles = {
 'Active': 'status-completed',
 'Inactive': 'status-not-started'
};

export default function Contractors() {
 const { contractors, error: contractorsError, loading: contractorsLoading } = useContractors();
 const [searchTerm, setSearchTerm] = useState('');
 const [specializationFilter, setSpecializationFilter] = useState('All Specializations');
 const [statusFilter, setStatusFilter] = useState('All Statuses');
 const [showFilters, setShowFilters] = useState(false);
 const [selectedContractor, setSelectedContractor] = useState(null);
 const [showDetailModal, setShowDetailModal] = useState(false);
 const [riskById, setRiskById] = useState({});

 useEffect(() => {
   contractorAPI.getRisk()
     .then((res) => {
       const map = {};
       (res?.data?.risk || []).forEach((r) => { map[r.contractorId] = r; });
       setRiskById(map);
     })
     .catch(() => {});
 }, []);

 const handleViewDetails = (contractor) => {
 setSelectedContractor(contractor);
 setShowDetailModal(true);
 };

 const handleCloseModal = () => {
 setSelectedContractor(null);
 setShowDetailModal(false);
 };

 const filteredContractors = contractors.filter(contractor => {
 const q = searchTerm.toLowerCase();
 const matchesSearch = (contractor.name || '').toLowerCase().includes(q) ||
 (contractor.contact || '').toLowerCase().includes(q) ||
 (contractor.id || '').toLowerCase().includes(q);
 const matchesSpecialization = specializationFilter === 'All Specializations' || contractor.specialization === specializationFilter;
 const matchesStatus = statusFilter === 'All Statuses' || contractor.status === statusFilter;
 
 return matchesSearch && matchesSpecialization && matchesStatus;
 });

 const ratedContractors = contractors.filter((c) => Number(c.rating) > 0);
 const avgRating = ratedContractors.length
   ? (ratedContractors.reduce((s, c) => s + Number(c.rating), 0) / ratedContractors.length).toFixed(1)
   : '—';

 const exportCsv = () => {
 const rows = [
 ['ID', 'Company', 'Registration', 'Contact', 'Email', 'Phone', 'Specialization', 'Rating', 'Verified', 'Certified'],
 ...filteredContractors.map((c) => [
 c.id, c.name, c.registrationNumber || '', c.contact || '', c.email || '', c.phone || '',
 c.specialization || '', c.rating ?? '', c.isVerified ? 'yes' : 'no', c.isCertified ? 'yes' : 'no',
 ]),
 ];
 const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
 const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
 const a = document.createElement('a');
 a.href = url;
 a.download = 'contractors.csv';
 a.click();
 URL.revokeObjectURL(url);
 };

 const renderStars = (rating) => {
 return Array.from({ length: 5 }, (_, i) => (
 <Star
 key={i}
 className={clsx(
 'h-4 w-4',
 i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-muted'
 )}
 />
 ));
 };

 return (
 <div className="space-y-8">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-3xl font-bold text-ink mb-2">Contractors</h1>
 <p className="text-lg text-muted">Manage and monitor all contractors working on government projects.</p>
 </div>
 <div className="mt-4 sm:mt-0 flex space-x-4">
 <button onClick={exportCsv} className="btn-secondary flex items-center space-x-2" disabled={filteredContractors.length === 0}>
 <Download className="h-4 w-4" />
 <span>Export</span>
 </button>
 <Link to="/contractors/new" className="btn-primary flex items-center space-x-2">
 <Plus className="h-4 w-4" />
 <span>Add New Contractor</span>
 </Link>
 </div>
 </div>

 {/* Error Message */}
 {contractorsError && (
 <div className="card bg-red-50 dark:bg-red-950/40 border border-red-200">
 <div className="flex items-center space-x-3">
 <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-400" />
 <div>
 <h3 className="text-sm font-medium text-red-900">Error Loading Contractors</h3>
 <p className="text-sm text-red-700 dark:text-red-400 mt-1">{contractorsError}</p>
 </div>
 </div>
 </div>
 )}

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <div className="card text-center">
 <div className="flex items-center justify-center w-14 h-14 bg-soft rounded-lg mx-auto mb-4">
 <Building className="h-7 w-7 text-soft-fg" />
 </div>
 <h3 className="text-3xl font-bold text-ink">{contractors.length}</h3>
 <p className="text-base text-muted mt-2">Total Contractors</p>
 </div>
 <div className="card text-center">
 <div className="flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-950/50 rounded-lg mx-auto mb-4">
 <User className="h-7 w-7 text-green-700 dark:text-green-400" />
 </div>
 <h3 className="text-3xl font-bold text-green-700 dark:text-green-400">
 {contractors.filter(c => c.status === 'Active').length}
 </h3>
 <p className="text-base text-muted mt-2">Active</p>
 </div>
 <div className="card text-center">
 <div className="flex items-center justify-center w-14 h-14 bg-yellow-100 dark:bg-yellow-950/50 rounded-lg mx-auto mb-4">
 <Award className="h-7 w-7 text-yellow-700 dark:text-yellow-400" />
 </div>
 <h3 className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{avgRating}</h3>
 <p className="text-base text-muted mt-2">Avg. Rating</p>
 </div>
 <div className="card text-center">
 <div className="flex items-center justify-center w-14 h-14 bg-purple-100 dark:bg-purple-950/50 rounded-lg mx-auto mb-4">
 <TrendingUp className="h-7 w-7 text-purple-700 dark:text-purple-400" />
 </div>
 <h3 className="text-3xl font-bold text-purple-700 dark:text-purple-400">
 {Object.values(riskById).reduce((sum, r) => sum + (r.signals?.totalProjects || 0), 0)}
 </h3>
 <p className="text-base text-muted mt-2">Total Projects</p>
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
 placeholder="Search contractors..."
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
 value={specializationFilter}
 onChange={(e) => setSpecializationFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 {specializationOptions.map(option => (
 <option key={option} value={option}>{option}</option>
 ))}
 </select>

 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 {statusOptions.map(option => (
 <option key={option} value={option}>{option}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 </div>

 {/* Contractors Table */}
 <div className="card">
 <div className="mb-6">
 <h3 className="text-xl font-semibold text-ink">All Contractors</h3>
 <p className="text-base text-muted mt-1">A comprehensive list of all contractors in the Government Project Tracker system.</p>
 </div>

 {/* Desktop Table */}
 <div className="hidden lg:block overflow-x-auto">
 <table className="min-w-full">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-4 px-4 font-semibold text-ink">ID</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Contractor</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Specialization</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Contact Person</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Rating</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Status</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Projects</th>
 <th className="text-left py-4 px-4 font-semibold text-ink">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredContractors.map((contractor) => (
 <tr key={contractor.id} className="border-b border-border hover:bg-bg transition-colors">
 <td className="py-5 px-4 text-base font-mono text-muted">{contractor.id}</td>
 <td className="py-5 px-4">
 <div>
 <p className="font-semibold text-base text-ink">{contractor.name}</p>
 <p className="text-sm text-muted mt-1">{contractor.email}</p>
 </div>
 </td>
 <td className="py-5 px-4 text-base text-muted">{contractor.specialization}</td>
 <td className="py-5 px-4">
 <div>
 <p className="text-base font-medium text-ink">{contractor.contact}</p>
 <p className="text-sm text-muted mt-1">{contractor.phone}</p>
 </div>
 </td>
 <td className="py-5 px-4">
 <div className="flex items-center space-x-2">
 <span className="text-base font-medium text-ink">{contractor.rating}</span>
 <div className="flex">
 {renderStars(contractor.rating)}
 </div>
 </div>
 </td>
 <td className="py-5 px-4">
 <div className="flex flex-col gap-1.5 items-start">
 <span className={clsx('status-badge', statusStyles[contractor.status])}>
 {contractor.status}
 </span>
 {riskById[contractor.id] && (
 <span
   className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', RISK_STYLES[riskById[contractor.id].level])}
   title={`Risk score ${riskById[contractor.id].score}/100 — stalled: ${riskById[contractor.id].signals.stalledProjects}, overdue milestones: ${riskById[contractor.id].signals.overdueMilestones}, rejections: ${riskById[contractor.id].signals.rejectionRate}%`}
 >
   {riskById[contractor.id].level === 'HIGH' ? '⚠ ' : ''}Risk: {riskById[contractor.id].level.toLowerCase()}
 </span>
 )}
 </div>
 </td>
 <td className="py-5 px-4">
 <div className="text-base">
 <p className="text-ink font-medium">{riskById[contractor.id]?.signals?.totalProjects ?? '—'} total</p>
 <p className="text-yellow-700 dark:text-yellow-400 mt-1">{riskById[contractor.id]?.signals?.stalledProjects ?? 0} stalled</p>
 </div>
 </td>
 <td className="py-5 px-4">
 <div className="flex items-center space-x-3">
 <button
 onClick={() => handleViewDetails(contractor)}
 className="text-soft-fg hover:text-soft-fg p-2 rounded-lg hover:bg-soft transition-colors"
 title="View Details"
 >
 <Eye className="h-5 w-5" />
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
 {filteredContractors.map((contractor) => (
 <div key={contractor.id} className="border border-border rounded-lg p-5">
 <div className="flex items-start justify-between mb-3">
 <div>
 <h4 className="font-medium text-ink">{contractor.name}</h4>
 <p className="text-sm text-muted font-mono">{contractor.id}</p>
 </div>
 <span className={clsx('status-badge', statusStyles[contractor.status])}>
 {contractor.status}
 </span>
 </div>
 
 <div className="grid grid-cols-2 gap-3 text-sm mb-3">
 <div className="flex items-center text-muted">
 <Building className="h-3 w-3 mr-1" />
 {contractor.specialization}
 </div>
 <div className="flex items-center text-muted">
 <User className="h-3 w-3 mr-1" />
 {contractor.contact}
 </div>
 <div className="flex items-center text-muted">
 <Phone className="h-3 w-3 mr-1" />
 {contractor.phone}
 </div>
 <div className="flex items-center text-muted">
 <MapPin className="h-3 w-3 mr-1" />
 {contractor.location}
 </div>
 </div>
 
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center space-x-1">
 <span className="text-sm font-medium text-ink">{contractor.rating}</span>
 <div className="flex">
 {renderStars(contractor.rating)}
 </div>
 </div>
 <div className="text-sm text-right">
 <p className="text-ink font-medium">{riskById[contractor.id]?.signals?.totalProjects ?? '—'} total</p>
 <p className="text-yellow-700 dark:text-yellow-400">{riskById[contractor.id]?.signals?.stalledProjects ?? 0} stalled</p>
 </div>
 </div>
 
 <div className="flex justify-end">
 <button
 onClick={() => handleViewDetails(contractor)}
 className="text-soft-fg hover:text-soft-fg text-sm font-medium flex items-center"
 >
 <Eye className="h-4 w-4 mr-1" />
 View Details
 </button>
 </div>
 </div>
 ))}
 </div>

 {filteredContractors.length === 0 && (
 <div className="text-center py-12">
 <div className="text-muted mb-4">
 <Building className="h-12 w-12 mx-auto" />
 </div>
 <h3 className="text-lg font-medium text-ink mb-2">No contractors found</h3>
 <p className="text-muted mb-4">Try adjusting your search or filter criteria.</p>
 <Link to="/contractors/new" className="btn-primary inline-flex items-center space-x-2">
 <Plus className="h-4 w-4" />
 <span>Add New Contractor</span>
 </Link>
 </div>
 )}
 </div>
 
 {/* Contractor Detail Modal */}
 <ContractorDetailModal
 contractor={selectedContractor}
 isOpen={showDetailModal}
 onClose={handleCloseModal}
 />
 </div>
 );
}
