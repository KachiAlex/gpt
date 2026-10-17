import { useState } from 'react';
import { 
  X, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  AlertTriangle,
  Building,
  Users,
  FileText,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { showError, showSuccess } from '../../utils/toast';
import { authAPI } from '../../services/api';

const roleInfo = {
  GOVERNMENT_ADMIN: {
    name: 'Government Administrator',
    icon: Building,
    description: 'Full system access and user management',
    redirectTo: '/dashboard'
  },
  GOVERNMENT_OFFICER: {
    name: 'Government Officer',
    icon: Building,
    description: 'Government dashboard and project oversight',
    redirectTo: '/dashboard'
  },
  CONTRACTOR: {
    name: 'Contractor',
    icon: Users,
    description: 'Project updates and milestone submissions',
    redirectTo: '/contractor/dashboard'
  },
  ME_OFFICER: {
    name: 'M&E Officer',
    icon: FileText,
    description: 'Review submissions and site inspections',
    redirectTo: '/me/dashboard'
  }
};

export default function SignInModal({ isOpen, onClose }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.email || !formData.password) {
        setError('Please enter both email and password');
        return;
      }

      const result = await signIn({ email: formData.email, password: formData.password });
      if (!result.success) {
        const msg = result.message || 'Login failed';
        setError(msg);
        showError(msg);
        return;
      }

      onClose();
      const role = result.data.user.role;
      const roleData = roleInfo[role];
      navigate(roleData?.redirectTo || '/dashboard');
      showSuccess('Logged in successfully');
    } catch (err) {
      setError('An error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
              <p className="text-base text-gray-600 mt-1">Access the Abia Project Tracker</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-8">
            <div className="flex items-start space-x-4">
              <Shield className="h-6 w-6 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-base font-medium text-blue-900">Sign in</h4>
                <p className="text-base text-blue-700 mt-2">
                  Use your email and password provided by the administrator.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <p className="text-base text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-11 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent text-base"
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-11 pr-12 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent text-base"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Secure access to Abia State government project data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
