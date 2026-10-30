import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';

/**
 * The framework's own integrations (email, storage, sign-in, monitoring…) in the console's language.
 *
 * The api translates what a plugin registered from that plugin's dictionary; what the framework
 * registered carries no plugin (`owner.slug` / `dictionary` empty) and is the console's to word:
 *
 *   settings.integrations.types.<type>.label | description
 *   settings.integrations.types.<type>.providers.<provider>.label | description
 *   settings.integrations.types.<type>.providers.<provider>.fields.<field>.label | description | placeholder
 *
 * A key the dictionary lacks leaves the declared text (a technical placeholder such as `smtp.example.com`).
 */
export class FrameworkIntegrationCopy {
  static localize(record: IIntegrationRecord): IIntegrationRecord {
    const base = `settings.integrations.types.${record.key}`;
    const ownType = !record.owner?.slug;
    return {
      ...record,
      label: ownType ? FrameworkIntegrationCopy.text(`${base}.label`, record.label) : record.label,
      description: ownType ? FrameworkIntegrationCopy.text(`${base}.description`, record.description) : record.description,
      providers: (record.providers || []).map((provider) => FrameworkIntegrationCopy.provider(`${base}.providers.${provider.key}`, provider)),
    };
  }

  private static provider(base: string, provider: IIntegrationProvider): IIntegrationProvider {
    if (provider.dictionary) return provider;
    return {
      ...provider,
      label: FrameworkIntegrationCopy.text(`${base}.label`, provider.label),
      description: FrameworkIntegrationCopy.text(`${base}.description`, provider.description),
      fields: provider.fields?.map((field) => FrameworkIntegrationCopy.field(`${base}.fields.${field.name}`, field)),
    };
  }

  private static field(base: string, field: IIntegrationConfigField): IIntegrationConfigField {
    return {
      ...field,
      label: FrameworkIntegrationCopy.text(`${base}.label`, field.label),
      description: FrameworkIntegrationCopy.text(`${base}.description`, field.description),
      placeholder: FrameworkIntegrationCopy.text(`${base}.placeholder`, field.placeholder),
    };
  }

  private static text<T extends string | undefined>(key: string, declared: T): T | string {
    if (!declared) return declared;
    return AdminI18n.optional(key) || declared;
  }
}
