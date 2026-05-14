import { AuthEmailTemplateFileService } from './auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from './auth-email-template-render-service';

export class ThemedVerifyEmailTemplate {
  static async build(options: {
    subject: string;
    greeting: string;
    title: string;
    message: string;
    buttonLabel: string;
    fallbackLabel: string;
    ignoreMessage: string;
    footerText: string;
    verificationUrl: string;
    accentColor: string;
    brandName: string;
    logoUrl: string;
  }): Promise<{ subject: string; text: string; html: string }> {
    const [textTemplate, htmlTemplate, logoTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('themed-verify-email.txt'),
      AuthEmailTemplateFileService.readTemplate('themed-verify-email.html'),
      AuthEmailTemplateFileService.readTemplate('themed-verify-email-logo.html'),
    ]);
    const logoHtml = options.logoUrl
      ? AuthEmailTemplateRenderService.render(logoTemplate, {
        logoUrl: AuthEmailTemplateRenderService.escapeHtml(options.logoUrl),
        brandName: AuthEmailTemplateRenderService.escapeHtml(options.brandName),
      }).trim()
      : '';

    return {
      subject: options.subject,
      text: AuthEmailTemplateRenderService.render(textTemplate, {
        greeting: options.greeting,
        title: options.title,
        message: options.message,
        buttonLabel: options.buttonLabel,
        verificationUrl: options.verificationUrl,
        fallbackLabel: options.fallbackLabel,
        ignoreMessage: options.ignoreMessage,
      }).trim(),
      html: AuthEmailTemplateRenderService.render(htmlTemplate, {
        greeting: AuthEmailTemplateRenderService.escapeHtml(options.greeting),
        title: AuthEmailTemplateRenderService.escapeHtml(options.title),
        message: AuthEmailTemplateRenderService.escapeHtml(options.message),
        buttonLabel: AuthEmailTemplateRenderService.escapeHtml(options.buttonLabel),
        verificationUrl: AuthEmailTemplateRenderService.escapeHtml(options.verificationUrl),
        fallbackLabel: AuthEmailTemplateRenderService.escapeHtml(options.fallbackLabel),
        ignoreMessage: AuthEmailTemplateRenderService.escapeHtml(options.ignoreMessage),
        footerText: AuthEmailTemplateRenderService.escapeHtml(options.footerText),
        accentColor: AuthEmailTemplateRenderService.escapeHtml(options.accentColor),
        logoHtml,
      }).trim(),
    };
  }
}
