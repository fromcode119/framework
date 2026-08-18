/**
 * Copy for the framework's OWN surfaces, resolved without a theme, a plugin or the context provider.
 *
 * The framework ships pages that a recipient can land on with no session and no themed content page behind
 * them — a share link, an unsubscribe link, a password reset. Those render the framework's fallback
 * panel, which mounts OUTSIDE the runtime context, so `PluginComponent.t` has nothing to read and every
 * string paints as its own key. Making the words depend on a theme or a plugin being present is the
 * wrong shape: this copy belongs to the framework, so the framework resolves it.
 *
 * Packs are registered per feature (`FileShareTranslations`, and the account pack) rather than kept in
 * one file, so a feature's words live beside it and a new language is one more JSON file.
 *
 * When the context provider IS present its translator still wins — a theme or plugin may legitimately
 * override framework copy. This is the floor, not a replacement.
 */
export class FrameworkTranslations {
  private static readonly packs = new Map<string, Record<string, unknown>>();

  /** Merge a locale pack, e.g. `register('bg', BG)`. Later registrations win on conflicting keys. */
  static register(locale: string, pack: Record<string, unknown>): void {
    const key = FrameworkTranslations.normalizeLocale(locale);
    const existing = FrameworkTranslations.packs.get(key) || {};
    FrameworkTranslations.packs.set(key, FrameworkTranslations.merge(existing, pack));
  }

  /** Registers several locales at once: `registerAll({ en: EN, bg: BG })`. */
  static registerAll(packs: Record<string, Record<string, unknown>>): void {
    Object.entries(packs || {}).forEach(([locale, pack]) => FrameworkTranslations.register(locale, pack));
  }

  /**
   * The active locale, from `<html lang>` — the same source the storefront already sets from the
   * platform's configured locale, so this needs no settings request of its own.
   */
  static get locale(): string {
    if (typeof document === 'undefined') return 'en';
    return FrameworkTranslations.normalizeLocale(document.documentElement.lang || 'en');
  }

  /**
   * Resolve a dotted key, interpolating `{{name}}` placeholders.
   *
   * Falls back to English, then to the key itself. Returning the key is deliberate: a visible
   * `files.share.title` is a bug report, whereas silently rendering nothing hides a missing translation
   * for as long as nobody looks.
   */
  static t(key: string, vars?: Record<string, unknown>): string {
    const value = FrameworkTranslations.lookup(FrameworkTranslations.locale, key)
      ?? FrameworkTranslations.lookup('en', key);
    if (typeof value !== 'string') return key;

    return Object.entries(vars || {}).reduce(
      (out, [name, replacement]) => out.split(`{{${name}}}`).join(String(replacement)),
      value,
    );
  }

  private static lookup(locale: string, key: string): unknown {
    const pack = FrameworkTranslations.packs.get(locale);
    if (!pack) return undefined;
    return String(key || '').split('.').reduce<any>((node, part) => (node ? node[part] : undefined), pack);
  }

  /** `bg-BG` and `bg` are the same pack; nothing here is region-specific. */
  private static normalizeLocale(locale: string): string {
    return String(locale || 'en').trim().toLowerCase().split('-')[0] || 'en';
  }

  private static merge(base: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(incoming || {})) {
      const existing = out[key];
      const bothObjects = value && typeof value === 'object' && !Array.isArray(value)
        && existing && typeof existing === 'object' && !Array.isArray(existing);
      out[key] = bothObjects
        ? FrameworkTranslations.merge(existing as Record<string, unknown>, value as Record<string, unknown>)
        : value;
    }
    return out;
  }
}
