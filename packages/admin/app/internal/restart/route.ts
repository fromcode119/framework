import { ApplicationUrlUtils, InternalServiceAuth, ProcessRestartService } from '@fromcode119/core/client';

/**
 * Exits the admin process so its supervisor restarts it — the admin half of the Settings →
 * Infrastructure restart buttons.
 *
 * Called by the api, never by a browser, and authenticated with the shared internal secret rather
 * than a session: the caller is a process, and the operator's authority was already checked by the
 * api. With `INTERNAL_SERVICE_SECRET` unset, {@link InternalServiceAuth.authorize} rejects
 * everything, so an unconfigured install serves a 403 here rather than an open restart endpoint.
 *
 * The path is declared once in core as `SystemConstants.INTERNAL_APP_PATH.RESTART`, so the api and
 * both Next apps cannot drift apart.
 */
export class InternalRestartRoute {
  static async POST(request: Request): Promise<Response> {
    if (!InternalServiceAuth.authorize(request.headers.get(InternalServiceAuth.HEADER))) {
      return Response.json({ app: ApplicationUrlUtils.ADMIN_APP, restarting: false, reason: 'Not authorized.' }, { status: 403 });
    }

    const exit = ProcessRestartService.scheduleExit('admin restart requested by the api');
    return Response.json({
      // Names itself so the caller can tell this really is the admin app answering, and not some
      // other host that happens to sit at the configured URL and return agreeable JSON.
      app: ApplicationUrlUtils.ADMIN_APP,
      restarting: exit.scheduled,
      exitInMs: exit.exitInMs,
      reason: exit.scheduled ? '' : 'Process exit is disabled while NODE_ENV=test.',
    });
  }
}
