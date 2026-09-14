import express from 'express';
import { SetupMode, SetupPhase, SystemConstants } from '@fromcode119/core';

/**
 * `GET /setup/status` on a deployment that HAS a database — the other half of the first-run wizard.
 *
 * `UnconfiguredApiServer` answers the same path while the platform is still being asked where its
 * database is. This one answers it afterwards, and the difference between the two replies is the
 * whole mechanism: the wizard commits the database, the api exits, the container manager starts it
 * again, and the browser polls this path until the phase stops saying `database`.
 *
 * Without it that poll would never end. The unconfigured process is gone by then, so a missing route
 * here reads as "still restarting" — the page would sit on a spinner for its full timeout and then
 * tell the operator to reload a platform that had been up the whole time.
 *
 * Unauthenticated, like the setup flow it belongs to, and it says nothing a caller could not already
 * learn: whether this installation still has no administrator. It carries no `options`, because a
 * deployment past the database phase has nothing left to choose.
 */
export class SetupStatusRouter {
  readonly router = express.Router();

  constructor() {
    this.router.get(SystemConstants.API_PATH.SETUP.STATUS, (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        phase: SetupPhase.PLATFORM.value,
        isActive: SetupMode.isActive(),
        unavailableReason: SetupMode.unavailableReason(),
      });
    });
  }
}
