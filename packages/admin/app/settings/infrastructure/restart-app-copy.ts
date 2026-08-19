import { ApplicationUrlUtils } from '@fromcode119/core/client';

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
        'Exits the API process; the container supervisor starts it again. Reloads plugin code, manifests and settings from disk. Requests in flight are dropped.',
        'The admin and the storefront both depend on the API, so both stop working until it is back.',
      );
    }
    if (app === ApplicationUrlUtils.ADMIN_APP) {
      return new RestartAppCopy(
        'Admin',
        'Exits the admin process; the container supervisor starts it again. Clears this app\'s server-side caches.',
        'This is the app you are using right now. This page will stop responding until the admin is back — reload it then.',
      );
    }
    if (app === ApplicationUrlUtils.FRONTEND_APP) {
      return new RestartAppCopy(
        'Frontend',
        'Exits the storefront process; the container supervisor starts it again. Clears its rendering caches and re-reads theme and plugin bundles.',
        'Visitors will get an error until the storefront is back.',
      );
    }
    return new RestartAppCopy(app, 'Exits the process; the container supervisor starts it again.', '');
  }
}
