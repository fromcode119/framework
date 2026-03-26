import { ApiRequestError } from './api-request-error';

export class ApiRequestService {
  static buildUrl(baseUrl: string, path: string): string {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) {
      return String(baseUrl || '').trim().replace(/\/+$/, '');
    }

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      return normalizedPath;
    }

    const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
    const suffix = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    return `${normalizedBaseUrl}${suffix}`;
  }

  static async getJson(baseUrl: string, path: string, options?: RequestInit): Promise<any> {
    return ApiRequestService.requestJson(baseUrl, path, {
      ...(options || {}),
      method: 'GET',
    });
  }

  static async getBlob(baseUrl: string, path: string, options?: RequestInit): Promise<Blob> {
    const response = await ApiRequestService.request(baseUrl, path, {
      ...(options || {}),
      method: 'GET',
    });
    return response.blob();
  }

  static async getJsonOrFallback(
    baseUrl: string,
    path: string,
    fallback: any,
    options?: RequestInit,
  ): Promise<any> {
    try {
      return await ApiRequestService.getJson(baseUrl, path, options);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        return fallback;
      }

      throw error;
    }
  }

  static async requestJson(baseUrl: string, path: string, options?: RequestInit): Promise<any> {
    const response = await ApiRequestService.request(baseUrl, path, options);
    return response.json();
  }

  static async request(baseUrl: string, path: string, options?: RequestInit): Promise<Response> {
    const url = ApiRequestService.buildUrl(baseUrl, path);
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message = ApiRequestService.resolveErrorMessage(payload, response.status);
    throw new ApiRequestError(message, response.status, payload, url);
  }

  private static resolveErrorMessage(payload: unknown, statusCode: number): string {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, any>) : null;
    const explicitMessage = String(record?.error || record?.message || '').trim();
    if (explicitMessage) {
      return explicitMessage;
    }

    return `HTTP ${statusCode}`;
  }
}
