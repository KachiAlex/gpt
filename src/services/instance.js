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
        config = { ...DEFAULTS, ...overrides };
        applyBrand(config);
        if (config.name) document.title = config.name;
      }
      return config;
    })
    .catch(() => config);
  return loadPromise;
};
