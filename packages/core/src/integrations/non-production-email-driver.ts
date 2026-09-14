import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';
import { TenantEnvironmentGate } from '@core/tenant/tenant-environment-gate';

/**
 * Wraps a site's real mail driver and refuses every send while the site is marked non-production.
 *
 * It WRAPS rather than replaces because the decision has to be taken per send, not when the driver is
 * resolved. Drivers are cached per tenant (`emailFor`), so choosing at construction would mean an
 * operator flipping Environment in the admin changed nothing until the cache happened to evict — a
 * control that appears to work and does not.
 *
 * The refusal throws, in the same spirit as {@link UnconfiguredTenantEmailDriver}: a send that reports
 * success and delivers nothing is the failure mode both of these exist to prevent. Here the stakes are
 * higher still, because the addresses in a migrated copy are real customers.
 */
export class NonProductionEmailDriver implements IEmailDriver {
  constructor(
    private readonly inner: IEmailDriver,
    private readonly gate: TenantEnvironmentGate,
  ) {}

  async send(options: IEmailOptions): Promise<unknown> {
    // `to` is what the operator needs to see in the refusal and the audit row — "who would this have
    // emailed" is the actual question when reviewing a test run.
    await this.gate.assert('email', NonProductionEmailDriver.recipient(options));
    return (this.inner as any).send(options);
  }

  private static recipient(options: IEmailOptions): string {
    const to = (options as any)?.to;
    if (Array.isArray(to)) return to.map((entry) => String(entry)).join(', ');
    return String(to ?? '(no recipient)');
  }
}
