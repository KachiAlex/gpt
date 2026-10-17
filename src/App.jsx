import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContractorsProvider } from './contexts/ContractorsContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectNew from './pages/ProjectNew';
import Contractors from './pages/Contractors';
import ContractorDashboard from './pages/ContractorDashboard';
import ContractorNew from './pages/ContractorNew';
import MEOfficerNew from './pages/MEOfficerNew';
import MEDashboard from './pages/MEDashboard';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import MapView from './pages/MapView';
import Settings from './pages/Settings';
import ProgressMeasurement from './pages/ProgressMeasurement';
import PublicPortal from './pages/PublicPortal';
import './App.css';

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
  
  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname === '/projects') return 'Projects';
    if (location.pathname.startsWith('/projects/')) return 'Project Details';
    if (location.pathname === '/contractors') return 'Contractors';
    if (location.pathname === '/contractors/new') return 'Add New Contractor';
    if (location.pathname === '/me-officers/new') return 'Register M&E Officer';
    if (location.pathname === '/contractor/dashboard') return 'Contractor Dashboard';
    if (location.pathname === '/me/dashboard') return 'M&E Dashboard';
    if (location.pathname === '/public') return 'Public Portal';
    if (location.pathname === '/reports') return 'M&E Reports';
    if (location.pathname === '/analytics') return 'Analytics';
    if (location.pathname === '/map') return 'Map View';
    if (location.pathname === '/settings') return 'Settings';
    return 'Dashboard';
  };

  // Check if current route is home, public portal, or other standalone pages
  const isStandaloneRoute = location.pathname === '/' || location.pathname === '/public';

  if (isStandaloneRoute) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/public" element={<PublicPortal />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ThemeSync />
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header title={getPageTitle()} />
        
        <main className={location.pathname === '/dashboard' ? 'p-4' : 'p-8'}>
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
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/map" element={
              <ProtectedRoute>
                <MapView />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute roles={['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']}>
                <ProgressMeasurement />
              </ProtectedRoute>
            } />
          </Routes>
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
          console.log('Clearing invalid auth data');
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
          <AuthProvider>
            <ContractorsProvider>
              <AppContent />
            </ContractorsProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;