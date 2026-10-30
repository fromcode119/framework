/**
 * An integration's words in the console's language (Settings → Integrations), from the dictionary of the
 * plugin that declared them. The type, each provider and each provider's settings were sent exactly as
 * registered, in English, so a Bulgarian console showed a courier's username, password and sender fields — and
 * every other plugin's — in English.
 *
 * The type's words come from its owner's dictionary; a provider's from the plugin that supplied it
 * (`dictionary`: the courier plugin whose settings logistics registered, not logistics):
 *
 *   admin.integrations.<type>.label | description
 *   admin.integrations.<type>.providers.<provider>.label | description
 *   admin.integrations.<type>.providers.<provider>.fields.<field>.label | description | placeholder
 *   admin.integrations.<type>.providers.<provider>.fields.<field>.options.<value>
 *
 * A key the dictionary lacks leaves the declared text. The framework's own types and providers carry no
 * plugin and are the console's to translate.
 */
export class AdminIntegrationLocalizer {
  constructor(private readonly lookup: (pluginSlug: string, key: string) => string) {}

  type<T extends Record<string, any>>(summary: T): T {
    if (!summary || !summary.key) return summary;
    const base = `admin.integrations.${summary.key}`;
    const owner = String(summary.owner?.slug || '');
    return {
      ...summary,
      // The tab a type is grouped under names its plugin; the plugin list words that name as `admin.label`.
      ...(summary.owner && owner ? { owner: { ...summary.owner, label: this.text(owner, 'admin.label', summary.owner.label) } } : {}),
      label: this.text(owner, `${base}.label`, summary.label),
      description: this.text(owner, `${base}.description`, summary.description),
      providers: Array.isArray(summary.providers) ? summary.providers.map((provider: any) => this.provider(`${base}.providers`, provider)) : summary.providers,
    };
  }

  private provider(base: string, provider: Record<string, any>): Record<string, any> {
    const slug = String(provider?.dictionary || '');
    if (!slug || !provider.key) return provider;
    const key = `${base}.${provider.key}`;
    return {
      ...provider,
      label: this.text(slug, `${key}.label`, provider.label),
      description: this.text(slug, `${key}.description`, provider.description),
      fields: Array.isArray(provider.fields) ? provider.fields.map((field: any) => this.field(slug, `${key}.fields`, field)) : provider.fields,
    };
  }

  private field(slug: string, base: string, field: Record<string, any>): Record<string, any> {
    if (!field?.name) return field;
    const key = `${base}.${field.name}`;
    return {
      ...field,
      label: this.text(slug, `${key}.label`, field.label),
      description: this.text(slug, `${key}.description`, field.description),
      placeholder: this.text(slug, `${key}.placeholder`, field.placeholder),
      ...(Array.isArray(field.options) ? {
        options: field.options.map((option: any) => ({ ...option, label: this.text(slug, `${key}.options.${option?.value}`, option?.label) })),
      } : {}),
    };
  }

  /** The translation, else the declared text untouched — including `undefined`, so no key is added. */
  private text<T>(slug: string, key: string, declared: T): T | string {
    if (!slug || !declared || declared !== String(declared)) return declared;
    return this.lookup(slug, key) || declared;
  }
}
