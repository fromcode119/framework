import { RouteConstants } from '@fromcode119/core';

export class WebhookRouteUtils {
  static readonly BASE_PATH = RouteConstants.SEGMENTS.WEBHOOKS;

  static isWebhookPath(pathname: string): boolean {
    const path = String(pathname || '');
    if (!path) {
      return false;
    }

    return path === WebhookRouteUtils.BASE_PATH || path.startsWith(`${WebhookRouteUtils.BASE_PATH}/`);
  }
}
