import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';
import type { IAuthEmailCommonData } from '@api/controllers/auth/interfaces/auth-email-common-data.interface';

/** The plain sign-up verification email — sent when the site's branded sign-up email is off. */
export class VerifyEmailFallbackTemplate {
  static build(options: IAuthEmailCommonData & { verificationUrl: string }): Promise<{ subject: string; text: string; html: string }> {
    return AuthEmailTemplateRenderService.renderEmail('verify-email-fallback', options, options.locale);
  }
}
