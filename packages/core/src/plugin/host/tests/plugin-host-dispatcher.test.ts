import { describe, expect, it, vi } from 'vitest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginPeerUnavailableError } from '@core/plugin/host/plugin-peer-unavailable-error';
import { RequestContextUtils } from '@core/context/request-context';

function dispatcher() {
  const tokens = new PluginInvocationTokens();
  const scopes: string[] = [];
  const db = { withTenant: vi.fn(async (tenantId: string, fn: () => Promise<unknown>) => { scopes.push(tenantId); return fn(); }) };
  const context: any = {
    db: { find: vi.fn(async (table: string) => [{ table, tenant: RequestContextUtils.getTenantId() }]) },
    plugins: { namespace: (ns: string) => ({ ledger: { record: async (p: unknown) => ({ ns, p }) } }) },
  };
  return { dispatcher: new PluginHostDispatcher('alpha', tokens, db, {}, new PluginHostCallbacks('alpha', async () => undefined)), tokens, db, context, scopes };
}

describe('PluginHostDispatcher', () => {
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
});
