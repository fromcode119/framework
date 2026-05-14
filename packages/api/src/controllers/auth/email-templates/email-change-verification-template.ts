import { AuthEmailTemplateFileService } from './auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from './auth-email-template-render-service';

export class EmailChangeVerificationTemplate {
  static async build(options: {
    appName: string;
    greeting: string;
    confirmUrl: string;
  }): Promise<{ subject: string; text: string; html: string }> {
    const [subjectTemplate, textTemplate, htmlTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('email-change-verification.subject.txt'),
      AuthEmailTemplateFileService.readTemplate('email-change-verification.txt'),
      AuthEmailTemplateFileService.readTemplate('email-change-verification.html'),
    ]);

    return {
      subject: AuthEmailTemplateRenderService.render(subjectTemplate, {
        appName: options.appName,
      }).trim(),
      text: AuthEmailTemplateRenderService.render(textTemplate, {
        greeting: options.greeting,
        confirmUrl: options.confirmUrl,
      }).trim(),
      html: AuthEmailTemplateRenderService.render(htmlTemplate, {
        greeting: AuthEmailTemplateRenderService.escapeHtml(options.greeting),
        confirmUrl: AuthEmailTemplateRenderService.escapeHtml(options.confirmUrl),
      }).trim(),
    };
  }
}
