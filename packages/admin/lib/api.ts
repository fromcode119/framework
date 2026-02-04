import { API_BASE_URL } from './constants';
import Cookies from 'js-cookie';

async function request(path: string, options: RequestInit = {}) {
  // Extract token from cookie (if available to JS) to add to Authorization header
  // This serves as a fallback for HttpOnly cookies when cross-subdomain fetch has issues
  const token = Cookies.get('fc_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as any,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically send HttpOnly cookies
  });

  if (response.status === 401 && !url.includes('/api/auth/status') && !url.includes('/api/auth/login')) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      // Clear client-side session marker
      document.cookie = "fc_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // Redirect to login page
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
  getURL: (path: string) => path.startsWith('http') ? path : `${API_BASE_URL}${path}`,
  get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
  upload: async (path: string, formData: FormData, options?: RequestInit) => {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const token = Cookies.get('fc_token');
    const headers: Record<string, string> = {
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
