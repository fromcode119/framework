import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginPeerUnavailableError } from '@core/plugin/host/plugin-peer-unavailable-error';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

function dispatcher() {
  const tokens = new PluginInvocationTokens();
  const scopes: string[] = [];
  const closed: string[] = [];
  const db = {
    tenantLease: vi.fn((tenantId: string) => ({
      run: async <T>(fn: () => Promise<T>) => { scopes.push(tenantId); return fn(); },
      close: async () => { closed.push(tenantId); },
    })),
  };
  const context: any = {
    db: { find: vi.fn(async (table: string) => [{ table, tenant: RequestContextUtils.getTenantId() }]) },
    plugins: { namespace: (ns: string) => ({ ledger: { record: async (p: unknown) => ({ ns, p }) } }) },
  };
  return { dispatcher: new PluginHostDispatcher('alpha', tokens, db, {}, new PluginHostCallbacks('alpha', async () => undefined)), tokens, db, context, scopes, closed };
}

describe('PluginHostDispatcher', () => {
  afterEach(() => PluginOwners.forget('alpha'));
  it('refuses a call whose token the host never minted', async () => {
    const { dispatcher: d, context } = dispatcher();
    await expect(d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token: 'route:forged' }))
      .rejects.toMatchObject({ code: 'unknown_invocation' });
    expect(context.db.find).not.toHaveBeenCalled();
  });

  it('runs the call under the token\'s tenant — re-entering the request context AND a tenant-bound scope', async () => {
    const { dispatcher: d, tokens, context, scopes } = dispatcher();
    const token = tokens.mint('route', { locale: 'en', tenantId: 't1' });
    const rows = await d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages'] }], token });
    expect(rows).toEqual([{ table: 'pages', tenant: 't1' }]);
    expect(scopes).toEqual(['t1']);
  });

  it('reuses ONE lease for every call of an invocation, and closes it when the token is revoked', async () => {
    const { dispatcher: d, tokens, db, context, scopes, closed } = dispatcher();
    const token = tokens.mint('route', { locale: 'en', tenantId: 't1' });
    const other = tokens.mint('route', { locale: 'en', tenantId: 't2' });
    for (let i = 0; i < 3; i += 1) await d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages'] }], token });
    const rows = await d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages'] }], token: other });
    expect(rows).toEqual([{ table: 'pages', tenant: 't2' }]);
    expect(db.tenantLease.mock.calls.map((call) => call[0])).toEqual(['t1', 't2']);
    expect(scopes).toEqual(['t1', 't1', 't1', 't2']);
    tokens.revoke(token);
    await Promise.resolve();
    expect(closed).toEqual(['t1']);
    await expect(d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['pages'] }], token }))
      .rejects.toMatchObject({ code: 'unknown_invocation' });
    tokens.revokeAll();
    await Promise.resolve();
    expect(closed).toEqual(['t1', 't2']);
  });

  it('walks property and call steps, awaiting each call', async () => {
    const { dispatcher: d, tokens, context } = dispatcher();
    const token = tokens.mint('hook', undefined);
    const out = await d.dispatch(context, { root: 'context', steps: [{ name: 'plugins' }, { name: 'namespace', args: ['org.x'] }, { name: 'ledger' }, { name: 'record', args: [{ id: 1 }] }], token });
    expect(out).toEqual({ ns: 'org.x', p: { id: 1 } });
  });

  it('an untenanted invocation opens no tenant scope', async () => {
    const { dispatcher: d, tokens, context, scopes } = dispatcher();
    await d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token: tokens.mint('scheduler', undefined) });
    expect(scopes).toEqual([]);
  });

  /**
   * `plugins.namespace('org.x').widget.registerProvider(...)` when `widget` is not resolvable (its
   * guest is down): `PluginsManagerResolver.resolve()` now answers `undefined` for that property
   * instead of handing back a stub whose methods are all `undefined`. The dispatcher must classify
   * the resulting missing property as "peer not there" and throw `PluginPeerUnavailableError`, never
   * the generic `"registerProvider" is not callable` that used to reach the operator as a failure.
   */
  it('classifies a call into an unresolved peer as peer-unavailable, not "is not callable"', async () => {
    const { dispatcher: d, tokens } = dispatcher();
    const token = tokens.mint('hook', undefined);
    const context: any = { plugins: { namespace: (_ns: string) => ({ widget: undefined }) } };
    const call = { root: 'context', steps: [{ name: 'plugins' }, { name: 'namespace', args: ['org.x'] }, { name: 'widget' }, { name: 'registerProvider', args: [{}] }], token };

    await expect(d.dispatch(context, call)).rejects.toBeInstanceOf(PluginPeerUnavailableError);
    await expect(d.dispatch(context, call)).rejects.toMatchObject({ code: 'peer_unavailable', peer: 'widget' });
  });

  it('still throws the plain "is not callable" error for a real fault unrelated to peer resolution', async () => {
    const { dispatcher: d, tokens } = dispatcher();
    const token = tokens.mint('hook', undefined);
    const context: any = { db: { find: 'not-a-function' } };
    const call = { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token };

    await expect(d.dispatch(context, call)).rejects.toThrow('"find" is not callable');
    await expect(d.dispatch(context, call)).rejects.not.toBeInstanceOf(PluginPeerUnavailableError);
  });

  it('blocks a site plugin before a platform service or DDL root is reached', async () => {
    const { dispatcher: d, tokens } = dispatcher();
    PluginOwners.record('alpha', 'site-a');
    const context: any = { meta: { set: vi.fn() } };
    const token = tokens.mint('route', { tenantId: 'site-a' });

    await expect(d.dispatch(context, {
      root: 'context', steps: [{ name: 'meta' }, { name: 'set', args: ['platform_key', 'owned'] }], token,
    })).rejects.toMatchObject({ code: 'tenant_plugin_runtime_denied', target: 'context.meta.set' });
    await expect(d.dispatch(context, {
      root: 'ddl', steps: [{ name: 'execute', args: ['ALTER TABLE users DROP COLUMN email'] }], token,
    })).rejects.toMatchObject({ code: 'tenant_plugin_runtime_denied', target: 'ddl.*' });
    expect(context.meta.set).not.toHaveBeenCalled();
  });
});
