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
    // No API URL, no identity to issue under: say so first, it is the one thing to fix before anything else.
    const controlProblem = !this.identityReady() ? 'api_url' : control ? '' : typed ? 'invalid' : 'missing';
    return { edges, control: control && !controlProblem ? control.toJSON() as { address: string; port: number } : null, controlProblem, authority };
  }

  /** A new edge and its one-time join command; null while the control channel is not configured. */
  async add(name: string, actor: { id?: unknown; email?: unknown }): Promise<{ edge: IEdgeRecord; command: string; expiresAt: string } | null> {
    const control = this.identity.control();
    if (!control || !this.identityReady()) return null;
    // The root first: whatever stops it (no encryption key) stops here, before an edge is recorded.
    const root = await this.rootHash();
    const { edge, token, expiresAt } = await this.identity.enrollment.add(name, EdgeAdminService.who(actor));
    void this.manager.audit.logAction('system', 'edge.add', edge.id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email, name: edge.name });
    return { edge, command: EdgeAdminService.command(control.dial, token, root), expiresAt };
  }

  /** A new token for an edge that has not joined (or lost its key); the previous one stops working. */
  async token(id: string, actor: { id?: unknown; email?: unknown }): Promise<{ command: string; expiresAt: string } | null> {
    const control = this.identity.control();
    if (!control || !this.identityReady()) return null;
    const root = await this.rootHash();
    const issued = await this.identity.enrollment.reissueToken(id);
    if (!issued) return null;
    void this.manager.audit.logAction('system', 'edge.token', id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    return { command: EdgeAdminService.command(control.dial, issued.token, root), expiresAt: issued.expiresAt };
  }

  async revoke(id: string, actor: { id?: unknown; email?: unknown }): Promise<boolean> {
    const done = await this.identity.enrollment.revoke(id, EdgeAdminService.who(actor));
    if (done) void this.manager.audit.logAction('system', 'edge.revoke', id, AuditOutcome.ALLOWED, { userId: actor.id, email: actor.email });
    return done;
  }

  /** Whether the platform has an API address to issue edge identities under (Settings → General → API URL). */
  private identityReady(): boolean {
    try { this.identity.policy(); return true; } catch { return false; }
  }

  private async rootHash(): Promise<string> {
    return EdgeX509.fingerprint(await this.identity.authority.trustBundle());
  }

  private static command(dial: string, token: string, root: string): string {
    return `fromcode system edge join --control ${dial} --token ${token} --root ${root} --state ${EdgeAdminService.STATE_DIRECTORY}`;
  }

  private static who(actor: { id?: unknown; email?: unknown }): string {
    return String(actor.email ?? actor.id ?? '').slice(0, 120);
  }
}
