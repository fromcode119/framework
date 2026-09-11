import { describe, expect, it, vi } from 'vitest';
import { PluginSiteDataContext } from '@core/plugin/tenant/plugin-site-data-context';

/**
 * `onInit` registers AND sets up data. The framework runs it once for the registration and again per
 * site for the data — which only works if the second pass cannot register anything twice.
 */
describe('PluginSiteDataContext', () => {
  const build = () => {
    const spies = {
      use: vi.fn(), registerCollection: vi.fn(), on: vi.fn(), schedule: vi.fn(),
      registerSettings: vi.fn(), find: vi.fn(async () => []), insert: vi.fn(async () => ({ id: 1 })),
      getSettings: vi.fn(async () => ({})),
    };
    const context = {
      api: { use: spies.use },
      collections: { register: spies.registerCollection },
      hooks: { on: spies.on },
      scheduler: { register: spies.schedule },
      settings: { register: spies.registerSettings, get: spies.getSettings },
      db: { find: spies.find, insert: spies.insert },
      logger: { info: vi.fn() },
    } as any;
    return { context: PluginSiteDataContext.wrap(context), spies };
  };

  it('accepts registration calls and does nothing with them', async () => {
    const { context, spies } = build();

    context.api.use('/', () => undefined);
    context.collections.register({} as never);
    context.hooks.on('x', () => undefined);
    await context.scheduler.register('t', '* * * * *', async () => undefined);
    context.settings.register({} as never);

    for (const spy of [spies.use, spies.registerCollection, spies.on, spies.schedule, spies.registerSettings]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  /** A plugin chains and awaits these; returning undefined would throw inside the PLUGIN. */
  it('still returns something awaitable, so plugin code survives', async () => {
    const { context } = build();

    await expect(context.api.use('/', () => undefined)).resolves.toBeUndefined();
  });

  it('leaves everything that reads or writes alone — that is the half being replayed', async () => {
    const { context, spies } = build();

    await context.db.find('t', {});
    await context.db.insert('t', {});
    await context.settings.get();

    expect(spies.find).toHaveBeenCalled();
    expect(spies.insert).toHaveBeenCalled();
    expect(spies.getSettings).toHaveBeenCalled();
  });

  it('passes through surfaces it was never asked to suppress', () => {
    const { context } = build();
    expect(context.logger.info).toBeTypeOf('function');
  });
});
