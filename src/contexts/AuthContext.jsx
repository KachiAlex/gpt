import { createContext, useContext, useState, useEffect } from 'react';
import PageLoader from '../components/Loading/PageLoader';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { clearAllCaches } from '../utils/cache';

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
          // Reject expired tokens up front instead of trusting stale cache
          try {
            const payload = JSON.parse(atob(parsed.token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              localStorage.removeItem('gpt_auth');
              if (isMounted) setLoading(false);
              return;
            }
          } catch { /* malformed token — clear it below */ }
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
    // Disconnect socket + record the logout server-side (fire-and-forget)
    authAPI.logout().catch(() => {});
    disconnectSocket();
    setUser(null);
    setToken(null);
    localStorage.removeItem('gpt_auth');
    // Drop every cached list so the next login can't see this user's data
    clearAllCaches();
  };

  // A 401 from any API call clears localStorage directly (api.js can't reach
  // React state) — it fires this event so we sign out properly here.
  useEffect(() => {
    const onExpired = () => signOut();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData };
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
