import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The driver a site gets when it opted into the platform's mail server (`email_platform_fallback`)
 * but the platform has no real one: its own email integration resolved to the `mock` driver.
 *
 * Handing the site that mock was the silent failure `UnconfiguredTenantEmailDriver` exists to prevent:
 * every send reported as delivered, logged, and dropped. Measured on production 2026-09-26: a site's
 * demo-request notification came back `delivered: true` while the only trace of it was the mock's log
 * line. Refusing makes the failure visible to the form, the operator and the log.
 */
export class PlatformMailUnavailableEmailDriver implements IEmailDriver {
  constructor(private readonly tenantId: string) {}

  /** The platform's own provider is the mock when nothing resolved, or every resolved provider is `mock`. */
  static isMock(resolved: unknown): boolean {
    if (resolved === null || resolved === undefined) return true;
    const entries = Array.isArray(resolved) ? resolved : [resolved];
    return entries.length > 0 && entries.every((entry) => String((entry as { providerKey?: unknown })?.providerKey) === 'mock');
  }

  async send(_options: IEmailOptions): Promise<never> {
    throw new Error(
      `This site ("${this.tenantId}") sends through the platform's mail server (\`${SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK}\`), `
      + 'but the platform has no mail server configured — its email integration is the mock driver, which only logs. '
      + 'The message was not sent. Add an email integration for this site in Settings → Integrations → Email, '
      + 'or configure the platform\'s own mail server in Platform → Settings → Integrations → Email.',
    );
  }
}
