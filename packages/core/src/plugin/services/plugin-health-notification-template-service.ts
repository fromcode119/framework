import type { IPluginHealthNotificationData } from '@core/plugin/services/interfaces/plugin-health-notification-data.interface';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';

/**
 * Renders the "plugins need attention" admin alert from Handlebars template FILES.
 *
 * Markup and copy live in `templates/plugin-health-notification.{subject.txt,txt,html}` — never as
 * string concatenation in service code (see the repo rule: rendered output = template files, the code
 * computes DATA only). File resolution + compilation are shared with every other framework email via
 * {@link PluginEmailTemplateFileService}.
 */
export class PluginHealthNotificationTemplateService {
  private static readonly TEMPLATE_BASE = 'plugin-health-notification';

  static render(data: IPluginHealthNotificationData): { subject: string; text: string; html: string } {
    return PluginEmailTemplateFileService.renderEmail(PluginHealthNotificationTemplateService.TEMPLATE_BASE, data);
  }
}
