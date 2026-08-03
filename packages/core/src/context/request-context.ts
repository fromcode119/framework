import { AsyncLocalStorage } from 'async_hooks';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';

export class RequestContextUtils {
  static readonly storage = new AsyncLocalStorage<IRequestStore>();

  /** Returns the locale stored in the current async request context. */
  static getLocale(): string | undefined {
    return RequestContextUtils.storage.getStore()?.locale;
  }
}