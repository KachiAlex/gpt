// API Client Service for ABT Frontend
// Centralized API communication with authentication and error handling

// Determine API URL based on environment
const getApiBaseUrl = () => {
  // If explicitly set via environment variable, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // If running in production (not localhost), use the VPS-hosted API
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://gpt-api.67-211-210-8.sslip.io/api';
  }
  
  // Default to localhost for local development
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Get auth token from localStorage
 */
const getAuthToken = () => {
  try {
    const authData = localStorage.getItem('gpt_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.token;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return null;
};

/**
 * Base fetch wrapper with authentication and error handling
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // No special headers needed for Render API - just use JWT token

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...config,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    // Check content type before parsing
    const contentType = response.headers.get('content-type') || '';
    let data;

    // Handle non-JSON responses (e.g., HTML error pages)
    if (contentType.includes('application/json')) {
      try {
        const text = await response.text();
        if (!text || text.trim() === '') {
          // Empty response
          data = {};
        } else {
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            // JSON parsing failed - likely HTML or other content
            console.error('Failed to parse JSON response:', text.substring(0, 200));
            
            // Handle specific status codes
            if (response.status === 503) {
              throw new Error('Service Unavailable: The backend server is not running or unavailable. Please check if the API server is running.');
            }
            if (response.status === 404) {
              throw new Error('API endpoint not found. Please check if the API server is configured correctly.');
            }
            if (response.status >= 500) {
              throw new Error(`Server Error (${response.status}): The backend server encountered an error. Please try again later.`);
            }
            
            throw new Error(`Server returned invalid response. Status: ${response.status}`);
          }
        }
      } catch (error) {
        // If error was already formatted, re-throw it
        if (error.message && (error.message.includes('Service Unavailable') || error.message.includes('API endpoint') || error.message.includes('Server Error'))) {
          throw error;
        }
        console.error('Error reading response:', error);
        throw new Error(`Failed to read server response. Status: ${response.status}`);
      }
    } else {
      // Response is not JSON (likely HTML error page)
      const text = await response.text();
      console.error('Non-JSON response received:', text.substring(0, 200));
      
      // Handle specific status codes
      if (response.status === 503) {
        throw new Error('Service Unavailable: The backend server is not running or unavailable. Please check if the API server is running.');
      }
      if (response.status === 404) {
        throw new Error('API endpoint not found. Please check if the API server is configured correctly.');
      }
      if (response.status >= 500) {
        throw new Error(`Server Error (${response.status}): The backend server encountered an error. Please try again later.`);
      }
      
      throw new Error(`Invalid response format. Status: ${response.status}`);
    }

    // Handle specific error status codes
    if (response.status === 401) {
      // Handle 401 Unauthorized - check if it's a login failure or token expiry
      if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/mfa-verify')) {
        throw new Error(data?.message || 'Authentication failed. Please check your credentials.');
      }
      // For authenticated endpoints, it's likely a token expiry — notify
      // AuthContext so the user is actually signed out, not just stranded
      localStorage.removeItem('gpt_auth');
      window.dispatchEvent(new Event('auth:expired'));
      throw new Error('Authentication expired. Please log in again.');
    }

    if (response.status === 503) {
      // Handle 503 Service Unavailable (in case it got past the earlier checks)
      throw new Error('Service Unavailable: The backend server is not running or unavailable. Please check if the API server is running.');
    }

    if (!response.ok) {
      throw new Error(data?.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('API request was aborted');
      throw new Error('Request timeout. Please try again.');
    }
    // Re-throw if it's already a formatted error
    if (error.message && !error.message.includes('Failed to parse') && !error.message.includes('Non-JSON')) {
      throw error;
    }
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * Upload file with multipart/form-data
 */
const uploadFile = async (endpoint, formData) => {
  const token = getAuthToken();
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData, // FormData sets its own Content-Type with boundary
    });

    if (response.status === 401) {
      localStorage.removeItem('gpt_auth');
      window.location.href = '/';
      throw new Error('Authentication expired. Please log in again.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
};

/**
 * Download a file from an authenticated endpoint and save it locally.
 * Uses fetch (so the Authorization header is sent) then a blob object URL.
 */
const downloadFile = async (endpoint, fallbackName = 'download') => {
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (response.status === 401) {
    localStorage.removeItem('gpt_auth');
    throw new Error('Authentication expired. Please log in again.');
  }
  if (!response.ok) {
    let message = `HTTP error! status: ${response.status}`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ============================================================================
// AUTHENTICATION APIs
// ============================================================================

export const authAPI = {
  login: (credentials) => 
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (userData) => 
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getProfile: () => 
    apiFetch('/auth/profile'),

  updateProfile: (userData) => 
    apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  changePassword: (passwordData) => 
    apiFetch('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    }),

  mfaVerify: (mfaToken, code) =>
    apiFetch('/auth/mfa-verify', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code }),
    }),

  mfaSetup: () =>
    apiFetch('/auth/mfa/setup', { method: 'POST' }),

  mfaEnable: (code, password) =>
    apiFetch('/auth/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ code, password }),
    }),

  mfaDisable: (password, code) =>
    apiFetch('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),

  forgotPassword: (email) =>
    apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data) =>
    apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiFetch('/auth/logout', { method: 'POST' }),
};

// ============================================================================
// PROJECT APIs
// ============================================================================

export const projectAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      // Array filters (e.g. lga) must repeat the key — Express only builds
      // arrays from repeated params, not comma-joined strings
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }
    return apiFetch(`/projects?${params}`);
  },

  getById: (id) => 
    apiFetch(`/projects/${id}`),

  create: (projectData) => 
    apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    }),

  update: (id, projectData) => 
    apiFetch(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    }),

  delete: (id) => 
    apiFetch(`/projects/${id}`, {
      method: 'DELETE',
    }),

  getStats: () => 
    apiFetch('/projects/stats'),

  publish: (id) =>
    apiFetch(`/projects/${id}/publish`, { method: 'POST' }),

  unpublish: (id) =>
    apiFetch(`/projects/${id}/unpublish`, { method: 'POST' }),

  setFinancialStatus: (id, status) =>
    apiFetch(`/projects/${id}/financial-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  addMilestone: (projectId, milestoneData) =>
    apiFetch(`/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(milestoneData),
    }),

  updateMilestone: (projectId, milestoneId, milestoneData) =>
    apiFetch(`/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify(milestoneData),
    }),

  deleteMilestone: (projectId, milestoneId) =>
    apiFetch(`/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    }),
};

