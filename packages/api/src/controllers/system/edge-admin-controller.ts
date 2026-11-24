import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger } from '@fromcode119/core';
import { EdgeAdminService } from '@api/services/security/edge-admin-service';

/**
 * HTTP for Settings → Security → Edges. Every route sits behind `auth.guard(['admin'])` AND
 * `PlatformAdminGuard`: an edge serves every site, so only the platform decides one.
 */
export class EdgeAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'edge-admin' });

  constructor(private readonly service: EdgeAdminService) {
    super();
  }

  async list(_req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.service.overview());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async add(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const name = CoercionUtils.toString((req.body ?? {}).name).trim();
      if (!name) { res.status(400).json({ error: 'name_required' }); return; }
      const added = await this.service.add(name, (req as any).user || {});
      if (!added) { res.status(409).json({ error: 'control_not_configured' }); return; }
      res.status(201).json(added);
    } catch (error) {
      this.fail(res, error);
    }
  }

  async token(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const issued = await this.service.token(CoercionUtils.toString(req.params.id), (req as any).user || {});
      // 409: removed, unknown, or no control channel — the list the operator saw is stale.
      if (!issued) { res.status(409).json({ error: 'edge_not_available' }); return; }
      res.json(issued);
    } catch (error) {
      this.fail(res, error);
    }
  }

  async revoke(req: Request, res: Response): Promise<void> {
    try {
      if (!(await this.service.revoke(CoercionUtils.toString(req.params.id), (req as any).user || {}))) { res.status(409).json({ error: 'edge_not_active' }); return; }
      res.json({ ok: true });
    } catch (error) {
      this.fail(res, error);
    }
  }

  private fail(res: Response, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Edge operation failed.';
    this.logger.error(message, error);
    res.status(500).json({ error: message });
  }
}
