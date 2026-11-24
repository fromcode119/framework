import { createHash, randomBytes, randomUUID } from 'crypto';
import { SystemConstants } from '@core/constants/system.constants';
import { EdgeX509 } from '@core/security/edge/identity/edge-x509';
import type { EdgeCertificateAuthority } from '@core/security/edge/identity/edge-certificate-authority';
import type { EdgeIdentityPolicy } from '@core/security/edge/identity/edge-identity-policy';
import type { IEdgeRecord } from '@core/security/edge/identity/interfaces/edge-record.interface';
import type { IEdgeIssued } from '@core/security/edge/identity/interfaces/edge-issued.interface';

/**
 * Adding, renewing and removing edges — SPIFFE/SPIRE's model, without a shared password anywhere:
 *
 * 1. An operator adds an edge: it gets an id and a ONE-TIME token, shown once, valid `tokenMinutes`.
 *    Only the token's hash is stored.
 * 2. The edge makes its own key, sends a certificate request with the token, and gets a certificate
 *    for `certificateHours`. The token is spent in the same statement that checks it, so two requests
 *    racing with one token get one certificate.
 * 3. From then on the edge proves itself with that certificate, and renews it — over the same mutual
 *    TLS — at half its life. Nothing it holds is reusable by anyone who copies it without its key.
 * 4. Removing an edge refuses every certificate it holds on the next connection (`verify`), and it can
 *    never renew; its last certificate would run out within `certificateHours` anyway.
 */
export class EdgeEnrollmentService {
  private static readonly EDGES = SystemConstants.TABLE.EDGES;
  private static readonly TOKENS = SystemConstants.TABLE.EDGE_ENROLLMENTS;
  private static readonly CERTIFICATES = SystemConstants.TABLE.EDGE_CERTIFICATES;
  private static readonly NAME_MAX = 80;

