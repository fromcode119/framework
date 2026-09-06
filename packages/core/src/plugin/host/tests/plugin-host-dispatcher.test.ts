import { describe, expect, it, vi } from 'vitest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { RequestContextUtils } from '@core/context/request-context';

function dispatcher() {
  const tokens = new PluginInvocationTokens();
  const scopes: string[] = [];
  const db = { withTenant: vi.fn(async (tenantId: string, fn: () => Promise<unknown>) => { scopes.push(tenantId); return fn(); }) };
  const context: any = {
    db: { find: vi.fn(async (table: string) => [{ table, tenant: RequestContextUtils.getTenantId() }]) },
    plugins: { namespace: (ns: string) => ({ mlm: { record: async (p: unknown) => ({ ns, p }) } }) },
  };
  return { dispatcher: new PluginHostDispatcher('seo', tokens, db, {}, new PluginHostCallbacks(async () => undefined)), tokens, db, context, scopes };
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
    const out = await d.dispatch(context, { root: 'context', steps: [{ name: 'plugins' }, { name: 'namespace', args: ['org.x'] }, { name: 'mlm' }, { name: 'record', args: [{ id: 1 }] }], token });
    expect(out).toEqual({ ns: 'org.x', p: { id: 1 } });
  });

  it('an untenanted invocation opens no tenant scope', async () => {
    const { dispatcher: d, tokens, context, scopes } = dispatcher();
    await d.dispatch(context, { root: 'context', steps: [{ name: 'db' }, { name: 'find', args: ['t'] }], token: tokens.mint('scheduler', undefined) });
    expect(scopes).toEqual([]);
  });
});
