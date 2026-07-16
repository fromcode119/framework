import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import type { PluginHealthNotificationData } from './plugin-health-notification-template.interfaces';

/**
 * Renders the "plugins need attention" admin alert from Handlebars template FILES.
 *
 * Markup and copy live in `templates/plugin-health-notification.{subject.txt,txt,html}` — never as
 * string concatenation in service code (see the repo rule: rendered output = template files, the code
 * computes DATA only). Mirrors the api's auth email-template file-service: the template is resolved
 * from the compiled `dist` copy first (see the `copy:templates` build step) with a `src` fallback so
 * it also works when running straight from source.
 */
export class PluginHealthNotificationTemplateService {
  private static readonly TEMPLATE_BASE = 'plugin-health-notification';
  private static cache = new Map<string, HandlebarsTemplateDelegate>();

  static render(data: PluginHealthNotificationData): { subject: string; text: string; html: string } {
    return {
      subject: PluginHealthNotificationTemplateService.renderPart('subject.txt', data).trim(),
      text: PluginHealthNotificationTemplateService.renderPart('txt', data),
      html: PluginHealthNotificationTemplateService.renderPart('html', data),
    };
  }

  private static renderPart(extension: string, data: PluginHealthNotificationData): string {
    const fileName = `${PluginHealthNotificationTemplateService.TEMPLATE_BASE}.${extension}`;
    const cached = PluginHealthNotificationTemplateService.cache.get(fileName);
    if (cached) return cached(data);

    const source = PluginHealthNotificationTemplateService.readTemplate(fileName);
    const compiled = Handlebars.compile(source, { noEscape: extension !== 'html' });
    PluginHealthNotificationTemplateService.cache.set(fileName, compiled);
    return compiled(data);
  }

  private static readTemplate(fileName: string): string {
    for (const candidate of PluginHealthNotificationTemplateService.candidatePaths(fileName)) {
      try {
        return fs.readFileSync(candidate, 'utf-8');
      } catch {
        // try the next candidate
      }
    }
    throw new Error(`Plugin health notification template not found: ${fileName}`);
  }

  private static candidatePaths(fileName: string): string[] {
    return [
      path.join(__dirname, 'templates', fileName),
      path.join(__dirname, '../../../src/plugin/services/templates', fileName),
      path.join(__dirname, '../../../dist/plugin/services/templates', fileName),
    ];
  }
}
