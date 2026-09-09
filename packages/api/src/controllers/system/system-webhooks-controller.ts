import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * Outbound webhook administration: listing endpoints, firing a test, and replaying one delivery.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, the shape the
 * other six system controllers already use. Composed by SystemController with the same runtime.
 */
export class SystemWebhooksController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /** Webhooks + their recent deliveries (Workbench-style delivery log). */
  async getWebhooks(_req: Request, res: Response) {
    try {
      const webhooks = await this.runtime.db.find('_system_webhooks', { limit: 200 }).catch(() => []);
      const deliveries = await this.runtime.manager.webhooks.listDeliveries(undefined, 60);
      res.json({
        webhooks: (Array.isArray(webhooks) ? webhooks : []).map((w: any) => ({
          id: w.id, name: w.name, url: w.url, method: w.method, active: Boolean(w.active),
          events: w.events, lastStatus: w.lastStatus, lastTriggeredAt: w.lastTriggeredAt,
        })),
        deliveries,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async testWebhook(req: Request, res: Response) {
    try {
      const result = await this.runtime.manager.webhooks.testWebhook(Number(req.params.id));
      res.status(result.success ? 200 : 404).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async resendWebhookDelivery(req: Request, res: Response) {
    try {
      const result = await this.runtime.manager.webhooks.resendDelivery(Number(req.params.id));
      res.status(result.success ? 200 : 404).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
