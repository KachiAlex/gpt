import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
 ArrowLeft, 
 Save, 
 User,
 Mail,
 Phone,
 MapPin,
 Shield,
 FileText,
 Lock,
 Eye,
 EyeOff
} from 'lucide-react';
import { authAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { validateEmail, validatePhone, validatePassword, validateRequired } from '../utils/validation';

export default function MEOfficerNew() {
 const navigate = useNavigate();
 const [loading, setLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [formData, setFormData] = useState({
 firstName: '',
 lastName: '',
 email: '',
 phone: '',
 password: '',
 confirmPassword: '',
 department: '',
 jobTitle: ''
 });

 const [errors, setErrors] = useState({});

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
 const newErrors = {};
 
 // Required fields
 if (!validateRequired(formData.firstName)) newErrors.firstName = 'First name is required';
 if (!validateRequired(formData.lastName)) newErrors.lastName = 'Last name is required';
 if (!validateRequired(formData.email)) {
 newErrors.email = 'Email is required';
 } else if (!validateEmail(formData.email)) {
 newErrors.email = 'Please enter a valid email address';
 }
 
 if (!validateRequired(formData.phone)) {
 newErrors.phone = 'Phone number is required';
 } else if (!validatePhone(formData.phone)) {
 newErrors.phone = 'Please enter a valid phone number';
 }
 
 if (!validateRequired(formData.password)) {
 newErrors.password = 'Password is required';
 } else if (!validatePassword(formData.password)) {
 newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
 }
 
 if (!validateRequired(formData.confirmPassword)) {
 newErrors.confirmPassword = 'Please confirm password';
 } else if (formData.password !== formData.confirmPassword) {
 newErrors.confirmPassword = 'Passwords do not match';
 }
 
 if (!validateRequired(formData.department)) newErrors.department = 'Department is required';
 if (!validateRequired(formData.jobTitle)) newErrors.jobTitle = 'Job title is required';
 
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 
 if (!validateForm()) {
 return;
 }
 
 setLoading(true);
 
 try {
 const registrationData = {
 email: formData.email,
 password: formData.password,
 firstName: formData.firstName,
 lastName: formData.lastName,
 role: 'ME_OFFICER',
 phone: formData.phone,
 department: formData.department,
 jobTitle: formData.jobTitle
 };

 console.log('Registering M&E Officer:', registrationData);
 const response = await authAPI.register(registrationData);
 
 if (response.success) {
 showSuccess('M&E Officer registered successfully!');
 navigate('/dashboard');
 } else {
 throw new Error(response.message || 'Failed to register M&E Officer');
 }
 } catch (error) {
 console.error('Error registering M&E Officer:', error);
 showError(error.message || 'Failed to register M&E Officer. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 const handleCancel = () => {
 navigate('/dashboard');
 };

 return (
 <div className="min-h-screen bg-bg">
 {/* Header */}
 <div className="bg-surface border-b border-border">
 <div className="px-6 py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <button
 onClick={handleCancel}
 className="p-2 hover:bg-hoverbg rounded-lg transition-colors"
 >
 <ArrowLeft className="h-5 w-5 text-muted" />
 </button>
 <div>
 <h1 className="text-2xl font-bold text-ink">Register M&E Officer</h1>
 <p className="text-muted">Register a new Monitoring & Evaluation Officer</p>
 </div>
 </div>
 
 <div className="flex items-center space-x-3">
 <button
 type="button"
 onClick={handleCancel}
 className="px-4 py-2 text-ink bg-hoverbg hover:bg-track rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 form="me-officer-form"
 disabled={loading}
 className="px-4 py-2 bg-brand text-white hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
 >
 {loading ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
 <span>Registering...</span>
 </>
 ) : (
 <>
 <Save className="h-4 w-4" />
 <span>Register M&E Officer</span>
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Form */}
 <div className="p-6">
 <form id="me-officer-form" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
 
 {/* Personal Information */}
 <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
 <div className="flex items-center space-x-3 mb-6">
 <User className="h-5 w-5 text-soft-fg" />
 <h2 className="text-lg font-semibold text-ink">Personal Information</h2>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 First Name *
 </label>
 <input
 type="text"
 value={formData.firstName}
 onChange={(e) => handleInputChange('firstName', e.target.value)}
 className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.firstName ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Enter first name"
 />
 {errors.firstName && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.firstName}</p>
 )}
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Last Name *
 </label>
 <input
 type="text"
 value={formData.lastName}
 onChange={(e) => handleInputChange('lastName', e.target.value)}
 className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.lastName ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Enter last name"
 />
 {errors.lastName && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.lastName}</p>
 )}
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Email Address *
 </label>
 <div className="relative">
 <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="email"
 value={formData.email}
 onChange={(e) => handleInputChange('email', e.target.value)}
 className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.email ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Enter email address"
 />
 </div>
 {errors.email && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.email}</p>
 )}
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Phone Number *
 </label>
 <div className="relative">
 <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="tel"
 value={formData.phone}
 onChange={(e) => handleInputChange('phone', e.target.value)}
 className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.phone ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Enter phone number"
 />
 </div>
 {errors.phone && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.phone}</p>
 )}
 </div>
 </div>
 </div>

 {/* Professional Information */}
 <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
 <div className="flex items-center space-x-3 mb-6">
 <Shield className="h-5 w-5 text-soft-fg" />
 <h2 className="text-lg font-semibold text-ink">Professional Information</h2>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Department *
 </label>
 <input
 type="text"
 value={formData.department}
 onChange={(e) => handleInputChange('department', e.target.value)}
 className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.department ? 'border-red-300' : 'border-border'
 }`}
 placeholder="e.g., Project Monitoring Unit"
 />
 {errors.department && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.department}</p>
 )}
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Job Title *
 </label>
 <input
 type="text"
 value={formData.jobTitle}
 onChange={(e) => handleInputChange('jobTitle', e.target.value)}
 className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.jobTitle ? 'border-red-300' : 'border-border'
 }`}
 placeholder="e.g., Senior M&E Officer"
 />
 {errors.jobTitle && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.jobTitle}</p>
 )}
 </div>
 </div>
 </div>

 {/* Login Credentials */}
 <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
 <div className="flex items-center space-x-3 mb-6">
 <Lock className="h-5 w-5 text-soft-fg" />
 <h2 className="text-lg font-semibold text-ink">Login Credentials</h2>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Password *
 </label>
 <div className="relative">
 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type={showPassword ? 'text' : 'password'}
 value={formData.password}
 onChange={(e) => handleInputChange('password', e.target.value)}
 className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.password ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Enter password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-muted"
 >
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 {errors.password && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.password}</p>
 )}
 <p className="mt-1 text-xs text-muted">
 At least 8 characters with letters and numbers
 </p>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Confirm Password *
 </label>
 <div className="relative">
 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type={showConfirmPassword ? 'text' : 'password'}
 value={formData.confirmPassword}
 onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
 className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
 errors.confirmPassword ? 'border-red-300' : 'border-border'
 }`}
 placeholder="Confirm password"
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-muted"
 >
 {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 {errors.confirmPassword && (
 <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errors.confirmPassword}</p>
 )}
 </div>
 </div>
 
 <div className="mt-4 p-4 bg-soft rounded-lg border border-border">
 <div className="flex items-start">
 <div className="flex-shrink-0">
 <Lock className="h-5 w-5 text-soft-fg" />
 </div>
 <div className="ml-3">
 <h3 className="text-sm font-medium text-brand">Security Information</h3>
 <p className="mt-1 text-sm text-soft-fg">
 The M&E Officer will use these credentials to access their dashboard and review contractor submissions. 
 Make sure to securely share these credentials with the officer after registration.
 </p>
 </div>
 </div>
 </div>
 </div>
 </form>
 </div>
 </div>
 );
}

