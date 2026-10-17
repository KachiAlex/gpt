import { X, Building, User, Mail, Phone, MapPin, Award, FileText, Calendar, Star, Download, Eye } from 'lucide-react';

export default function ContractorDetailModal({ contractor, isOpen, onClose }) {
  if (!isOpen || !contractor) return null;

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const getStatusColor = (status) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{contractor.name}</h2>
                <p className="text-sm text-gray-500 font-mono">{contractor.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="mt-4 flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contractor.status)}`}>
              {contractor.status}
            </span>
            <div className="flex items-center space-x-1">
              <span className="text-sm font-medium text-gray-900">{contractor.rating}</span>
              <div className="flex">
                {renderStars(contractor.rating)}
              </div>
            </div>
            <div className="text-sm text-gray-500">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2 text-blue-600" />
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-600">{contractor.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <p className="text-sm text-gray-600">{contractor.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Contact Person</p>
                      <p className="text-sm text-gray-600">{contractor.contact}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Location</p>
                      <p className="text-sm text-gray-600">{contractor.location}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              {(contractor.registrationNumber || contractor.specialization || contractor.yearsInBusiness) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Building className="h-5 w-5 mr-2 text-blue-600" />
                    Business Information
                  </h3>
                  <div className="space-y-3">
                    {contractor.registrationNumber && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Registration Number</p>
                        <p className="text-sm text-gray-600">{contractor.registrationNumber}</p>
                      </div>
                    )}
                    {contractor.specialization && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Specialization</p>
                        <p className="text-sm text-gray-600">{contractor.specialization}</p>
                      </div>
                    )}
                    {contractor.yearsInBusiness && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Years in Business</p>
                        <p className="text-sm text-gray-600">{contractor.yearsInBusiness} years</p>
                      </div>
                    )}
                    {contractor.employeeCount && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Employee Count</p>
                        <p className="text-sm text-gray-600">{contractor.employeeCount} employees</p>
                      </div>
                    )}
                    {contractor.annualRevenue && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Annual Revenue</p>
                        <p className="text-sm text-gray-600">{contractor.annualRevenue}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Project Statistics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Award className="h-5 w-5 mr-2 text-blue-600" />
                  Project Statistics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{contractor.projects.completed}</div>
                    <div className="text-sm text-green-700">Completed Projects</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{contractor.projects.ongoing}</div>
                    <div className="text-sm text-yellow-700">Ongoing Projects</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-900">Total Value</div>
                  <div className="text-lg font-bold text-blue-600">{contractor.totalValue}</div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Assigned Projects */}
              {contractor.assignedProjects && contractor.assignedProjects.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-blue-600" />
                    Assigned Projects ({contractor.assignedProjects.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contractor.assignedProjects.map((project, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{project.projectName}</p>
                            <p className="text-xs text-gray-500">{project.projectId}</p>
                          </div>
                          <div className="text-xs text-gray-500">
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-blue-600" />
                    Company Documents ({contractor.documents.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contractor.documents.map((doc, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span>{doc.category}</span>
                                <span>•</span>
                                <span>{formatFileSize(doc.size)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button className="p-1 text-gray-400 hover:text-blue-600">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-green-600">
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-blue-600" />
                    Additional Information
                  </h3>
                  <div className="space-y-4">
                    {contractor.description && (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Company Description</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{contractor.description}</p>
                      </div>
                    )}
                    {contractor.certifications && (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Certifications</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{contractor.certifications}</p>
                      </div>
                    )}
                    {contractor.insuranceDetails && (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Insurance Details</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{contractor.insuranceDetails}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Login Credentials */}
              {contractor.username && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" />
                    Login Credentials
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Username</p>
                        <p className="text-sm text-blue-700">{contractor.username}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Status</p>
                        <p className="text-sm text-blue-700">Active</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Last updated: {formatDate(contractor.joinDate)}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Edit Contractor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
