/**
 * How a Fromcode app restarts itself: it exits cleanly and the supervisor starts it again.
 *
 * Every service in `docker-compose.yml` declares `restart: unless-stopped`, so a zero exit is a
 * restart — there is no in-process "reload" to perform and nothing to shell into. The delay exists so
 * the HTTP response reaches the caller before the process goes away; without it the operator sees a
 * network error for a restart that actually worked.
 *
 * One implementation, used by the api's own restart and by the admin/frontend exit endpoints, so all
 * three behave identically instead of each app hand-rolling a `process.exit`.
 */
export class ProcessRestartService {
  /** Long enough for the response to flush, short enough that the operator sees the app cycle. */
  static readonly EXIT_DELAY_MS = 500;

  /**
   * Schedule the exit and report what was scheduled. `scheduled` is false under `NODE_ENV=test`,
   * where killing the process would take the test runner with it — the caller must surface that
   * rather than claim a restart happened.
   */
  static scheduleExit(reason: string, logger?: { warn(message: string): void }): { scheduled: boolean; exitInMs: number } {
    const message = `Restart requested (${reason}) — exiting in ${ProcessRestartService.EXIT_DELAY_MS}ms so the supervisor restarts this app.`;
    if (logger) logger.warn(message); else console.warn(`[fromcode] ${message}`);

    if (process.env.NODE_ENV === 'test') return { scheduled: false, exitInMs: 0 };

    const timer = setTimeout(() => process.exit(0), ProcessRestartService.EXIT_DELAY_MS);
    timer.unref?.();
    return { scheduled: true, exitInMs: ProcessRestartService.EXIT_DELAY_MS };
  }
}
