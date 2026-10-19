// Maps backend status enums to display labels + design-token class suffixes.
// Classes (status-<key> for pills, bar-<key> for progress fills) live in index.css.
import { getInstance } from '../services/instance';

export const areaLabel = () => getInstance().areaLabel;
export const areasLabel = () => getInstance().areaLabelPlural;
export const currency = () => getInstance().currency;

export const STATUS_KEYS = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  NEAR_COMPLETION: 'near-completion',
  COMPLETED: 'completed',
  DELAYED: 'delayed',
  ON_HOLD: 'on-hold',
  CANCELLED: 'cancelled',
  // review/submission statuses reuse the same palette
  PENDING: 'in-progress',
  SUBMITTED: 'in-progress',
  APPROVED: 'completed',
  REJECTED: 'delayed',
  UNDER_REVIEW: 'near-completion',
};

export const STATUS_LABELS = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  NEAR_COMPLETION: 'Near completion',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
  SUBMITTED: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Returned',
  UNDER_REVIEW: 'Under review',
};

export const statusKey = (status) => STATUS_KEYS[status] || 'not-started';
export const statusLabel = (status) => STATUS_LABELS[status] || status || 'Unknown';

// Canonical category options — values match the backend ProjectCategory enum
// exactly. Always store/send `value`, never re-derive it from the label.
export const CATEGORY_OPTIONS = [
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'WATER_SANITATION', label: 'Water & Sanitation' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'AGRICULTURE', label: 'Agriculture' },
  { value: 'ENERGY', label: 'Energy' },
  { value: 'ICT', label: 'ICT' },
  { value: 'TOURISM', label: 'Tourism' },
  { value: 'ENVIRONMENT', label: 'Environment' },
];

export const CATEGORY_LABELS = {
  TRANSPORTATION: 'Transportation',
  HEALTHCARE: 'Healthcare',
  WATER_AND_SANITATION: 'Water & Sanitation',
  WATER_SANITATION: 'Water & Sanitation',
  EDUCATION: 'Education',
  HOUSING: 'Housing',
  INFRASTRUCTURE: 'Infrastructure',
  AGRICULTURE: 'Agriculture',
  OTHER: 'Other',
};

export const categoryLabel = (c) =>
  CATEGORY_LABELS[c] ||
  (c ? String(c).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/\bAnd\b/, '&') : '—');

// Derive the sorted set of area names (LGAs, districts, regions —
// whatever the deployment calls them) present in a list of projects.
export const collectAreas = (projects = []) => {
  const set = new Set();
  for (const p of projects) {
    const areas = Array.isArray(p?.lga) ? p.lga : (p?.lga ? [p.lga] : []);
    areas.forEach((a) => a && set.add(a));
  }
  return [...set].sort();
};

export const fmtNaira = (n) => `${getInstance().currency}${Number(n || 0).toLocaleString()}`;

export const fmtNairaCompact = (n) => {
  const cur = getInstance().currency;
  const v = Number(n || 0);
  if (v >= 1e9) return `${cur}${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (v >= 1e6) return `${cur}${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${cur}${Math.round(v / 1e3)}K`;
  return `${cur}${v}`;
};

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtAgo = (ts) => {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  if (isNaN(diff)) return '—';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
};
