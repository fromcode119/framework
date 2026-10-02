import { LocalizationUtils, RequestContextUtils, SettingChangeInvalidators, SystemConstants } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';
import { AdminConsoleLocale } from '@api/services/system/admin-console-locale';

/**
 * A console request speaks the console language of the person making it.
 *
 * The console names no locale on its API calls, so they resolved to the PLATFORM default: everything a
 * plugin translated on the server for an admin screen — a sitemap's source names, a review's source,
 * numerology meanings — came back English in a Bulgarian console, while the console's own copy and the
 * field labels (`AdminConsoleLocale`) were Bulgarian. Runs after authentication, on the admin surface
 * only, and only when the request named no locale of its own (`?locale`, the locale cookie). It sets
 * both `req.locale` and the request context, which is what isolated plugins receive.
 *
 * The answer is two small reads, so it is kept per site and person for a short while and dropped when
 * that person saves their language or the site changes its admin default.
 */
export class ConsoleLocaleMiddleware {
  static readonly ADMIN_SURFACE = 'admin';
  private static readonly TTL_MS = 60_000;
  private static readonly cache = new Map<string, { locale: string; expires: number }>();
  private static unregister: (() => void) | undefined;

  constructor(private readonly manager: PluginManager) {
    ConsoleLocaleMiddleware.unregister?.();
    ConsoleLocaleMiddleware.unregister = SettingChangeInvalidators.register(
      [SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE],
      (tenantId) => ConsoleLocaleMiddleware.forget(tenantId ?? undefined),
    );
  }

  middleware() {
    return (req: any, _res: unknown, next: () => void): void => {
      if (req.tenantSurface !== ConsoleLocaleMiddleware.ADMIN_SURFACE || req.localeExplicit || req.user?.id == null) {
        next();
        return;
      }
      this.resolve(req)
        .then((locale) => {
          if (locale) {
            req.locale = locale;
            const store = RequestContextUtils.storage.getStore();
            if (store) store.locale = locale;
          }
        })
        .catch(() => undefined)
        .finally(() => next());
    };
  }

  /** Drop one person's remembered language on a site, or everyone's on the site, or everyone's anywhere. */
  static forget(tenantId?: string, userId?: unknown): void {
    if (tenantId === undefined) {
      ConsoleLocaleMiddleware.cache.clear();
      return;
    }
    const prefix = `${tenantId}:`;
    for (const key of ConsoleLocaleMiddleware.cache.keys()) {
      if (userId == null ? key.startsWith(prefix) : key === `${prefix}${userId}`) ConsoleLocaleMiddleware.cache.delete(key);
    }
  }

  private async resolve(req: any): Promise<string> {
    const key = `${RequestContextUtils.getTenantId() ?? ''}:${req.user.id}`;
    const cached = ConsoleLocaleMiddleware.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.locale;
    const locale = LocalizationUtils.normalizeLocaleCode(await AdminConsoleLocale.resolve(this.manager, req)) || '';
    ConsoleLocaleMiddleware.cache.set(key, { locale, expires: Date.now() + ConsoleLocaleMiddleware.TTL_MS });
    return locale;
  }
}
