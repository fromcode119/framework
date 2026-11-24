import express from 'express';
import { AuditOutcome, CoercionUtils, EdgeIdentity, InternalServiceAuth, Logger, RouteConstants } from '@fromcode119/core';
import type { IEdgeIssued } from '@fromcode119/core';

/**
 * What the gateway forwards from its control channel, and its own certificate for it. Secret-only: an
 * edge never reaches the api, only the gateway does, after the edge's TLS connection has been checked.
 *
 * - `enroll` `{ token, request, address, version }` — an edge being added spends its one-time token.
 * - `renew` `{ serial, request, address, version }` — an edge renews with the certificate it holds.
 * - `verify` `{ serial, address, version }` — whose certificate this is, checked on every connection.
 * - `control-certificate` `{ request }` — the gateway's certificate for the control listener.
 *
 * Every refusal is the same 403 with no reason: an edge learns nothing from a wrong token or a removed
 * certificate except that it was refused. The reason is logged and audited here.
 */
export class EdgeIdentityInternalRouter {
  readonly router = express.Router();
  private readonly logger = new Logger({ namespace: 'edge-identity' });

  constructor(private readonly manager: any, private readonly identity: EdgeIdentity) {
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_ENROLL, (req, res) => { void this.enroll(req, res); });
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_RENEW, (req, res) => { void this.renew(req, res); });
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_VERIFY, (req, res) => { void this.verify(req, res); });
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_CONTROL_CERTIFICATE, (req, res) => { void this.controlCertificate(req, res); });
  }

  private async enroll(req: express.Request, res: express.Response): Promise<void> {
    await this.answer(req, res, 'edge.enroll', async (body, seen) => this.identity.enrollment.enroll(CoercionUtils.toString(body.token), CoercionUtils.toString(body.request), seen));
  }

  private async renew(req: express.Request, res: express.Response): Promise<void> {
    await this.answer(req, res, 'edge.renew', async (body, seen) => {
      const edge = await this.identity.enrollment.verify(CoercionUtils.toString(body.serial));
      return edge ? this.identity.enrollment.renew(edge.id, CoercionUtils.toString(body.request), seen) : null;
    });
  }

  private async verify(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const edge = await this.identity.enrollment.verify(CoercionUtils.toString(body.serial)).catch(() => null);
    if (!edge) { res.status(403).json({ error: 'refused' }); return; }
    await this.identity.enrollment.seen(edge.id, EdgeIdentityInternalRouter.seen(body)).catch(() => undefined);
    res.json({ edge: { id: edge.id, name: edge.name } });
  }

  private async controlCertificate(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    try {
      const issued = await this.identity.controlCertificate(CoercionUtils.toString((req.body ?? {}).request));
      if (!issued) { res.status(409).json({ error: 'control_not_configured' }); return; }
      res.json(issued);
    } catch (error: any) {
      this.logger.error(`Could not issue the control channel's certificate: ${error?.message || error}`);
      res.status(500).json({ error: 'not_issued' });
    }
  }

  /** Runs an issuing action, audits who got what, and answers the certificate or the one refusal. */
  private async answer(req: express.Request, res: express.Response, action: string, issue: (body: Record<string, unknown>, seen: { address?: string; version?: string }) => Promise<IEdgeIssued | null>): Promise<void> {
    if (!this.authorized(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const seen = EdgeIdentityInternalRouter.seen(body);
    try {
      const issued = await issue(body, seen);
      if (!issued) {
        this.logger.warn(`Refused ${action} from ${seen.address || 'an unknown address'}.`);
        void this.manager.audit.logAction('system', action, seen.address || '', AuditOutcome.DENIED, { address: seen.address ?? null });
        res.status(403).json({ error: 'refused' });
        return;
      }
      void this.manager.audit.logAction('system', action, issued.edgeId, AuditOutcome.ALLOWED, { edgeId: issued.edgeId, address: seen.address ?? null, version: seen.version ?? null, notAfter: issued.notAfter });
      res.json(issued);
    } catch (error: any) {
      this.logger.error(`Could not complete ${action}: ${error?.message || error}`);
      res.status(500).json({ error: 'not_issued' });
    }
  }

  private authorized(req: express.Request, res: express.Response): boolean {
    res.setHeader('Cache-Control', 'no-store');
    if (InternalServiceAuth.isConfigured() && InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) return true;
    res.status(401).json({ error: 'internal_secret_required' });
    return false;
  }

  private static seen(body: Record<string, unknown>): { address?: string; version?: string } {
    const address = CoercionUtils.toString(body.address).slice(0, 64);
    const version = CoercionUtils.toString(body.version).slice(0, 40);
    return { ...(address ? { address } : {}), ...(version ? { version } : {}) };
  }
}
