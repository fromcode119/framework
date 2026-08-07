import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

/**
 * Loads + compiles the framework's plugin-system email templates from `templates/*`.
 *
 * The repo rule is that rendered output is a template FILE and the code computes DATA only. This is
 * the one place that resolves those files, so the health-notification renderer, the telemetry
 * renderer and anything added later share a single loader instead of each copying the same
 * `readFileSync` + `Handlebars.compile` + candidate-path block.
 *
 * The compiled `dist` copy is preferred (see the `copy:templates` build step) with a `src` fallback
 * so rendering also works when running straight from source.
 */
export class PluginEmailTemplateFileService {
  private static cache = new Map<string, HandlebarsTemplateDelegate>();

  /**
   * Render `<base>.<extension>` with `data`. HTML templates escape interpolations; `.txt` templates
   * do not (they are plain text, and escaping would corrupt it).
   */
  static render(base: string, extension: string, data: object): string {
    const fileName = `${base}.${extension}`;
    const cached = PluginEmailTemplateFileService.cache.get(fileName);
    if (cached) return cached(data);

    const compiled = Handlebars.compile(
      PluginEmailTemplateFileService.readTemplate(fileName),
      { noEscape: !fileName.endsWith('.html') },
    );
    PluginEmailTemplateFileService.cache.set(fileName, compiled);
    return compiled(data);
  }

  /** Render the conventional `<base>.{subject.txt,txt,html}` trio in one call. */
  static renderEmail(base: string, data: object): { subject: string; text: string; html: string } {
    return {
      subject: PluginEmailTemplateFileService.render(base, 'subject.txt', data).trim(),
      text: PluginEmailTemplateFileService.render(base, 'txt', data),
      html: PluginEmailTemplateFileService.render(base, 'html', data),
    };
  }

  private static readTemplate(fileName: string): string {
    for (const candidate of PluginEmailTemplateFileService.candidatePaths(fileName)) {
      try {
        return fs.readFileSync(candidate, 'utf-8');
      } catch {
        // try the next candidate
      }
    }
    throw new Error(`Plugin email template not found: ${fileName}`);
  }

  private static candidatePaths(fileName: string): string[] {
    return [
      path.join(__dirname, 'templates', fileName),
      path.join(__dirname, '../../../src/plugin/services/templates', fileName),
      path.join(__dirname, '../../../dist/plugin/services/templates', fileName),
    ];
  }
}
