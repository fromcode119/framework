import { afterEach, describe, expect, it } from 'vitest';
import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { ConsoleLocaleMiddleware } from '@api/middlewares/console-locale-middleware';

/**
 * The console names no locale on its API calls, so a plugin's server-side text for an admin screen came
 * back in the PLATFORM's language: English sitemap sources and review labels in a Bulgarian console.
 */
describe('ConsoleLocaleMiddleware', () => {
  afterEach(() => ConsoleLocaleMiddleware.forget());

  /** A site where the person may have chosen a language and the site may have an admin default. */
  function manager(state: { personal?: string; siteDefault?: string }, reads: { count: number }) {
    return {
      db: {
        findOne: async (table: string) => {
          reads.count += 1;
          return table === SystemConstants.TABLE.PEOPLE ? { preferred_locale: state.personal ?? '' } : null;
        },
        find: async () => (state.siteDefault ? [{ key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE, value: state.siteDefault }] : []),
      },
    } as any;
  }

  async function run(middleware: ConsoleLocaleMiddleware, req: any) {
    const store: any = { locale: 'en', tenantId: 'shop' };
    await RequestContextUtils.storage.run(store, () => new Promise<void>((done) => middleware.middleware()(req, {}, done)));
    return { req, store };
  }

  const consoleRequest = (overrides: Record<string, unknown> = {}) => ({ tenantSurface: 'admin', locale: 'en', user: { id: 7 }, ...overrides });

  it("answers a console request in the reader's own language, for plugins too", async () => {
    const { req, store } = await run(new ConsoleLocaleMiddleware(manager({ personal: 'bg' }, { count: 0 })), consoleRequest());
    expect(req.locale).toBe('bg');
    expect(store.locale).toBe('bg');
  });

  it("falls back to the site's admin default when the reader chose none", async () => {
    const { store } = await run(new ConsoleLocaleMiddleware(manager({ siteDefault: 'bg' }, { count: 0 })), consoleRequest());
    expect(store.locale).toBe('bg');
  });

  it('leaves the storefront, anonymous requests and a named locale alone', async () => {
    const middleware = new ConsoleLocaleMiddleware(manager({ personal: 'bg' }, { count: 0 }));
    expect((await run(middleware, consoleRequest({ tenantSurface: 'storefront' }))).store.locale).toBe('en');
    expect((await run(middleware, consoleRequest({ user: undefined }))).store.locale).toBe('en');
    expect((await run(middleware, consoleRequest({ localeExplicit: true }))).store.locale).toBe('en');
  });

  it('remembers the answer, and forgets it when the person saves their language', async () => {
    const state = { personal: 'bg' };
    const reads = { count: 0 };
    const middleware = new ConsoleLocaleMiddleware(manager(state, reads));
    await run(middleware, consoleRequest());
    await run(middleware, consoleRequest());
    expect(reads.count).toBe(1);
    state.personal = 'en';
    ConsoleLocaleMiddleware.forget('shop', 7);
    expect((await run(middleware, consoleRequest())).store.locale).toBe('en');
  });
});
