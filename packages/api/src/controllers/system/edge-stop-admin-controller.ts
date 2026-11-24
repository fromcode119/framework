import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger } from '@fromcode119/core';
import { EdgeStopAdminService } from '@api/services/security/edge-stop-admin-service';

/**
 * HTTP for Settings → Security → Stopped addresses. Every route sits behind `auth.guard(['admin'])`
 * AND `PlatformAdminGuard`: a stop covers every site on the platform, so only the platform decides it.
 */
export class EdgeStopAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'edge-stop-admin' });

  constructor(private readonly service: EdgeStopAdminService) {
    super();
  }

  async list(_req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ stops: await this.service.list() });
    } catch (error) {
      this.fail(res, error);
    }
  }

  async release(req: Request, res: Response): Promise<void> {
    await this.act(req, res, (id, actor) => this.service.release(id, actor));
  }

  async block(req: Request, res: Response): Promise<void> {
    await this.act(req, res, (id, actor) => this.service.block(id, actor));
  }

  private async act(req: Request, res: Response, action: (id: number, actor: { id?: unknown; email?: unknown }) => Promise<boolean>): Promise<void> {
    try {
      const id = Math.floor(CoercionUtils.toNumber(req.params.id, 0));
      if (!(id > 0)) {
        res.status(400).json({ error: 'invalid_id' });
        return;
      }
      // 409: the stop has already ended, been released or been blocked — the list the operator saw is stale.
      if (!(await action(id, (req as any).user || {}))) {
        res.status(409).json({ error: 'stop_not_active' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      this.fail(res, error);
    }
  }

  private fail(res: Response, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Stopped address operation failed.';
    this.logger.error(message, error);
    res.status(500).json({ error: message });
  }
}
