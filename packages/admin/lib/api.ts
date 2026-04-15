import { AdminConstants } from './constants';
import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';
import { AuthUtils } from './auth-utils';
import { AdminUrlUtils } from './url-utils';
import { AdminPathUtils } from './admin-path';

export class AdminApi {
  private static readonly browserState = new BrowserStateClient();
  private static readonly inFlightGetRequests = new Map<string, Promise<any>>();
  private static readonly cachedGetResponses = new Map<string, { expiresAt: number; data: any }>();
  private static readonly cachedGetErrors = new Map<string, { expiresAt: number; error: any }>();
  private static readonly GET_RESPONSE_TTL_MS = 5000;
  private static readonly GET_ERROR_TTL_MS = 15000;

  static getBaseUrl(): string {
    return AdminConstants.API_BASE_URL;
  }

  static getURL(path: string): string {
    const normalizedPath = AdminUrlUtils.normalizeRequestPath(path);
    return normalizedPath.startsWith('http') ? normalizedPath : `${AdminConstants.API_BASE_URL}${normalizedPath}`;
  }

  static getAdminExportToken(): string {
    return AdminApi.browserState.readCookie(CookieConstants.ADMIN_EXPORT_AUTH_TOKEN);
  }

  static async get(path: string, options?: RequestInit & { noDedupe?: boolean }): Promise<any> {
    if (options?.noDedupe) {
      return AdminApi.request(path, { ...options, method: 'GET' });
    }

    const token = AdminApi.browserState.readCookie(CookieConstants.AUTH_TOKEN);
    const dedupeKey = `${AdminApi.getURL(path)}|${token ? 'auth' : 'anon'}`;
    const now = Date.now();
    const cachedResponse = AdminApi.cachedGetResponses.get(dedupeKey);
    if (cachedResponse && cachedResponse.expiresAt > now) {
      return cachedResponse.data;
    }

    const cachedError = AdminApi.cachedGetErrors.get(dedupeKey);
    if (cachedError && cachedError.expiresAt > now) {
      throw cachedError.error;
    }

    const inFlight = AdminApi.inFlightGetRequests.get(dedupeKey);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = AdminApi.request(path, { ...options, method: 'GET' })
      .then((data) => {
        AdminApi.cachedGetResponses.set(dedupeKey, {
          expiresAt: Date.now() + AdminApi.GET_RESPONSE_TTL_MS,
          data,
        });
        AdminApi.cachedGetErrors.delete(dedupeKey);
        return data;
      })
      .catch((error) => {
        AdminApi.cachedGetErrors.set(dedupeKey, {
          expiresAt: Date.now() + AdminApi.GET_ERROR_TTL_MS,
          error,
        });
        throw error;
      })
      .finally(() => {
        AdminApi.inFlightGetRequests.delete(dedupeKey);
      });

    AdminApi.inFlightGetRequests.set(dedupeKey, requestPromise);
    return requestPromise;
  }

