import { RequestContextUtils } from '@core/context/request-context';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { NonProductionRefusal } from '@core/tenant/non-production-refusal';
import { Logger } from '@core/logging';
import { AuditOutcome } from '@core/security/enums/audit-outcome.enum';

/**
 * The brake: refuses any outward-facing effect from a site marked non-production.
 *
 * ONE class, called from the framework's own chokepoints — the email driver, `context.fetch` and the
 * scheduler. It is deliberately not something a plugin opts into: a plugin that has never heard of
 * this gate still cannot send, because the gate sits on the path its effect must travel, not in its
 * own code. A sandboxed plugin reaches the network only through `context.fetch`, so there is no way
 * around it from inside a guest.
 *
 * It resolves the tenant PER CALL rather than at cache time. The email driver in particular is cached
 * per tenant, and deciding at construction would mean flipping the switch in the admin did nothing
 * until the cache happened to evict — a control that appears to work and does not.
 */
export class TenantEnvironmentGate {

  private static readonly logger = new Logger({ namespace: 'tenant-environment' });

  constructor(private readonly db: any, private readonly audit?: { logAction: (...args: any[]) => Promise<unknown> }) {}

  /**
   * Allow the effect, or throw {@link NonProductionRefusal}.
   *
   * @param effect what is being attempted: `email`, `network` or `scheduler`
   * @param target what it would reach — a recipient, a URL, a task name; shown to the operator
   * @param pluginSlug whose effect it is, for the audit row; the framework's own sends pass `system`
   */
  async assert(effect: string, target: string, pluginSlug = 'system'): Promise<void> {
    if (await this.isProduction()) return;

    const record = await this.record();
    const slug = record?.slug || record?.id || 'unknown';

    // Recorded, not just refused: a test run is meant to be inspectable afterwards — "what would this
    // have sent?" is the question the operator actually has.
    //
    // DENIED, not a descriptive string. `AuditOutcome.resolve` falls back to ALLOWED for any value it
    // does not know, so an invented status like `blocked:non-production` was silently written as
    // `allowed` — a refused send recorded as a permitted one, which is worse than no row at all. The
    // reason goes in metadata, where it does not have to survive an enum.
    if (this.audit) {
      try {
        await this.audit.logAction(pluginSlug, effect, target, AuditOutcome.DENIED, { reason: 'non-production' });
      } catch (err: any) {
        TenantEnvironmentGate.logger.warn(`Could not audit a blocked ${effect} on "${slug}": ${err?.message || err}`);
      }
    }

    throw new NonProductionRefusal(effect, String(slug), target);
  }

  /**
   * Whether the current site may reach the outside world.
   *
   * NO TENANT MEANS ALLOW. Platform-level work — certificate mail, telemetry — runs with no tenant in
   * the request store, and a single-tenant deployment has none either. There is nothing to flag when
   * there is no site, and refusing here would mute the platform's own mail.
   *
   * A tenant id that resolves to NOTHING is the one genuinely ambiguous case, and it refuses: an id
   * we cannot read is not evidence that sending is safe.
   */
  async isProduction(): Promise<boolean> {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return true;

    const record = await this.record();
    if (!record) {
      TenantEnvironmentGate.logger.warn(`Tenant "${tenantId}" could not be resolved; treating it as non-production.`);
      return false;
    }
    return record.environment.isProduction;
  }

  private async record(): Promise<any | null> {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return null;
    return TenantResolverService.shared(this.db).resolveById(tenantId);
  }
}
