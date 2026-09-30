import { Request, Response } from 'express';
import { BaseController, GeoDatabaseUpdater, Logger } from '@fromcode119/core';

/**
 * HTTP for the IP-location card in Settings → Infrastructure. Platform admins only (the router).
 *
 * The switch itself is the ordinary `geo_ip_lookup` platform setting; these two routes report the
 * database's real state and bring it in line with the switch on demand, so the card never shows
 * "on" for a database that is not there.
 */
export class GeoAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'geo-admin' });

  constructor(private readonly updater: GeoDatabaseUpdater) {
    super();
  }

  async status(_req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.updater.status());
    } catch (error) {
      this.logger.error('Reading the IP-location database state failed', error);
      res.status(500).json({ error: 'geo_status_unavailable' });
    }
  }

  async update(_req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.updater.apply());
    } catch (error) {
      this.logger.error('Updating the IP-location database failed', error);
      res.status(500).json({ error: 'geo_update_failed' });
    }
  }
}
