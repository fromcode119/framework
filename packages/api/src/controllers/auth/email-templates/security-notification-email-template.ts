import { AuthEmailTemplateFileService } from './auth-email-template-file-service';
import { AuthEmailTemplateRenderService } from './auth-email-template-render-service';

export class SecurityNotificationEmailTemplate {
  static async build(options: {
    appName: string;
    subject: string;
    title: string;
    details: string[];
  }): Promise<{ subject: string; text: string; html: string }> {
    const safeDetails = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
    const [subjectTemplate, textTemplate, htmlTemplate, listTemplate, listItemTemplate] = await Promise.all([
      AuthEmailTemplateFileService.readTemplate('security-notification.subject.txt'),
      AuthEmailTemplateFileService.readTemplate('security-notification.txt'),
      AuthEmailTemplateFileService.readTemplate('security-notification.html'),
      AuthEmailTemplateFileService.readTemplate('security-notification-list.html'),
      AuthEmailTemplateFileService.readTemplate('security-notification-list-item.html'),
    ]);
    const detailsHtml = safeDetails.length > 0
      ? AuthEmailTemplateRenderService.render(listTemplate, {
        itemsHtml: safeDetails.map((line) => AuthEmailTemplateRenderService.render(listItemTemplate, {
          detail: AuthEmailTemplateRenderService.escapeHtml(line),
        })).join(''),
      }).trim()
      : '';

    return {
      subject: AuthEmailTemplateRenderService.render(subjectTemplate, {
        appName: options.appName,
        subject: options.subject,
      }).trim(),
      text: AuthEmailTemplateRenderService.render(textTemplate, {
        title: options.title,
        detailsText: safeDetails.join('\n'),
      }).trim(),
      html: AuthEmailTemplateRenderService.render(htmlTemplate, {
        title: AuthEmailTemplateRenderService.escapeHtml(options.title),
        detailsHtml,
      }).trim(),
    };
  }
}
