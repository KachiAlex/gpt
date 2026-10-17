import { useState } from 'react';
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
 MoreHorizontal,
 User,
 Award,
 TrendingUp,
 AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useContractors } from '../contexts/ContractorsContext';
import ContractorDetailModal from '../components/Contractors/ContractorDetailModal';


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

 // Debug logging
 console.log('Contractors page - contractors from context:', contractors);
 console.log('Contractors page - contractors count:', contractors.length);

 const handleViewDetails = (contractor) => {
 setSelectedContractor(contractor);
 setShowDetailModal(true);
 };

 const handleCloseModal = () => {
 setSelectedContractor(null);
 setShowDetailModal(false);
 };

 const filteredContractors = contractors.filter(contractor => {
 const matchesSearch = contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 contractor.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
 contractor.id.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesSpecialization = specializationFilter === 'All Specializations' || contractor.specialization === specializationFilter;
 const matchesStatus = statusFilter === 'All Statuses' || contractor.status === statusFilter;
 
 return matchesSearch && matchesSpecialization && matchesStatus;
 });

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
 <button className="btn-secondary flex items-center space-x-2">
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
 <h3 className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">4.4</h3>
 <p className="text-base text-muted mt-2">Avg. Rating</p>
 </div>
 <div className="card text-center">
 <div className="flex items-center justify-center w-14 h-14 bg-purple-100 dark:bg-purple-950/50 rounded-lg mx-auto mb-4">
 <TrendingUp className="h-7 w-7 text-purple-700 dark:text-purple-400" />
 </div>
 <h3 className="text-3xl font-bold text-purple-700 dark:text-purple-400">
 {contractors.reduce((sum, c) => sum + c.projects.ongoing, 0)}
 </h3>
 <p className="text-base text-muted mt-2">Ongoing Projects</p>
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
 className="pl-10 pr-4 py-2 w-full border border-border rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent"
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
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
 >
 {specializationOptions.map(option => (
 <option key={option} value={option}>{option}</option>
 ))}
 </select>

 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
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
 <span className={clsx('status-badge', statusStyles[contractor.status])}>
 {contractor.status}
 </span>
 </td>
 <td className="py-5 px-4">
 <div className="text-base">
 <p className="text-green-700 dark:text-green-400 font-medium">{contractor.projects.completed} completed</p>
 <p className="text-yellow-700 dark:text-yellow-400 mt-1">{contractor.projects.ongoing} ongoing</p>
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
 <button className="text-muted hover:text-muted p-2 rounded-lg hover:bg-bg transition-colors">
 <MoreHorizontal className="h-5 w-5" />
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
 <p className="text-green-700 dark:text-green-400 font-medium">{contractor.projects.completed} completed</p>
 <p className="text-yellow-700 dark:text-yellow-400">{contractor.projects.ongoing} ongoing</p>
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