// ============================================================================
// CONTRACTOR APIs
// ============================================================================

export const contractorAPI = {
  getRisk: () =>
    apiFetch('/contractors/risk'),

  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiFetch(`/contractors?${params}`);
  },

  getById: (id) => 
    apiFetch(`/contractors/${id}`),

  create: (contractorData) =>
    apiFetch('/contractors', {
      method: 'POST',
      body: JSON.stringify(contractorData),
    }),

  getStats: (id) => 
    apiFetch(`/contractors/${id}/stats`),

  update: (id, contractorData) => 
    apiFetch(`/contractors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contractorData),
    }),

  getPerformance: (id) => 
    apiFetch(`/contractors/${id}/performance`),

  assignProject: (assignmentData) => 
    apiFetch('/contractors/assign-project', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    }),
};

// ============================================================================
// SUBMISSION APIs
// ============================================================================

export const submissionAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiFetch(`/submissions?${params}`);
  },

  getById: (id) => 
    apiFetch(`/submissions/${id}`),

  create: (submissionData) => 
    apiFetch('/submissions', {
      method: 'POST',
      body: JSON.stringify(submissionData),
    }),

  update: (id, submissionData) => 
    apiFetch(`/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(submissionData),
    }),

  review: (id, reviewData) => 
    apiFetch(`/submissions/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    }),

  transition: (id, toStage, comment) =>
    apiFetch(`/submissions/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStage, comment }),
    }),

  delete: (id) => 
    apiFetch(`/submissions/${id}`, {
      method: 'DELETE',
    }),

  getStats: () => 
    apiFetch('/submissions/stats'),
};

// ============================================================================
// DASHBOARD APIs
// ============================================================================

export const dashboardAPI = {
  getStats: () => 
    apiFetch('/dashboard/stats'),

  getProjectStatusChart: () => 
    apiFetch('/dashboard/project-status-chart'),

  getBudgetAnalysis: () => 
    apiFetch('/dashboard/budget-analysis'),

  getLGAPerformance: () => 
    apiFetch('/dashboard/lga-performance'),

  getRecentActivity: () => 
    apiFetch('/dashboard/recent-activity'),
};

