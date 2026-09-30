import { CoercionUtils, Logger, ProcessRestartService, TenantMode } from '@fromcode119/core';

/**
 * Restarts the api after the FIRST site comes into being, so the site takes effect without anyone
 * having to find a restart button.
 *
 * Whether this deployment runs sites is decided at boot (`TenantMode`): row-level security, the
 * least-privilege connection check and request-to-site binding are all set up then, and none of them
 * can be switched on under requests already in flight. Before this, creating the first site answered
 * "created" and changed nothing the operator could see — Media and People kept saying there was no
 * site — until the api happened to restart. Adoption at least said "restart required"; creating and
 * importing said nothing.
 *
 * The restart is the same clean exit the Restart Services buttons use. The answer reports it, so the
 * admin can wait for the api to come back before moving on.
 */
export class FirstSiteRestart {
  private readonly logger = new Logger({ namespace: 'first-site' });

  constructor(
    private readonly countSites: () => Promise<number>,
    private readonly scheduleExit: typeof ProcessRestartService.scheduleExit = (reason, logger) => ProcessRestartService.scheduleExit(reason, logger),
  ) {}

  /** `null` when sites were already on, or there is still no site; otherwise the scheduled exit. */
  async afterSiteAdded(actor: Record<string, unknown>): Promise<{ restarting: boolean; exitInMs: number } | null> {
    if (TenantMode.isEnabled()) return null;
    if ((await this.countSites()) === 0) return null;
    const who = CoercionUtils.toString(actor.email ?? actor.userId ?? actor.id) || 'an operator';
    const exit = this.scheduleExit(`first site added by ${who}; sites take effect at boot`, this.logger);
    return { restarting: exit.scheduled, exitInMs: exit.exitInMs };
  }
}
