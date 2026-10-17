// White-label instance configuration.
// Fetched once from GET /api/instance and cached at module level so both
// React components (via InstanceContext) and plain helpers (statusMap)
// can read it without prop threading.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const DEFAULTS = {
  name: 'Government Project Tracker',
  logoUrl: '/logo.png',
  brandColor: '#0284c7',
  sidebarColor: null,
  currency: '₦',
  areaLabel: 'LGA',
  areaLabelPlural: 'LGAs',
  contactEmail: null,
  footerOrg: 'Kreatix Technologies',
  faviconUrl: null,
  accentColor: null,
  // Provider-licensed modules (INSTANCE_FEATURES env on the backend).
  features: { publicPortal: true, map: true, analytics: true, reports: true, progress: true },
};

let config = { ...DEFAULTS };
let loadPromise = null;

export const getInstance = () => config;

// Push the instance brand color into the CSS variables the design
// system is built on. color-mix derives the soft tint automatically.
const applyBrand = (c) => {
  const root = document.documentElement.style;
  if (c.brandColor) {
    root.setProperty('--brand', c.brandColor);
    root.setProperty('--btn', c.brandColor);
    root.setProperty('--soft-fg', c.brandColor);
    root.setProperty('--soft', `color-mix(in srgb, ${c.brandColor} 12%, transparent)`);
  }
  if (c.sidebarColor) {
    root.setProperty('--side', c.sidebarColor);
  }
  if (c.accentColor) {
    root.setProperty('--accent', c.accentColor);
  }
  if (c.faviconUrl) {
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = c.faviconUrl;
  }
};

export const loadInstance = () => {
  if (loadPromise) return loadPromise;
  loadPromise = fetch(`${API_BASE}/instance`)
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => {
      if (res?.success && res.data?.instance) {
        // Only explicit values override defaults — null/'' mean "unset"
        const overrides = Object.fromEntries(
          Object.entries(res.data.instance).filter(([, v]) => v != null && v !== '')
        );
        config = { ...DEFAULTS, ...overrides, features: { ...DEFAULTS.features, ...(overrides.features || {}) } };
        applyBrand(config);
        if (config.name) document.title = config.name;
      }
      return config;
    })
    .catch(() => config);
  return loadPromise;
};

// ---- Workflow stages (the configurable review chain) ----

const DEFAULT_STAGES = [
  { key: 'DRAFT', label: 'Draft', orderIndex: 0, allowedRoles: ['CONTRACTOR'], mapsToStatus: 'PENDING', isTerminal: false, isSystem: true },
  { key: 'SUBMITTED', label: 'Submitted', orderIndex: 1, allowedRoles: ['CONTRACTOR'], mapsToStatus: 'PENDING', isTerminal: false, isSystem: true },
  { key: 'UNDER_REVIEW', label: 'Under review', orderIndex: 2, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'UNDER_REVIEW', isTerminal: false, isSystem: false },
  { key: 'APPROVED', label: 'Approved', orderIndex: 3, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'APPROVED', isTerminal: true, isSystem: true },
  { key: 'REJECTED', label: 'Rejected', orderIndex: 4, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'REJECTED', isTerminal: true, isSystem: true },
];

let stages = DEFAULT_STAGES;
let stagesPromise = null;

export const getStages = () => stages;

export const stageLabel = (key) => stages.find((s) => s.key === key)?.label || key || '—';

// The stages a role may move a submission into, and the label of the
// configured next step for a given current stage.
export const forwardStages = () => stages.filter((s) => s.mapsToStatus !== 'REJECTED');
export const nextStage = (currentKey) => {
  const chain = forwardStages();
  const i = chain.findIndex((s) => s.key === currentKey);
  return i >= 0 ? chain[i + 1] || null : null;
};
export const canActOnStage = (stageKey, role) =>
  !!stages.find((s) => s.key === stageKey)?.allowedRoles?.includes(role);

export const loadStages = (force = false) => {
  if (stagesPromise && !force) return stagesPromise;
  stagesPromise = fetch(`${API_BASE}/instance/workflow`)
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => {
      if (res?.success && Array.isArray(res.data?.stages) && res.data.stages.length) {
        stages = res.data.stages;
      }
      return stages;
    })
    .catch(() => stages);
  return stagesPromise;
};
