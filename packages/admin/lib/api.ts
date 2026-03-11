import { AdminConstants } from './constants';
import Cookies from 'js-cookie';
import { AuthUtils } from './auth-utils';
import { AdminUrlUtils } from './url-utils';
import { AdminPathUtils } from './admin-path';

export class AdminApi {
  static getBaseUrl(): string {
    return AdminConstants.API_BASE_URL;
  }

  static getURL(path: string): string {
    const normalizedPath = AdminUrlUtils.normalizeRequestPath(path);
    return normalizedPath.startsWith('http') ? normalizedPath : `${AdminConstants.API_BASE_URL}${normalizedPath}`;
  }

  static async get(path: string, options?: RequestInit): Promise<any> {
    return AdminApi.request(path, { ...options, method: 'GET' });
  }

  static async post(path: string, body?: any, options?: RequestInit): Promise<any> {
    return AdminApi.request(path, {
      ...options,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async put(path: string, body?: any, options?: RequestInit): Promise<any> {
    return AdminApi.request(path, {
      ...options,
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async patch(path: string, body?: any, options?: RequestInit): Promise<any> {
    return AdminApi.request(path, {
      ...options,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async delete(path: string, options?: RequestInit): Promise<any> {
    return AdminApi.request(path, { ...options, method: 'DELETE' });
  }

  static async upload(path: string, formData: FormData, options?: RequestInit): Promise<any> {
    const url = AdminApi.getURL(path);
    const token = Cookies.get('fc_token');
    const csrfToken = Cookies.get('fc_csrf');
    const headers: Record<string, string> = {
      'X-Framework-Client': 'admin-ui',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options?.headers as any),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    return AdminApi.parseResponse(response, url);
  }

  private static async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = Cookies.get('fc_token');
    const csrfToken = Cookies.get('fc_csrf');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Framework-Client': 'admin-ui',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers as any),
    };

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = AdminApi.getURL(path);
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    AdminApi.handleUnauthorized(response, url);
    return AdminApi.parseResponse(response, url);
  }

  private static handleUnauthorized(response: Response, url: string): void {
    if (response.status !== 401) {
      return;
    }
    if (url.includes(AdminConstants.ENDPOINTS.AUTH.STATUS) || url.includes(AdminConstants.ENDPOINTS.AUTH.LOGIN)) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (AdminPathUtils.stripBase(window.location.pathname) === AdminConstants.ROUTES.AUTH.LOGIN) {
      return;
    }

    console.warn('[API] 401 Unauthorized detected. Purging session.');
    AuthUtils.purgeAuth();
    window.location.href = AdminConstants.ADMIN_URLS.AUTH.LOGIN_SESSION_EXPIRED();
  }

  private static async parseResponse(response: Response, url: string): Promise<any> {
    if (response.ok) {
      return response.json();
    }

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
}
