import { SystemApiPaths } from '@core/constants/system-api-paths.constants';

export class SystemAuthClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
      post: (path: string, body?: any, options?: any) => Promise<any>;
      patch: (path: string, body?: any, options?: any) => Promise<any>;
      delete: (path: string, options?: any) => Promise<any>;
    },
  ) {}

  getStatus(options?: any): Promise<any> {
    return this.requester.get(SystemApiPaths.ALL.AUTH.STATUS, options);
  }

  /** The social sign-in providers this site offers: `{ providers: [{ key, label }] }`. */
  getSsoProviders(options?: any): Promise<any> {
    return this.requester.get(SystemApiPaths.ALL.AUTH.SSO_PROVIDERS, options);
  }

  login(payload: { email: string; password: string; captchaToken?: string }, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.LOGIN, payload, options);
  }

  register(
    payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      context?: Record<string, any>;
    },
    options?: any,
  ): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.REGISTER, payload, options);
  }

  resendVerification(email: string, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.RESEND_VERIFICATION, { email }, options);
  }

  /** Request a password-reset email for the given address (always resolves with a generic message). */
  forgotPassword(payload: { email: string; context?: string }, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.FORGOT_PASSWORD, payload, options);
  }

  /** Set a new password using the token from the reset email. */
  resetPassword(payload: { token: string; newPassword: string }, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.RESET_PASSWORD, payload, options);
  }

  getSecurityState(options?: any): Promise<any> {
    return this.requester.get(SystemApiPaths.ALL.AUTH.SECURITY, options);
  }

  updateProfile(payload: Record<string, any>, options?: any): Promise<any> {
    return this.requester.patch(SystemApiPaths.ALL.AUTH.PROFILE, payload, options);
  }

  changePassword(
    payload: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean },
    options?: any,
  ): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.CHANGE_PASSWORD, payload, options);
  }

  requestEmailChange(payload: { newEmail: string; currentPassword: string }, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.EMAIL_CHANGE_REQUEST, payload, options);
  }

  getSessions(options?: any): Promise<any> {
    return this.requester.get(SystemApiPaths.ALL.AUTH.MY_SESSIONS, options);
  }

  revokeOtherSessions(options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.REVOKE_OTHER_SESSIONS, {}, options);
  }

  getTwoFactorStatus(options?: any): Promise<any> {
    return this.requester.get(SystemApiPaths.ALL.AUTH.TWO_FACTOR_STATUS, options);
  }

  setupTwoFactor(options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.TWO_FACTOR_SETUP, {}, options);
  }

  verifyTwoFactor(token: string, options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.TWO_FACTOR_VERIFY, { token }, options);
  }

  regenerateRecoveryCodes(options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.TWO_FACTOR_RECOVERY_REGENERATE, {}, options);
  }

  disableTwoFactor(options?: any): Promise<any> {
    return this.requester.delete(SystemApiPaths.ALL.AUTH.TWO_FACTOR_DISABLE, options);
  }

  logout(options?: any): Promise<any> {
    return this.requester.post(SystemApiPaths.ALL.AUTH.LOGOUT, {}, options);
  }
}
