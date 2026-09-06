import { describe, expect, it } from 'vitest';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';

describe('PluginInvocationTokens', () => {
  it('binds a token to the tenant of the store it was minted with', () => {
    const tokens = new PluginInvocationTokens();
    const token = tokens.mint('route', { locale: 'bg', tenantId: 't1' });
    expect(tokens.resolve(token)).toMatchObject({ tenantId: 't1', kind: 'route' });
    expect(tokens.resolve(token)?.store?.locale).toBe('bg');
  });

  it('resolves nothing for a forged, revoked or foreign token — never a default tenant', () => {
    const tokens = new PluginInvocationTokens();
    const token = tokens.mint('hook', { locale: '', tenantId: 't1' });
    expect(tokens.resolve('route:forged')).toBeNull();
    expect(tokens.resolve(undefined)).toBeNull();
    tokens.revoke(token);
    expect(tokens.resolve(token)).toBeNull();
    const other = new PluginInvocationTokens();
    expect(other.resolve(tokens.mint('job', undefined))).toBeNull();
  });

  it('an untenanted invocation (boot, scheduler) resolves to no tenant, not to a guessed one', () => {
    const tokens = new PluginInvocationTokens();
    expect(tokens.resolve(tokens.mint('lifecycle', undefined))?.tenantId).toBeNull();
  });

  it('revokeAll drops every outstanding token when the guest dies', () => {
    const tokens = new PluginInvocationTokens();
    const a = tokens.mint('route', undefined);
    const b = tokens.mint('route', undefined);
    tokens.revokeAll();
    expect(tokens.resolve(a)).toBeNull();
    expect(tokens.resolve(b)).toBeNull();
    expect(tokens.size).toBe(0);
  });
});
