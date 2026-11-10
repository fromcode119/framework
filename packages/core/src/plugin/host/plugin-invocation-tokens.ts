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
  private readonly live = new Map<string, { store: IRequestStore | undefined; tenantId: string | null; kind: string; rpc: { ms: number; count: number; by: Map<string, { ms: number; count: number }> } }>();
  private readonly leases = new Map<string, ITenantScopeLease>();
  /** Per live token: host calls still running, and when the last one started or ended. */
  private readonly activity = new Map<string, { running: number; lastAt: number }>();

  /** Mints a token for one invocation; `store` is the request context to re-enter for its calls. */
  mint(kind: string, store: IRequestStore | undefined): string {
    const token = `${kind}:${randomBytes(18).toString('base64url')}`;
    const tenantId = String(store?.tenantId ?? '').trim() || null;
    this.live.set(token, { store, tenantId, kind, rpc: { ms: 0, count: 0, by: new Map() } });
    this.activity.set(token, { running: 0, lastAt: Date.now() });
    return token;
  }

  /** The invocation a token was minted for, or null — never a guess. */
  resolve(token: unknown): { store: IRequestStore | undefined; tenantId: string | null; kind: string; rpc: { ms: number; count: number; by: Map<string, { ms: number; count: number }> } } | null {
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

  /**
   * Runs one host call the guest made under `token`, recorded as that invocation's activity: a request
   * that keeps calling back is working, not stuck (see {@link quietForMs}).
   */
  async track<T>(token: string, call: () => Promise<T>): Promise<T> {
    const entry = this.activity.get(token);
    if (!entry) return call();
    entry.running += 1;
    entry.lastAt = Date.now();
    try {
      return await call();
    } finally {
      entry.running -= 1;
      entry.lastAt = Date.now();
    }
  }

  /**
   * How long the invocation has gone without calling the host: 0 while one of its calls is still
   * running, Infinity for a token that is not live. A deadline on THIS, not on the whole request, lets a
   * large checkout finish while a guest that is really stuck still goes quiet and is cut off.
   */
  quietForMs(token: string, now = Date.now()): number {
    const entry = this.activity.get(token);
    if (!entry) return Infinity;
    return entry.running > 0 ? 0 : Math.max(0, now - entry.lastAt);
  }

  revoke(token: string): void {
    this.live.delete(token);
    this.activity.delete(token);
    this.closeLease(token);
  }

  /** Everything outstanding — dropped when the guest dies, so nothing survives a restart. */
  revokeAll(): void {
    this.live.clear();
    this.activity.clear();
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
