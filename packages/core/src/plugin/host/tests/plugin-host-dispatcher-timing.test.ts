import { describe, expect, it, vi } from 'vitest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';

/**
 * The plugin process times each call it makes back to the platform from its side. The host keeps its own
 * side of the same calls on the invocation, by kind of call, so what the two differ by — the way there and
 * back — can be told from what the platform itself spent.
 */
describe('PluginHostDispatcher keeps the host\'s own time on an invocation', () => {
  const build = () => {
    const tokens = new PluginInvocationTokens();
    const context: any = {
      db: { find: vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return []; }) },
      settings: { get: vi.fn(async () => ({})) },
    };
    const dispatcher = new PluginHostDispatcher('alpha', tokens, { tenantLease: vi.fn() } as any, {}, new PluginHostCallbacks('alpha', async () => undefined));
    return { tokens, context, dispatcher };
  };

  it('adds each call to the invocation total and to its kind', async () => {
    const { tokens, context, dispatcher } = build();
    const token = tokens.mint('route', undefined);
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token });
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['u'] }], token });
    await dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'settings' }, { name: 'get', args: [] }], token });
    const rpc = tokens.resolve(token)!.rpc;
    expect(rpc.count).toBe(3);
    expect(rpc.by.get('db-find')!.count).toBe(2);
    expect(rpc.by.get('settings-get')!.count).toBe(1);
    expect(rpc.by.get('db-find')!.ms).toBeGreaterThanOrEqual(9);
    expect(rpc.ms).toBeGreaterThanOrEqual(rpc.by.get('db-find')!.ms);
  });

  it('counts a call that fails, and names its kind only from the platform surface it asked for', async () => {
    const { tokens, context, dispatcher } = build();
    context.db.find = vi.fn(async () => { throw new Error('boom'); });
    const token = tokens.mint('route', undefined);
    await expect(dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token })).rejects.toThrow('boom');
    expect(tokens.resolve(token)!.rpc.count).toBe(1);
    for (const kind of tokens.resolve(token)!.rpc.by.keys()) expect(kind).toMatch(/^[a-z0-9-]{1,28}$/);
  });

  it('keeps nothing for a token the host never minted', async () => {
    const { context, dispatcher } = build();
    await expect(dispatcher.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token: 'route:forged' })).rejects.toMatchObject({ code: 'unknown_invocation' });
  });
});
