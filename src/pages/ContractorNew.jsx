import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContractors } from '../contexts/ContractorsContext';
import { projectAPI, documentAPI } from '../services/api';
import { validateContractorForm, validateFile } from '../utils/validation';
import { showSuccess, showError } from '../utils/toast';
import { 
  ArrowLeft, 
  Save, 
  X,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Award,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Upload,
  Download,
  Image,
  File
} from 'lucide-react';

export default function ContractorNew() {
  const navigate = useNavigate();
  const { addContractor } = useContractors();
  const [loading, setLoading] = useState(false);
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Load available projects from API
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await projectAPI.getAll();
        if (res?.success) {
          const projects = res.data?.projects || [];
          // Filter out projects that already have contractors assigned (optional)
          // For now, include all projects - admin can reassign if needed
          setAvailableProjects(projects.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            status: p.status,
            budget: `₦${(p.budget || 0).toLocaleString()}`,
            location: Array.isArray(p.lga) ? p.lga.join(', ') : p.lga || 'Not specified',
            startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
            endDate: p.expectedEndDate ? new Date(p.expectedEndDate).toISOString().split('T')[0] : ''
          })));
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setAvailableProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, []);
  const [formData, setFormData] = useState({
    // Basic Information
    companyName: '',
    registrationNumber: '',
    taxId: '',
    website: '',
    
    // Contact Information
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'Abia State',
    
    // Login Credentials
    username: '',
    password: '',
    confirmPassword: '',
    
    // Business Information
    specialization: '',
    yearsInBusiness: '',
    employeeCount: '',
    annualRevenue: '',
    
    // Certifications
    certifications: '',
    insuranceDetails: '',
    
    // Additional Information
    description: '',
    previousProjects: ''
  });

  const [errors, setErrors] = useState({});
  
  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Project assignment functions
  const handleAddProject = (project) => {
    // Check if project is already assigned
    const isAlreadyAssigned = assignedProjects.some(p => p.id === project.id);
    if (!isAlreadyAssigned) {
      setAssignedProjects(prev => [...prev, project]);
    }
    setShowProjectModal(false);
  };

  const handleRemoveProject = (projectId) => {
    setAssignedProjects(prev => prev.filter(p => p.id !== projectId));
  };

  // Get available projects (not already assigned)
  const getAvailableProjects = () => {
    const assignedIds = assignedProjects.map(p => p.id);
    return availableProjects.filter(p => !assignedIds.includes(p.id));
  };

  // Document upload functions
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingFiles(true);
    
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/jpg', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    // Upload files using real API
    for (const file of files) {
      // Validate file using utility
      const validation = validateFile(file, {
        allowedTypes,
        maxSize,
        required: false
      });

      if (!validation.valid) {
        showError(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        // Create FormData for upload
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('category', 'COMPANY_DOCUMENT');

        // Upload file
        const response = await documentAPI.upload(uploadFormData);
        
        if (response.success) {
          const document = {
            id: response.data.document.id,
            name: response.data.document.originalName,
            type: response.data.document.mimeType,
            size: response.data.document.fileSize,
            category: 'Company Document',
            uploadDate: new Date().toISOString(),
            status: 'uploaded',
            documentId: response.data.document.id,
            downloadURL: response.data.document.downloadURL
          };

          setUploadedDocuments(prev => [...prev, document]);
          showSuccess(`File ${file.name} uploaded successfully`);
        } else {
          showError(`Failed to upload ${file.name}: ${response.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('File upload error:', error);
        showError(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
      }
    }
    
    setUploadingFiles(false);
    event.target.value = ''; // Clear the input
  };

  const handleRemoveDocument = async (documentId) => {
    // Find the document to get its API ID
    const document = uploadedDocuments.find(doc => doc.id === documentId);
    
    // If document was uploaded to API, delete it
    if (document?.documentId) {
      try {
        await documentAPI.delete(document.documentId);
        showSuccess('Document removed successfully');
      } catch (error) {
        console.error('Error deleting document:', error);
        showError('Failed to delete document from server');
        // Still remove from UI even if API call fails
      }
    }
    
    // Remove from local state
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleDocumentCategoryChange = (documentId, category) => {
    setUploadedDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId ? { ...doc, category } : doc
      )
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return Image;
    return File;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    // Use the validation utility
    const validation = validateContractorForm(formData);
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form submitted, validating...');
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    console.log('Form validation passed, starting submission...');
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const contractorData = {
        ...formData,
        // Remove confirmPassword from the data (not needed in backend)
        confirmPassword: undefined,
        assignedProjects: assignedProjects.map(p => ({
          projectId: p.id,
          projectName: p.name,
          assignedAt: new Date().toISOString()
        })),
        // Add uploaded documents
        documents: uploadedDocuments.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          category: doc.category,
          uploadDate: doc.uploadDate,
          status: doc.status
        })),
        // Add role for contractor
        role: 'CONTRACTOR',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      
      // Add contractor to the context (this will update the contractors list)
      console.log('About to call addContractor with data:', contractorData);
      const newContractor = await addContractor(contractorData);
      
      console.log('Contractor added successfully:', newContractor);
      
      // Assign projects to the contractor after creation
      if (assignedProjects.length > 0 && newContractor?.id) {
        try {
          const { contractorAPI } = await import('../services/api');
          for (const project of assignedProjects) {
            await contractorAPI.assignProject({
              contractorId: newContractor.id,
              projectId: project.id
            });
          }
        } catch (assignError) {
          console.error('Error assigning projects:', assignError);
          // Still show success, but mention project assignment issue
          showError(`Contractor created but some projects may not have been assigned. ${assignError.message}`);
        }
      }
      
      const projectMessage = assignedProjects.length > 0 ? `Assigned to ${assignedProjects.length} project(s). ` : '';
      const documentMessage = uploadedDocuments.length > 0 ? `Uploaded ${uploadedDocuments.length} document(s).` : '';
      showSuccess(`Contractor added successfully! ${projectMessage}${documentMessage}`);
      navigate('/contractors');
    } catch (error) {
      console.error('Error adding contractor:', error);
      showError(error.message || 'Failed to add contractor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/contractors');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add New Contractor</h1>
                <p className="text-gray-600">Register a new contractor to the system</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="contractor-form"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Contractor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        <form id="contractor-form" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Building className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.companyName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter company name"
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Number *
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.registrationNumber ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter registration number"
                />
                {errors.registrationNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.registrationNumber}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax ID
                </label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => handleInputChange('taxId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tax ID"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.contactPerson ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter contact person name"
                />
                {errors.contactPerson && (
                  <p className="mt-1 text-sm text-red-600">{errors.contactPerson}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter city"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company address"
                />
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Lock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Login Credentials</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter username"
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  3-20 characters, letters, numbers, and underscores only
                </p>
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  At least 8 characters with letters and numbers
                </p>
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Lock className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Security Information</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    The contractor will use these credentials to access their dashboard and submit project updates. 
                    Make sure to securely share these credentials with the contractor after registration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Award className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialization *
                </label>
                <select
                  value={formData.specialization}
                  onChange={(e) => handleInputChange('specialization', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.specialization ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select specialization</option>
                  <option value="Road Construction">Road Construction</option>
                  <option value="Building Construction">Building Construction</option>
                  <option value="Healthcare Infrastructure">Healthcare Infrastructure</option>
                  <option value="Educational Infrastructure">Educational Infrastructure</option>
                  <option value="Water & Sanitation">Water & Sanitation</option>
                  <option value="Power & Energy">Power & Energy</option>
                  <option value="Telecommunications">Telecommunications</option>
                  <option value="Environmental">Environmental</option>
                  <option value="Other">Other</option>
                </select>
                {errors.specialization && (
                  <p className="mt-1 text-sm text-red-600">{errors.specialization}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years in Business
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.yearsInBusiness}
                  onChange={(e) => handleInputChange('yearsInBusiness', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter years in business"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.employeeCount}
                  onChange={(e) => handleInputChange('employeeCount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter number of employees"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Revenue (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.annualRevenue}
                  onChange={(e) => handleInputChange('annualRevenue', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter annual revenue"
                />
              </div>
            </div>
          </div>

          {/* Project Assignment */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FolderOpen className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Project Assignment</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectModal(true)}
                className="btn-primary flex items-center space-x-2"
                disabled={getAvailableProjects().length === 0}
              >
                <Plus className="h-4 w-4" />
                <span>Assign Project</span>
              </button>
            </div>
            
            {assignedProjects.length > 0 ? (
              <div className="space-y-3">
                {assignedProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FolderOpen className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {project.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">{project.id}</span>
                            <span className="text-xs text-gray-500">{project.category}</span>
                            <span className="text-xs text-gray-500">{project.location}</span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-green-600 font-medium">{project.budget}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              project.status === 'In Progress' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProject(project.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No projects assigned</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Assign projects to this contractor to track their work.
                </p>
                {getAvailableProjects().length === 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    All available projects have been assigned.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Additional Information</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the company and its services..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certifications
                </label>
                <textarea
                  value={formData.certifications}
                  onChange={(e) => handleInputChange('certifications', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="List relevant certifications and licenses..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance Details
                </label>
                <textarea
                  value={formData.insuranceDetails}
                  onChange={(e) => handleInputChange('insuranceDetails', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide insurance coverage details..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Previous Projects
                </label>
                <textarea
                  value={formData.previousProjects}
                  onChange={(e) => handleInputChange('previousProjects', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe notable previous projects and achievements..."
                />
              </div>
            </div>
          </div>

          {/* Company Documents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Upload className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Company Documents</h2>
            </div>
            
            {/* Upload Area */}
            <div className="mb-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="document-upload"
                  disabled={uploadingFiles}
                />
                <label
                  htmlFor="document-upload"
                  className={`cursor-pointer ${uploadingFiles ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {uploadingFiles ? 'Uploading files...' : 'Upload Company Documents'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag and drop files here, or click to browse
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>Supported formats:</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">PDF</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">DOC</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">DOCX</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">JPG</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">PNG</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Maximum file size: 10MB</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Document Categories */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Document Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  'Business Registration',
                  'Tax Certificate',
                  'Insurance Policy',
                  'Financial Statement',
                  'Certificate of Incorporation',
                  'Professional License',
                  'Previous Work Samples',
                  'Company Profile'
                ].map((category) => (
                  <span
                    key={category}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-center"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>

            {/* Uploaded Documents List */}
            {uploadedDocuments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Uploaded Documents ({uploadedDocuments.length})</h3>
                <div className="space-y-2">
                  {uploadedDocuments.map((doc) => {
                    const FileIcon = getFileIcon(doc.type);
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileIcon className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">{doc.name}</h4>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">{formatFileSize(doc.size)}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(doc.uploadDate).toLocaleDateString()}
                              </span>
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                {doc.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* Document Category Dropdown */}
                          <select
                            value={doc.category}
                            onChange={(e) => handleDocumentCategoryChange(doc.id, e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Company Document">Company Document</option>
                            <option value="Business Registration">Business Registration</option>
                            <option value="Tax Certificate">Tax Certificate</option>
                            <option value="Insurance Policy">Insurance Policy</option>
                            <option value="Financial Statement">Financial Statement</option>
                            <option value="Certificate of Incorporation">Certificate of Incorporation</option>
                            <option value="Professional License">Professional License</option>
                            <option value="Previous Work Samples">Previous Work Samples</option>
                            <option value="Company Profile">Company Profile</option>
                          </select>
                          
                          {/* Remove Document Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document Upload Info */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Document Requirements</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Upload essential company documents including business registration, tax certificates, 
                    insurance policies, and professional licenses. These documents will be reviewed during 
                    the contractor verification process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Project Selection Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Assign Project to Contractor</h2>
                  <button
                    onClick={() => setShowProjectModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-gray-600 mt-1">Select a project to assign to this contractor</p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingProjects ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading projects...</p>
                  </div>
                ) : getAvailableProjects().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getAvailableProjects().map((project) => (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => handleAddProject(project)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <FolderOpen className="h-4 w-4 text-blue-600" />
                              <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">ID:</span> {project.id}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Category:</span> {project.category}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Location:</span> {project.location}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Budget:</span> {project.budget}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Duration:</span> {project.startDate} - {project.endDate}
                              </p>
                            </div>
                          </div>
                          <div className="ml-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              project.status === 'In Progress' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            type="button"
                            className="w-full text-sm bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Assign Project
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No projects available</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      All projects have been assigned to contractors.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowProjectModal(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
