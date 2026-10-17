import { useState, useEffect, useMemo } from 'react';
import {
 TrendingUp,
 TrendingDown,
 DollarSign,
 Clock,
 Users,
 AlertTriangle,
 CheckCircle,
 Filter,
 Download,
 RefreshCw,
 Target,
 Zap
} from 'lucide-react';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
 LineChart,
 Line,
 PieChart,
 Pie,
 Cell,
 AreaChart,
 Area
} from 'recharts';
import toast from 'react-hot-toast';
import { dashboardAPI, contractorAPI, projectAPI, reportAPI } from '../services/api';

const STATUS_LABELS = {
 NOT_STARTED: 'Not Started',
 IN_PROGRESS: 'In Progress',
 NEAR_COMPLETION: 'Near Completion',
 COMPLETED: 'Completed',
 DELAYED: 'Delayed',
 ON_HOLD: 'On Hold',
 CANCELLED: 'Cancelled',
};

const CATEGORY_LABELS = {
 TRANSPORTATION: 'Transportation',
 HEALTHCARE: 'Healthcare',
 EDUCATION: 'Education',
 WATER_SANITATION: 'Water & Sanitation',
 HOUSING: 'Housing',
 AGRICULTURE: 'Agriculture',
 ENERGY: 'Energy',
 ICT: 'ICT',
 TOURISM: 'Tourism',
 ENVIRONMENT: 'Environment',
};

const formatNaira = (value) => {
 const n = Number(value || 0);
 if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
 if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
 return `₦${n.toLocaleString()}`;
};

