import { AuthEmailTemplateFileService } from './auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from './auth-email-template-render-service';

export class VerifyEmailFallbackTemplate {
  static async build(options: {
    appName: string;
    greeting: string;
    verificationUrl: string;
  }): Promise<{ subject: string; text: string; html: string }> {
    const [subjectTemplate, textTemplate, htmlTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('verify-email-fallback.subject.txt'),
      AuthEmailTemplateFileService.readTemplate('verify-email-fallback.txt'),
      AuthEmailTemplateFileService.readTemplate('verify-email-fallback.html'),
    ]);
    const subject = AuthEmailTemplateRenderService.render(subjectTemplate, {
      appName: options.appName,
    }).trim();
    const text = AuthEmailTemplateRenderService.render(textTemplate, {
      greeting: options.greeting,
      verificationUrl: options.verificationUrl,
    }).trim();
    const html = AuthEmailTemplateRenderService.render(htmlTemplate, {
      greeting: AuthEmailTemplateRenderService.escapeHtml(options.greeting),
      verificationUrl: AuthEmailTemplateRenderService.escapeHtml(options.verificationUrl),
    }).trim();

    return {
      subject,
      text,
      html,
    };
  }
}
