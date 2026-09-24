import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';

/** The branded sign-up email: markup from the template files, copy from the site's Sign-up email settings. */
export class BrandedVerifyEmailTemplate {
  static async build(options: {
    /** Platform locale code for the document's `lang` attribute. Empty renders no attribute. */
    lang: string;
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
  }): Promise<{ subject: string; text: string; html: string }> {
    const [textTemplate, htmlTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('branded-verify-email.txt'),
      AuthEmailTemplateFileService.readTemplate('branded-verify-email.html'),
    ]);
    const escape = AuthEmailTemplateRenderService.escapeHtml;

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
        langAttribute: options.lang ? ` lang="${escape(options.lang)}"` : '',
        greeting: escape(options.greeting),
        title: escape(options.title),
        message: escape(options.message),
        buttonLabel: escape(options.buttonLabel),
        verificationUrl: escape(options.verificationUrl),
        fallbackLabel: escape(options.fallbackLabel),
        ignoreMessage: escape(options.ignoreMessage),
        footerText: escape(options.footerText),
        accentColor: escape(options.accentColor),
      }).trim(),
    };
  }
}