  static async post(path: string, body?: any, options?: RequestInit): Promise<any> {
    AdminApi.clearGetCaches();
    return AdminApi.request(path, {
      ...options,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async put(path: string, body?: any, options?: RequestInit): Promise<any> {
    AdminApi.clearGetCaches();
    return AdminApi.request(path, {
      ...options,
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async patch(path: string, body?: any, options?: RequestInit): Promise<any> {
    AdminApi.clearGetCaches();
    return AdminApi.request(path, {
      ...options,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  static async delete(path: string, options?: RequestInit): Promise<any> {
    AdminApi.clearGetCaches();
    return AdminApi.request(path, { ...options, method: 'DELETE' });
  }

  static async upload(
    path: string,
    formData: FormData,
    options?: RequestInit & {
      onProgress?: (state: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void;
    },
  ): Promise<any> {
    AdminApi.clearGetCaches();
    const url = AdminApi.getURL(path);
    const headers = AdminApi.buildHeaders(options, { isJson: false });

    if (typeof XMLHttpRequest !== 'undefined' && options?.onProgress) {
      return AdminApi.uploadWithProgress(url, formData, headers, options.onProgress);
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

  static async download(
    path: string,
    options?: RequestInit,
    onProgress?: (state: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void,
  ): Promise<{ blob: Blob; filename: string }> {
    const url = AdminApi.getURL(path);
    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers: AdminApi.buildHeaders(options, { isJson: false }),
      credentials: 'include',
    });

    AdminApi.handleUnauthorized(response, url);

    if (!response.ok) {
      await AdminApi.parseResponse(response, url);
    }

    const filename = AdminApi.resolveDownloadFilename(response, path);
    const totalBytes = AdminApi.readContentLength(response.headers.get('content-length'));
    if (!response.body) {
      const blob = await response.blob();
      onProgress?.({
        loadedBytes: blob.size,
        totalBytes: totalBytes ?? blob.size,
        percent: 100,
      });
      return { blob, filename };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;
    onProgress?.({ loadedBytes, totalBytes, percent: totalBytes === 0 ? 100 : 0 });

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      chunks.push(value);
      loadedBytes += value.byteLength;
      onProgress?.({
        loadedBytes,
        totalBytes,
        percent: totalBytes ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : null,
      });
    }

    const blob = new Blob(chunks as BlobPart[]);
    onProgress?.({
      loadedBytes: blob.size,
      totalBytes: totalBytes ?? blob.size,
      percent: 100,
    });

    return {
      blob,
      filename,
    };
  }

  private static async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = AdminApi.getURL(path);
    const response = await fetch(url, {
      ...options,
      headers: AdminApi.buildHeaders(options),
      credentials: 'include',
    });

    AdminApi.handleUnauthorized(response, url);
    return AdminApi.parseResponse(response, url);
  }

  private static uploadWithProgress(
    url: string,
    formData: FormData,
    headers: Record<string, string>,
    onProgress: (state: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.withCredentials = true;

      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }

      xhr.upload.onprogress = (event) => {
        const totalBytes = event.lengthComputable ? event.total : null;
        onProgress({
          loadedBytes: event.loaded,
          totalBytes,
          percent: totalBytes ? Math.round((event.loaded / totalBytes) * 100) : null,
        });
      };

      xhr.onerror = () => reject(new Error('Network request failed'));

      xhr.onload = () => {
        AdminApi.handleUnauthorizedStatus(xhr.status, url);
        try {
          resolve(AdminApi.parseXhrResponse(xhr, url));
        } catch (error) {
          reject(error);
        }
      };

      xhr.send(formData);
    });
  }

  private static handleUnauthorized(response: Response, url: string): void {
    AdminApi.handleUnauthorizedStatus(response.status, url);
  }

  private static handleUnauthorizedStatus(status: number, url: string): void {
    const shouldPurge = status === 401;

    if (!shouldPurge) {
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

    console.warn(`[API] ${status} auth failure detected. Purging session.`);
    AuthUtils.purgeAuth();
    window.location.href = AdminConstants.ADMIN_URLS.AUTH.LOGIN_SESSION_EXPIRED();
  }

  private static parseXhrResponse(xhr: XMLHttpRequest, url: string): any {
    const contentType = xhr.getResponseHeader('content-type') || '';
    const rawBody = typeof xhr.responseText === 'string' ? xhr.responseText : '';
    const body = contentType.includes('application/json') && rawBody ? JSON.parse(rawBody) : null;

    if (xhr.status >= 200 && xhr.status < 300) {
      return body;
    }

    const message = body?.error || body?.message || rawBody.trim() || `HTTP error! status: ${xhr.status}`;
    const errObj = new Error(message) as any;
    errObj.status = xhr.status;
    errObj.data = body;
    errObj.raw = rawBody;
    errObj.url = url;
    throw errObj;
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

  private static clearGetCaches(): void {
    AdminApi.cachedGetResponses.clear();
    AdminApi.cachedGetErrors.clear();
  }

  private static buildHeaders(options?: RequestInit, config?: { isJson?: boolean }): Record<string, string> {
    const token = AdminApi.browserState.readCookie(CookieConstants.AUTH_TOKEN);
    const csrfToken = AdminApi.browserState.readCookie(CookieConstants.AUTH_CSRF);
    const headers: Record<string, string> = {
      ...(config?.isJson === false ? {} : { 'Content-Type': 'application/json' }),
      'X-Framework-Client': 'admin-ui',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options?.headers as any),
    };

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private static resolveDownloadFilename(response: Response, path: string): string {
    const contentDisposition = response.headers.get('content-disposition') || '';
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (filenameMatch?.[1]) {
      return filenameMatch[1];
    }

    const segments = String(path || '').split('/').filter(Boolean);
    return segments[segments.length - 2] || 'backup-download';
  }

  private static readContentLength(value: string | null): number | null {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }
}
