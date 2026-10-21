import { X, Building, User, Mail, Phone, MapPin, Award, FileText, Calendar, Star, Download, Eye } from 'lucide-react';

export default function ContractorDetailModal({ contractor, isOpen, onClose }) {
 if (!isOpen || !contractor) return null;

 const renderStars = (rating) => {
 return Array.from({ length: 5 }, (_, i) => (
 <Star
 key={i}
 className={`h-4 w-4 ${
 i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-muted'
 }`}
 />
 ));
 };

 const getStatusColor = (status) => {
 return status === 'Active' 
 ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' 
 : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300';
 };

 const formatDate = (dateString) => {
 return new Date(dateString).toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 });
 };

 const formatFileSize = (bytes) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 };

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div role="dialog" aria-modal="true" aria-label="Contractor details" className="bg-surface rounded-lg shadow-sm max-w-4xl w-full max-h-[90vh] overflow-hidden">
 {/* Header */}
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <div className="w-12 h-12 bg-soft rounded-lg flex items-center justify-center">
 <Building className="h-6 w-6 text-soft-fg" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-ink">{contractor.name}</h2>
 <p className="text-sm text-muted font-mono">{contractor.id}</p>
 </div>
 </div>
 <button
 onClick={onClose}
 aria-label="Close contractor details"
 className="text-muted hover:text-muted transition-colors"
 >
 <X className="h-6 w-6" />
 </button>
 </div>
 
 <div className="mt-4 flex items-center space-x-4">
 <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contractor.status)}`}>
 {contractor.status}
 </span>
 <div className="flex items-center space-x-1">
 <span className="text-sm font-medium text-ink">{contractor.rating}</span>
 <div className="flex">
 {renderStars(contractor.rating)}
 </div>
 </div>
 <div className="text-sm text-muted">
 Joined: {formatDate(contractor.joinDate)}
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 
 {/* Basic Information */}
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <User className="h-5 w-5 mr-2 text-soft-fg" />
 Basic Information
 </h3>
 <div className="space-y-3">
 <div className="flex items-center space-x-3">
 <Mail className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Email</p>
 <p className="text-sm text-muted">{contractor.email}</p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <Phone className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Phone</p>
 <p className="text-sm text-muted">{contractor.phone}</p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <User className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Contact Person</p>
 <p className="text-sm text-muted">{contractor.contact}</p>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <MapPin className="h-4 w-4 text-muted" />
 <div>
 <p className="text-sm font-medium text-ink">Location</p>
 <p className="text-sm text-muted">{contractor.location}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Business Information */}
 {(contractor.registrationNumber || contractor.specialization || contractor.yearsInBusiness) && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <Building className="h-5 w-5 mr-2 text-soft-fg" />
 Business Information
 </h3>
 <div className="space-y-3">
 {contractor.registrationNumber && (
 <div>
 <p className="text-sm font-medium text-ink">Registration Number</p>
 <p className="text-sm text-muted">{contractor.registrationNumber}</p>
 </div>
 )}
 {contractor.specialization && (
 <div>
 <p className="text-sm font-medium text-ink">Specialization</p>
 <p className="text-sm text-muted">{contractor.specialization}</p>
 </div>
 )}
 {contractor.yearsInBusiness && (
 <div>
 <p className="text-sm font-medium text-ink">Years in Business</p>
 <p className="text-sm text-muted">{contractor.yearsInBusiness} years</p>
 </div>
 )}
 {contractor.employeeCount && (
 <div>
 <p className="text-sm font-medium text-ink">Employee Count</p>
 <p className="text-sm text-muted">{contractor.employeeCount} employees</p>
 </div>
 )}
 {contractor.annualRevenue && (
 <div>
 <p className="text-sm font-medium text-ink">Annual Revenue</p>
 <p className="text-sm text-muted">{contractor.annualRevenue}</p>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Project Statistics */}
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <Award className="h-5 w-5 mr-2 text-soft-fg" />
 Project Statistics
 </h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
 <div className="text-2xl font-bold text-green-700 dark:text-green-400">{contractor.projects.completed}</div>
 <div className="text-sm text-green-700">Completed Projects</div>
 </div>
 <div className="bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-lg">
 <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{contractor.projects.ongoing}</div>
 <div className="text-sm text-yellow-700 dark:text-yellow-400">Ongoing Projects</div>
 </div>
 </div>
 <div className="mt-3">
 <div className="text-sm font-medium text-ink">Total Value</div>
 <div className="text-lg font-bold text-soft-fg">{contractor.totalValue}</div>
 </div>
 </div>
 </div>

 {/* Right Column */}
 <div className="space-y-6">
 
 {/* Assigned Projects */}
 {contractor.assignedProjects && contractor.assignedProjects.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <FileText className="h-5 w-5 mr-2 text-soft-fg" />
 Assigned Projects ({contractor.assignedProjects.length})
 </h3>
 <div className="space-y-2 max-h-40 overflow-y-auto">
 {contractor.assignedProjects.map((project, index) => (
 <div key={index} className="bg-bg p-3 rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-ink">{project.projectName}</p>
 <p className="text-xs text-muted">{project.projectId}</p>
 </div>
 <div className="text-xs text-muted">
 {formatDate(project.assignedAt)}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Documents */}
 {contractor.documents && contractor.documents.length > 0 && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <FileText className="h-5 w-5 mr-2 text-soft-fg" />
 Company Documents ({contractor.documents.length})
 </h3>
 <div className="space-y-2 max-h-40 overflow-y-auto">
 {contractor.documents.map((doc, index) => (
 <div key={index} className="bg-bg p-3 rounded-lg">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-3">
 <div className="w-8 h-8 bg-soft rounded flex items-center justify-center">
 <FileText className="h-4 w-4 text-soft-fg" />
 </div>
 <div>
 <p className="text-sm font-medium text-ink">{doc.name}</p>
 <div className="flex items-center space-x-2 text-xs text-muted">
 <span>{doc.category}</span>
 <span>•</span>
 <span>{formatFileSize(doc.size)}</span>
 </div>
 </div>
 </div>
 <div className="flex items-center space-x-2">
 <button className="p-1 text-muted hover:text-soft-fg">
 <Eye className="h-4 w-4" />
 </button>
 <button className="p-1 text-muted hover:text-green-700 dark:text-green-400">
 <Download className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Additional Information */}
 {(contractor.description || contractor.certifications || contractor.insuranceDetails) && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <FileText className="h-5 w-5 mr-2 text-soft-fg" />
 Additional Information
 </h3>
 <div className="space-y-4">
 {contractor.description && (
 <div>
 <p className="text-sm font-medium text-ink mb-1">Company Description</p>
 <p className="text-sm text-muted bg-bg p-3 rounded-lg">{contractor.description}</p>
 </div>
 )}
 {contractor.certifications && (
 <div>
 <p className="text-sm font-medium text-ink mb-1">Certifications</p>
 <p className="text-sm text-muted bg-bg p-3 rounded-lg">{contractor.certifications}</p>
 </div>
 )}
 {contractor.insuranceDetails && (
 <div>
 <p className="text-sm font-medium text-ink mb-1">Insurance Details</p>
 <p className="text-sm text-muted bg-bg p-3 rounded-lg">{contractor.insuranceDetails}</p>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Login Credentials */}
 {contractor.username && (
 <div>
 <h3 className="text-lg font-semibold text-ink mb-4 flex items-center">
 <User className="h-5 w-5 mr-2 text-soft-fg" />
 Login Credentials
 </h3>
 <div className="bg-soft p-4 rounded-lg">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <p className="text-sm font-medium text-blue-900">Username</p>
 <p className="text-sm text-soft-fg">{contractor.username}</p>
 </div>
 <div>
 <p className="text-sm font-medium text-blue-900">Status</p>
 <p className="text-sm text-soft-fg">Active</p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border bg-bg">
 <div className="flex items-center justify-between">
 <div className="text-sm text-muted">
 Last updated: {formatDate(contractor.joinDate)}
 </div>
 <div className="flex items-center space-x-3">
 <button
 onClick={onClose}
 className="px-4 py-2 text-ink bg-surface border border-border rounded-lg hover:bg-bg transition-colors"
 >
 Close
 </button>
 <button className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand transition-colors">
 Edit Contractor
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
