import React from 'react';
import { RuntimeConstants } from './runtime-constants';

/**
 * Lazy-loading cache of `publicSettings` from /api/v1/system/frontend.
 *
 * Many UI primitives (LocalizedField, locale switchers, etc.) need to read
 * site-wide settings like `localization_locales` and `default_locale` from
 * the browser runtime. The framework loads these once per page via this
 * singleton; subsequent reads are synchronous against the cached record.
 */
export class PublicSettings {
  private static cache: Record<string, unknown> | null = null;
  private static inflight: Promise<Record<string, unknown>> | null = null;
  private static subscribers = new Set<() => void>();

  static getAll(): Record<string, unknown> | null {
    return PublicSettings.cache;
  }

  static get(key: string): unknown {
    return PublicSettings.cache ? PublicSettings.cache[key] : undefined;
  }

  /** Kick the lazy fetch if not already loaded. Safe to call repeatedly. */
  static ensureLoaded(apiBaseUrl?: string): Promise<Record<string, unknown>> {
    if (PublicSettings.cache) return Promise.resolve(PublicSettings.cache);
    if (PublicSettings.inflight) return PublicSettings.inflight;
    PublicSettings.inflight = PublicSettings.fetchFromApi(apiBaseUrl)
      .then((settings) => {
        PublicSettings.cache = settings;
        PublicSettings.inflight = null;
        PublicSettings.emit();
        return settings;
      })
      .catch((err) => {
        PublicSettings.inflight = null;
        // eslint-disable-next-line no-console
        console.warn('[PublicSettings] failed to load:', err);
        return {};
      });
    return PublicSettings.inflight;
  }

  static subscribe(handler: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    PublicSettings.subscribers.add(handler);
    window.addEventListener(RuntimeConstants.FRONTEND.EVENTS.PUBLIC_SETTINGS_LOADED, handler);
    return () => {
      PublicSettings.subscribers.delete(handler);
      window.removeEventListener(RuntimeConstants.FRONTEND.EVENTS.PUBLIC_SETTINGS_LOADED, handler);
    };
  }

  /** React hook returning the cached settings; triggers a lazy load on first call. */
  static useSettings(): Record<string, unknown> | null {
    const subscribe = React.useCallback((onChange: () => void) => PublicSettings.subscribe(onChange), []);
    const snapshot = React.useSyncExternalStore<Record<string, unknown> | null>(
      subscribe,
      () => PublicSettings.cache,
      () => null,
    );
    React.useEffect(() => {
      if (!PublicSettings.cache) PublicSettings.ensureLoaded();
    }, []);
    return snapshot;
  }

  private static async fetchFromApi(apiBaseUrl?: string): Promise<Record<string, unknown>> {
    const base = PublicSettings.resolveApiBaseUrl(apiBaseUrl);
    const url = `${base.replace(/\/+$/, '')}/api/v1/system/frontend`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return (json && typeof json === 'object' && json.publicSettings && typeof json.publicSettings === 'object')
      ? json.publicSettings as Record<string, unknown>
      : {};
  }

  private static resolveApiBaseUrl(explicit?: string): string {
    if (explicit) return explicit;
    if (typeof window === 'undefined') return '';
    const w = window as any;
    return String(w.FROMCODE_API_URL || w.Fromcode?.apiUrl || w.location?.origin || '').replace(/\/+$/, '');
  }

  private static emit(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(RuntimeConstants.FRONTEND.EVENTS.PUBLIC_SETTINGS_LOADED));
  }
}
