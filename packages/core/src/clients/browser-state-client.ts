import type { IBrowserCookieOptions } from '@core/clients/interfaces/browser-cookie-options.interface';
import { EnvUtils } from '@core/utils/env-utils';

export class BrowserStateClient {
  readQueryParamFromWindow(name: string): string {
    if (EnvUtils.isServer()) {
      return '';
    }

    try {
      return String(new URLSearchParams(window.location.search).get(name) || '').trim();
    } catch {
      return '';
    }
  }

  readLocalString(key: string): string {
    if (EnvUtils.isServer()) {
      return '';
    }

    return String(window.localStorage.getItem(key) || '').trim();
  }

  readLocalJson<T>(key: string, fallback: T): T {
    if (EnvUtils.isServer()) {
      return fallback;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) as T : fallback;
    } catch {
      return fallback;
    }
  }

  writeLocalString(key: string, value: string): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.localStorage.setItem(key, value);
  }

  writeLocalJson(key: string, value: unknown): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }

  removeLocalValue(key: string): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.localStorage.removeItem(key);
  }

  readSessionJson<T>(key: string, fallback: T): T {
    if (EnvUtils.isServer()) {
      return fallback;
    }

    try {
      const rawValue = window.sessionStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) as T : fallback;
    } catch {
      return fallback;
    }
  }

  writeSessionJson(key: string, value: unknown): void {
    if (EnvUtils.isServer()) {
      return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
  }

  readCookie(name: string): string {
    if (EnvUtils.isServer()) {
      return '';
    }

    const cookieRow = String(document.cookie || '')
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${name}=`));
    if (!cookieRow) {
      return '';
    }

    const rawValue = cookieRow.split('=').slice(1).join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  writeCookie(name: string, value: string, options: IBrowserCookieOptions = {}): void {
    if (EnvUtils.isServer()) {
      return;
    }

    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `path=${options.path || '/'}`,
      `samesite=${options.sameSite || 'lax'}`,
    ];
    if (typeof options.maxAgeSeconds === 'number') {
      parts.push(`max-age=${options.maxAgeSeconds}`);
    }
    if (options.domain) {
      parts.push(`domain=${options.domain}`);
    }
    if (options.secure) {
      parts.push('secure');
    }

    document.cookie = parts.join('; ');
  }

  clearCookie(name: string, options: IBrowserCookieOptions = {}): void {
    this.writeCookie(name, '', {
      ...options,
      maxAgeSeconds: 0,
    });
  }
}
