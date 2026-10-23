import axios from 'axios';

export const TOKEN_KEY = 'irp_token';

// Requests go to /api; in development package.json "proxy" forwards them to Express on :5000.
const api = axios.create({ baseURL: '/api', timeout: 15000 });

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid token on an authenticated request logs the user out.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && sentToken) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// Turns an axios error into { message, details } for display.
export function apiError(error) {
  if (!error.response) {
    return { message: 'Cannot reach the server. Check that the backend is running.', details: {} };
  }
  const { message, details } = error.response.data || {};
  return { message: message || `Request failed (${error.response.status})`, details: details || {} };
}

export default api;
