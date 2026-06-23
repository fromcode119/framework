import { BaseRouter } from '../routers/base-router';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { AuthController } from '../controllers/auth';
import { RouteConstants } from '@fromcode119/core';

/**
 * Authentication router (class-based implementation).
 * 
 * Handles all authentication-related endpoints:
 * - Login/logout
 * - Registration and email verification
 * - Password reset
 * - SSO provider integration
 * - Session management
 * - API token management
 * 
 * @example
 * ```typescript
 * const authRouter = new AuthRouter(pluginManager, authManager);
 * app.use('/auth', authRouter.router);
 * ```
 */
export class AuthRouter extends BaseRouter {
  private controller: AuthController;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new AuthController(manager, auth);
  }

  protected registerRoutes(): void {
    // Public authentication endpoints
    this.get(RouteConstants.SEGMENTS.STATUS, this.controller.getStatus);
    this.post(RouteConstants.SEGMENTS.SETUP, this.controller.setup);
    this.post(RouteConstants.SEGMENTS.REGISTER, this.controller.register);
    this.post(RouteConstants.SEGMENTS.VERIFY_EMAIL, this.controller.verifyEmail);
    this.post(RouteConstants.SEGMENTS.RESEND_VERIFICATION, this.controller.resendVerification);
    this.post(RouteConstants.SEGMENTS.FORGOT_PASSWORD, this.controller.forgotPassword);
    this.post(RouteConstants.SEGMENTS.RESET_PASSWORD, this.controller.resetPassword);
    
    // SSO endpoints
    this.get(RouteConstants.SEGMENTS.SSO_PROVIDERS, this.controller.getSsoProviders);
    this.post(RouteConstants.SEGMENTS.SSO_LOGIN, this.controller.ssoLogin);
    
    // Login/logout
    this.post(RouteConstants.SEGMENTS.LOGIN, this.controller.login);
    this.post(RouteConstants.SEGMENTS.LOGOUT, this.controller.logout);

    // User security (requires authentication)
    this.get(RouteConstants.SEGMENTS.SECURITY, this.auth.guard(), this.controller.getMySecurityState);
    this.patch(RouteConstants.SEGMENTS.PROFILE, this.auth.guard(), this.controller.updateMyProfile);
    this.get(RouteConstants.SEGMENTS.ME_PERSON, this.auth.guard(), this.controller.getMyPerson);
    this.patch(RouteConstants.SEGMENTS.ME_PERSON, this.auth.guard(), this.controller.updateMyPerson);
    this.post(RouteConstants.SEGMENTS.VERIFY_PASSWORD, this.auth.guard(), this.controller.verifyPassword);
    this.post(RouteConstants.SEGMENTS.CHANGE_PASSWORD, this.auth.guard(), this.controller.changePassword);
    this.post(RouteConstants.SEGMENTS.EMAIL_CHANGE_REQUEST, this.auth.guard(), this.controller.requestEmailChange);
    this.post(RouteConstants.SEGMENTS.EMAIL_CHANGE_CONFIRM, this.controller.confirmEmailChange);
    this.get(RouteConstants.SEGMENTS.TWO_FACTOR_STATUS, this.auth.guard(), this.controller.getMyTwoFactorStatus);
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_SETUP, this.auth.guard(), this.controller.setupMyTwoFactor);
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_VERIFY, this.auth.guard(), this.controller.verifyMyTwoFactor);
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_RECOVERY, this.auth.guard(), this.controller.regenerateMyRecoveryCodes);
    this.delete(RouteConstants.SEGMENTS.TWO_FACTOR_DISABLE, this.auth.guard(), this.controller.disableMyTwoFactor);

    // Session management (user)
    this.get(RouteConstants.SEGMENTS.SESSIONS_ME, this.auth.guard(), this.controller.getMySessions);
    this.post(RouteConstants.SEGMENTS.SESSIONS_ID_REVOKE, this.auth.guard(), this.controller.revokeMySession);
    this.post(RouteConstants.SEGMENTS.SESSIONS_REVOKE_OTHERS, this.auth.guard(), this.controller.revokeOtherSessions);

    // API token management (user)
    this.get(RouteConstants.SEGMENTS.API_TOKENS, this.auth.guard(), this.controller.listMyApiTokens);
    this.post(RouteConstants.SEGMENTS.API_TOKENS, this.auth.guard(), this.controller.createMyApiToken);
    this.delete(RouteConstants.SEGMENTS.API_TOKENS_ID, this.auth.guard(), this.controller.revokeMyApiToken);

    // Admin-only endpoints
    this.get(RouteConstants.SEGMENTS.SESSIONS, this.auth.guard(['admin']), this.controller.getSessions);
    this.post(RouteConstants.SEGMENTS.SESSIONS_ID_KILL, this.auth.guard(['admin']), this.controller.killSession);
    this.post(RouteConstants.SEGMENTS.ADMIN_SEND_PASSWORD_RESET, this.auth.guard(['admin']), this.controller.adminSendPasswordReset);
  }
}
