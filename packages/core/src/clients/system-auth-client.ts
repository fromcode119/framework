import { SystemConstants } from '../constants';

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
    return this.requester.get(SystemConstants.API_PATH.AUTH.STATUS, options);
  }

  login(payload: { email: string; password: string; captchaToken?: string }, options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.LOGIN, payload, options);
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
    return this.requester.post(SystemConstants.API_PATH.AUTH.REGISTER, payload, options);
  }

  resendVerification(email: string, options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION, { email }, options);
  }

  getSecurityState(options?: any): Promise<any> {
    return this.requester.get(SystemConstants.API_PATH.AUTH.SECURITY, options);
  }

  updateProfile(payload: Record<string, any>, options?: any): Promise<any> {
    return this.requester.patch(SystemConstants.API_PATH.AUTH.PROFILE, payload, options);
  }

  changePassword(
    payload: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean },
    options?: any,
  ): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD, payload, options);
  }

  requestEmailChange(payload: { newEmail: string; currentPassword: string }, options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST, payload, options);
  }

  getSessions(options?: any): Promise<any> {
    return this.requester.get(SystemConstants.API_PATH.AUTH.MY_SESSIONS, options);
  }

  revokeOtherSessions(options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS, {}, options);
  }

  getTwoFactorStatus(options?: any): Promise<any> {
    return this.requester.get(SystemConstants.API_PATH.AUTH.TWO_FACTOR_STATUS, options);
  }

  setupTwoFactor(options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.TWO_FACTOR_SETUP, {}, options);
  }

  verifyTwoFactor(token: string, options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.TWO_FACTOR_VERIFY, { token }, options);
  }

  regenerateRecoveryCodes(options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.TWO_FACTOR_RECOVERY_REGENERATE, {}, options);
  }

  disableTwoFactor(options?: any): Promise<any> {
    return this.requester.delete(SystemConstants.API_PATH.AUTH.TWO_FACTOR_DISABLE, options);
  }

  logout(options?: any): Promise<any> {
    return this.requester.post(SystemConstants.API_PATH.AUTH.LOGOUT, {}, options);
  }
}
