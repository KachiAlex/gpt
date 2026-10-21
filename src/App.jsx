import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContractorsProvider } from './contexts/ContractorsContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { InstanceProvider, useInstance } from './contexts/InstanceContext';
import Home from './pages/Home';
// Everything else code-splits — the app shell shouldn't pay for pages the
// user's role can never reach (e.g. contractors don't need Analytics/MapView)
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const InviteAccept = lazy(() => import('./pages/InviteAccept'));
const MfaSetup = lazy(() => import('./pages/MfaSetup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ProjectNew = lazy(() => import('./pages/ProjectNew'));
const Contractors = lazy(() => import('./pages/Contractors'));
const ContractorDashboard = lazy(() => import('./pages/ContractorDashboard'));
const ContractorNew = lazy(() => import('./pages/ContractorNew'));
const MEOfficerNew = lazy(() => import('./pages/MEOfficerNew'));
const MEDashboard = lazy(() => import('./pages/MEDashboard'));
const Reports = lazy(() => import('./pages/Reports'));
const Analytics = lazy(() => import('./pages/Analytics'));
const MapView = lazy(() => import('./pages/MapView'));
const Settings = lazy(() => import('./pages/Settings'));
const ProgressMeasurement = lazy(() => import('./pages/ProgressMeasurement'));
const PublicPortal = lazy(() => import('./pages/PublicPortal'));
import './App.css';

// Shown while a lazy route chunk loads
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading page">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

// Renders children only when the deployment has the feature licensed
// (INSTANCE_FEATURES on the backend). Otherwise bounces to `to`.
function FeatureRoute({ feature, to = '/', children }) {
  const { features } = useInstance();
  if (features?.[feature] === false) return <Navigate to={to} replace />;
  return children;
}

function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  
  useEffect(() => {
    if (user?.preferences?.theme) {
      setTheme(user.preferences.theme);
    }
  }, [user?.preferences?.theme, setTheme]);
  
  return null;
}

function AppContent() {
  const location = useLocation();

  // Standalone pages render without the app shell (sidebar/header)
  const isStandaloneRoute =
    ['/', '/public', '/login', '/forgot-password', '/reset-password', '/mfa-setup'].includes(location.pathname)
    || location.pathname.startsWith('/invite/');

  if (isStandaloneRoute) {
    return (
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<FeatureRoute feature="publicPortal" to="/login"><Home /></FeatureRoute>} />
        <Route path="/public" element={<FeatureRoute feature="publicPortal"><PublicPortal /></FeatureRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/mfa-setup" element={<MfaSetup />} />
      </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <ThemeSync />
      <Sidebar />

      <div className="lg:ml-64">
        <Header />

        <main className="p-6 lg:p-8">
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <Projects />
              </ProtectedRoute>
            } />
            <Route path="/projects/new" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN']}>
                <ProjectNew />
              </ProtectedRoute>
            } />
            <Route path="/projects/:id" element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="/contractors" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <Contractors />
              </ProtectedRoute>
            } />
            <Route path="/contractors/new" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN']}>
                <ContractorNew />
              </ProtectedRoute>
            } />
            <Route path="/me-officers/new" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN']}>
                <MEOfficerNew />
              </ProtectedRoute>
            } />
            <Route path="/contractor/dashboard" element={
              <ProtectedRoute roles={['CONTRACTOR']}>
                <ContractorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/me/dashboard" element={
              <ProtectedRoute roles={['ME_OFFICER']}>
                <MEDashboard />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <FeatureRoute feature="reports"><Reports /></FeatureRoute>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <FeatureRoute feature="analytics"><Analytics /></FeatureRoute>
              </ProtectedRoute>
            } />
            <Route path="/map" element={
              <ProtectedRoute>
                <FeatureRoute feature="map"><MapView /></FeatureRoute>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <FeatureRoute feature="progress"><ProgressMeasurement /></FeatureRoute>
              </ProtectedRoute>
            } />
          </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  // Clear any old/invalid auth tokens on app start
  useEffect(() => {
    const authData = localStorage.getItem('gpt_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        // Clear tokens that look suspicious or incomplete
        if (parsed.token && (!parsed.user || !parsed.user.role || !parsed.user.email)) {
          localStorage.removeItem('gpt_auth');
        }
      } catch (error) {
        console.error('Error parsing auth data:', error);
        localStorage.removeItem('gpt_auth');
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <InstanceProvider>
            <AuthProvider>
            <ContractorsProvider>
              <AppContent />
            </ContractorsProvider>
            </AuthProvider>
          </InstanceProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;