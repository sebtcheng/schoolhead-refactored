/**
 * Centralized API URL helper for SchoolHead.
 * Resolves to '/insighted-schoolhead/api' in production (where base is /insighted-schoolhead/)
 * Resolves to '/api' in localhost (where base is /)
 */
const BASE_PATH = import.meta.env.BASE_URL;
const ENV_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = ENV_API_URL ? ENV_API_URL : `${BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH}/api`;

/**
 * Build an API URL. 
 * Pass a path starting with a slash, e.g. api('/ph_schools/999009')
 * It automatically handles the /api prefix.
 */
export const api = (path) => {
  if (!path) return API_BASE;
  
  // Strip leading slash for easier processing
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If the path already starts with 'api/', strip it to avoid double '/api/api'
  if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(4);
  }
  
  return `${API_BASE}/${cleanPath}`;
};
