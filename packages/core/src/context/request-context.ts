import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  locale: string;
  [key: string]: any;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getLocale(): string | undefined {
  return requestContext.getStore()?.locale;
}
