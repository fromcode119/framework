import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';
import type { IAuthEmailCommonData } from '@api/controllers/auth/interfaces/auth-email-common-data.interface';

export class EmailChangeVerificationTemplate {
  static build(options: IAuthEmailCommonData & { confirmUrl: string; newEmail: string }): Promise<{ subject: string; text: string; html: string }> {
    return AuthEmailTemplateRenderService.renderEmail('email-change-verification', options, options.locale);
  }
}
