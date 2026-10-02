import { describe, expect, it, vi } from 'vitest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';
import { PluginJsonRows } from '@core/plugin/host/plugin-json-rows';

/**
 * The host asks for JSON rows (`PluginJsonRows.REQUEST`) only on `context.db.find` — directly or through
 * the `stored` / `withArchived` views — and only for a process whose protocol says it reads them.
 */
function setup() {
  const tokens = new PluginInvocationTokens();
  const db = { tenantLease: () => ({ run: async <T>(fn: () => Promise<T>) => fn(), close: async () => undefined }) };
  const find = vi.fn(async (..._args: unknown[]) => []);
  const count = vi.fn(async (..._args: unknown[]) => 0);
  const dbApi: any = { find, count };
  dbApi.stored = dbApi;
  dbApi.withArchived = dbApi;
  const context: any = { db: dbApi };
  const dispatcher = new PluginHostDispatcher('alpha', tokens, db as any, {}, new PluginHostCallbacks('alpha', async () => undefined));
  return { dispatcher, context, find, count, token: tokens.mint('route', { locale: 'en', tenantId: 't1' }) };
}

const marks = (options: unknown) => Boolean(options && (options as any)[PluginJsonRows.REQUEST]);

describe('PluginHostDispatcher and JSON rows', () => {
  it('marks db.find for a process that reads JSON rows, keeping its options', async () => {
    const { dispatcher, context, find, token } = setup();
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages', { limit: 3 }] }], token }, PluginHostProtocol.identity());
    expect(marks(find.mock.calls[0][1])).toBe(true);
    expect(find.mock.calls[0][1]).toMatchObject({ limit: 3 });
  });

  it('marks it through the stored and withArchived views, and with no options at all', async () => {
    const { dispatcher, context, find, token } = setup();
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'stored' }, { name: 'find', args: ['pages'] }], token }, PluginHostProtocol.identity());
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'withArchived' }, { name: 'find', args: ['pages'] }], token }, PluginHostProtocol.identity());
    expect(find.mock.calls.map((call) => marks(call[1]))).toEqual([true, true]);
  });

  it('never marks a process that does not say it reads them', async () => {
    const { dispatcher, context, find, token } = setup();
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages', {}] }], token }, { version: PluginHostProtocol.VERSION, node: process.version });
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages', {}] }], token });
    expect(find.mock.calls.map((call) => marks(call[1]))).toEqual([false, false]);
  });

  it('never marks any other call', async () => {
    const { dispatcher, context, count, token } = setup();
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'count', args: ['pages', {}] }], token }, PluginHostProtocol.identity());
    expect(marks(count.mock.calls[0][1])).toBe(false);
  });
});
