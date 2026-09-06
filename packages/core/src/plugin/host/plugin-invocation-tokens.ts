import { randomBytes } from 'crypto';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';

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
 */
export class PluginInvocationTokens {
  private readonly live = new Map<string, { store: IRequestStore | undefined; tenantId: string | null; kind: string }>();

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

  revoke(token: string): void {
    this.live.delete(token);
  }

  /** Everything outstanding — dropped when the guest dies, so nothing survives a restart. */
  revokeAll(): void {
    this.live.clear();
  }

  get size(): number {
    return this.live.size;
  }
}
