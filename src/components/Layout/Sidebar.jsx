import { useState } from 'react';
import { 
  Home, 
  FolderOpen, 
  Users, 
  BarChart3, 
  MapPin, 
  Settings, 
  Menu, 
  X,
  FileText,
  Plus,
  Download
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Contractors', href: '/contractors', icon: Users },
  { name: 'M&E Reports', href: '/reports', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Map View', href: '/map', icon: MapPin },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const quickActions = [
  { name: 'Generate Report', href: '/reports', icon: Download, roles: ['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER'] },
];

export default function Sidebar({ userRole = 'Government Official' }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleQuickAction = (action) => {
    console.log('Quick action clicked:', action);
    console.log('User role:', user?.role);
    console.log('Action roles:', action.roles);
    console.log('Can access:', action.roles?.includes(user?.role));
    setIsOpen(false);
    navigate(action.href);
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    console.log('Sidebar user data:', user); // Debug log
    if (!user) return 'User';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'GOVERNMENT_ADMIN': 'Government Administrator',
      'GOVERNMENT_OFFICER': 'Government Officer', 
      'CONTRACTOR': 'Contractor',
      'ME_OFFICER': 'M&E Officer'
    };
    return roleNames[role] || role;
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900 backdrop-blur-xl shadow-2xl border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo and Header */}
        <div className="flex items-center justify-center h-20 px-4 bg-gradient-to-r from-abia-600 via-abia-700 to-abia-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-abia-500/20 to-transparent"></div>
          <div className="relative flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform duration-300">
              <span className="text-abia-600 font-extrabold text-lg">GPT</span>
            </div>
            <div className="text-white">
              <h1 className="text-base font-extrabold leading-tight">Government Project Tracker</h1>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-abia-500 to-abia-700 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-lg">{getUserInitials()}</span>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white"></div>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">{getUserDisplayName()}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-0.5">{user ? getRoleDisplayName(user.role) : userRole}</p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-green-600 text-white mt-2 shadow-md">
                {user?.role === 'GOVERNMENT_ADMIN' ? 'Admin' : 
                 user?.role === 'ME_OFFICER' ? 'M&E' :
                 user?.role === 'CONTRACTOR' ? 'Contractor' : 'Officer'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1.5">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-4 py-3.5 text-base font-semibold rounded-xl transition-all duration-300 relative',
                    isActive
                      ? 'bg-gradient-to-r from-abia-500 to-abia-600 text-white shadow-lg shadow-abia-500/30 transform scale-105'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-md'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5 transition-transform duration-300',
                      isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 group-hover:scale-110'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Quick Actions */}
        <div className="mt-10 px-3">
          <h3 className="px-4 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {quickActions
              .filter(action => !action.roles || !user || action.roles.includes(user.role))
              .map((action) => (
                <button
                  key={action.name}
                  onClick={() => handleQuickAction(action)}
                  className="group flex items-center px-4 py-3 text-base font-medium text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full text-left"
                >
                  <action.icon className="mr-3 h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400" />
                  {action.name}
                </button>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>Government Project Tracker v1.0</p>
            <p>© 2025 Kreatix Technologies</p>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
