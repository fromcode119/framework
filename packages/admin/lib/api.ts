import { API_BASE_URL } from './constants';

async function request(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

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
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  getURL: (path: string) => path.startsWith('http') ? path : `${API_BASE_URL}${path}`,
  get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: any, options?: RequestInit) => request(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
};
