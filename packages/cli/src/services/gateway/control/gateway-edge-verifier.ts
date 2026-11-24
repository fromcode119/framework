import type tls from 'tls';
import { RouteConstants } from '@fromcode119/core';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';

/**
 * Which edge is on the other end of a connection, or null. Two checks, both required:
 *
 * 1. the TLS handshake proved the certificate chains to the platform's edge authority and the peer holds
 *    its key (`socket.authorized`);
 * 2. the api says that certificate is one it issued, not revoked, not run out, and its edge not removed —
 *    the revocation check, made live rather than from a list fetched earlier.
 *
 * A positive answer is kept {@link CACHE_MS}, so a removed edge is cut off within that; a refusal is
 * never kept, so an edge added a moment ago is not refused from a stale answer.
 */
export class GatewayEdgeVerifier {
  static readonly CACHE_MS = 10_000;
  private readonly known = new Map<string, { edge: { id: string; name: string }; at: number }>();

  constructor(private readonly api: GatewayControlApi, private readonly now: () => number = Date.now) {}

  async edgeOf(socket: tls.TLSSocket, version = ''): Promise<{ id: string; name: string } | null> {
    if (!socket.authorized) return null;
    const peer = socket.getPeerCertificate();
    const serial = String(peer?.serialNumber ?? '').toLowerCase();
    if (!serial) return null;
    const cached = this.known.get(serial);
    if (cached && this.now() - cached.at < GatewayEdgeVerifier.CACHE_MS) return cached.edge;
    const answer = await this.api.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_VERIFY, { serial, address: socket.remoteAddress ?? '', version });
    const edge = answer.status === 200 ? answer.body.edge : null;
    // The identity in the certificate must be the edge the api found for its serial.
    const uri = String(peer.subjectaltname ?? '').split(/,\s*/).find((name) => name.startsWith('URI:')) ?? '';
    if (!edge?.id || !uri.endsWith(`/edge/${edge.id}`)) { this.known.delete(serial); return null; }
    if (this.known.size > 1_000) this.known.clear();
    this.known.set(serial, { edge: { id: String(edge.id), name: String(edge.name ?? '') }, at: this.now() });
    return this.known.get(serial)!.edge;
  }
}
