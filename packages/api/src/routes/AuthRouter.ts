import { BaseRouter } from '../routers/BaseRouter';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { AuthController } from '../controllers/auth-controller';

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
    this.get('/status', this.bind(this.controller.getStatus));
    this.post('/setup', this.bind(this.controller.setup));
    this.post('/register', this.bind(this.controller.register));
    this.post('/verify-email', this.bind(this.controller.verifyEmail));
    this.post('/resend-verification', this.bind(this.controller.resendVerification));
    this.post('/forgot-password', this.bind(this.controller.forgotPassword));
    this.post('/reset-password', this.bind(this.controller.resetPassword));
    
    // SSO endpoints
    this.get('/sso/providers', this.bind(this.controller.getSsoProviders));
    this.post('/sso/login', this.bind(this.controller.ssoLogin));
    
    // Login/logout
    this.post('/login', this.bind(this.controller.login));
    this.post('/logout', this.bind(this.controller.logout));

    // User security (requires authentication)
    this.get('/security', this.auth.guard(), this.bind(this.controller.getMySecurityState));
    this.post('/verify-password', this.auth.guard(), this.bind(this.controller.verifyPassword));
    this.post('/change-password', this.auth.guard(), this.bind(this.controller.changePassword));
    this.post('/email-change/request', this.auth.guard(), this.bind(this.controller.requestEmailChange));
    this.post('/email-change/confirm', this.bind(this.controller.confirmEmailChange));

    // Session management (user)
    this.get('/sessions/me', this.auth.guard(), this.bind(this.controller.getMySessions));
    this.post('/sessions/:id/revoke', this.auth.guard(), this.bind(this.controller.revokeMySession));
    this.post('/sessions/revoke-others', this.auth.guard(), this.bind(this.controller.revokeOtherSessions));

    // API token management (user)
    this.get('/api-tokens', this.auth.guard(), this.bind(this.controller.listMyApiTokens));
    this.post('/api-tokens', this.auth.guard(), this.bind(this.controller.createMyApiToken));
    this.delete('/api-tokens/:id', this.auth.guard(), this.bind(this.controller.revokeMyApiToken));

    // Admin-only endpoints
    this.get('/sessions', this.auth.guard(['admin']), this.bind(this.controller.getSessions));
    this.post('/sessions/:id/kill', this.auth.guard(['admin']), this.bind(this.controller.killSession));
  }
}
