import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { AuthContextProxy } from '@core/plugin/context/auth';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * An ISOLATED plugin asks the platform about the session it was handed — two-step status, and ending
 * it — through `context.auth`, end to end: the guest's call crosses to the host, the host walks it on
 * the REAL auth surface, and the answer comes back. Before this API, the only way was an HTTP call to
 * the api from inside the guest, which has no network (EAI_AGAIN) — so a space's "require two-step"
 * policy was never enforced and an idle session was never revoked.
 */
class Stack {
  readonly meta = new Map<string, string>([['user:7:2fa_enabled', 'true']]);
  readonly revoked: string[] = [];
  readonly hostContext: any = {
    auth: AuthContextProxy.createAuthProxy(
      { verifyToken: async (token: string) => { if (token !== 'alice-token') throw new Error('Invalid token'); return { id: 7, jti: 'jti-alice' }; } },
      {
        findOne: async (table: string, where: { key: string }) => (table === SystemConstants.TABLE.META && this.meta.has(where.key) ? { value: this.meta.get(where.key) } : null),
        update: async (table: string, where: { tokenId: string }) => { if (table === SystemConstants.TABLE.SESSIONS) this.revoked.push(where.tokenId); return {}; },
      },
    ),
  };
  readonly tokens = new PluginInvocationTokens();
  readonly dispatcher = new PluginHostDispatcher('alpha', this.tokens, { tenantLease: vi.fn() as any }, {}, new PluginHostCallbacks('alpha', async () => undefined));
  private readonly invocation = this.tokens.mint('route', undefined);

  /** The guest's `context.auth`, wired to the host through the dispatcher instead of a socket. */
  guestAuth(): any {
    const factory: any = Object.create(PluginGuestContextFactory.prototype);
    factory.remote = { call: (root: string, steps: any[]) => this.dispatcher.dispatch(this.hostContext, { root, steps, token: this.invocation } as any) };
    factory.http = {};
    return factory.auth();
  }
}

describe('isolated guest context.auth — two-step and session revocation', () => {
  afterEach(() => PluginOwners.forget('alpha'));

  it('answers two-step status for the bearer of the token the guest was handed', async () => {
    const stack = new Stack();

    await expect(stack.guestAuth().twoFactorEnabled('alice-token')).resolves.toBe(true);
    stack.meta.delete('user:7:2fa_enabled');
    await expect(stack.guestAuth().twoFactorEnabled('alice-token')).resolves.toBe(false);
    await expect(stack.guestAuth().twoFactorEnabled('forged-token')).resolves.toBeNull();
  });

  it('revokes exactly the session behind the token', async () => {
    const stack = new Stack();

    await expect(stack.guestAuth().revokeSession('alice-token')).resolves.toBe(true);
    await expect(stack.guestAuth().revokeSession('forged-token')).resolves.toBe(false);
    expect(stack.revoked).toEqual(['jti-alice']);
  });

  it('is not offered to a plugin a site uploaded', async () => {
    PluginOwners.record('alpha', 'site-a');
    const stack = new Stack();

    await expect(stack.guestAuth().twoFactorEnabled('alice-token')).rejects.toThrow(/context\.auth\.twoFactorEnabled/);
    await expect(stack.guestAuth().revokeSession('alice-token')).rejects.toThrow(/context\.auth\.revokeSession/);
    expect(stack.revoked).toEqual([]);
  });
});
