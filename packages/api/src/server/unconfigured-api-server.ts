import express from 'express';
import {
  ApplicationUrlUtils,
  DatabaseConnectionFileService,
  InternalServiceAuth,
  Logger,
  RouteConstants,
  SetupDatabaseService,
  SetupMode,
  SystemConstants,
  TenantRouteMap,
} from '@fromcode119/core';

/**
 * The api a deployment serves when nobody has told it where its database is.
 *
 * It exists because the real server cannot: `PluginManager` opens a connection in its CONSTRUCTOR,
 * long before any route is registered, so a process with no connection string dies with a stack
 * trace and never listens on anything. A brand-new install therefore had nothing to talk to, which
 * is why the five database variables had to be hand-written into a file before the first boot.
 *
 * It answers exactly four things and 503s everything else. That is not defensive coding, it is the
 * honest shape of this process: with no database there are no users, no tenants, no settings and no
 * sessions, so any other endpoint could only lie. In particular it does NOT register plugins, does
 * not serve the admin api, and holds no privileged credential — the roles named in the file it
 * writes are created on the next boot by the entrypoint, running as root.
 *
 * It ends by killing itself. Committing the answer means `process.exit(0)`, and the container
 * manager starts the real server in its place; see {@link SetupPhase} for why the restart is the
 * commit rather than a bug.
 */
export class UnconfiguredApiServer {
  private readonly logger = new Logger({ namespace: 'setup' });
  private readonly app = express();

  constructor() {
    this.app.use(express.json());
    this.app.set('trust proxy', true);

    const prefix = `/api/${String(process.env.API_VERSION_PREFIX || 'v1')}`;
    this.app.get(`${prefix}${RouteConstants.SEGMENTS.HEALTH}`, (_req, res) => {
      res.json({ status: 'setup_required', phase: SetupMode.currentPhase().value });
    });
    this.app.get(RouteConstants.SEGMENTS.INTERNAL_ROUTING, (req, res) => this.routingMap(req, res));
    this.app.get(`${prefix}${RouteConstants.SEGMENTS.INTERNAL_ROUTING}`, (req, res) => this.routingMap(req, res));
    this.app.get(`${prefix}${SystemConstants.API_PATH.SETUP.STATUS}`, (req, res) => this.status(req, res));
    this.app.post(`${prefix}${SystemConstants.API_PATH.SETUP.DATABASE}`, (req, res) => { void this.configure(req, res); });

    // Everything else, including the admin's own api calls, says WHY rather than 404ing: an admin
    // page that gets "not found" looks broken, while this one can be shown as a setup screen.
    this.app.use((_req, res) => {
      res.status(503).json({ error: 'setup_required', phase: SetupMode.currentPhase().value });
    });
  }

  /**
   * The host → app map, built with no tenants because there cannot be any yet.
   *
   * The gateway needs this or it has nothing to route by, and a fresh install answers 404 at every
   * address it has. `SetupMode.isActive()` is what tells the map to send every host to the admin.
   */
  private routingMap(req: express.Request, res: express.Response): void {
    if (!InternalServiceAuth.isConfigured() || !InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) {
      res.status(401).json({ error: 'internal_secret_required' });
      return;
    }
    const map = TenantRouteMap.build([], {
      admin: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      api: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
      frontend: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
    }, SetupMode.isActive());
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...map.toJSON(), generatedAt: new Date().toISOString() });
  }

  /**
   * What the wizard renders its first screen from.
   *
   * Claiming happens HERE rather than on the POST, so a second browser arriving mid-install is told
   * before it fills anything in instead of after it presses the button.
   */
  private status(req: express.Request, res: express.Response): void {
    const claimant = UnconfiguredApiServer.claimantOf(req);
    const claimed = SetupMode.claim(claimant);

    res.json({
      initialized: false,
      phase: SetupMode.currentPhase().value,
      isActive: SetupMode.isActive(),
      unavailableReason: SetupMode.unavailableReason(),
      isClaimedByOther: !claimed && SetupMode.isClaimedByOther(claimant),
      options: SetupDatabaseService.options(),
    });
  }

  /**
   * Write the connection and stop, so the container manager starts a process that can use it.
   *
   * The response is flushed BEFORE the exit: the browser needs to know this succeeded, because for
   * the next twenty seconds there is nothing listening to ask.
   */
  private async configure(req: express.Request, res: express.Response): Promise<void> {
    const claimant = UnconfiguredApiServer.claimantOf(req);

    if (!SetupMode.isActive()) {
      res.status(409).json({ error: 'setup_closed', reason: SetupMode.unavailableReason() });
      return;
    }
    if (!SetupMode.claim(claimant)) {
      res.status(409).json({ error: 'setup_claimed_by_other' });
      return;
    }
    if (DatabaseConnectionFileService.isConfigured()) {
      res.status(409).json({ error: 'already_configured' });
      return;
    }

    try {
      const { file, driver } = SetupDatabaseService.apply({ driver: req.body?.driver });
      this.logger.info(`Configured the "${driver.value}" driver into ${file}. Restarting to connect.`);
      res.json({ driver: driver.value, file, restarting: true });
    } catch (error: any) {
      // The message names the driver and what was wrong with it; there is no second wording here.
      res.status(400).json({ error: 'setup_database_failed', message: String(error?.message || error) });
      return;
    }

    // Only once the browser has the answer. The exit is the commit: the next process reads the file
    // this one just wrote, the entrypoint creates the roles it names, and the real server boots.
    res.on('finish', () => {
      this.logger.info('Database configured — exiting so the deployment restarts into the real server.');
      process.exit(0);
    });
  }

  /**
   * Who is asking, for the first-claimant lock only.
   *
   * Never parsed, never trusted as a fact about the network, and only ever compared with itself —
   * the socket address is enough to tell "the same browser" from "a different one".
   */
  private static claimantOf(req: express.Request): string {
    return String(req.ip || req.socket?.remoteAddress || 'unknown');
  }

  listen(port: number, host: string): void {
    this.app.listen(port, host, () => {
      this.logger.info(
        `No database configured. Serving the first-run wizard on http://${host}:${port} — open this `
        + 'deployment in a browser to choose one. Setup closes 15 minutes after start.',
      );
    });
  }
}
