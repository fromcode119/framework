import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from '@api/controllers/auth/email-templates/auth-email-template-render-service';

/**
 * The email that carries a share link.
 *
 * Markup lives in the sibling `.html`/`.txt`/`.subject.txt` files, never in a template literal here —
 * this class computes values, the files own the presentation. `render` compiles with `noEscape`, so
 * every value going into the HTML is escaped explicitly below; the text part is not markup and is not.
 */
export class FileShareEmailTemplate {
  static async build(options: {
    appName: string;
    title: string;
    message: string;
    shareUrl: string;
    expiresAt: string;
    maxDownloads: string;
    /** The recipient's language. Falls back to the English template when untranslated. */
    locale?: string;
  }): Promise<{ subject: string; text: string; html: string }> {
    const [subjectTemplate, textTemplate, htmlTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('file-share.subject.txt', options.locale),
      AuthEmailTemplateFileService.readTemplate('file-share.txt', options.locale),
      AuthEmailTemplateFileService.readTemplate('file-share.html', options.locale),
    ]);

    const escape = AuthEmailTemplateRenderService.escapeHtml;

    return {
      subject: AuthEmailTemplateRenderService.render(subjectTemplate, { title: options.title }).trim(),
      text: AuthEmailTemplateRenderService.render(textTemplate, {
        title: options.title,
        message: options.message,
        shareUrl: options.shareUrl,
        expiresAt: options.expiresAt,
        maxDownloads: options.maxDownloads,
      }).trim(),
      html: AuthEmailTemplateRenderService.render(htmlTemplate, {
        appName: escape(options.appName),
        title: escape(options.title),
        message: escape(options.message),
        // Escaped like every other value: the operator composes the message, but the URL still travels
        // through an HTML attribute and must not be able to close it.
        shareUrl: escape(options.shareUrl),
        expiresAt: escape(options.expiresAt),
        maxDownloads: escape(options.maxDownloads),
      }).trim(),
    };
  }
}
