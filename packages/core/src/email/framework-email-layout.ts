import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';
import { EmailLogoUrl } from '@core/email/email-logo-url';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The ONE default frame for every email the framework itself sends to its operators (plugin held,
 * monitoring incidents, certificate expiry, telemetry): the site's email logo (Settings → General →
 * Email logo), its Platform Name, the subject as a heading, the body, and a footer saying where the
 * recipient list is set. The markup is the template FILE `email-layout.html`.
 *
 * The active theme may replace the frame with its own `src/overrides/framework/emails/email-layout.html`
 * (same data); the auth emails read their theme copies from the same folder.
 *
 * A plugin that sends its own mail through `notifyAdmins` is NOT framed — its html is its own design.
 */
export class FrameworkEmailLayout {
  static readonly THEME_OVERRIDE = path.join('src', 'overrides', 'framework', 'emails', 'email-layout.html');

  /** `source` is anything that can read settings and media: the plugin manager, or the bare database handle. */
  static async wrap(
    source: { db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }; themeManager?: { getActiveThemeManifest(): { slug: string } | null; getThemeDirectory?(slug: string): string } | null },
    message: { subject: string; html?: string; text?: string },
  ): Promise<string> {
    const read = (key: string) => source.db.findOne(SystemConstants.TABLE.META, { key }).then((row) => row?.value ?? '').catch(() => '');
    const [platformName, logoSetting] = await Promise.all([
      read(SystemConstants.META_KEY.PLATFORM_NAME),
      read(SystemConstants.META_KEY.EMAIL_LOGO),
    ]);
    const logoUrl = await EmailLogoUrl.resolve(
      source.db,
      logoSetting,
      async () => source.themeManager?.getActiveThemeManifest()?.slug ?? null,
    ).catch(() => '');
    const bodyHtml = String(message.html ?? '').trim();
    const data = {
      appName: String(platformName ?? '').trim(),
      logoUrl,
      subject: message.subject,
      bodyHtml,
      paragraphs: bodyHtml ? [] : String(message.text ?? '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
    };
    const override = FrameworkEmailLayout.themeOverride(source.themeManager);
    return override ? Handlebars.compile(override)(data) : PluginEmailTemplateFileService.render('email-layout', 'html', data);
  }

  /** The active theme's own frame, or null when it ships none. */
  private static themeOverride(themes: { getActiveThemeManifest(): { slug: string } | null; getThemeDirectory?(slug: string): string } | null | undefined): string | null {
    const slug = String(themes?.getActiveThemeManifest()?.slug ?? '').trim();
    if (!slug || !themes?.getThemeDirectory) return null;
    try {
      return fs.readFileSync(path.join(themes.getThemeDirectory(slug), FrameworkEmailLayout.THEME_OVERRIDE), 'utf-8');
    } catch {
      return null;
    }
  }
}
