// Deep imports, not core's `client` barrel — reachable from the middleware graph (see admin.constants.ts).
import { ApiPathUtils } from '@fromcode119/core/api/api-path-utils';
import { SystemConstants } from '@fromcode119/core/constants/system.constants';
import { AdminApiPaths } from '@/lib/constants/admin-api-paths';

/** The console's sign-in, account and site-selection endpoints (`AdminConstants.ENDPOINTS.AUTH`). */
export class AdminAuthEndpoints {
  static readonly ALL = {
      LOGIN: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.LOGIN),
      LOGOUT: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.LOGOUT),
      STATUS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.STATUS),
      HOST_INFO: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.HOST_INFO),
      TENANTS_AVAILABLE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_AVAILABLE),
      TENANTS_SELECT: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_SELECT),
      TENANTS_LEAVE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_LEAVE),
      SETUP: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SETUP),
      REGISTER: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.REGISTER),
      VERIFY_EMAIL: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL),
      RESEND_VERIFICATION: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION),
      FORGOT_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD),
      RESET_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.RESET_PASSWORD),
      ADMIN_SEND_PASSWORD_RESET: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.ADMIN_SEND_PASSWORD_RESET),
      VERIFY_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.VERIFY_PASSWORD),
      CHANGE_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD),
      SECURITY: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SECURITY),
      ME_PERSON: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.ME_PERSON),
      /** The signed-in account's own name — no user-management permission needed. */
      PROFILE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.PROFILE),
      TWO_FACTOR_STATUS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TWO_FACTOR_STATUS),
      TWO_FACTOR_SETUP: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TWO_FACTOR_SETUP),
      TWO_FACTOR_VERIFY: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TWO_FACTOR_VERIFY),
      TWO_FACTOR_RECOVERY_REGENERATE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TWO_FACTOR_RECOVERY_REGENERATE),
      TWO_FACTOR_DISABLE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TWO_FACTOR_DISABLE),
      EMAIL_CHANGE_REQUEST: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST),
      EMAIL_CHANGE_CONFIRM: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM),
      SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SESSIONS),
      MY_SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.MY_SESSIONS),
      REVOKE_MY_SESSION: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.REVOKE_SESSION, { id })),
      REVOKE_OTHER_SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS),
      API_TOKENS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.API_TOKENS),
      API_TOKEN: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.API_TOKEN, { id })),
      SSO_PROVIDERS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SSO_PROVIDERS),
      SSO_LOGIN: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SSO_LOGIN),
  } as const;
}
