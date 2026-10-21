/**
 * Centralized caching utility for reducing API calls
 * All cache keys should be defined here for consistency
 */

export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats_cache',
  RECENT_PROJECTS: 'recent_projects_cache',
  PROJECTS_LIST: 'projects_list_cache',
  CONTRACTORS: 'contractors_cache',
};

export const CACHE_DURATIONS = {
  DASHBOARD: 5 * 60 * 1000,      // 5 minutes
  RECENT_DATA: 3 * 60 * 1000,    // 3 minutes
  LIST_DATA: 5 * 60 * 1000,      // 5 minutes
};

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {object|null} - Cached data or null
 */
export const getFromCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    return { data, timestamp };
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
};

/**
 * Save data to cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export const saveToCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error(`Error saving cache for ${key}:`, error);
  }
};

/**
 * Check if cache is still valid
 * @param {number} timestamp - Cache timestamp
 * @param {number} duration - Cache duration in milliseconds
 * @returns {boolean} - True if cache is valid
 */
export const isCacheValid = (timestamp, duration) => {
  if (!timestamp) return false;
  return Date.now() - timestamp < duration;
};

/**
 * Invalidate specific cache
 * @param {string} key - Cache key to invalidate
 */
export const invalidateCache = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error invalidating cache for ${key}:`, error);
  }
};

/**
 * Invalidate multiple caches at once
 * @param {string[]} keys - Array of cache keys to invalidate
 */
export const invalidateMultiple = (keys) => {
  keys.forEach(key => invalidateCache(key));
};

/**
 * Clear all app caches — exact keys plus per-user variants (`<key>_<userId>`).
 * Called on sign-out and token expiry so the next user can't see stale data.
 */
export const clearAllCaches = () => {
  try {
    const prefixes = Object.values(CACHE_KEYS);
    Object.keys(localStorage)
      .filter((k) => prefixes.some((p) => k === p || k.startsWith(`${p}_`)))
      .forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

