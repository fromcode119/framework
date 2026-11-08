import type { EmailCategoryRegistry } from '@core/email/email-category-registry';
import { EmailCategoryAudience } from '@core/email/enums/email-category-audience.enum';

/**
 * The alerts the FRAMEWORK sends to a site's administrators, declared as streams so each administrator
 * can switch off the ones they do not want in their own profile.
 *
 * Plugins declare their own the same way (`context.email.registerCategory`, audience `admin`); these are
 * only the ones no plugin owns. The label and description keys resolve in the admin console's own
 * dictionary (`notifications.alerts.*`).
 */
export class FrameworkAdminAlerts {
  /** The registry owner for everything declared here. */
  static readonly OWNER = 'core';

  /** A plugin failed to start, or came up unhealthy. */
  static readonly PLUGIN_HEALTH = 'admin-plugin-health';
  /** A plugin is waiting for approval, or was auto-approved for new capabilities. */
  static readonly PLUGIN_APPROVAL = 'admin-plugin-approval';
  /** A certificate is about to expire. Cannot be switched off: an expired one takes the site down. */
  static readonly CERTIFICATE_EXPIRY = 'admin-certificate-expiry';
  /** The platform's own uptime and health monitor. */
  static readonly MONITORING = 'admin-monitoring';

  static register(registry: EmailCategoryRegistry): void {
    const declare = (key: string, name: string, locked = false) => registry.register({
      key,
      labelKey: `notifications.alerts.${name}.label`,
      descriptionKey: `notifications.alerts.${name}.description`,
      pluginSlug: FrameworkAdminAlerts.OWNER,
      audience: EmailCategoryAudience.ADMIN,
      locked,
    });
    declare(FrameworkAdminAlerts.PLUGIN_HEALTH, 'pluginHealth');
    declare(FrameworkAdminAlerts.PLUGIN_APPROVAL, 'pluginApproval');
    declare(FrameworkAdminAlerts.CERTIFICATE_EXPIRY, 'certificateExpiry', true);
    declare(FrameworkAdminAlerts.MONITORING, 'monitoring');
  }
}
