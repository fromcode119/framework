import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The driver a site gets when it has configured NO mail of its own and has not opted into the
 * platform's.
 *
 * It refuses, loudly. The behaviour it replaces was to fall through to the platform's SMTP: the send
 * succeeded, so nothing anywhere reported a problem, while the customer's mail left on the platform's
 * server, signed by the platform's SPF and DKIM, spending the platform's sending reputation. A shared
 * mail server is a decision an operator makes deliberately, not a default nobody can see.
 *
 * Refusing is also the honest failure. The alternative silence — resolving to the `mock` driver when no
 * SMTP is configured anywhere — reports every send as delivered and drops it on the floor.
 */
export class UnconfiguredTenantEmailDriver implements IEmailDriver {
  constructor(private readonly tenantId: string) {}

  async send(_options: IEmailOptions): Promise<never> {
    throw new Error(
      `This site ("${this.tenantId}") has no mail configuration, so the message was not sent. `
      + 'Add an email integration for the site in Settings → Integrations, or, to send through the '
      + `platform's own mail server, set "${SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK}" to true `
      + 'for this site. It is off by default so that one site never borrows another\'s mail server unnoticed.',
    );
  }
}
