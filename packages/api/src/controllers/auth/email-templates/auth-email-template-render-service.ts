import Handlebars from 'handlebars';
import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';

/**
 * Renders one framework email — `<name>.subject.txt`, `<name>.txt`, `<name>.html` in the reader's
 * language, the active theme's copy first — from the data its sender passes. The template decides what
 * to print; the HTML part is escaped by Handlebars, the subject and text parts are plain text.
 */
export class AuthEmailTemplateRenderService {
  static async renderEmail(name: string, data: object, locale?: string): Promise<{ subject: string; text: string; html: string }> {
    const [subject, text, html] = await Promise.all(['subject.txt', 'txt', 'html']
      .map((ext) => AuthEmailTemplateFileService.readTemplate(`${name}.${ext}`, locale)));
    return {
      subject: Handlebars.compile(subject, { noEscape: true })(data).trim(),
      text: Handlebars.compile(text, { noEscape: true })(data).trim(),
      html: Handlebars.compile(html)(data).trim(),
    };
  }
}
