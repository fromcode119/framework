import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What each restart button actually does, spelled out for the operator.
 *
 * A restart is downtime, and each of the three apps loses something different — the api drops
 * in-flight requests, the admin drops the very page the button was clicked on, the frontend blanks
 * the public storefront. A generic "Restart" label would hide all of that, so each row states its own
 * consequence and every one of them names the mechanism: the process exits and the container
 * supervisor starts it again.
 */
export class RestartAppCopy {
  readonly title: string;

  readonly description: string;

  /** Extra sentence shown in the confirmation dialog only — the part worth pausing over. */
  readonly warning: string;

  private constructor(title: string, description: string, warning: string) {
    this.title = title;
    this.description = description;
    this.warning = warning;
  }

  static for(app: string): RestartAppCopy {
    if (app === ApplicationUrlUtils.API_APP) {
      return new RestartAppCopy(
        'API',
        AdminI18n.t('settings.infrastructure.restart.apiDescription'),
        AdminI18n.t('settings.infrastructure.restart.apiWarning'),
      );
    }
    if (app === ApplicationUrlUtils.ADMIN_APP) {
      return new RestartAppCopy(
        AdminI18n.t('settings.infrastructure.restart.adminTitle'),
        AdminI18n.t('settings.infrastructure.restart.adminDescription'),
        AdminI18n.t('settings.infrastructure.restart.adminWarning'),
      );
    }
    if (app === ApplicationUrlUtils.FRONTEND_APP) {
      return new RestartAppCopy(
        AdminI18n.t('settings.infrastructure.restart.frontendTitle'),
        AdminI18n.t('settings.infrastructure.restart.frontendDescription'),
        AdminI18n.t('settings.infrastructure.restart.frontendWarning'),
      );
    }
    return new RestartAppCopy(app, AdminI18n.t('settings.infrastructure.restart.otherDescription'), '');
  }
}
