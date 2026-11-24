import type http from 'http';
import type tls from 'tls';
import { EdgeControlPaths, EdgeRuleSnapshot, NetworkAddressUtils, RouteConstants } from '@fromcode119/core';
import type { TenantRouteMap } from '@fromcode119/core';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';
import { GatewayEdgeVerifier } from '@cli/services/gateway/control/gateway-edge-verifier';

/**
 * The control channel's four requests. Least privilege: an edge can spend a token, renew its own
 * certificate, read the rules that hold everywhere, and report what it refused — nothing else. Never a
 * site's certificate, never a setting, never another edge's anything.
 *
 * Only `trust` (the public root) and `enroll` are answered without a certificate, and `enroll` gives nothing for a wrong token but a 403.
 * Attempts are limited per address so a token cannot be guessed at speed (it is 256 random bits anyway).
 */
export class GatewayControlRequests {
  private static readonly BODY_LIMIT = 64 * 1024;
  private static readonly ENROLL_ATTEMPTS = 10;
  private static readonly ENROLL_WINDOW_MS = 10 * 60_000;
  private static readonly MAX_REPORTED = 10_000;
  private static readonly POLL_MS = 1_000;
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly api: GatewayControlApi,
    private readonly verifier: GatewayEdgeVerifier,
    private readonly map: () => TenantRouteMap | null,
    /** The platform's root (public, like any CA certificate); empty until the channel has its certificate. */
    private readonly trust: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    const socket = req.socket as tls.TLSSocket;
    const url = new URL(req.url || '/', 'https://control.invalid');
    const version = String(req.headers['user-agent'] ?? '').slice(0, 40);
    if (req.method === 'POST' && url.pathname === EdgeControlPaths.ENROLL) return this.enroll(req, res, socket, version);
    if (req.method === 'GET' && url.pathname === EdgeControlPaths.TRUST) return GatewayControlRequests.send(res, this.trust() ? 200 : 503, { trustPem: this.trust() });

    const edge = await this.verifier.edgeOf(socket, version);
    if (!edge) return GatewayControlRequests.send(res, 403, { error: 'refused' });
    if (req.method === 'POST' && url.pathname === EdgeControlPaths.RENEW) {
      const body = await GatewayControlRequests.body(req);
      const serial = String(socket.getPeerCertificate()?.serialNumber ?? '').toLowerCase();
      const answer = await this.api.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_RENEW, { serial, request: String(body?.request ?? ''), address: socket.remoteAddress ?? '', version });
      return GatewayControlRequests.send(res, answer.status === 200 ? 200 : 403, answer.status === 200 ? answer.body : { error: 'refused' });
    }
    if (req.method === 'GET' && url.pathname === EdgeControlPaths.RULES) return this.rules(req, res, url.searchParams.get('known') ?? '');
    if (req.method === 'POST' && url.pathname === EdgeControlPaths.REPORTS) return this.reports(req, res);
    GatewayControlRequests.send(res, 404, { error: 'not_found' });
  }

  private async enroll(req: http.IncomingMessage, res: http.ServerResponse, socket: tls.TLSSocket, version: string): Promise<void> {
    const address = NetworkAddressUtils.normalize(socket.remoteAddress ?? '');
    if (!this.attempt(address)) return GatewayControlRequests.send(res, 429, { error: 'too_many_attempts' });
    const body = await GatewayControlRequests.body(req);
    const answer = await this.api.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_ENROLL, { token: String(body?.token ?? ''), request: String(body?.request ?? ''), address, version });
    GatewayControlRequests.send(res, answer.status === 200 ? 200 : 403, answer.status === 200 ? answer.body : { error: 'refused' });
  }

  /**
   * The rules, at once when the edge's `known` version is not the current one; otherwise held up to
   * {@link EdgeControlPaths.RULES_WAIT_MS} for a change, then answered 204. A long poll: an edge hears of a
   * new stop within about a second, without asking every second.
   */
  private async rules(req: http.IncomingMessage, res: http.ServerResponse, known: string): Promise<void> {
    const until = this.now() + EdgeControlPaths.RULES_WAIT_MS;
    let gone = false;
    req.once('close', () => { gone = true; });
    for (;;) {
      const map = this.map();
      const snapshot = map ? EdgeRuleSnapshot.fromMap(map, this.now()) : null;
      if (snapshot && snapshot.version !== known) return GatewayControlRequests.send(res, 200, snapshot.toJSON());
      if (gone) return;
      if (this.now() >= until) { res.writeHead(204); res.end(); return; }
      await new Promise((resolve) => setTimeout(resolve, GatewayControlRequests.POLL_MS));
    }
  }

  /** `{ refused: { address: count } }` — what the edge refused at connect, counted toward Stopped addresses. */
  private async reports(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await GatewayControlRequests.body(req);
    const raw = body?.refused && typeof body.refused === 'object' ? Object.entries(body.refused as Record<string, unknown>) : [];
    const refused: Record<string, number> = {};
    for (const [address, count] of raw.slice(0, GatewayControlRequests.MAX_REPORTED)) {
      const value = Math.floor(Number(count));
      if (NetworkAddressUtils.isPublic(address) && value > 0) refused[NetworkAddressUtils.normalize(address)] = Math.min(value, 1_000_000);
    }
    if (Object.keys(refused).length) await this.api.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_STOPS, { refused });
    GatewayControlRequests.send(res, 200, { ok: true });
  }

  private attempt(address: string): boolean {
    const now = this.now();
    const recent = (this.attempts.get(address) ?? []).filter((at) => now - at < GatewayControlRequests.ENROLL_WINDOW_MS);
    if (recent.length >= GatewayControlRequests.ENROLL_ATTEMPTS) return false;
    recent.push(now);
    if (this.attempts.size > 10_000) this.attempts.clear();
    this.attempts.set(address, recent);
    return true;
  }

  private static body(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > GatewayControlRequests.BODY_LIMIT) { resolve(null); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { resolve(null); } });
      req.on('error', () => resolve(null));
    });
  }

  private static send(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }
}
