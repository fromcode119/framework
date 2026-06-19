import type {
  EntityRecordProviderRegistration,
  RegisteredEntityRecordProvider,
} from './entity-record.interfaces';

/**
 * Registry of entity-record providers.
 *
 * Plugins register a provider (keyed by namespace + slug + key) that returns the
 * records they own for a given person. The framework stays plugin-agnostic: it only
 * stores the providers and hands them to the resolution service.
 *
 * Registration is idempotent per canonical key — re-registering the same provider
 * replaces the previous one, so a plugin re-init never stacks duplicates.
 */
export class PluginEntityRecordsRegistryService {
  private readonly providers = new Map<string, RegisteredEntityRecordProvider>();

  register(registration: EntityRecordProviderRegistration): RegisteredEntityRecordProvider | null {
    const entry = this.createEntry(registration);
    if (!entry) return null;
    this.providers.set(entry.canonicalKey, entry);
    return entry;
  }

  unregister(canonicalKey: string): void {
    this.providers.delete(canonicalKey);
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    const ns = String(namespace || '').trim();
    const slug = String(pluginSlug || '').trim();
    for (const [key, entry] of this.providers.entries()) {
      if (entry.namespace === ns && entry.pluginSlug === slug) {
        this.providers.delete(key);
      }
    }
  }

  list(): RegisteredEntityRecordProvider[] {
    return Array.from(this.providers.values());
  }

  clear(): void {
    this.providers.clear();
  }

  private createEntry(
    registration: EntityRecordProviderRegistration,
  ): RegisteredEntityRecordProvider | null {
    const namespace = String(registration?.namespace || '').trim();
    const pluginSlug = String(registration?.pluginSlug || '').trim();
    const key = String(registration?.key || '').trim();
    const label = String(registration?.label || '').trim();
    if (!namespace || !pluginSlug || !key || typeof registration?.resolve !== 'function') {
      return null;
    }
    return {
      namespace,
      pluginSlug,
      key,
      label: label || key,
      resolve: registration.resolve,
      canonicalKey: `${namespace}:${pluginSlug}:${key}`,
    };
  }
}
