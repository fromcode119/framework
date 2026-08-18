import { PluginManager, Logger, SystemConstants } from '@fromcode119/core';
import { FileShareEmailTemplate } from '@api/controllers/auth/email-templates/file-share-email-template';
import { FileShareAdminController } from '@api/controllers/file-share-admin-controller';

/**
 * Sends the one email that carries a share link.
 *
 * Returns a boolean rather than throwing, and the caller reports which recipients failed. That matters
 * more here than in most send paths: the raw token exists only in memory during creation, so a silent
 * send failure would leave a grant nobody can ever reach and an operator who believes it was delivered.
 */
export class FileShareEmailService {
  private readonly logger = new Logger({ namespace: 'file-share-email' });

  constructor(private readonly manager: PluginManager) {}

  async sendShareLink(options: { email: string; title: string; message: string; rawToken: string; expiresAt?: string | null; maxDownloads?: number }): Promise<boolean> {
    try {
      const shareUrl = FileShareAdminController.buildShareUrl(options.rawToken);
      if (!shareUrl) {
        // No frontend URL configured. Better to fail loudly than to mail a link to nowhere.
        this.logger.error('Cannot send share link: no frontend base URL is configured');
        return false;
      }

      const email = await FileShareEmailTemplate.build({
        appName: await this.resolveAppName(),
        locale: await this.resolveLocale(options.email),
        title: options.title,
        message: options.message,
        shareUrl,
        expiresAt: options.expiresAt ? new Date(options.expiresAt).toLocaleDateString() : '',
        maxDownloads: options.maxDownloads && options.maxDownloads > 0 ? String(options.maxDownloads) : '',
      });

      await (this.manager as any).email.send({
        to: options.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send share link to ${options.email}: ${error?.message || error}`);
      return false;
    }
  }

  /**
   * The language to write in: the RECIPIENT's own preference when the platform knows them, otherwise the
   * platform default. A share often goes to someone with no account, so `people.preferred_locale` is
   * the only per-person signal available — and it is set for backfilled contacts too.
   */
  private async resolveLocale(email: string): Promise<string> {
    const db = (this.manager as any).db;
    const person = await db?.findOne?.(SystemConstants.TABLE.PEOPLE, { email: String(email || '').trim().toLowerCase() });
    const preferred = String(person?.preferred_locale || person?.preferredLocale || '').trim();
    if (preferred) return preferred;

    const row = await db?.findOne?.(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.DEFAULT_LOCALE });
    return String(row?.value || '').trim();
  }

  /** Same precedence the auth emails use, so every framework email signs itself the same way. */
  private async resolveAppName(): Promise<string> {
    const db = (this.manager as any).db;
    const read = async (key: string): Promise<string> => {
      const row = await db?.findOne?.(SystemConstants.TABLE.META, { key });
      return String(row?.value || '').trim();
    };

    return (await read(SystemConstants.META_KEY.PLATFORM_NAME))
      || (await read(SystemConstants.META_KEY.SITE_NAME))
      || String(process.env.APP_NAME || '').trim()
      || 'Platform';
  }
}
