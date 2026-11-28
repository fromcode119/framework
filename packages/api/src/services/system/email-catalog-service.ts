import { EmailTemplateRegistry, SystemConstants } from '@fromcode119/core';
import type { IRenderedEmail } from '@fromcode119/core';

/**
 * The email catalog as one scope sees it: every kind of email the platform and the site's extensions
 * can send, WHEN each goes out, how often it went out lately, and each one drawn with its example data.
 */
export class EmailCatalogService {
  private static readonly WINDOW_DAYS = 30;

  constructor(
    private readonly db: any,
    private readonly translate: (key: string, fallback: string) => string,
  ) {}

  async list(): Promise<Array<Record<string, unknown>>> {
    const since = new Date(Date.now() - EmailCatalogService.WINDOW_DAYS * 86_400_000).toISOString();
    const groups: Array<Record<string, unknown>> = await this.db.groupCount(SystemConstants.TABLE.EMAIL_LOG, { where: { created_at: { gte: since } }, groupBy: ['template_key'] });
    const recent = new Map(groups.map((group) => [String(group?.template_key ?? ''), Number(group?.count ?? 0)]));
    const entries = EmailTemplateRegistry.listForCurrentTenant();
    return Promise.all(entries.map(async (entry) => {
      const [last] = await this.db.find(SystemConstants.TABLE.EMAIL_LOG, { where: { template_key: entry.id }, orderBy: { id: 'desc' }, limit: 1, columns: { created_at: true } });
      return {
        id: entry.id,
        key: entry.key,
        sender: entry.sender || null,
        labelKey: entry.labelKey,
        triggerKey: entry.triggerKey,
        descriptionKey: entry.descriptionKey || null,
        // Translated here from the sender's own dictionary when it has one; the console's dictionary
        // holds the platform's own, so an empty label is the caller's to look up by key.
        label: this.translate(entry.labelKey, ''),
        trigger: this.translate(entry.triggerKey, ''),
        description: entry.descriptionKey ? this.translate(entry.descriptionKey, '') : '',
        category: entry.category || null,
        sensitive: entry.sensitive === true,
        sentLastWindow: recent.get(entry.id) ?? 0,
        windowDays: EmailCatalogService.WINDOW_DAYS,
        lastSentAt: last?.created_at ?? null,
      };
    }));
  }

  /** One email drawn with its declared example data. `null` when this scope has no such email. */
  async preview(id: string): Promise<(IRenderedEmail & { sample: Record<string, unknown> }) | null> {
    const entry = EmailTemplateRegistry.get(id);
    if (!entry) return null;
    const rendered = await entry.render(entry.sample);
    return { subject: String(rendered?.subject ?? ''), html: rendered?.html, text: rendered?.text, sample: entry.sample };
  }

  /** Who sends `id`, and whether its log row keeps content — what a test send must carry. */
  static entry(id: string) {
    return EmailTemplateRegistry.get(id);
  }
}
