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