export default function Analytics() {
 const [timeRange, setTimeRange] = useState('6M');
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [stats, setStats] = useState(null);
 const [statusData, setStatusData] = useState({});
 const [budgetAnalysis, setBudgetAnalysis] = useState(null);
 const [lgaPerformance, setLgaPerformance] = useState([]);
 const [contractors, setContractors] = useState([]);
 const [projects, setProjects] = useState([]);

 const fetchAnalytics = async () => {
 setLoading(true);
 setError(null);
 try {
 const [statsRes, chartRes, budgetRes, lgaRes, contractorsRes, projectsRes] =
 await Promise.all([
 dashboardAPI.getStats(),
 dashboardAPI.getProjectStatusChart(),
 dashboardAPI.getBudgetAnalysis(),
 dashboardAPI.getLGAPerformance(),
 contractorAPI.getAll({ limit: 100 }),
 projectAPI.getAll({ limit: 100 }),
 ]);

 setStats(statsRes.data?.stats || null);
 setStatusData(chartRes.data?.statusData || {});
 setBudgetAnalysis(budgetRes.data?.budgetAnalysis || null);
 setLgaPerformance(lgaRes.data?.lgaPerformance || []);
 setContractors(contractorsRes.data?.contractors || []);
 setProjects(projectsRes.data?.projects || []);
 } catch (err) {
 console.error('Failed to load analytics:', err);
 setError(err.message || 'Failed to load analytics');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchAnalytics();
 }, []);

 // Project status breakdown (real counts by status)
 const projectStatusData = useMemo(
 () =>
 Object.entries(statusData).map(([status, count]) => ({
 name: STATUS_LABELS[status] || status,
 count,
 })),
 [statusData]
 );

 // Budget allocated vs spent per category (₦B)
 const budgetData = useMemo(
 () =>
 (budgetAnalysis?.byCategory || [])
 .filter((c) => c.projectCount > 0)
 .map((c) => ({
 month: CATEGORY_LABELS[c.category] || c.category,
 allocated: Number((c.totalBudget / 1e9).toFixed(2)),
 spent: Number((c.spentBudget / 1e9).toFixed(2)),
 })),
 [budgetAnalysis]
 );

 // Contractor rating buckets
 const contractorPerformanceData = useMemo(() => {
 const buckets = [
 { name: 'Excellent', min: 4.5, color: '#10b981', value: 0 },
 { name: 'Good', min: 3.5, color: '#3b82f6', value: 0 },
 { name: 'Average', min: 2.5, color: '#f59e0b', value: 0 },
 { name: 'Poor', min: 0, color: '#ef4444', value: 0 },
 ];
 contractors.forEach((c) => {
 const rating = Number(c.rating || 0);
 const bucket = buckets.find((b) => rating >= b.min) || buckets[3];
 bucket.value += 1;
 });
 return buckets.filter((b) => b.value > 0);
 }, [contractors]);

 // Cumulative project count by start month
 const timeSeriesData = useMemo(() => {
 const byMonth = {};
 projects.forEach((p) => {
 const d = p.startDate || p.createdAt;
 if (!d) return;
 const key = new Date(d).toISOString().slice(0, 7); // YYYY-MM
 byMonth[key] = (byMonth[key] || 0) + 1;
 });
 const months = Object.keys(byMonth).sort();
 let cumulative = 0;
 return months.map((m) => {
 cumulative += byMonth[m];
 return { date: m, projects: cumulative };
 });
 }, [projects]);

 // Headline metrics
 const metrics = useMemo(() => {
 const projectStats = stats?.projects || {};
 const budget = stats?.budget || {};
 const total = projectStats.total || 0;
 const completed = projectStats.completed || 0;
 const allocated = Number(budget.totalAllocated || 0);
 const spent = Number(budget.totalSpent || 0);
 const delayed = (projectStats.delayed || 0) + (stats?.byStatus?.ON_HOLD || 0);

 return {
 successRate: total > 0 ? (completed / total) * 100 : 0,
 budgetEfficiency: allocated > 0 ? (spent / allocated) * 100 : 0,
 averageProgress: Number(stats?.averageProgress || 0),
 riskProjects: delayed,
 totalProjects: total,
 };
 }, [stats]);

 const handleExport = async () => {
 try {
 await reportAPI.generate({ type: 'CUSTOM', title: 'Analytics Snapshot', includeFinancials: true });
 toast.success('Report generated');
 } catch (err) {
 toast.error(err.message || 'Export failed');
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-24">
 <RefreshCw className="h-6 w-6 text-muted animate-spin mr-2" />
 <span className="text-muted">Loading analytics...</span>
 </div>
 );
 }

 if (error) {
 return (
 <div className="card text-center py-12">
 <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-ink mb-2">Failed to load analytics</h3>
 <p className="text-muted mb-4">{error}</p>
 <button onClick={fetchAnalytics} className="btn-primary">Try Again</button>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-ink">Analytics & Insights</h1>
 <p className="text-muted">Advanced analytics and performance insights for project tracking.</p>
 </div>
 <div className="mt-4 sm:mt-0 flex space-x-3">
 <select
 value={timeRange}
 onChange={(e) => setTimeRange(e.target.value)}
 className="border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
 >
 <option value="1M">Last Month</option>
 <option value="3M">Last 3 Months</option>
 <option value="6M">Last 6 Months</option>
 <option value="1Y">Last Year</option>
 </select>
 <button onClick={fetchAnalytics} className="btn-secondary flex items-center space-x-2">
 <RefreshCw className="h-4 w-4" />
 <span>Refresh</span>
 </button>
 <button onClick={handleExport} className="btn-primary flex items-center space-x-2">
 <Download className="h-4 w-4" />
 <span>Export</span>
 </button>
 </div>
 </div>

 {/* Key Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Project Success Rate</p>
 <p className="text-2xl font-bold text-green-700 dark:text-green-400">{metrics.successRate.toFixed(1)}%</p>
 <div className="flex items-center text-sm text-muted mt-1">
 <CheckCircle className="h-4 w-4 mr-1 text-green-700 dark:text-green-400" />
 <span>{stats?.projects?.completed || 0} completed of {metrics.totalProjects}</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-green-100 dark:bg-green-950/50 rounded-lg flex items-center justify-center">
 <Target className="h-6 w-6 text-green-700 dark:text-green-400" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Budget Utilization</p>
 <p className="text-2xl font-bold text-soft-fg">{metrics.budgetEfficiency.toFixed(1)}%</p>
 <div className="flex items-center text-sm text-muted mt-1">
 <DollarSign className="h-4 w-4 mr-1 text-soft-fg" />
 <span>{formatNaira(stats?.budget?.totalSpent)} of {formatNaira(stats?.budget?.totalAllocated)}</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-soft rounded-lg flex items-center justify-center">
 <DollarSign className="h-6 w-6 text-soft-fg" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Average Progress</p>
 <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{metrics.averageProgress.toFixed(1)}%</p>
 <div className="flex items-center text-sm text-muted mt-1">
 {metrics.averageProgress >= 50 ? (
 <TrendingUp className="h-4 w-4 mr-1 text-green-700 dark:text-green-400" />
 ) : (
 <TrendingDown className="h-4 w-4 mr-1 text-red-700 dark:text-red-400" />
 )}
 <span>Across all projects</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/50 rounded-lg flex items-center justify-center">
 <Clock className="h-6 w-6 text-purple-700 dark:text-purple-400" />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted">Risk Projects</p>
 <p className="text-2xl font-bold text-red-700 dark:text-red-400">{metrics.riskProjects}</p>
 <div className="flex items-center text-sm text-muted mt-1">
 <AlertTriangle className="h-4 w-4 mr-1 text-red-700 dark:text-red-400" />
 <span>Delayed or on hold</span>
 </div>
 </div>
 <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 rounded-lg flex items-center justify-center">
 <AlertTriangle className="h-6 w-6 text-red-700 dark:text-red-400" />
 </div>
 </div>
 </div>
 </div>

 {/* Charts Row 1 */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Project Status Breakdown */}
 <div className="card">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-semibold text-ink">Project Status Breakdown</h3>
 </div>
 {projectStatusData.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={projectStatusData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="name" />
 <YAxis allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="count" fill="#3b82f6" name="Projects" />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-sm text-muted text-center py-16">No project data available.</p>
 )}
 </div>

 {/* Budget Analysis */}
 <div className="card">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-semibold text-ink">Budget by Category (₦B)</h3>
 <div className="flex items-center space-x-2 text-sm">
 <div className="flex items-center">
 <div className="w-3 h-3 bg-brand rounded-full mr-1"></div>
 <span>Allocated</span>
 </div>
 <div className="flex items-center">
 <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
 <span>Spent</span>
 </div>
 </div>
 </div>
 {budgetData.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={budgetData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="allocated" stroke="#059669" strokeWidth={2} />
 <Line type="monotone" dataKey="spent" stroke="#10b981" strokeWidth={2} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-sm text-muted text-center py-16">No budget data available.</p>
 )}
 </div>
 </div>

 {/* Charts Row 2 */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Contractor Performance */}
 <div className="card">
 <h3 className="text-lg font-semibold text-ink mb-6">Contractor Performance</h3>
 {contractorPerformanceData.length > 0 ? (
 <ResponsiveContainer width="100%" height={250}>
 <PieChart>
 <Pie
 data={contractorPerformanceData}
 cx="50%"
 cy="50%"
 outerRadius={80}
 fill="#8884d8"
 dataKey="value"
 label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
 >
 {contractorPerformanceData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip />
 </PieChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-sm text-muted text-center py-16">No contractors registered yet.</p>
 )}
 </div>

 {/* Growth Trends */}
 <div className="card lg:col-span-2">
 <h3 className="text-lg font-semibold text-ink mb-6">Cumulative Project Growth</h3>
 {timeSeriesData.length > 0 ? (
 <ResponsiveContainer width="100%" height={250}>
 <AreaChart data={timeSeriesData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="date" />
 <YAxis allowDecimals={false} />
 <Tooltip />
 <Area type="monotone" dataKey="projects" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
 </AreaChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-sm text-muted text-center py-16">No project timeline data available.</p>
 )}
 </div>
 </div>

 {/* LGA Performance Table */}
 <div className="card">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-semibold text-ink">LGA Performance Overview</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-full">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-3 px-4 font-medium text-ink">LGA</th>
 <th className="text-left py-3 px-4 font-medium text-ink">Active Projects</th>
 <th className="text-left py-3 px-4 font-medium text-ink">Completion Rate</th>
 <th className="text-left py-3 px-4 font-medium text-ink">Budget</th>
 <th className="text-left py-3 px-4 font-medium text-ink">Performance</th>
 </tr>
 </thead>
 <tbody>
 {lgaPerformance.map((lga) => {
 const completion = lga.totalProjects > 0
 ? Math.round((lga.completedProjects / lga.totalProjects) * 100)
 : Math.round(lga.averageProgress || 0);
 return (
 <tr key={lga.lga} className="border-b border-border hover:bg-bg">
 <td className="py-4 px-4 font-medium text-ink">{lga.lga}</td>
 <td className="py-4 px-4 text-muted">{lga.totalProjects}</td>
 <td className="py-4 px-4">
 <div className="flex items-center">
 <div className="flex-1 bg-track rounded-full h-2 max-w-[100px] mr-3">
 <div
 className="bg-green-500 h-2 rounded-full"
 style={{ width: `${completion}%` }}
 />
 </div>
 <span className="text-sm font-medium">{completion}%</span>
 </div>
 </td>
 <td className="py-4 px-4 text-muted">{formatNaira(lga.totalBudget)}</td>
 <td className="py-4 px-4">
 <span className={`status-badge ${
 completion >= 80 ? 'status-completed' :
 completion >= 50 ? 'status-in-progress' : 'status-delayed'
 }`}>
 {completion >= 80 ? 'Excellent' :
 completion >= 50 ? 'Good' : 'Needs Attention'}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 {lgaPerformance.length === 0 && (
 <p className="text-sm text-muted text-center py-8">No LGA data available yet.</p>
 )}
 </div>
 </div>

 {/* Insights and Recommendations */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="card">
 <div className="flex items-center mb-4">
 <div className="w-8 h-8 bg-soft rounded-lg flex items-center justify-center mr-3">
 <Zap className="h-4 w-4 text-soft-fg" />
 </div>
 <h3 className="text-lg font-semibold text-ink">Key Insights</h3>
 </div>
 <div className="space-y-3">
 <div className="flex items-start space-x-2">
 <CheckCircle className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5" />
 <p className="text-sm text-ink">
 {stats?.projects?.completed || 0} of {metrics.totalProjects} projects completed
 ({metrics.successRate.toFixed(0)}% success rate)
 </p>
 </div>
 <div className="flex items-start space-x-2">
 <TrendingUp className="h-4 w-4 text-soft-fg mt-0.5" />
 <p className="text-sm text-ink">
 {formatNaira(stats?.budget?.remaining)} of allocated budget remains unspent
 </p>
 </div>
 <div className="flex items-start space-x-2">
 <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-400 mt-0.5" />
 <p className="text-sm text-ink">
 {metrics.riskProjects} project{metrics.riskProjects === 1 ? '' : 's'} delayed or on hold
 </p>
 </div>
 <div className="flex items-start space-x-2">
 <Users className="h-4 w-4 text-purple-700 dark:text-purple-400 mt-0.5" />
 <p className="text-sm text-ink">
 {stats?.contractors?.verified || 0} of {stats?.contractors?.total || 0} contractors verified
 </p>
 </div>
 </div>
 </div>

 <div className="card">
 <div className="flex items-center mb-4">
 <div className="w-8 h-8 bg-green-100 dark:bg-green-950/50 rounded-lg flex items-center justify-center mr-3">
 <Target className="h-4 w-4 text-green-700 dark:text-green-400" />
 </div>
 <h3 className="text-lg font-semibold text-ink">Recommendations</h3>
 </div>
 <div className="space-y-3">
 {metrics.riskProjects > 0 && (
 <div className="p-3 bg-soft rounded-lg">
 <p className="text-sm font-medium text-blue-900">Focus on Delayed Projects</p>
 <p className="text-sm text-soft-fg">
 {metrics.riskProjects} project{metrics.riskProjects === 1 ? ' requires' : 's require'} attention to prevent further delays
 </p>
 </div>
 )}
 {(stats?.submissions?.pending || 0) > 0 && (
 <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg">
 <p className="text-sm font-medium text-yellow-900">Pending Reviews</p>
 <p className="text-sm text-yellow-700 dark:text-yellow-400">
 {stats.submissions.pending} submission{stats.submissions.pending === 1 ? '' : 's'} awaiting M&E review
 </p>
 </div>
 )}
 {(stats?.contractors?.total || 0) - (stats?.contractors?.verified || 0) > 0 && (
 <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-lg">
 <p className="text-sm font-medium text-green-900">Contractor Verification</p>
 <p className="text-sm text-green-700">
 {(stats.contractors.total - stats.contractors.verified)} contractor{(stats.contractors.total - stats.contractors.verified) === 1 ? '' : 's'} pending verification
 </p>
 </div>
 )}
 {metrics.riskProjects === 0 && (stats?.submissions?.pending || 0) === 0 && (
 <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-lg">
 <p className="text-sm font-medium text-green-900">All Clear</p>
 <p className="text-sm text-green-700">No delayed projects or pending reviews right now.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
