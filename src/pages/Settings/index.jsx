import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  RefreshCw,
  Check,
  Database,
  GitBranch,
  ScrollText,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authAPI, userAPI } from '../../services/api';
import { showError } from '../../utils/toast';
import ProfileTab from './ProfileTab';
import NotificationsTab from './NotificationsTab';
import SecurityTab from './SecurityTab';
import AppearanceTab from './AppearanceTab';
import WorkflowTab from './WorkflowTab';
import UsersTab from './UsersTab';
import AuditTab from './AuditTab';
import SystemTab from './SystemTab';

const TAB_IDS = ['profile', 'notifications', 'security', 'appearance', 'workflow', 'users', 'audit', 'system'];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAdmin = user?.role === 'GOVERNMENT_ADMIN';
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

  const [loading, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);

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
      if (user.preferences) {
        if (user.preferences.theme) setTheme(user.preferences.theme);
        if (user.preferences.language) setLanguage(user.preferences.language);
        if (user.preferences.timezone) setTimezone(user.preferences.timezone);
        if (user.preferences.notifications) setNotifications(user.preferences.notifications);
      }
    }
  }, [user, setTheme]);

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
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showError('File size must be less than 5MB');
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setProfileImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (user?.profileImage) {
      const { profileImage: _removed, ...userWithoutImage } = user;
      updateUser(userWithoutImage);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
      let uploadedImageUrl = null;
      if (profileImage) {
        const uploadData = new FormData();
        uploadData.append('file', profileImage);
        const uploadRes = await userAPI.uploadProfileImage(uploadData);
        if (uploadRes?.success) {
          uploadedImageUrl = uploadRes.data?.profileImage || null;
        }
      }

      // Email is the sign-in identity and is read-only in the form
      const { email: _ignored, ...updatedUserData } = { ...formData };
      if (uploadedImageUrl) updatedUserData.profileImage = uploadedImageUrl;
      updatedUserData.preferences = { theme, language, timezone, notifications };

      const response = await authAPI.updateProfile(updatedUserData);
      if (response.success && response.data && response.data.user) {
        updateUser(response.data.user);
        setSuccessMessage('Profile updated successfully!');
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <div className="flex items-center space-x-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg" role="status">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}
          <button onClick={handleReset} className="btn-secondary flex items-center space-x-2" disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            <span>Reset</span>
          </button>
          <button onClick={handleSaveChanges} className="btn-primary flex items-center space-x-2" disabled={loading}>
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="card">
            <nav className="space-y-1" aria-label="Settings sections">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={clsx(
                      'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      activeTab === tab.id ? 'bg-soft text-soft-fg' : 'text-muted hover:bg-bg hover:text-ink'
                    )}
                  >
                    <Icon className={clsx('mr-3 h-4 w-4', activeTab === tab.id ? 'text-soft-fg' : 'text-muted')} />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <ProfileTab
              user={user}
              formData={formData}
              onInputChange={handleInputChange}
              profileImage={profileImage}
              profileImagePreview={profileImagePreview}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onUploadClick={() => fileInputRef.current?.click()}
              onRemovePhoto={handleRemovePhoto}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab notifications={notifications} onChange={handleNotificationChange} />
          )}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'appearance' && (
            <AppearanceTab
              language={language} setLanguage={setLanguage}
              timezone={timezone} setTimezone={setTimezone}
            />
          )}
          {activeTab === 'workflow' && isAdmin && <WorkflowTab />}
          {activeTab === 'users' && isAdmin && <UsersTab />}
          {activeTab === 'audit' && isAdmin && <AuditTab />}
          {activeTab === 'system' && <SystemTab />}
        </div>
      </div>
    </div>
  );
}
