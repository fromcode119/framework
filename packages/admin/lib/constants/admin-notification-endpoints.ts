// Deep imports, like admin.constants: core's `client` barrel must not reach the middleware graph.
import { RouteConstants } from '@fromcode119/core/constants/route.constants';
import { SystemConstants } from '@fromcode119/core/constants/system.constants';
import { AdminApiPaths } from '@/lib/constants/admin-api-paths';

/** The signed-in person's console notifications (the sidebar's menu) and their devices that accept push. */
export class AdminNotificationEndpoints {
  static readonly LIST = AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS);
  static readonly READ_ALL = AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS_READ_ALL);
  static readonly PUSH_KEY = AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.PUSH_KEY);
  static readonly PUSH_SUBSCRIPTIONS = AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.PUSH_SUBSCRIPTIONS);
  static readonly PUSH_SUBSCRIPTIONS_REMOVE = AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.PUSH_SUBSCRIPTIONS_REMOVE);

  static read(id: number): string {
    return AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS_ID_READ, { id });
  }
}
