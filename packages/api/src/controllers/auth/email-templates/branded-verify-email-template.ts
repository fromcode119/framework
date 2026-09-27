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
    theme?: Record<string, unknown>;
  }): Promise<{ subject: string; text: string; html: string }> {
    // The copy is the site's own (Settings → General → Sign-up email); the markup is the template's.
    return AuthEmailTemplateRenderService.renderEmail('branded-verify-email', { ...options, theme: options.theme || {} }, options.lang);
  }
}
