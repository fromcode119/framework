import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';
import { AdminApiHttpService } from './api-http-service';
import { AdminApiSessionGuardService } from './api-session-guard-service';

export class AdminApi {
  private static readonly browserState = new BrowserStateClient();
  private static readonly inFlightGetRequests = new Map<string, Promise<any>>();
  private static readonly cachedGetResponses = new Map<string, { expiresAt: number; data: any }>();
  private static readonly cachedGetErrors = new Map<string, { expiresAt: number; error: any }>();
  private static readonly GET_RESPONSE_TTL_MS = 5000;
  private static readonly GET_ERROR_TTL_MS = 15000;

  static getBaseUrl(): string {
    return AdminApiHttpService.getBaseUrl();
  }

  static getURL(path: string): string {
    return AdminApiHttpService.getURL(path);
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
    const headers = AdminApiHttpService.buildHeaders(options, { isJson: false });

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

    AdminApiSessionGuardService.handleUnauthorized(response, url, options?.method || 'POST');
    return AdminApiHttpService.parseResponse(response, url);
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
      headers: AdminApiHttpService.buildHeaders(options, { isJson: false }),
      credentials: 'include',
    });

    AdminApiSessionGuardService.handleUnauthorized(response, url, options?.method || 'GET');

    if (!response.ok) {
      await AdminApiHttpService.parseResponse(response, url);
    }

    const filename = AdminApiHttpService.resolveDownloadFilename(response, path);
    const totalBytes = AdminApiHttpService.readContentLength(response.headers.get('content-length'));
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
      headers: AdminApiHttpService.buildHeaders(options),
      credentials: 'include',
    });

    AdminApiSessionGuardService.handleUnauthorized(response, url);
    return AdminApiHttpService.parseResponse(response, url);
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
        AdminApiSessionGuardService.handleUnauthorizedStatus(xhr.status, url, 'POST');
        try {
          resolve(AdminApiHttpService.parseXhrResponse(xhr, url));
        } catch (error) {
          reject(error);
        }
      };

      xhr.send(formData);
    });
  }

  private static clearGetCaches(): void {
    AdminApi.cachedGetResponses.clear();
    AdminApi.cachedGetErrors.clear();
  }
}
