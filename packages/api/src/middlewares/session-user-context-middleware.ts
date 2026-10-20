import { RequestContextUtils } from '@fromcode119/core';

/**
 * Records the signed-in account's id on the request context (`IRequestStore.sessionUserId`).
 *
 * The request context is what code running for the request — an isolated plugin's calls back into
 * the host among it — can read; `req.user` is not. Without this a framework service could tell which
 * site a request was for but never which person, so a capability minted for one operator could be
 * finished by anyone who got hold of it (`context.platform`'s connect tickets).
 *
 * Runs after authentication. Writes onto the request's own store, as `ConsoleLocaleMiddleware` does.
 */
export class SessionUserContextMiddleware {
  middleware() {
    return (req: any, _res: unknown, next: () => void): void => {
      const store = RequestContextUtils.storage.getStore();
      const userId = String(req.user?.id ?? '').trim();
      if (store && userId) store.sessionUserId = userId;
      next();
    };
  }
}