// ============================================================================
// PUBLIC APIs (No authentication required)
// ============================================================================

export const publicAPI = {
  getProjects: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiFetch(`/public/projects?${params}`);
  },

  getProjectById: (id) => 
    apiFetch(`/public/projects/${id}`),

  getStats: () => 
    apiFetch('/public/stats'),

  getProjectsByCategory: () => 
    apiFetch('/public/projects-by-category'),

  getProjectsByArea: () => 
    apiFetch('/public/projects-by-lga'),

  searchProjects: (query) => 
    apiFetch(`/public/projects/search?q=${encodeURIComponent(query)}`),
};

// ============================================================================
// REPORT APIs
// ============================================================================

export const reportAPI = {
  getAll: () => 
    apiFetch('/reports'),

  generate: (reportConfig) => 
    apiFetch('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(reportConfig),
    }),

  download: (id, filename = 'report.pdf') =>
    downloadFile(`/reports/${id}/download`, filename),
};

// ============================================================================
// USER APIs
// ============================================================================

export const userAPI = {
  getAll: () => 
    apiFetch('/users'),

  update: (id, updates) =>
    apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  resetPassword: (id, newPassword) =>
    apiFetch(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  uploadProfileImage: (formData) => 
    uploadFile('/users/upload-profile-image', formData),

  getNotifications: () => 
    apiFetch('/users/notifications'),

  markNotificationRead: (id) => 
    apiFetch(`/users/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllNotificationsRead: () => 
    apiFetch('/users/notifications/read-all', {
      method: 'PUT',
    }),
};

// ============================================================================
// INVITE APIs — admin generates role-locked links; invitees self-register
// ============================================================================

export const inviteAPI = {
  // Admin
  create: (data) =>
    apiFetch('/users/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: () =>
    apiFetch('/users/invites'),

  revoke: (id) =>
    apiFetch(`/users/invites/${id}`, { method: 'DELETE' }),

  // Public — no auth header needed (apiFetch just doesn't send one)
  get: (token) =>
    apiFetch(`/auth/invite/${token}`),

  accept: (data) =>
    apiFetch('/auth/register-invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================================================
// DOCUMENT APIs
// ============================================================================

export const documentAPI = {
  upload: (formData) => 
    uploadFile('/files/upload', formData),

  uploadMultiple: (formData) => 
    uploadFile('/files/upload-multiple', formData),

  get: (id) => 
    apiFetch(`/files/${id}`),

  delete: (id) => 
    apiFetch(`/files/${id}`, {
      method: 'DELETE',
    }),

  getByProject: (projectId, category = null) => {
    const query = category ? `?category=${category}` : '';
    return apiFetch(`/files/project/${projectId}${query}`);
  },

  getBySubmission: (submissionId) => 
    apiFetch(`/files/submission/${submissionId}`),

  download: (id, filename = 'document') =>
    downloadFile(`/files/download/${id}`, filename),
};

// Instance (white-label config + workflow)
export const instanceAPI = {
  get: () =>
    apiFetch('/instance'),

  update: (settings) =>
    apiFetch('/instance', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getWorkflow: () =>
    apiFetch('/instance/workflow'),

  updateWorkflow: (stages) =>
    apiFetch('/instance/workflow', {
      method: 'PUT',
      body: JSON.stringify({ stages }),
    }),

  listRequests: () =>
    apiFetch('/instance/requests'),

  approveRequest: (id) =>
    apiFetch(`/instance/requests/${id}/approve`, { method: 'POST' }),

  rejectRequest: (id) =>
    apiFetch(`/instance/requests/${id}/reject`, { method: 'POST' }),
};

// Audit trail (admin)
export const auditAPI = {
  list: (filters = {}) =>
    apiFetch(`/audit-log?${new URLSearchParams(filters)}`),
};

// Export everything as default as well
export default {
  authAPI,
  projectAPI,
  contractorAPI,
  submissionAPI,
  dashboardAPI,
  publicAPI,
  reportAPI,
  userAPI,
  inviteAPI,
  documentAPI,
  instanceAPI,
  auditAPI,
};

