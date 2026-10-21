import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
 User, 
 Bell, 
 Shield, 
 Palette,
 Globe,
 Download,
 Upload,
 Save,
 RefreshCw,
 Eye,
 EyeOff,
 Mail,
 Phone,
 Building,
 Key,
 Database,
 Monitor,
 Smartphone,
 Check,
 X,
 AlertTriangle,
 Camera,
 Image,
 GitBranch,
 Plus,
 Trash2,
 ScrollText,
 Users,
 Link2,
 Copy
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useInstance } from '../contexts/InstanceContext';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI, userAPI, instanceAPI, auditAPI, inviteAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { roleLabel } from '../utils/statusMap';

const TAB_IDS = ['profile', 'notifications', 'security', 'appearance', 'workflow', 'users', 'audit', 'system'];

export default function Settings() {
 const { user, updateUser } = useAuth();
 const { stages: workflowStages, refreshWorkflow } = useInstance();
 const { theme, setTheme } = useTheme();
 const isAdmin = user?.role === 'GOVERNMENT_ADMIN';
 const [wfStages, setWfStages] = useState([]);
 const [wfSaving, setWfSaving] = useState(false);
 const [auditEntries, setAuditEntries] = useState([]);
 const [managedUsers, setManagedUsers] = useState([]);
 const [usersLoading, setUsersLoading] = useState(false);
 const [invites, setInvites] = useState([]);
 const [inviteForm, setInviteForm] = useState({ role: 'CONTRACTOR', email: '', expiresInDays: 7, note: '' });
 const [inviteUrl, setInviteUrl] = useState('');
 const [inviteBusy, setInviteBusy] = useState(false);
 const [showInviteForm, setShowInviteForm] = useState(false);
 const [auditLoading, setAuditLoading] = useState(false);
 const [configRequests, setConfigRequests] = useState([]);
 const fileInputRef = useRef(null);
 const [searchParams, setSearchParams] = useSearchParams();
 const [activeTab, setActiveTabState] = useState('profile');

 // Keep ?tab=<id> in the URL so admin links (e.g. sidebar "Users") can
 // deep-link straight to a tab and the tab survives reload/share
 const setActiveTab = (id) => {
   setActiveTabState(id);
   setSearchParams((p) => { p.set('tab', id); return p; }, { replace: true });
 };
 useEffect(() => {
   const t = searchParams.get('tab');
   if (t && TAB_IDS.includes(t) && t !== activeTab) setActiveTabState(t);
 }, [searchParams, activeTab]);
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setSaving] = useState(false);
 const [successMessage, setSuccessMessage] = useState('');
 const [profileImage, setProfileImage] = useState(null);
 const [profileImagePreview, setProfileImagePreview] = useState(null);
 const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
 const [passwordSaving, setPasswordSaving] = useState(false);
 const [passwordMessage, setPasswordMessage] = useState('');
 // Two-factor auth (TOTP)
 const [mfaSetup, setMfaSetup] = useState(null); // { secret, qrDataUrl }
 const [mfaCode, setMfaCode] = useState('');
 const [mfaPassword, setMfaPassword] = useState('');
 const [mfaBusy, setMfaBusy] = useState(false);
 const [mfaDisable, setMfaDisable] = useState({ open: false, password: '', code: '' });
 
 // Initialize form data with user data
 const [formData, setFormData] = useState({
 firstName: user?.firstName || '',
 lastName: user?.lastName || '',
 email: user?.email || '',
 phone: user?.phone || '',
 jobTitle: user?.jobTitle || '',
 department: user?.department || '',
 address: user?.address || '',
 city: user?.city || '',
 state: user?.state || ''
 });
 
 const [notifications, setNotifications] = useState({
 email: true,
 sms: false,
 push: true,
 reports: true,
 deadlines: true,
 approvals: false
 });
 const [language, setLanguage] = useState('en');
 const [timezone, setTimezone] = useState('WAT');

 // Sync form data and preferences when user data changes
 useEffect(() => {
 if (user) {
 setFormData({
 firstName: user.firstName || '',
 lastName: user.lastName || '',
 email: user.email || '',
 phone: user.phone || '',
 jobTitle: user.jobTitle || '',
 department: user.department || '',
 address: user.address || '',
 city: user.city || '',
 state: user.state || ''
 });
 
 // Load preferences if they exist
 if (user.preferences) {
 if (user.preferences.theme) setTheme(user.preferences.theme);
 if (user.preferences.language) setLanguage(user.preferences.language);
 if (user.preferences.timezone) setTimezone(user.preferences.timezone);
 if (user.preferences.notifications) setNotifications(user.preferences.notifications);
 }
 }
 }, [user, setTheme]);

 // Editable mid-chain stages (between Submitted and the Approved/Rejected terminals)
 useEffect(() => {
   setWfStages(
     workflowStages
       .filter((s) => !s.isTerminal && !['DRAFT', 'SUBMITTED'].includes(s.key))
       .map((s) => ({ key: s.key, label: s.label, allowedRoles: [...s.allowedRoles] }))
   );
 }, [workflowStages]);

 useEffect(() => {
   if (isAdmin) loadConfigRequests();
 }, [isAdmin]);

 useEffect(() => {
   if (activeTab !== 'audit' || !isAdmin) return;
   setAuditLoading(true);
   auditAPI.list({ limit: 100 })
     .then((res) => setAuditEntries(res?.data?.entries || []))
     .catch(() => showError('Failed to load audit log'))
     .finally(() => setAuditLoading(false));
 }, [activeTab, isAdmin]);

 useEffect(() => {
   if (activeTab !== 'users' || !isAdmin) return;
   setUsersLoading(true);
   userAPI.getAll()
     .then((res) => setManagedUsers(res?.data?.users || []))
     .catch(() => showError('Failed to load users'))
     .finally(() => setUsersLoading(false));
   inviteAPI.list()
     .then((res) => setInvites(res?.data?.invites || []))
     .catch(() => {});
 }, [activeTab, isAdmin]);

 const createInvite = async () => {
   setInviteBusy(true);
   setInviteUrl('');
   try {
     const res = await inviteAPI.create({
       role: inviteForm.role,
       email: inviteForm.email.trim() || undefined,
       expiresInDays: Number(inviteForm.expiresInDays) || 7,
       note: inviteForm.note.trim() || undefined,
     });
     if (res?.success) {
       setInviteUrl(res.data.invite.url);
       showSuccess('Invite link generated');
       const list = await inviteAPI.list().catch(() => null);
       if (list?.success) setInvites(list.data.invites || []);
     } else {
       showError(res?.message || 'Failed to create invite');
     }
   } catch (e) {
     showError(e.message || 'Failed to create invite');
   } finally {
     setInviteBusy(false);
   }
 };

 const revokeInvite = async (inv) => {
   try {
     const res = await inviteAPI.revoke(inv.id);
     if (res?.success) {
       setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, revokedAt: new Date().toISOString() } : i));
       showSuccess('Invite revoked');
     } else {
       showError(res?.message || 'Revoke failed');
     }
   } catch (e) {
     showError(e.message || 'Revoke failed');
   }
 };

 const handleUserPatch = async (target, updates) => {
   try {
     const res = await userAPI.update(target.id, updates);
     if (res?.success) {
       setManagedUsers((prev) => prev.map((u) => u.id === target.id ? { ...u, ...updates, isActive: updates.isActive ?? u.isActive, role: updates.role ?? u.role } : u));
       showSuccess('User updated');
     } else {
       showError(res?.message || 'Update failed');
     }
   } catch (e) {
     showError(e.message || 'Update failed');
   }
 };

 const handleUserReset = async (target) => {
   const newPassword = window.prompt(`Set a new password for ${target.email} (min 8 characters):`);
   if (newPassword === null) return;
   try {
     const res = await userAPI.resetPassword(target.id, newPassword);
     if (res?.success) showSuccess(res.message || 'Password reset');
     else showError(res?.message || 'Reset failed');
   } catch (e) {
     showError(e.message || 'Reset failed');
   }
 };

 const REVIEW_ROLES = [
   ['ME_OFFICER', 'M&E Officer'],
   ['GOVERNMENT_OFFICER', 'Government Officer'],
   ['GOVERNMENT_ADMIN', 'Administrator'],
 ];

 const wfToggleRole = (idx, role) =>
   setWfStages((prev) => prev.map((s, i) =>
     i === idx
       ? { ...s, allowedRoles: s.allowedRoles.includes(role) ? s.allowedRoles.filter((r) => r !== role) : [...s.allowedRoles, role] }
       : s
   ));

 const saveWorkflow = async () => {
   if (wfStages.some((s) => !s.label.trim() || s.allowedRoles.length === 0)) {
     showError('Every stage needs a label and at least one approving role.');
     return;
   }
   setWfSaving(true);
   try {
     const res = await instanceAPI.updateWorkflow(wfStages);
     if (res?.data?.pending) {
       showSuccess('Change submitted — awaiting approval from a second administrator');
       loadConfigRequests();
     } else {
       await refreshWorkflow();
       showSuccess('Review workflow updated');
     }
   } catch (e) {
     showError(e.message || 'Failed to save workflow');
   } finally {
     setWfSaving(false);
   }
 };

 const loadConfigRequests = async () => {
   try {
     const res = await instanceAPI.listRequests();
     if (res?.success) setConfigRequests(res.data.requests || []);
   } catch { /* queue may not exist pre-migration */ }
 };

 const decideRequest = async (id, approve) => {
   try {
     const res = approve ? await instanceAPI.approveRequest(id) : await instanceAPI.rejectRequest(id);
     if (res?.success) {
       showSuccess(res.message || (approve ? 'Change applied' : 'Request rejected'));
       loadConfigRequests();
       if (approve) refreshWorkflow();
     } else {
       showError(res?.message || 'Action failed');
     }
   } catch (e) {
     showError(e.message || 'Action failed');
   }
 };

 const tabs = [
 { id: 'profile', name: 'Profile', icon: User },
 { id: 'notifications', name: 'Notifications', icon: Bell },
 { id: 'security', name: 'Security', icon: Shield },
 { id: 'appearance', name: 'Appearance', icon: Palette },
 ...(isAdmin ? [
   { id: 'workflow', name: 'Workflow', icon: GitBranch },
   { id: 'users', name: 'Users', icon: Users },
   { id: 'audit', name: 'Audit Log', icon: ScrollText },
 ] : []),
 { id: 'system', name: 'System', icon: Database }
 ];

 const handleNotificationChange = (key) => {
 setNotifications(prev => ({
 ...prev,
 [key]: !prev[key]
 }));
 };

 const handleInputChange = (field, value) => {
 setFormData(prev => ({
 ...prev,
 [field]: value
 }));
 };

 const handleFileSelect = (event) => {
 const file = event.target.files[0];
 if (file) {
 // Validate file type
 const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
 if (!allowedTypes.includes(file.type)) {
 showError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
 return;
 }

 // Validate file size (5MB max)
 const maxSize = 5 * 1024 * 1024; // 5MB
 if (file.size > maxSize) {
 showError('File size must be less than 5MB');
 return;
 }

 setProfileImage(file);
 
 // Create preview
 const reader = new FileReader();
 reader.onload = (e) => {
 setProfileImagePreview(e.target.result);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleUploadClick = () => {
 fileInputRef.current?.click();
 };

 const handleRemovePhoto = async () => {
 setProfileImage(null);
 setProfileImagePreview(null);
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 // Also remove from user profile
 if (user?.profileImage) {
 const { profileImage, ...userWithoutImage } = user;
 updateUser(userWithoutImage);
 }
 };

 const handleSaveChanges = async () => {
 setSaving(true);
 setSuccessMessage('');

 try {
 // Upload a newly selected profile image through the files endpoint,
 // which stores it and sets user.profileImage to the public URL.
 let uploadedImageUrl = null;
 if (profileImage) {
 const uploadData = new FormData();
 uploadData.append('file', profileImage);
 const uploadRes = await userAPI.uploadProfileImage(uploadData);
 if (uploadRes?.success) {
 uploadedImageUrl = uploadRes.data?.profileImage || null;
 }
 }

 // Prepare updated user data with profile image and preferences —
 // email is the sign-in identity and is read-only in the form
 const { email: _ignored, ...updatedUserData } = { ...formData };
 if (uploadedImageUrl) {
 updatedUserData.profileImage = uploadedImageUrl;
 }
 
 // Add preferences
 updatedUserData.preferences = {
 theme,
 language,
 timezone,
 notifications
 };

 // Call the API to update the profile in the database
 const response = await authAPI.updateProfile(updatedUserData);
 
 if (response.success && response.data && response.data.user) {
 // Update user context with new data from server
 updateUser(response.data.user);
 setSuccessMessage('Profile updated successfully!');
 
 // Clear success message after 3 seconds
 setTimeout(() => setSuccessMessage(''), 3000);
 } else {
 throw new Error(response.message || 'Failed to update profile');
 }
 
 } catch (error) {
 console.error('Error updating profile:', error);
 showError(error.message || 'Failed to update profile. Please try again.');
 } finally {
 setSaving(false);
 }
 };

 const handleChangePassword = async () => {
 setPasswordMessage('');
 if (!passwordForm.currentPassword || !passwordForm.newPassword) {
 setPasswordMessage('Enter your current password and a new password.');
 return;
 }
 if (passwordForm.newPassword.length < 8) {
 setPasswordMessage('New password must be at least 8 characters.');
 return;
 }
 if (passwordForm.newPassword !== passwordForm.confirmPassword) {
 setPasswordMessage('New passwords do not match.');
 return;
 }
 setPasswordSaving(true);
 try {
 const res = await authAPI.changePassword({
 currentPassword: passwordForm.currentPassword,
 newPassword: passwordForm.newPassword,
 });
 if (res?.success) {
 setPasswordMessage('Password changed successfully.');
 setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
 } else {
 setPasswordMessage(res?.message || 'Failed to change password.');
 }
 } catch (err) {
 setPasswordMessage(err.message || 'Failed to change password.');
 } finally {
 setPasswordSaving(false);
 }
 };

 const handleReset = () => {
 setFormData({
 firstName: user?.firstName || '',
 lastName: user?.lastName || '',
 email: user?.email || '',
 phone: user?.phone || '',
 jobTitle: user?.jobTitle || '',
 department: user?.department || '',
 address: user?.address || '',
 city: user?.city || '',
 state: user?.state || ''
 });
 setProfileImage(null);
 setProfileImagePreview(null);
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-ink">Settings</h1>
 <p className="text-muted">Manage your account settings and preferences.</p>
 </div>
 <div className="mt-4 sm:mt-0 flex space-x-3">
 {successMessage && (
 <div className="flex items-center space-x-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg">
 <Check className="h-4 w-4" />
 <span className="text-sm font-medium">{successMessage}</span>
 </div>
 )}
 <button 
 onClick={handleReset}
 className="btn-secondary flex items-center space-x-2"
 disabled={loading}
 >
 <RefreshCw className="h-4 w-4" />
 <span>Reset</span>
 </button>
 <button 
 onClick={handleSaveChanges}
 className="btn-primary flex items-center space-x-2"
 disabled={loading}
 >
 <Save className="h-4 w-4" />
 <span>{loading ? 'Saving...' : 'Save Changes'}</span>
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* Settings Navigation */}
 <div className="lg:col-span-1">
 <div className="card">
 <nav className="space-y-1">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={clsx(
 'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
 activeTab === tab.id
 ? 'bg-soft text-soft-fg'
 : 'text-muted hover:bg-bg hover:text-ink'
 )}
 >
 <Icon className={clsx(
 'mr-3 h-4 w-4',
 activeTab === tab.id ? 'text-soft-fg' : 'text-muted'
 )} />
 {tab.name}
 </button>
 );
 })}
 </nav>
 </div>
 </div>

 {/* Settings Content */}
 <div className="lg:col-span-3">
 {/* Profile Settings */}
 {activeTab === 'profile' && (
 <div className="space-y-6">
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Profile Information</h3>
 
 {/* Profile Photo */}
 <div className="flex items-center space-x-6 mb-6">
 <div className="relative">
 <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center overflow-hidden">
 {profileImagePreview || user?.profileImage ? (
 <img 
 src={profileImagePreview || user?.profileImage} 
 alt="Profile" 
 className="w-full h-full object-cover"
 />
 ) : (
 <span className="text-soft-fg font-semibold text-xl">
 {user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'U'}
 </span>
 )}
 </div>
 {(profileImagePreview || profileImage) && (
 <button
 onClick={handleRemovePhoto}
 className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
 >
 <X className="h-3 w-3" />
 </button>
 )}
 </div>
 <div>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/jpeg,image/png,image/gif,image/webp"
 onChange={handleFileSelect}
 className="hidden"
 capture="environment" // This enables camera on mobile devices
 />
 <div className="flex flex-col space-y-2">
 <div className="flex space-x-2">
 <button 
 onClick={handleUploadClick}
 className="btn-secondary flex items-center space-x-2"
 >
 <Image className="h-4 w-4" />
 <span>Choose from Gallery</span>
 </button>
 <button 
 onClick={() => {
 // Create a new input for camera capture
 const cameraInput = document.createElement('input');
 cameraInput.type = 'file';
 cameraInput.accept = 'image/*';
 cameraInput.capture = 'camera'; // This specifically requests camera
 cameraInput.onchange = handleFileSelect;
 cameraInput.click();
 }}
 className="btn-secondary flex items-center space-x-2"
 >
 <Camera className="h-4 w-4" />
 <span>Take Photo</span>
 </button>
 </div>
 <p className="text-xs text-muted">
 JPEG, PNG, GIF or WebP. Max 5MB.
 </p>
 {profileImage && (
 <div className="flex items-center space-x-2">
 <Check className="h-4 w-4 text-green-700 dark:text-green-400" />
 <p className="text-xs text-green-700 dark:text-green-400 font-medium">
 {profileImage.name} selected ({(profileImage.size / 1024 / 1024).toFixed(2)} MB)
 </p>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Personal Information */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 First Name
 </label>
 <input
 type="text"
 value={formData.firstName}
 onChange={(e) => handleInputChange('firstName', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter first name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Last Name
 </label>
 <input
 type="text"
 value={formData.lastName}
 onChange={(e) => handleInputChange('lastName', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter last name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Email Address
 </label>
 <div className="relative">
 <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="email"
 value={formData.email}
 readOnly
 className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-bg text-muted cursor-not-allowed"
 />
 </div>
 <p className="text-xs text-muted mt-1">Email is your sign-in identity and can't be changed here — contact an administrator.</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Phone Number
 </label>
 <div className="relative">
 <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <input
 type="tel"
 value={formData.phone}
 onChange={(e) => handleInputChange('phone', e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter phone number"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Job Title
 </label>
 <input
 type="text"
 value={formData.jobTitle}
 onChange={(e) => handleInputChange('jobTitle', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter job title"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Department
 </label>
 <div className="relative">
 <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <select 
 value={formData.department}
 onChange={(e) => handleInputChange('department', e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 <option value="">Select department</option>
 <option value="Ministry of Works">Ministry of Works</option>
 <option value="Ministry of Health">Ministry of Health</option>
 <option value="Ministry of Education">Ministry of Education</option>
 <option value="Ministry of Water Resources">Ministry of Water Resources</option>
 <option value="Ministry of Agriculture">Ministry of Agriculture</option>
 <option value="Ministry of Commerce">Ministry of Commerce</option>
 <option value="Project Monitoring Unit">Project Monitoring Unit</option>
 </select>
 </div>
 </div>
 </div>
 </div>

 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-4">Address Information</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-ink mb-2">
 Street Address
 </label>
 <input
 type="text"
 value={formData.address}
 onChange={(e) => handleInputChange('address', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter street address"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 City
 </label>
 <input
 type="text"
 value={formData.city}
 onChange={(e) => handleInputChange('city', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter city"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 State
 </label>
 <input
 type="text"
 value={formData.state}
 onChange={(e) => handleInputChange('state', e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Enter state"
 />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Notifications Settings */}
 {activeTab === 'notifications' && (
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Notification Preferences</h3>
 
 <div className="space-y-6">
 <div>
 <h4 className="text-sm font-medium text-ink mb-3">Communication</h4>
 <div className="space-y-3">
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">Email Notifications</span>
 <p className="text-sm text-muted">Receive notifications via email</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.email}
 onChange={() => handleNotificationChange('email')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">SMS Notifications</span>
 <p className="text-sm text-muted">Receive notifications via SMS</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.sms}
 onChange={() => handleNotificationChange('sms')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">Push Notifications</span>
 <p className="text-sm text-muted">Receive push notifications in browser</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.push}
 onChange={() => handleNotificationChange('push')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 </div>
 </div>

 <div className="border-t border-border pt-6">
 <h4 className="text-sm font-medium text-ink mb-3">Content</h4>
 <div className="space-y-3">
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">Report Updates</span>
 <p className="text-sm text-muted">New reports and analytics</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.reports}
 onChange={() => handleNotificationChange('reports')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">Project Deadlines</span>
 <p className="text-sm text-muted">Upcoming project deadlines</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.deadlines}
 onChange={() => handleNotificationChange('deadlines')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 <label className="flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-ink">Approval Requests</span>
 <p className="text-sm text-muted">New items requiring approval</p>
 </div>
 <input
 type="checkbox"
 checked={notifications.approvals}
 onChange={() => handleNotificationChange('approvals')}
 className="rounded border-border text-soft-fg focus:ring-primary-500"
 />
 </label>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Security Settings */}
 {activeTab === 'security' && (
 <div className="space-y-6">
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Password & Authentication</h3>
 
 <div className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Current Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={passwordForm.currentPassword}
 onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
 className="w-full pr-10 pl-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute inset-y-0 right-0 pr-3 flex items-center"
 >
 {showPassword ? (
 <EyeOff className="h-4 w-4 text-muted" />
 ) : (
 <Eye className="h-4 w-4 text-muted" />
 )}
 </button>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 New Password
 </label>
 <input
 type="password"
 value={passwordForm.newPassword}
 onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Confirm New Password
 </label>
 <input
 type="password"
 value={passwordForm.confirmPassword}
 onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 </div>

 <div className="bg-bg rounded-lg p-4">
 <h4 className="text-sm font-medium text-ink mb-2">Password Requirements</h4>
 <ul className="text-sm text-muted space-y-1">
 <li className="flex items-center">
 <Check className="h-4 w-4 text-green-500 mr-2" />
 At least 8 characters long
 </li>
 <li className="flex items-center">
 <Check className="h-4 w-4 text-green-500 mr-2" />
 Contains uppercase and lowercase letters
 </li>
 <li className="flex items-center">
 <X className="h-4 w-4 text-red-500 mr-2" />
 Contains at least one number
 </li>
 <li className="flex items-center">
 <X className="h-4 w-4 text-red-500 mr-2" />
 Contains at least one special character
 </li>
 </ul>
 </div>

 {passwordMessage && (
 <p className={clsx('text-sm', passwordMessage.includes('success') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
 {passwordMessage}
 </p>
 )}
 <button
 type="button"
 onClick={handleChangePassword}
 disabled={passwordSaving}
 className="btn-primary self-start"
 >
 {passwordSaving ? 'Changing…' : 'Change password'}
 </button>
 </div>
 </div>

 {/* Two-factor authentication */}
 <div className="card">
 <div className="flex items-start justify-between gap-4 mb-4">
 <div>
 <h3 className="text-lg font-semibold text-ink">Two-factor authentication</h3>
 <p className="text-sm text-muted mt-1">
 Requires a code from an authenticator app (e.g. Google/Microsoft Authenticator) at each login.
 </p>
 </div>
 <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full',
 user?.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-muted')}>
 {user?.totpEnabled ? 'Enabled' : 'Disabled'}
 </span>
 </div>

 {!user?.totpEnabled && !mfaSetup && (
 <button
 type="button"
 disabled={mfaBusy}
 onClick={async () => {
 setMfaBusy(true);
 try {
 const res = await authAPI.mfaSetup();
 if (res.success) setMfaSetup(res.data);
 else showError(res.message || 'Could not start two-factor setup');
 } catch (e) { showError(e.message || 'Could not start two-factor setup'); }
 finally { setMfaBusy(false); }
 }}
 className="btn-primary self-start"
 >
 {mfaBusy ? 'Preparing…' : 'Set up two-factor authentication'}
 </button>
 )}

 {!user?.totpEnabled && mfaSetup && (
 <div className="space-y-4">
 <p className="text-sm text-muted">
 1. Scan this QR code with your authenticator app, or enter the key manually.
 </p>
 <div className="flex flex-col sm:flex-row gap-5 items-start">
 <img src={mfaSetup.qrDataUrl} alt="TOTP QR code" className="w-44 h-44 rounded-lg border border-border" />
 <div>
 <div className="text-xs font-semibold text-muted mb-1">Manual entry key</div>
 <code className="block bg-bg rounded-lg px-3 py-2 text-sm break-all select-all">{mfaSetup.secret}</code>
 </div>
 </div>
 <div>
 <p className="text-sm text-muted mb-2">2. Enter the 6-digit code it now shows:</p>
 <div className="flex gap-3 items-center">
 <input
 type="text"
 inputMode="numeric"
 maxLength={6}
 value={mfaCode}
 onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
 className="w-40 border border-border rounded-lg px-3 py-2 text-center tracking-[0.3em] focus:ring-2 focus:ring-primary-500"
 placeholder="123456"
 />
 </div>
 </div>
 <div>
 <p className="text-sm text-muted mb-2">3. Confirm with your account password:</p>
 <div className="flex gap-3 items-center">
 <input
 type="password"
 value={mfaPassword}
 onChange={(e) => setMfaPassword(e.target.value)}
 className="w-48 border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 placeholder="Password"
 autoComplete="current-password"
 />
 <button
 type="button"
 disabled={mfaBusy || mfaCode.length !== 6 || !mfaPassword}
 onClick={async () => {
 setMfaBusy(true);
 try {
 const res = await authAPI.mfaEnable(mfaCode, mfaPassword);
 if (res.success) {
 showSuccess('Two-factor authentication enabled');
 updateUser({ ...user, totpEnabled: true });
 setMfaSetup(null); setMfaCode(''); setMfaPassword('');
 } else showError(res.message || 'Invalid code');
 } catch (e) { showError(e.message || 'Verification failed'); }
 finally { setMfaBusy(false); }
 }}
 className="btn-primary"
 >
 Enable
 </button>
 <button type="button" onClick={() => { setMfaSetup(null); setMfaCode(''); setMfaPassword(''); }} className="text-sm text-soft-fg font-semibold">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}

 {user?.totpEnabled && !mfaDisable.open && (
 <button
 type="button"
 onClick={() => setMfaDisable({ open: true, password: '', code: '' })}
 className="text-sm font-semibold text-red-600 hover:text-red-700"
 >
 Disable two-factor authentication
 </button>
 )}

 {user?.totpEnabled && mfaDisable.open && (
 <div className="space-y-3 max-w-sm">
 <p className="text-sm text-muted">Confirm your password and current code to disable:</p>
 <input
 type="password"
 placeholder="Password"
 value={mfaDisable.password}
 onChange={(e) => setMfaDisable({ ...mfaDisable, password: e.target.value })}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 />
 <input
 type="text"
 inputMode="numeric"
 maxLength={6}
 placeholder="6-digit code"
 value={mfaDisable.code}
 onChange={(e) => setMfaDisable({ ...mfaDisable, code: e.target.value.replace(/\D/g, '') })}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
 />
 <div className="flex gap-3">
 <button
 type="button"
 disabled={mfaBusy}
 onClick={async () => {
 setMfaBusy(true);
 try {
 const res = await authAPI.mfaDisable(mfaDisable.password, mfaDisable.code);
 if (res.success) {
 showSuccess('Two-factor authentication disabled');
 updateUser({ ...user, totpEnabled: false });
 setMfaDisable({ open: false, password: '', code: '' });
 } else showError(res.message || 'Could not disable');
 } catch (e) { showError(e.message || 'Could not disable'); }
 finally { setMfaBusy(false); }
 }}
 className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-red-700"
 >
 Disable 2FA
 </button>
 <button type="button" onClick={() => setMfaDisable({ open: false, password: '', code: '' })} className="text-sm text-soft-fg font-semibold">
 Cancel
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Appearance Settings */}
 {activeTab === 'appearance' && (
 <div className="space-y-6">
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Theme Preferences</h3>
 
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-ink mb-3">
 Color Theme
 </label>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {['light', 'dark', 'auto'].map((themeOption) => (
 <label key={themeOption} className="cursor-pointer">
 <input
 type="radio"
 name="theme"
 value={themeOption}
 checked={theme === themeOption}
 onChange={(e) => setTheme(e.target.value)}
 className="sr-only"
 />
 <div className={clsx(
 'p-4 border-2 rounded-lg transition-colors',
 theme === themeOption 
 ? 'border-primary-500 bg-soft' 
 : 'border-border hover:border-border'
 )}>
 <div className="flex items-center space-x-3">
 <div className={clsx(
 'w-8 h-8 rounded-full',
 themeOption === 'light' ? 'bg-surface border border-border' :
 themeOption === 'dark' ? 'bg-gray-900' : ' from-white '
 )} />
 <span className="text-sm font-medium text-ink capitalize">
 {themeOption}
 </span>
 </div>
 </div>
 </label>
 ))}
 </div>
 </div>
 </div>
 </div>

 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Language & Region</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Language
 </label>
 <div className="relative">
 <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
 <select 
 value={language}
 onChange={(e) => setLanguage(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 <option value="en">English</option>
 <option value="ig">Igbo</option>
 <option value="ha">Hausa</option>
 <option value="yo">Yoruba</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Timezone
 </label>
 <select 
 value={timezone}
 onChange={(e) => setTimezone(e.target.value)}
 className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 <option value="WAT">West Africa Time (WAT)</option>
 <option value="GMT">Greenwich Mean Time (GMT)</option>
 <option value="UTC">Coordinated Universal Time (UTC)</option>
 </select>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* System Settings */}
 {/* Review workflow editor (admin) */}
 {activeTab === 'workflow' && isAdmin && (
 <div className="space-y-6">
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-2">Submission review workflow</h3>
 <p className="text-sm text-muted mb-6">
   Stages a contractor submission passes through between <strong>Submitted</strong> and <strong>Approved</strong>.
   Each stage lists the roles allowed to move a submission into it. Rejected is always available to those roles.
 </p>

 <div className="space-y-3">
   {wfStages.map((stage, idx) => (
     <div key={stage.key || idx} className="flex flex-wrap items-center gap-3 p-4 border border-border rounded-xl">
       <span className="text-xs font-bold text-muted w-6">{idx + 2}.</span>
       <input
         className="input flex-1 min-w-[160px]"
         value={stage.label}
         onChange={(e) => setWfStages((prev) => prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s)))}
         placeholder="Stage name"
         aria-label={`Stage ${idx + 1} name`}
       />
       <div className="flex flex-wrap gap-3">
         {REVIEW_ROLES.map(([role, label]) => (
           <label key={role} className="flex items-center gap-1.5 text-sm text-ink">
             <input
               type="checkbox"
               checked={stage.allowedRoles.includes(role)}
               onChange={() => wfToggleRole(idx, role)}
               className="accent-primary-600"
             />
             {label}
           </label>
         ))}
       </div>
       <button
         type="button"
         onClick={() => setWfStages((prev) => prev.filter((_, i) => i !== idx))}
         className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 p-2 rounded-lg"
         aria-label={`Remove stage ${stage.label}`}
       >
         <Trash2 className="w-4 h-4" />
       </button>
     </div>
   ))}

   {wfStages.length === 0 && (
     <p className="text-sm text-muted p-4 border border-dashed border-border rounded-xl">
       No intermediate stages — submissions go straight from Submitted to Approved.
     </p>
   )}

   <button
     type="button"
     onClick={() => setWfStages((prev) => [...prev, { key: '', label: '', allowedRoles: ['ME_OFFICER'] }])}
     className="btn-secondary"
   >
     <Plus className="h-4 w-4 mr-2" />
     Add stage
   </button>
 </div>

 <div className="mt-6 flex justify-end">
   <button type="button" onClick={saveWorkflow} disabled={wfSaving} className="btn-primary">
     <Save className="h-4 w-4 mr-2" />
     {wfSaving ? 'Saving…' : 'Save workflow'}
   </button>
 </div>
 </div>

 {/* Pending config-change requests (two-admin approval) */}
 {configRequests.filter((r) => r.status === 'PENDING').length > 0 && (
   <div className="card">
     <h3 className="text-lg font-semibold text-ink mb-1">Pending approvals</h3>
     <p className="text-sm text-muted mb-4">Configuration changes awaiting a second administrator.</p>
     <div className="space-y-3">
       {configRequests.filter((r) => r.status === 'PENDING').map((r) => (
         <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-xl p-4">
           <div className="min-w-0">
             <div className="font-medium text-ink capitalize">{r.kind} change</div>
             <div className="text-xs text-muted">
               requested by {r.requestedByEmail} · {new Date(r.createdAt).toLocaleString()}
             </div>
           </div>
           <div className="flex gap-2">
             <button
               type="button"
               onClick={() => decideRequest(r.id, true)}
               className="btn-primary !py-1.5 text-sm"
             >
               <Check className="h-4 w-4 mr-1" /> Approve
             </button>
             <button
               type="button"
               onClick={() => decideRequest(r.id, false)}
               className="btn-secondary !py-1.5 text-sm"
             >
               <X className="h-4 w-4 mr-1" /> Reject
             </button>
           </div>
         </div>
       ))}
     </div>
   </div>
 )}
 </div>
 )}

 {/* User management (admin) */}
 {activeTab === 'users' && isAdmin && (
 <div className="space-y-6">
 <div className="card">
 <div className="flex items-start justify-between gap-4 mb-2">
  <div>
   <h3 className="text-lg font-semibold text-ink">User management</h3>
   <p className="text-sm text-muted">Deactivate accounts, change roles, or reset passwords. Deactivation takes effect immediately.</p>
  </div>
  <button type="button" onClick={() => setShowInviteForm((v) => !v)} className="btn-secondary flex items-center gap-2 flex-none">
   <Link2 className="h-4 w-4" /> Invite link
  </button>
 </div>

 {showInviteForm && (
  <div className="mt-4 mb-6 p-4 border border-border rounded-xl bg-bg space-y-3">
   <p className="text-sm text-muted">Generate a link the person opens to set their own details and password — no shared credentials.</p>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
     <label className="block text-xs font-medium text-muted mb-1">Role *</label>
     <select
      value={inviteForm.role}
      onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
     >
      <option value="CONTRACTOR">Contractor</option>
      <option value="ME_OFFICER">M&E Officer</option>
      <option value="GOVERNMENT_OFFICER">Government Officer</option>
      <option value="GOVERNMENT_ADMIN">Administrator</option>
      <option value="PUBLIC">Public</option>
     </select>
    </div>
    <div>
     <label className="block text-xs font-medium text-muted mb-1">Their email (optional — locks the link to it)</label>
     <input
      type="email"
      value={inviteForm.email}
      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
      placeholder="contractor@company.com"
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
     />
    </div>
    <div>
     <label className="block text-xs font-medium text-muted mb-1">Expires in (days)</label>
     <input
      type="number" min={1} max={30}
      value={inviteForm.expiresInDays}
      onChange={(e) => setInviteForm((f) => ({ ...f, expiresInDays: e.target.value }))}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
     />
    </div>
    <div>
     <label className="block text-xs font-medium text-muted mb-1">Note (optional)</label>
     <input
      value={inviteForm.note}
      onChange={(e) => setInviteForm((f) => ({ ...f, note: e.target.value }))}
      placeholder="e.g. for ABC Construction"
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink"
     />
    </div>
   </div>
   <div className="flex items-center gap-3">
    <button type="button" onClick={createInvite} disabled={inviteBusy} className="btn-primary text-sm disabled:opacity-50">
     {inviteBusy ? 'Generating…' : 'Generate link'}
    </button>
    {inviteUrl && (
     <div className="flex-1 flex items-center gap-2 min-w-0">
      <code className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2 truncate text-ink">{inviteUrl}</code>
      <button
       type="button"
       onClick={() => { navigator.clipboard?.writeText(inviteUrl); showSuccess('Link copied'); }}
       className="btn-secondary text-xs flex items-center gap-1 flex-none"
      >
       <Copy className="h-3.5 w-3.5" /> Copy
      </button>
     </div>
    )}
   </div>
  </div>
 )}

 {invites.filter((i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date()).length > 0 && (
  <div className="mb-6">
   <h4 className="text-sm font-semibold text-ink mb-2">Pending invites</h4>
   <div className="space-y-2">
    {invites.filter((i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date()).map((inv) => (
     <div key={inv.id} className="flex items-center justify-between gap-3 p-3 bg-bg border border-border rounded-lg text-sm">
      <div className="min-w-0">
       <span className="font-medium text-ink">{roleLabel(inv.role)}</span>
       <span className="text-muted"> — {inv.email || 'any email'}{inv.note ? ` · ${inv.note}` : ''}</span>
       <span className="block text-xs text-muted">expires {new Date(inv.expiresAt).toLocaleDateString()} · by {inv.invitedByName}</span>
      </div>
      <button type="button" onClick={() => revokeInvite(inv)} className="text-xs font-semibold text-red-600 flex-none">Revoke</button>
     </div>
    ))}
   </div>
  </div>
 )}

 {usersLoading ? (
   <p className="text-muted text-sm py-6 text-center">Loading…</p>
 ) : managedUsers.length === 0 ? (
   <p className="text-muted text-sm py-6 text-center">No users found.</p>
 ) : (
   <div className="overflow-x-auto -mx-2">
     <table className="w-full text-sm">
       <thead>
         <tr className="text-left text-muted border-b border-border">
           <th className="px-2 py-2 font-medium">User</th>
           <th className="px-2 py-2 font-medium">Role</th>
           <th className="px-2 py-2 font-medium">Status</th>
           <th className="px-2 py-2 font-medium text-right">Actions</th>
         </tr>
       </thead>
       <tbody>
         {managedUsers.map((u) => {
           const isSelf = u.id === user?.id;
           return (
             <tr key={u.id} className="border-b border-border last:border-0">
               <td className="px-2 py-3">
                 <div className="font-medium text-ink">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</div>
                 <div className="text-xs text-muted">{u.email}</div>
               </td>
               <td className="px-2 py-3">
                 <select
                   value={u.role}
                   disabled={isSelf}
                   onChange={(e) => handleUserPatch(u, { role: e.target.value })}
                   className="border border-border rounded-lg px-2 py-1 text-sm bg-bg disabled:opacity-50"
                 >
                   <option value="GOVERNMENT_ADMIN">Administrator</option>
                   <option value="GOVERNMENT_OFFICER">Govt Officer</option>
                   <option value="ME_OFFICER">M&amp;E Officer</option>
                   <option value="CONTRACTOR">Contractor</option>
                   <option value="PUBLIC">Public</option>
                 </select>
               </td>
               <td className="px-2 py-3">
                 <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                   {u.isActive ? 'Active' : 'Disabled'}
                 </span>
               </td>
               <td className="px-2 py-3 text-right space-x-3">
                 {!isSelf && (
                   <button
                     type="button"
                     onClick={() => handleUserPatch(u, { isActive: !u.isActive })}
                     className={clsx('text-xs font-semibold', u.isActive ? 'text-red-600' : 'text-green-600')}
                   >
                     {u.isActive ? 'Deactivate' : 'Activate'}
                   </button>
                 )}
                 <button
                   type="button"
                   onClick={() => handleUserReset(u)}
                   className="text-xs font-semibold text-soft-fg"
                 >
                   Reset password
                 </button>
               </td>
             </tr>
           );
         })}
       </tbody>
     </table>
   </div>
 )}
 </div>
 </div>
 )}

 {/* Audit log (admin) */}
 {activeTab === 'audit' && isAdmin && (
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-2">Audit log</h3>
 <p className="text-sm text-muted mb-6">Append-only record of sensitive actions — publications, reviews, settings changes, logins.</p>
 {auditLoading ? (
   <p className="text-muted text-sm py-6 text-center">Loading…</p>
 ) : auditEntries.length === 0 ? (
   <p className="text-muted text-sm py-6 text-center">No audit entries yet.</p>
 ) : (
   <div className="overflow-x-auto -mx-2">
     <table className="w-full text-sm">
       <thead>
         <tr className="text-left text-muted border-b border-border">
           <th className="py-2 px-2 font-medium">When</th>
           <th className="py-2 px-2 font-medium">Actor</th>
           <th className="py-2 px-2 font-medium">Action</th>
           <th className="py-2 px-2 font-medium">Entity</th>
           <th className="py-2 px-2 font-medium">Detail</th>
         </tr>
       </thead>
       <tbody>
         {auditEntries.map((e) => (
           <tr key={e.id} className="border-b border-border last:border-0">
             <td className="py-2.5 px-2 whitespace-nowrap text-muted">{new Date(e.createdAt).toLocaleString()}</td>
             <td className="py-2.5 px-2">{e.actorEmail || 'system'}<span className="block text-xs text-muted">{e.actorRole || ''}</span></td>
             <td className="py-2.5 px-2 font-mono text-xs">{e.action}</td>
             <td className="py-2.5 px-2 text-muted">{e.entityType || '—'}</td>
             <td className="py-2.5 px-2 text-muted max-w-[280px] truncate" title={JSON.stringify(e.detail)}>
               {e.detail?.name || e.detail?.title || e.detail?.toStage || (Object.keys(e.detail || {}).length ? JSON.stringify(e.detail) : '—')}
             </td>
           </tr>
         ))}
       </tbody>
     </table>
   </div>
 )}
 </div>
 )}

 {activeTab === 'system' && (
 <div className="space-y-6">

 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">System Information</h3>
 
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-muted">Application Version:</span>
 <span className="font-medium">v1.0.0</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted">Last Updated:</span>
 <span className="font-medium">January 15, 2024</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted">Database Version:</span>
 <span className="font-medium">PostgreSQL 15.2</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted">Server Status:</span>
 <span className="flex items-center">
 <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
 Online
 </span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
