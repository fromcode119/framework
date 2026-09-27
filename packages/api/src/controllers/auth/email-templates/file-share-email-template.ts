import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';

/**
 * The email that carries a share link. Markup lives in the `file-share.*` template files (a theme's
 * copy first); this class only hands them the share as data.
 */
export class FileShareEmailTemplate {
  static build(options: {
    appName: string;
    title: string;
    message: string;
    shareUrl: string;
    expiresAt: string;
    maxDownloads: string;
    /** The recipient's language. Falls back to the English template when untranslated. */
    locale?: string;
    theme?: Record<string, unknown>;
  }): Promise<{ subject: string; text: string; html: string }> {
    return AuthEmailTemplateRenderService.renderEmail('file-share', { ...options, theme: options.theme || {} }, options.locale);
  }
}
