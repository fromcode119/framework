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
    this.get(RouteConstants.SEGMENTS.STATUS, this.bind(this.controller.getStatus.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SETUP, this.bind(this.controller.setup.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.REGISTER, this.bind(this.controller.register.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.VERIFY_EMAIL, this.bind(this.controller.verifyEmail.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.RESEND_VERIFICATION, this.bind(this.controller.resendVerification.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.FORGOT_PASSWORD, this.bind(this.controller.forgotPassword.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.RESET_PASSWORD, this.bind(this.controller.resetPassword.bind(this.controller)));
    
    // SSO endpoints
    this.get(RouteConstants.SEGMENTS.SSO_PROVIDERS, this.bind(this.controller.getSsoProviders.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SSO_LOGIN, this.bind(this.controller.ssoLogin.bind(this.controller)));
    
    // Login/logout
    this.post(RouteConstants.SEGMENTS.LOGIN, this.bind(this.controller.login.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.LOGOUT, this.bind(this.controller.logout.bind(this.controller)));

    // User security (requires authentication)
    this.get(RouteConstants.SEGMENTS.SECURITY, this.auth.guard(), this.bind(this.controller.getMySecurityState.bind(this.controller)));
    this.patch(RouteConstants.SEGMENTS.PROFILE, this.auth.guard(), this.bind(this.controller.updateMyProfile.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.VERIFY_PASSWORD, this.auth.guard(), this.bind(this.controller.verifyPassword.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.CHANGE_PASSWORD, this.auth.guard(), this.bind(this.controller.changePassword.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.EMAIL_CHANGE_REQUEST, this.auth.guard(), this.bind(this.controller.requestEmailChange.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.EMAIL_CHANGE_CONFIRM, this.bind(this.controller.confirmEmailChange.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.TWO_FACTOR_STATUS, this.auth.guard(), this.bind(this.controller.getMyTwoFactorStatus.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_SETUP, this.auth.guard(), this.bind(this.controller.setupMyTwoFactor.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_VERIFY, this.auth.guard(), this.bind(this.controller.verifyMyTwoFactor.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.TWO_FACTOR_RECOVERY, this.auth.guard(), this.bind(this.controller.regenerateMyRecoveryCodes.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.TWO_FACTOR_DISABLE, this.auth.guard(), this.bind(this.controller.disableMyTwoFactor.bind(this.controller)));

    // Session management (user)
    this.get(RouteConstants.SEGMENTS.SESSIONS_ME, this.auth.guard(), this.bind(this.controller.getMySessions.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SESSIONS_ID_REVOKE, this.auth.guard(), this.bind(this.controller.revokeMySession.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SESSIONS_REVOKE_OTHERS, this.auth.guard(), this.bind(this.controller.revokeOtherSessions.bind(this.controller)));

    // API token management (user)
    this.get(RouteConstants.SEGMENTS.API_TOKENS, this.auth.guard(), this.bind(this.controller.listMyApiTokens.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.API_TOKENS, this.auth.guard(), this.bind(this.controller.createMyApiToken.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.API_TOKENS_ID, this.auth.guard(), this.bind(this.controller.revokeMyApiToken.bind(this.controller)));

    // Admin-only endpoints
    this.get(RouteConstants.SEGMENTS.SESSIONS, this.auth.guard(['admin']), this.bind(this.controller.getSessions.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SESSIONS_ID_KILL, this.auth.guard(['admin']), this.bind(this.controller.killSession.bind(this.controller)));
  }
}
