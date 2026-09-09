import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * One admin user's notification inbox and the per-user preferences that decide what reaches it.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, the shape the
 * other six system controllers already use. Composed by SystemController with the same runtime.
 */
export class SystemNotificationsController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /** Per-user UI preference (saved views etc.) — always scoped to the authenticated user. */
  async getPreference(req: Request, res: Response) {
    try {
      res.json(await this.runtime.preferences.get(Number((req as any).user?.id), String(req.params.key || '')));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async setPreference(req: Request, res: Response) {
    try {
      const result = await this.runtime.preferences.set(Number((req as any).user?.id), String(req.params.key || ''), (req.body as any)?.value);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /** In-app inbox: the authenticated user's notifications + unread count (bell UI). */
  async getNotifications(req: Request, res: Response) {
    try {
      res.json(await this.runtime.inbox.list(Number((req as any).user?.id)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async markNotificationRead(req: Request, res: Response) {
    try {
      res.json(await this.runtime.inbox.markRead(Number((req as any).user?.id), Number(req.params.id)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async markAllNotificationsRead(req: Request, res: Response) {
    try {
      res.json(await this.runtime.inbox.markAllRead(Number((req as any).user?.id)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
