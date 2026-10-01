import { Request, Response } from 'express';
import { BaseController, Logger, MonitoringIncidentStore, MonitoringProviderFactory, PlatformMonitorTask } from '@fromcode119/core';

/**
 * HTTP for the Health page. Platform admins only (the router): one monitor watches every site.
 *
 * `status` reports what the monitor last found and who it tells; `check` runs the monitor now instead of
 * waiting for its five-minute slot — the same pass, announcing what opened or resolved.
 */
export class MonitoringAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'monitoring-admin' });

  constructor(private readonly manager: any) {
    super();
  }

  async status(_req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.snapshot());
    } catch (error) {
      this.logger.error('Reading the monitoring state failed', error);
      res.status(500).json({ error: 'monitoring_status_unavailable' });
    }
  }

  async check(_req: Request, res: Response): Promise<void> {
    try {
      const { opened, resolved } = await PlatformMonitorTask.for(this.manager).run();
      res.json({ ...(await this.snapshot()), opened, resolved });
    } catch (error) {
      this.logger.error('Running the monitor failed', error);
      res.status(500).json({ error: 'monitoring_check_failed' });
    }
  }

  private async snapshot() {
    const providers = await new MonitoringProviderFactory(this.manager).active();
    return {
      incidents: await new MonitoringIncidentStore(this.manager.db).readOpen(),
      providers: providers.map(({ key }) => key),
      // Whether any active provider delivers the platform's own incidents. An outside watcher (UptimeRobot)
      // only watches addresses, so with it alone a plugin down or a full disk reaches nobody.
      alerting: providers.some(({ provider }) => Boolean(provider.notify)),
      targets: await PlatformMonitorTask.for(this.manager).targets(),
    };
  }
}
