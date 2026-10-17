import { createContext, useContext, useState, useEffect } from 'react';
import PageLoader from '../components/Loading/PageLoader';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = () => {
      try {
        const authData = localStorage.getItem('gpt_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          console.log('Loading cached auth data:', parsed); // Debug log
          if (isMounted) {
            setUser(parsed.user);
            setToken(parsed.token);
            // Connect socket if user is authenticated
            if (parsed.user?.id) {
              connectSocket(parsed.user.id);
            }
          }
        }
      } catch (error) {
        console.error('Error parsing auth data:', error);
        localStorage.removeItem('gpt_auth');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  const finishSignIn = (authData) => {
    setUser(authData.user);
    setToken(authData.token);
    localStorage.setItem('gpt_auth', JSON.stringify(authData));

    // Connect to Socket.IO for real-time notifications
    if (authData.user?.id) {
      connectSocket(authData.user.id);
    }
  };

  const signIn = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);

      if (response.success) {
        const authData = response.data;

        // TOTP accounts get a challenge token — hand it back for the code step
        if (authData.mfaRequired) {
          return { success: true, mfaRequired: true, mfaToken: authData.mfaToken };
        }

        finishSignIn(authData);
        return { success: true, data: authData };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error.message || 'Login failed' };
    }
  };

  const verifyMfa = async (mfaToken, code) => {
    try {
      const response = await authAPI.mfaVerify(mfaToken, code);
      if (response.success) {
        finishSignIn(response.data);
        return { success: true, data: response.data };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message || 'Verification failed' };
    }
  };

  const signOut = () => {
    // Disconnect socket before signing out
    disconnectSocket();
    setUser(null);
    setToken(null);
    localStorage.removeItem('gpt_auth');
  };

  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData };
    console.log('Updating user from:', user, 'to:', updatedUser); // Debug log
    setUser(updatedUser);
    const authData = { user: updatedUser, token };
    localStorage.setItem('gpt_auth', JSON.stringify(authData));
  };

  const isAuthenticated = () => {
    return !!(user && token);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  const isGovernmentUser = () => {
    return hasRole(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER']);
  };

  const isContractor = () => {
    return hasRole('CONTRACTOR');
  };

  const isMEOfficer = () => {
    return hasRole('ME_OFFICER');
  };

  const canAccessAdminFeatures = () => {
    return hasRole('GOVERNMENT_ADMIN');
  };

  const value = {
    user,
    token,
    loading,
    signIn,
    verifyMfa,
    signOut,
    updateUser,
    isAuthenticated,
    hasRole,
    isGovernmentUser,
    isContractor,
    isMEOfficer,
    canAccessAdminFeatures,
  };

  if (loading) {
    return <PageLoader text="Initializing..." />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
