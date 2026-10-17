import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, roles = [] }) {
 const { isAuthenticated, hasRole, loading } = useAuth();
 const location = useLocation();

 // Show loading spinner while checking auth
 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-bg">
 <div className="text-center">
 <div className="w-16 h-16 bg-soft rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
 <span className="text-soft-fg font-bold text-xl">GPT</span>
 </div>
 <p className="text-muted">Loading...</p>
 </div>
 </div>
 );
 }

 // Redirect to login if not authenticated
 if (!isAuthenticated()) {
 return <Navigate to="/login" state={{ from: location }} replace />;
 }

 // Check role permissions if roles are specified
 if (roles.length > 0 && !hasRole(roles)) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-bg">
 <div className="text-center max-w-md mx-auto p-6">
 <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-red-700 dark:text-red-400 font-bold text-xl">!</span>
 </div>
 <h2 className="text-xl font-bold text-ink mb-2">Access Denied</h2>
 <p className="text-muted mb-4">
 You don't have permission to access this page. Please contact your administrator if you believe this is an error.
 </p>
 <button
 onClick={() => window.history.back()}
 className="btn-secondary"
 >
 Go Back
 </button>
 </div>
 </div>
 );
 }

 return children;
}
