// Deep imports, like admin.constants: core's `client` barrel must not reach the middleware graph.
import { RouteConstants } from '@fromcode119/core/constants/route.constants';
import { SystemConstants } from '@fromcode119/core/constants/system.constants';
import { AdminApiPaths } from '@/lib/constants/admin-api-paths';

/** What a plugin asks to be approved for, and approving it: the platform's plugins, and a site's own. */
export class AdminPluginConsentEndpoints {
  static consent(slug: string): string {
    return AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_CONSENT, { slug });
  }

  static siteConsent(slug: string): string {
    return AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_MINE_SLUG_CONSENT, { slug });
  }

  static siteApprove(slug: string): string {
    return AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_MINE_SLUG_APPROVE, { slug });
  }
}
