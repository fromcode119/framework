import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';

/**
 * The opt-outable email streams a person can be asked about.
 *
 * A category is a plain string on the mail itself (`review-invitation`, `broadcast`), which is all the
 * suppression list needs to refuse a send. It is NOT enough to build a preferences screen: the string
 * has no human name, and nothing can enumerate what streams exist — each one is a private constant
 * inside the plugin that sends it. A panel that hardcoded that list would be the cross-plugin literal
 * the architecture rules forbid, and it would silently omit any stream added later.
 *
 * So the sender declares its own stream, with its own i18n keys, and the framework only stores what it
 * was told. The caller owns the semantics and the copy; this owns the list.
 *
 * Transactional mail is deliberately absent. It carries no category, cannot be switched off, and must
 * never appear as a toggle — a receipt is not a subscription.
 */
export class EmailCategoryRegistry {
  private readonly categories = new Map<string, IEmailCategory>();

  /**
   * Last registration wins, so a plugin reloaded at runtime refreshes its own entry — but never another
   * plugin's: the owner of a stream is who may re-subscribe people to it (`context.email.unsuppress`).
   */
  register(category: IEmailCategory): void {
    const key = String(category?.key || '').trim();
    if (!key) return;
    const holder = this.categories.get(key)?.pluginSlug;
    if (holder && holder !== String(category?.pluginSlug || '').trim()) return;
    this.categories.set(key, {
      key,
      labelKey: String(category?.labelKey || '').trim(),
      descriptionKey: String(category?.descriptionKey || '').trim(),
      pluginSlug: String(category?.pluginSlug || '').trim(),
    });
  }

  /** Every declared stream, in registration order. */
  list(): IEmailCategory[] {
    return [...this.categories.values()];
  }

  /** The plugin that declared `key`, or '' when nobody (or the framework) did. */
  ownerOf(key: unknown): string {
    return this.categories.get(String(key || '').trim())?.pluginSlug ?? '';
  }

  has(key: unknown): boolean {
    return this.categories.has(String(key || '').trim());
  }
}