  constructor(
    private readonly db: any,
    private readonly authority: EdgeCertificateAuthority,
    private readonly policy: () => EdgeIdentityPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  /** A new edge and its one-time token. The token is returned here and nowhere else, ever. */
  async add(name: string, by: string): Promise<{ edge: IEdgeRecord; token: string; expiresAt: string }> {
    const label = String(name ?? '').trim().slice(0, EdgeEnrollmentService.NAME_MAX);
    if (!label) throw new Error('An edge needs a name.');
    const id = randomUUID();
    const now = new Date(this.now());
    await this.db.insert(EdgeEnrollmentService.EDGES, { id, name: label, created_at: now.toISOString(), created_by: by });
    const { token, expiresAt } = await this.newToken(id);
    return { edge: (await this.find(id))!, token, expiresAt };
  }

  /** A fresh token for an edge that was never enrolled or lost its key; any earlier unused one stops working. */
  async reissueToken(id: string): Promise<{ token: string; expiresAt: string } | null> {
    const edge = await this.find(id);
    if (!edge || edge.revokedAt) return null;
    await this.db.update(EdgeEnrollmentService.TOKENS, { edge_id: id, used_at: null }, { used_at: new Date(this.now()).toISOString() });
    return this.newToken(id);
  }

  /** Spends a token for a certificate. Null when the token is unknown, spent, expired, or the edge was removed. */
  async enroll(token: string, requestPem: string, seen: { address?: string; version?: string }): Promise<IEdgeIssued | null> {
    const publicKey = await EdgeX509.readRequest(requestPem);
    if (!publicKey) return null;
    const now = new Date(this.now()).toISOString();
    // One statement checks and spends: two requests racing with one token get one row back, not two.
    // Equality only — an `update` filter takes no operators on every dialect — so the expiry is read off
    // the row it spent. An expired token is spent all the same: it could never have been used again.
    const spent = await this.db.update(EdgeEnrollmentService.TOKENS, { token_hash: EdgeEnrollmentService.hash(token), used_at: null }, { used_at: now });
    const live = spent && new Date(spent.expires_at ?? spent.expiresAt).getTime() > this.now();
    const edgeId = live && spent.edge_id ? String(spent.edge_id) : '';
    const edge = edgeId ? await this.find(edgeId) : null;
    if (!edge || edge.revokedAt) return null;
    const issued = await this.issueFor(edge, publicKey, seen);
    await this.db.update(EdgeEnrollmentService.EDGES, { id: edge.id }, { enrolled_at: now });
    return issued;
  }

  /** A new certificate for an edge that has already proved itself with its current one. Null once removed. */
  async renew(edgeId: string, requestPem: string, seen: { address?: string; version?: string }): Promise<IEdgeIssued | null> {
    const edge = await this.find(edgeId);
    const publicKey = await EdgeX509.readRequest(requestPem);
    if (!edge || edge.revokedAt || !edge.enrolledAt || !publicKey) return null;
    return this.issueFor(edge, publicKey, seen);
  }

  /**
   * The edge a presented certificate belongs to, checked on EVERY connection: issued by us, not revoked,
   * not run out, and its edge not removed. This is the revocation check — live, not a list fetched later.
   */
  async verify(serial: string): Promise<IEdgeRecord | null> {
    const row = await this.db.findOne(EdgeEnrollmentService.CERTIFICATES, {
      serial: EdgeEnrollmentService.serialKey(serial),
      revoked_at: null,
      not_after: { gt: new Date(this.now()).toISOString() },
    });
    const edge = row?.edge_id ? await this.find(String(row.edge_id)) : null;
    return edge && !edge.revokedAt ? edge : null;
  }

  /** Records that an edge was in contact. */
  async seen(edgeId: string, seen: { address?: string; version?: string }): Promise<void> {
    await this.db.update(EdgeEnrollmentService.EDGES, { id: edgeId }, EdgeEnrollmentService.contact(this.now(), seen));
  }

  /** Removes an edge: its tokens and certificates stop working at once. False when there is no such edge in use. */
  async revoke(edgeId: string, by: string): Promise<boolean> {
    const edge = await this.find(edgeId);
    if (!edge || edge.revokedAt) return false;
    const now = new Date(this.now()).toISOString();
    await this.db.update(EdgeEnrollmentService.EDGES, { id: edgeId }, { revoked_at: now, revoked_by: by });
    await this.db.update(EdgeEnrollmentService.CERTIFICATES, { edge_id: edgeId, revoked_at: null }, { revoked_at: now });
    await this.db.update(EdgeEnrollmentService.TOKENS, { edge_id: edgeId, used_at: null }, { used_at: now });
    return true;
  }

  async list(): Promise<IEdgeRecord[]> {
    const rows = (await this.db.find(EdgeEnrollmentService.EDGES, { orderBy: { created_at: 'desc' } })) || [];
    return rows.map((row: any) => EdgeEnrollmentService.record(row));
  }

  async find(id: string): Promise<IEdgeRecord | null> {
    const row = await this.db.findOne(EdgeEnrollmentService.EDGES, { id: String(id) });
    return row ? EdgeEnrollmentService.record(row) : null;
  }

  /** The SPIFFE-style identity an edge's certificate carries. */
  uriOf(edgeId: string): string {
    return `spiffe://${this.policy().trustDomain}/edge/${edgeId}`;
  }

  private async issueFor(edge: IEdgeRecord, publicKey: Parameters<EdgeCertificateAuthority['issue']>[0], seen: { address?: string; version?: string }): Promise<IEdgeIssued> {
    const issued = await this.authority.issue(publicKey, `edge ${edge.id}`, { uri: this.uriOf(edge.id) }, { clientAuth: true });
    await this.db.insert(EdgeEnrollmentService.CERTIFICATES, { serial: EdgeEnrollmentService.serialKey(issued.serial), edge_id: edge.id, not_after: issued.notAfter.toISOString(), issued_at: new Date(this.now()).toISOString() });
    await this.db.update(EdgeEnrollmentService.EDGES, { id: edge.id }, {
      certificate_serial: issued.serial,
      certificate_not_after: issued.notAfter.toISOString(),
      ...EdgeEnrollmentService.contact(this.now(), seen),
    });
    return { edgeId: edge.id, certificatePem: issued.certificatePem, chainPem: issued.chainPem, trustPem: await this.authority.trustBundle(), notAfter: issued.notAfter.toISOString() };
  }

  private async newToken(edgeId: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now() + this.policy().tokenMinutes * 60_000).toISOString();
    await this.db.insert(EdgeEnrollmentService.TOKENS, { edge_id: edgeId, token_hash: EdgeEnrollmentService.hash(token), expires_at: expiresAt, created_at: new Date(this.now()).toISOString() });
    return { token, expiresAt };
  }

  private static contact(now: number, seen: { address?: string; version?: string }): Record<string, string> {
    return {
      last_seen_at: new Date(now).toISOString(),
      ...(seen.address ? { last_address: String(seen.address).slice(0, 64) } : {}),
      ...(seen.version ? { version: String(seen.version).slice(0, 40) } : {}),
    };
  }

  /** A serial as stored: lower-case hex without leading zeros, however the certificate reader printed it. */
  private static serialKey(serial: string): string {
    return String(serial ?? '').toLowerCase().replace(/^0+/, '');
  }

  private static hash(token: string): string {
    return createHash('sha256').update(String(token ?? '')).digest('hex');
  }

  private static record(row: any): IEdgeRecord {
    const iso = (value: unknown): string => (value ? new Date(value as string).toISOString() : '');
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      createdAt: iso(row.created_at),
      createdBy: String(row.created_by ?? ''),
      enrolledAt: iso(row.enrolled_at),
      revokedAt: iso(row.revoked_at),
      revokedBy: String(row.revoked_by ?? ''),
      lastSeenAt: iso(row.last_seen_at),
      lastAddress: String(row.last_address ?? ''),
      version: String(row.version ?? ''),
      certificateNotAfter: iso(row.certificate_not_after),
    };
  }
}
