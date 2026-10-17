import { 
  FolderOpen, 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../services/api';
import StatsCard from '../components/Dashboard/StatsCard';
import ProjectStatusChart from '../components/Dashboard/ProjectStatusChart';
import RecentProjects from '../components/Dashboard/RecentProjects';

export default function Dashboard() {
  const { canAccessAdminFeatures, hasRole, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleAddProject = () => {
    console.log('Navigating to /projects/new');
    console.log('User:', user);
    console.log('Can access admin features:', canAccessAdminFeatures());
    navigate('/projects/new');
  };
  
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      // Check cache first (5 minute cache)
      const cacheKey = 'dashboard_stats_cache';
      const cacheTime = 5 * 60 * 1000; // 5 minutes
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            if (isMounted) {
              setStats(data);
              setLoading(false);
              return;
            }
          }
        }

        const res = await dashboardAPI.getStats();
        if (res?.success && isMounted) {
          setStats(res.data?.stats || null);
          // Cache the result
          localStorage.setItem(cacheKey, JSON.stringify({
            data: res.data?.stats,
            timestamp: Date.now()
          }));
        }
      } catch (e) {
        if (isMounted) setError(e.message || 'Failed to load stats');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={stats && stats.total !== undefined ? String(stats.total) : (loading ? '...' : '0')}
          subtitle={error ? 'Error loading data' : '+12 from last month'}
          icon={FolderOpen}
          trend="up"
          trendValue="+12"
          color="blue"
        />
        <StatsCard
          title="Active Projects"
          value={stats ? String((stats.byStatus?.IN_PROGRESS || 0)) : (loading ? '...' : '0')}
          subtitle="45% of total projects"
          icon={Activity}
          trend="up"
          trendValue="+4%"
          color="green"
        />
        <StatsCard
          title="Total Budget"
          value={stats ? `₦${(stats.totalBudget || 0).toLocaleString()}` : (loading ? '...' : '₦0')}
          subtitle="₦450M allocated this quarter"
          icon={DollarSign}
          trend="up"
          trendValue="₦150M"
          color="purple"
        />
        <StatsCard
          title="Total Contractors"
          value={stats && stats.contractors ? String(stats.contractors.total) : (loading ? '...' : '0')}
          subtitle={stats && stats.contractors ? `${stats.contractors.verified} verified` : '0 verified'}
          icon={Users}
          trend="up"
          trendValue="+3"
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ProjectStatusChart type="bar" />
        <ProjectStatusChart type="pie" />
      </div>

      {/* Recent Projects and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RecentProjects />
        </div>
        
        {/* Quick Links and Activity */}
        <div className="space-y-8">
          {/* Quick Links */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Links</h3>
            <div className="space-y-3">
              {canAccessAdminFeatures() && (
                <button 
                  onClick={handleAddProject}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Add New Project</span>
                </button>
              )}
              {hasRole('ME_OFFICER') && (
                <Link to="/me/dashboard" className="w-full btn-secondary flex items-center justify-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Review Contractor Updates</span>
                </Link>
              )}
              {hasRole(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']) && (
                <Link to="/reports" className="w-full btn-secondary flex items-center justify-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Export Reports</span>
                </Link>
              )}
              <Link to="/projects" className="w-full btn-secondary flex items-center justify-center space-x-2">
                <FolderOpen className="h-4 w-4" />
                <span>View All Projects</span>
              </Link>
              <Link to="/analytics" className="w-full btn-secondary flex items-center justify-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>View Analytics</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">John Doe approved a milestone for Aba-Umuahia Expressway</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Sarah Johnson added a new project: Aba Marina Development</p>
                  <p className="text-xs text-gray-500">Yesterday</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Michael Adebayo flagged an issue with Aba South Water Project</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
