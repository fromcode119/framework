import type { Request, Response } from 'express';
import { SystemRedirectService } from '@fromcode119/core';

/**
 * Admin CRUD over the framework's URL-redirect rules (`_system_redirects`, Settings → Redirects).
 * Payloads are camelCase at this edge; the service owns normalization (path shape, type whitelist,
 * from-path uniqueness) and throws plain Errors whose messages are safe to show the operator.
 */
export class SystemRedirectsController {
  constructor(private readonly service: SystemRedirectService) {}

  async list(_req: Request, res: Response): Promise<void> {
    res.json({ redirects: await this.service.list() });
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, redirect: await this.service.create(req.body || {}) });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const updated = await this.service.update(Number(req.params.id), req.body || {});
      if (!updated) {
        res.status(404).json({ success: false, error: 'Redirect not found.' });
        return;
      }
      res.json({ success: true, redirect: updated });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    const removed = await this.service.remove(Number(req.params.id));
    if (!removed) {
      res.status(404).json({ success: false, error: 'Redirect not found.' });
      return;
    }
    res.json({ success: true });
  }
}
