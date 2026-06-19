import { AdminConstants } from './constants';
import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';
import { AdminUrlUtils } from './url-utils';

export class AdminApiHttpService {
  private static readonly browserState = new BrowserStateClient();

  static getBaseUrl(): string {
    return AdminConstants.API_BASE_URL;
  }

  static getURL(path: string): string {
    const normalizedPath = AdminUrlUtils.normalizeRequestPath(path);
    return normalizedPath.startsWith('http') ? normalizedPath : `${AdminConstants.API_BASE_URL}${normalizedPath}`;
  }

  static buildHeaders(options?: RequestInit, config?: { isJson?: boolean }): Record<string, string> {
    const token = AdminApiHttpService.browserState.readCookie(CookieConstants.AUTH_TOKEN);
    const csrfToken = AdminApiHttpService.browserState.readCookie(CookieConstants.AUTH_CSRF);
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

  static parseXhrResponse(xhr: XMLHttpRequest, url: string): any {
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

  static async parseResponse(response: Response, url: string): Promise<any> {
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

  static resolveDownloadFilename(response: Response, path: string): string {
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

  static readContentLength(value: string | null): number | null {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }
}
