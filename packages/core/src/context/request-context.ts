import { AsyncLocalStorage } from 'async_hooks';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';

export class RequestContextUtils {
  static readonly storage = new AsyncLocalStorage<IRequestStore>();

  /** Returns the locale stored in the current async request context. */
  static getLocale(): string | undefined {
    return RequestContextUtils.storage.getStore()?.locale;
  }

  /** The current request's tenant, or undefined. An empty string counts as absent. */
  static getTenantId(): string | undefined {
    const tenantId = RequestContextUtils.storage.getStore()?.tenantId;
    const trimmed = String(tenantId ?? '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /** The bound site's own default locale, or undefined (platform scope, or the site set none). */
  static getSiteLocale(): string | undefined {
    const locale = String(RequestContextUtils.storage.getStore()?.siteLocale ?? '').trim();
    return locale.length > 0 ? locale : undefined;
  }

  /** The user the current work is done for, or undefined — see {@link IRequestStore.user}. */
  static getUser(): Record<string, unknown> | undefined {
    return RequestContextUtils.storage.getStore()?.user;
  }

  /**
   * Runs `work` in the current request context with `user` recorded as the actor.
   *
   * Outside a request (no store) it runs unchanged: opening a store here would make the work look
   * like a request to every check that asks "is there one?", which is a bigger change than naming who
   * acts.
   */
  static runAs<T>(user: Record<string, unknown> | null | undefined, work: () => T): T {
    const store = RequestContextUtils.storage.getStore();
    if (!user || !store) return work();
    return RequestContextUtils.storage.run({ ...store, user }, work);
  }

  /**
   * The current request's tenant, or a thrown error.
   *
   * Used by every tenant-scoped data path: an absent tenant must FAIL the request, never widen the
   * query to every tenant. That widening is the exact shape of a cross-customer data leak.
   */
  static requireTenantId(): string {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) {
      throw new Error('No tenant in the request context; refusing to run an untenanted query.');
    }
    return tenantId;
  }
}
