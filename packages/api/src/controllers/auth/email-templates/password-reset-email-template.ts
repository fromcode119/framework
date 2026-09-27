import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';
import type { IAuthEmailCommonData } from '@api/controllers/auth/interfaces/auth-email-common-data.interface';

export class PasswordResetEmailTemplate {
  static build(options: IAuthEmailCommonData & { resetUrl: string }): Promise<{ subject: string; text: string; html: string }> {
    return AuthEmailTemplateRenderService.renderEmail('password-reset', options, options.locale);
  }
}
