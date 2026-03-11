import { AsyncLocalStorage } from 'async_hooks';
import type { RequestStore } from './request-context.interfaces';

export class RequestContextUtils {
  static readonly storage = new AsyncLocalStorage<RequestStore>();

  /** Returns the locale stored in the current async request context. */
  static getLocale(): string | undefined {
    return RequestContextUtils.storage.getStore()?.locale;
  }
}