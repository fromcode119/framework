import { AuditOutcome, EdgeIdentity, EdgeX509, SystemConstants } from '@fromcode119/core';
import type { IEdgeRecord } from '@fromcode119/core';

/**
 * Settings → Security → Edges: the edges added to the platform, adding one, a new token for one that has
 * not joined, and removing one. Each action is audited under the operator who took it.
 *
 * Adding returns the token ONCE, inside the command the operator runs on the edge's machine: the control
 * address, the token, and the SHA-256 of the platform's root, which the edge checks before it sends the
 * token anywhere. The token is not stored — only its hash — so it can never be shown again.
 */
export class EdgeAdminService {
  /** Where the printed command keeps the edge's key; the operator may change it in the command. */
  static readonly STATE_DIRECTORY = '/var/lib/fromcode-edge';

  constructor(private readonly manager: any, private readonly identity: EdgeIdentity, private readonly settings: Map<string, string>) {}

  /** The edges, the authority's dates, and whether the control channel is configured (and if not, why). */
  async overview(): Promise<{ edges: IEdgeRecord[]; control: { address: string; port: number } | null; controlProblem: string; authority: { rootNotAfter: string; workingNotAfter: string; workingSince: string } | null }> {
    const keys = SystemConstants.META_KEY;
    const control = this.identity.control();
    const typed = String(this.settings.get(keys.EDGE_CONTROL_ADDRESS) ?? '').trim() || String(this.settings.get(keys.EDGE_CONTROL_PORT) ?? '').trim();
    const edges = await this.identity.enrollment.list();
    // The authority exists once the first edge was added; describing it earlier would create it.
    const authority = edges.length ? await this.identity.authority.describe().catch(() => null) : null;
    return { edges, control: control ? control.toJSON() as { address: string; port: number } : null, controlProblem: control ? '' : typed ? 'invalid' : 'missing', authority };
  }

  /** A new edge and its one-time join command; null while the control channel is not configured. */
  async add(name: string, actor: { id?: unknown; email?: unknown }): Promise<{ edge: IEdgeRecord; command: string; expiresAt: string } | null> {
    const control = this.identity.control();
    if (!control) return null;
    const { edge, token, expiresAt } = await this.identity.enrollment.add(name, EdgeAdminService.who(actor));
    void this.manager.audit.logAction('system', 'edge.add', edge.id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email, name: edge.name });
    return { edge, command: await this.command(control.dial, token), expiresAt };
  }

  /** A new token for an edge that has not joined (or lost its key); the previous one stops working. */
  async token(id: string, actor: { id?: unknown; email?: unknown }): Promise<{ command: string; expiresAt: string } | null> {
    const control = this.identity.control();
    const issued = control ? await this.identity.enrollment.reissueToken(id) : null;
    if (!control || !issued) return null;
    void this.manager.audit.logAction('system', 'edge.token', id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    return { command: await this.command(control.dial, issued.token), expiresAt: issued.expiresAt };
  }

  async revoke(id: string, actor: { id?: unknown; email?: unknown }): Promise<boolean> {
    const done = await this.identity.enrollment.revoke(id, EdgeAdminService.who(actor));
    if (done) void this.manager.audit.logAction('system', 'edge.revoke', id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    return done;
  }

  private async command(dial: string, token: string): Promise<string> {
    const hash = EdgeX509.fingerprint(await this.identity.authority.trustBundle());
    return `fromcode system edge join --control ${dial} --token ${token} --root ${hash} --state ${EdgeAdminService.STATE_DIRECTORY}`;
  }

  private static who(actor: { id?: unknown; email?: unknown }): string {
    return String(actor.email ?? actor.id ?? '').slice(0, 120);
  }
}
