import { SystemConstants } from '@core/constants/system.constants';
import { EnvUtils } from '@core/utils/env-utils';
import { StorefrontNoticeParam } from '@core/storefront-notice/storefront-notice-param';
import type { StorefrontNoticeDisplay } from '@core/storefront-notice/storefront-notice-display';
import type { IStorefrontNotice } from '@core/storefront-notice/interfaces/storefront-notice.interface';

/**
 * Reads the one-time notice a redirect put in the address (`?fc_notice=`) and asks the api what it says.
 *
 * The browser cannot check the signature — the key never leaves the server — so the words always come
 * from the api, never from the URL. Once read, the parameter is taken out of the address bar, so a
 * reload, a bookmark or a shared link does not show the message again.
 */
export class StorefrontNoticeClient {
  constructor(
    private readonly requester: { get: (path: string, options?: any) => Promise<any> },
  ) {}

  /** The token in the current address, or '' (always '' on the server). */
  static readTokenFromWindow(): string {
    if (EnvUtils.isServer()) return '';
    try {
      return String(new URLSearchParams(window.location.search).get(StorefrontNoticeParam.NAME) ?? '').trim();
    } catch {
      return '';
    }
  }

  /** Takes the notice parameter out of the address bar without a navigation. */
  static clearFromWindow(): void {
    if (EnvUtils.isServer() || typeof window.history?.replaceState !== 'function') return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(StorefrontNoticeParam.NAME)) return;
      url.searchParams.delete(StorefrontNoticeParam.NAME);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Leaving the parameter in place only means a reload asks again; the api still decides.
    }
  }

  /** What `token` says when shown as `display`, or null when it does not verify for this site. */
  async resolve(token: string, display: StorefrontNoticeDisplay): Promise<IStorefrontNotice | null> {
    const value = String(token ?? '').trim();
    if (!value) return null;
    const query = `?token=${encodeURIComponent(value)}&display=${encodeURIComponent(String(display.value))}`;
    try {
      const response = await this.requester.get(`${SystemConstants.API_PATH.SYSTEM.STOREFRONT_NOTICE}${query}`, { silent: true, noDedupe: true });
      const notice = response?.notice;
      return notice && String(notice.title || '').trim() ? { tone: String(notice.tone || ''), title: String(notice.title), body: String(notice.body || '') } : null;
    } catch {
      return null;
    }
  }
}
