import { API_BASE_URL } from './constants';
import Cookies from 'js-cookie';
import { purgeAuth } from './auth-utils';
import { normalizeRequestPath } from './url-utils';

async function request(path: string, options: RequestInit = {}) {
  // Extract token from cookie (if available to JS).
  // Note: Backend cookies are usually HttpOnly, so this is rarely used now.
  const token = Cookies.get('fc_token');
  const csrfToken = Cookies.get('fc_csrf');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Framework-Client': 'admin-ui',
    'X-Requested-With': 'XMLHttpRequest',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...options.headers as any,
  };

  // Only add Bearer if it's explicitly available to JS
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedPath = normalizeRequestPath(path);
  const url = normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically send HttpOnly cookies from backend
  });

  if (response.status === 401 && !url.includes('/api/auth/status') && !url.includes('/api/auth/login')) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      console.warn("[API] 401 Unauthorized detected. Purging session.");
      purgeAuth();
      window.location.href = '/login?reason=session_expired';
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errObj = new Error(errorBody.error || errorBody.message || `HTTP error! status: ${response.status}`) as any;
    errObj.status = response.status;
    errObj.data = errorBody;
    throw errObj;
  }

  return response.json();
}

export const api = {
  getBaseUrl: () => API_BASE_URL,
  getURL: (path: string) => {
    const normalizedPath = normalizeRequestPath(path);
    return normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;
  },
  get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
  upload: async (path: string, formData: FormData, options?: RequestInit) => {
    const normalizedPath = normalizeRequestPath(path);
    const url = normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;
    const token = Cookies.get('fc_token');
    const csrfToken = Cookies.get('fc_csrf');
    const headers: Record<string, string> = {
      'X-Framework-Client': 'admin-ui',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options?.headers as any,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errObj = new Error(error.error || `HTTP error! status: ${response.status}`) as any;
      errObj.status = response.status;
      throw errObj;
    }

    return response.json();
  }
};
