import { ADMIN_URLS, API_BASE_URL, ROUTES } from './constants';
import Cookies from 'js-cookie';
import { purgeAuth } from './auth-utils';
import { normalizeRequestPath } from './url-utils';
import { stripAdminBasePath } from './admin-path';

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
    if (typeof window !== 'undefined' && stripAdminBasePath(window.location.pathname) !== ROUTES.AUTH.LOGIN) {
      console.warn("[API] 401 Unauthorized detected. Purging session.");
      purgeAuth();
      window.location.href = ADMIN_URLS.AUTH.LOGIN_SESSION_EXPIRED();
    }
  }

  if (!response.ok) {
    let errorBody: any = null;
    let rawBody = '';
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      errorBody = await response.json().catch(() => null);
    } else {
      rawBody = await response.text().catch(() => '');
    }

    const message =
      errorBody?.error ||
      errorBody?.message ||
      rawBody.trim() ||
      response.statusText ||
      `HTTP error! status: ${response.status}`;

    const errObj = new Error(message) as any;
    errObj.status = response.status;
    errObj.data = errorBody;
    errObj.raw = rawBody;
    errObj.url = url;
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
  post: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
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
      let errorBody: any = null;
      let rawBody = '';
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        errorBody = await response.json().catch(() => null);
      } else {
        rawBody = await response.text().catch(() => '');
      }

      const message =
        errorBody?.error ||
        errorBody?.message ||
        rawBody.trim() ||
        response.statusText ||
        `HTTP error! status: ${response.status}`;

      const errObj = new Error(message) as any;
      errObj.status = response.status;
      errObj.data = errorBody;
      errObj.raw = rawBody;
      errObj.url = url;
      throw errObj;
    }

    return response.json();
  }
};
