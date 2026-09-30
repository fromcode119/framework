import { randomBytes } from 'crypto';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import type { ITenantScopeLease } from '@fromcode119/database';

/**
 * The host's memory of WHY a guest is running right now.
 *
 * Every time the host hands work to a guest — a request, a hook, a scheduled task, a lifecycle hook —
 * it mints an opaque token bound to that invocation's tenant and request context. The guest carries
 * the token on every call it makes back; the host resolves it HERE, on its own record, and runs the
 * call under that tenant. The guest never names a tenant, so a plugin cannot act as a tenant it was
 * not invoked for: not by convention, by construction (T5 spec §5.3).
 *
 * Tokens are single-invocation: minted when the work starts, revoked when it ends. A call that arrives
 * with a revoked, foreign or invented token is refused as `unknown_invocation`.
 *
 * A token also owns its invocation's database lease (`leaseFor`): the site-bound scope the guest's
 * calls reuse while this one piece of work runs. Revoking the token closes it.
 */
export class PluginInvocationTokens {
  private readonly live = new Map<string, { store: IRequestStore | undefined; tenantId: string | null; kind: string }>();
  private readonly leases = new Map<string, ITenantScopeLease>();

  /** Mints a token for one invocation; `store` is the request context to re-enter for its calls. */
  mint(kind: string, store: IRequestStore | undefined): string {
    const token = `${kind}:${randomBytes(18).toString('base64url')}`;
    const tenantId = String(store?.tenantId ?? '').trim() || null;
    this.live.set(token, { store, tenantId, kind });
    return token;
  }

  /** The invocation a token was minted for, or null — never a guess. */
  resolve(token: unknown): { store: IRequestStore | undefined; tenantId: string | null; kind: string } | null {
    if (typeof token !== 'string' || !token) return null;
    return this.live.get(token) ?? null;
  }

  /**
   * The invocation's lease, opened by `open` on first use. Only for a LIVE token, and always for the
   * tenant that token was minted for — the caller supplies how to open one, never which site.
   */
  leaseFor(token: string, open: (tenantId: string) => ITenantScopeLease): ITenantScopeLease | null {
    const invocation = this.live.get(token);
    if (!invocation?.tenantId) return null;
    let lease = this.leases.get(token);
    if (!lease) {
      lease = open(invocation.tenantId);
      this.leases.set(token, lease);
    }
    return lease;
  }

  revoke(token: string): void {
    this.live.delete(token);
    this.closeLease(token);
  }

  /** Everything outstanding — dropped when the guest dies, so nothing survives a restart. */
  revokeAll(): void {
    this.live.clear();
    for (const token of [...this.leases.keys()]) this.closeLease(token);
  }

  private closeLease(token: string): void {
    const lease = this.leases.get(token);
    if (!lease) return;
    this.leases.delete(token);
    void lease.close().catch(() => undefined);
  }

  get size(): number {
    return this.live.size;
  }
}
