import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Filter,
  Search,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Plus,
  PieChart,
  RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import GeneratedReportModal from '../components/Reports/GeneratedReportModal';
import { reportAPI } from '../services/api';

const reportTypes = ['All Types', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'SPECIAL', 'CUSTOM'];
const categories = ['All Categories', 'Progress', 'Financial', 'Performance', 'Impact'];
const statuses = ['All Status', 'Published', 'Draft'];

const statusStyles = {
  'Published': 'bg-green-100 text-green-800',
  'Draft': 'bg-yellow-100 text-yellow-800',
};

const categoryIcons = {
  'Progress': BarChart3,
  'Financial': TrendingUp,
  'Performance': CheckCircle,
  'Impact': PieChart
};

const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return n > 0 ? `${n} B` : '—';
};

const titleCase = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Generate form state
  const [genForm, setGenForm] = useState({
    title: '',
    type: 'MONTHLY',
    category: 'Progress',
    startDate: '',
    endDate: '',
    scope: 'all',
    includeFinancials: false,
    includeContractors: false,
  });

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportAPI.getAll();
      setReports(res.data?.reports || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getStatus = (report) => (report.isPublic ? 'Published' : 'Draft');

  const filteredReports = reports.filter(report => {
    const generatedBy = report.generatedByName || '';
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         generatedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All Types' || report.type === typeFilter;
    const matchesCategory = categoryFilter === 'All Categories' || report.category === categoryFilter;
    const matchesStatus = statusFilter === 'All Status' || getStatus(report) === statusFilter;

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setSelectedReport(null);
  };

  const handleDownload = async (report) => {
    try {
      await reportAPI.download(report.id, `${report.title.replace(/[^a-z0-9]+/gi, '-')}.json`);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(err.message || 'Download failed');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await reportAPI.generate({
        title: genForm.title || undefined,
        type: genForm.type,
        category: genForm.category,
        startDate: genForm.startDate || undefined,
        endDate: genForm.endDate || undefined,
        scope: genForm.scope,
        includeFinancials: genForm.includeFinancials,
        includeContractors: genForm.includeContractors,
      });
      toast.success('Report generated');
      setShowGenerateModal(false);
      setGenForm({
        title: '', type: 'MONTHLY', category: 'Progress',
        startDate: '', endDate: '', scope: 'all',
        includeFinancials: false, includeContractors: false,
      });
      fetchReports();
    } catch (err) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">M&E Reports</h1>
          <p className="text-gray-600">Generate, manage, and download monitoring & evaluation reports.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button onClick={fetchReports} className="btn-secondary flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{reports.length}</h3>
          <p className="text-sm text-gray-600">Total Reports</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-green-600">
            {reports.filter(r => r.isPublic).length}
          </h3>
          <p className="text-sm text-gray-600">Published</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-yellow-600">
            {reports.filter(r => !r.isPublic).length}
          </h3>
          <p className="text-sm text-gray-600">Drafts</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
            <Download className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-purple-600">
            {reports.reduce((sum, r) => sum + Number(r.downloads || 0), 0)}
          </h3>
          <p className="text-sm text-gray-600">Total Downloads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-4">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            >
              {reportTypes.map(type => (
                <option key={type} value={type}>{type === 'All Types' ? type : titleCase(type)}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500 focus:border-transparent"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Generated Reports</h3>
          <p className="text-sm text-gray-600">All monitoring and evaluation reports generated by the system.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 text-gray-400 animate-spin mr-2" />
            <span className="text-gray-600">Loading reports...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load reports</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button onClick={fetchReports} className="btn-primary">Try Again</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const CategoryIcon = categoryIcons[report.category] || FileText;
              const status = getStatus(report);
              const projectCount = report.data?.projectCount ?? 0;
              return (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-abia-100 rounded-lg flex items-center justify-center">
                          <CategoryIcon className="h-6 w-6 text-abia-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{report.title}</h4>
                          <span className={clsx('status-badge', statusStyles[status])}>
                            {status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Type:</span> {titleCase(report.type)}
                          </div>
                          <div>
                            <span className="font-medium">Category:</span> {report.category || 'General'}
                          </div>
                          <div>
                            <span className="font-medium">Projects:</span> {projectCount}
                          </div>
                          <div>
                            <span className="font-medium">Size:</span> {formatBytes(report.fileSize)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-600">
                            Generated on {new Date(report.createdAt).toLocaleDateString()} by {report.generatedByName || 'System'}
                          </div>
                          <div className="text-gray-500">
                            {report.downloads || 0} downloads
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleViewReport(report)}
                        className="text-abia-600 hover:text-abia-700 p-2 rounded-lg hover:bg-abia-50"
                        title="View Report Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(report)}
                        className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50"
                        title="Download Report"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-600 mb-4">
              {reports.length === 0
                ? 'No reports have been generated yet.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Generate New Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New Report</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Title
                </label>
                <input
                  type="text"
                  value={genForm.title}
                  onChange={(e) => setGenForm({ ...genForm, title: e.target.value })}
                  placeholder="e.g. Q1 2026 Progress Report"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Type
                </label>
                <select
                  value={genForm.type}
                  onChange={(e) => setGenForm({ ...genForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                >
                  <option value="MONTHLY">Monthly Progress Report</option>
                  <option value="QUARTERLY">Quarterly Budget Analysis</option>
                  <option value="ANNUAL">Annual Performance Review</option>
                  <option value="SPECIAL">Special Impact Assessment</option>
                  <option value="CUSTOM">Custom Report</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={genForm.startDate}
                    onChange={(e) => setGenForm({ ...genForm, startDate: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  />
                  <input
                    type="date"
                    value={genForm.endDate}
                    onChange={(e) => setGenForm({ ...genForm, endDate: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Include Projects
                </label>
                <select
                  value={genForm.scope}
                  onChange={(e) => setGenForm({ ...genForm, scope: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-abia-500"
                >
                  <option value="all">All Projects</option>
                  <option value="active">Active Projects Only</option>
                  <option value="completed">Completed Projects Only</option>
                  <option value="delayed">Delayed Projects Only</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={genForm.includeFinancials}
                    onChange={(e) => setGenForm({ ...genForm, includeFinancials: e.target.checked })}
                    className="rounded border-gray-300 text-abia-600 focus:ring-abia-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include financial data</span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={genForm.includeContractors}
                    onChange={(e) => setGenForm({ ...genForm, includeContractors: e.target.checked })}
                    className="rounded border-gray-300 text-abia-600 focus:ring-abia-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include contractor performance</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 btn-secondary"
                disabled={generating}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 btn-primary disabled:opacity-50"
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <GeneratedReportModal
          report={selectedReport}
          isOpen={showReportModal}
          onClose={handleCloseReportModal}
          onDownload={() => handleDownload(selectedReport)}
        />
      )}
    </div>
  );
}
