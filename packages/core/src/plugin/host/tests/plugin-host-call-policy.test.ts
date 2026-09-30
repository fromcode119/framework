import { describe, expect, it } from 'vitest';
import { PluginHostCallPolicy } from '@core/plugin/host/plugin-host-call-policy';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';

/**
 * Any plugin process — the platform's too — reaches the api only through the SDK's contract. The walk
 * used to follow whatever steps arrived, so isolation contained nothing: past the contract lay every
 * framework service and the object model itself.
 */
describe('what a plugin process may ask the api for', () => {
  const context = { db: { find: async () => [] }, settings: { get: async () => ({}) }, plugins: {} };
  const lifecycle = 'lifecycle';
  const route = 'route';

  it('allows the contract: a context surface and its public members, the bridged core registries, schema work in the lifecycle', () => {
    expect(() => PluginHostCallPolicy.assert('p', { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t', {}] }] }, context, route)).not.toThrow();
    expect(() => PluginHostCallPolicy.assert('p', { root: 'context', steps: [{ name: 'plugins' }, { name: 'get', args: ['org', 'x'] }, { name: 'record', args: [1] }] }, context, route)).not.toThrow();
    // `hooks.call` is a contract method that happens to share a name with Function.prototype.call.
    expect(() => PluginHostCallPolicy.assert('p', { root: 'context', steps: [{ name: 'hooks' }, { name: 'call', args: ['p:x', {}] }] }, { ...context, hooks: {} }, route)).not.toThrow();
    expect(() => PluginHostCallPolicy.assert('p', { root: 'core', steps: [{ name: 'defaultPageContracts' }, { name: 'register', args: [{}] }] }, context, null)).not.toThrow();
    expect(() => PluginHostCallPolicy.assert('p', { root: 'core', steps: [{ name: 'defaultPageContracts' }, { name: 'list', args: [] }] }, context, lifecycle)).not.toThrow();
    expect(() => PluginHostCallPolicy.assert('p', { root: 'ddl', steps: [{ name: 'createTable', args: ['fcp_p_x'] }] }, context, lifecycle)).not.toThrow();
  });

  it('refuses the object model, private members, surfaces the context does not have, and the rest of core', () => {
    const refused: Array<[string, Array<{ name: string; args?: unknown[] }>]> = [
      ['context', [{ name: 'settings' }, { name: 'constructor' }]],
      ['context', [{ name: 'db' }, { name: '__proto__' }]],
      ['context', [{ name: 'db' }, { name: '_raw' }]],
      ['context', [{ name: 'notThere' }, { name: 'x', args: [] }]],
      ['core', [{ name: 'pluginManager' }]],
      ['core', [{ name: 'secrets' }, { name: 'decrypt', args: ['x'] }]],
      ['nowhere', [{ name: 'x' }]],
    ];
    for (const [root, steps] of refused) {
      expect(() => PluginHostCallPolicy.assert('p', { root, steps }, context, route)).toThrow(/Security Violation/);
    }
  });

  it('refuses the schema connection outside the plugin\'s lifecycle', () => {
    for (const kind of [route, 'hook', 'job', null]) {
      expect(() => PluginHostCallPolicy.assert('p', { root: 'ddl', steps: [{ name: 'execute', args: ['x'] }] }, context, kind)).toThrow(/Security Violation/);
    }
  });

  it('the dispatcher never walks into a function value', async () => {
    const tokens = new PluginInvocationTokens();
    const dispatcher = new PluginHostDispatcher('p', tokens, { withTenant: (_t: string, fn: any) => fn() }, {}, new PluginHostCallbacks('p', async () => undefined));
    const token = tokens.mint(route, undefined);
    await expect(dispatcher.dispatch(context as any, { root: 'context', steps: [{ name: 'db' }, { name: 'find' }, { name: 'length' }], token } as any)).rejects.toThrow(/function is called/);
    await expect(dispatcher.dispatch(context as any, { root: 'context', steps: [{ name: 'db' }, { name: 'find' }, { name: 'call', args: [] }], token } as any)).rejects.toThrow(/function is called/);
    await expect(dispatcher.dispatch(context as any, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: [] }], token } as any)).resolves.toEqual([]);
  });
});
