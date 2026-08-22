import { FrameworkEmailSender } from '@core/email/framework-email-sender';

/**
 * Resolves the sender for framework-owned email (auth, 2FA, telemetry) from configuration only.
 *
 * ONE resolver, because there were three: the auth infrastructure, the 2FA service and the plugin
 * telemetry service each built their own, each with the same invented `no-reply@<domain>` and the
 * same dead `EMAIL_FROM` branch underneath it.
 *
 * The order is strict and there is no final fallback:
 *
 * 1. the **From Address** configured on the Email Delivery integration — the same screen that holds
 *    the SMTP host and credentials, which is where an operator looks for it;
 * 2. `EMAIL_FROM` / `SMTP_FROM` from the environment, for deployments that configure mail entirely
 *    through env;
 * 3. nothing.
 *
 * Nothing means nothing: no `no-reply@` built from the site domain, no `no-reply@localhost`. A
 * message the platform cannot honestly address is not sent, and the caller says so in the log with
 * the name of the setting to fill in. An invented sender is worse than a missing one — it is
 * undeliverable, unattributable, and it quietly claims a domain the operator never nominated for
 * mail (see {@link FrameworkEmailSender}).
 */
export class FrameworkEmailSenderService {
  /** What an operator should be told to fill in when no sender is configured. */
  static readonly SETTING_HINT =
    'Settings → Integrations → Email Delivery → From Address (or the EMAIL_FROM environment variable)';

  /**
   * @param integrations the plugin manager's integration manager, or null when unavailable.
   * @param appName platform/site name, used as the display name when the integration sets none.
   */
  static async resolve(
    integrations: { getConfig(type: string): Promise<any> } | null,
    appName = '',
  ): Promise<FrameworkEmailSender> {
    const configured = await FrameworkEmailSenderService.readIntegrationSender(integrations);
    if (configured.address) {
      return new FrameworkEmailSender(configured.address, configured.name || appName);
    }

    const envAddress = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
    const envName = String(process.env.EMAIL_FROM_NAME || '').trim();
    if (envAddress) {
      return new FrameworkEmailSender(envAddress, envName || appName);
    }

    return new FrameworkEmailSender('', appName);
  }

  /**
   * The active Email Delivery config. Reading it must never break sending: a deployment with no
   * integration row, or one whose provider is the mock driver, simply has no configured sender and
   * falls through to the environment.
   */
  private static async readIntegrationSender(
    integrations: { getConfig(type: string): Promise<any> } | null,
  ): Promise<{ address: string; name: string }> {
    if (!integrations) return { address: '', name: '' };

    try {
      const config = await integrations.getConfig('email');
      // STORED first: it holds exactly what the operator typed. The `active` config is the
      // provider's resolved transport options — for SMTP that is `normalizeSmtpConfig`, which
      // deliberately emits only host/port/secure/auth, so the sender fields are not in it.
      const stored = config?.stored?.config || {};
      const active = config?.active?.config || {};
      return {
        address: String(stored.fromAddress || active.fromAddress || '').trim(),
        name: String(stored.fromName || active.fromName || '').trim(),
      };
    } catch {
      return { address: '', name: '' };
    }
  }
}
