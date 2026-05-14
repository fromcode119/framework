import { AuthEmailTemplateFileService } from './auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from './auth-email-template-render-service';

export class PasswordResetEmailTemplate {
  static async build(options: {
    appName: string;
    greeting: string;
    resetUrl: string;
  }): Promise<{ subject: string; text: string; html: string }> {
    const [subjectTemplate, textTemplate, htmlTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('password-reset.subject.txt'),
      AuthEmailTemplateFileService.readTemplate('password-reset.txt'),
      AuthEmailTemplateFileService.readTemplate('password-reset.html'),
    ]);

    return {
      subject: AuthEmailTemplateRenderService.render(subjectTemplate, {
        appName: options.appName,
      }).trim(),
      text: AuthEmailTemplateRenderService.render(textTemplate, {
        greeting: options.greeting,
        resetUrl: options.resetUrl,
      }).trim(),
      html: AuthEmailTemplateRenderService.render(htmlTemplate, {
        greeting: AuthEmailTemplateRenderService.escapeHtml(options.greeting),
        resetUrl: AuthEmailTemplateRenderService.escapeHtml(options.resetUrl),
      }).trim(),
    };
  }
}
