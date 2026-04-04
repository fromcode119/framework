import { SystemConstants } from '@fromcode119/core/client';

export class VerifyEmailCaptchaService {
  static readonly resendVerificationAction = VerifyEmailCaptchaService.buildAction(
    SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION,
  );

  private static buildAction(path: string): string {
    const normalizedPath = String(path || '')
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalizedPath || 'captcha_action';
  }
}