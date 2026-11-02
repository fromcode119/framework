import type { Request, Response } from 'express';
import { UsageReportService } from '@fromcode119/core';

/**
 * Settings → General → Usage report: the exact report this installation would send, where it would go
 * and how the last one went; and "Send now". Platform routes — the report describes the whole box.
 */
export class SystemUsageReportController {
  constructor(private readonly manager: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  private get service(): UsageReportService {
    return new UsageReportService(this.manager);
  }

  async show(_req: Request, res: Response): Promise<void> {
    try {
      const service = this.service;
      const [enabled, target, report, status] = await Promise.all([service.enabled(), service.target(), service.build(), service.status()]);
      res.json({ enabled, target, report, status });
    } catch (error) {
      res.status(500).json({ error: String((error as Error)?.message || error) });
    }
  }

  async send(_req: Request, res: Response): Promise<void> {
    try {
      const status = await this.service.send();
      res.status(status.ok ? 200 : 502).json({ status });
    } catch (error) {
      res.status(500).json({ error: String((error as Error)?.message || error) });
    }
  }
}
