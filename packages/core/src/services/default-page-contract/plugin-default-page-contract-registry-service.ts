import type {
  PluginDefaultPageContract,
  PluginDefaultPageContractDependency,
  PluginDefaultPageContractRegistration,
  RegisteredPluginDefaultPageContract,
} from '../../types';
import { BaseService } from '../base-service';

export class PluginDefaultPageContractRegistryService extends BaseService {
  private readonly entries = new Map<string, RegisteredPluginDefaultPageContract>();

  get serviceName(): string {
    return 'PluginDefaultPageContractRegistryService';
  }

  register(registration: PluginDefaultPageContractRegistration): RegisteredPluginDefaultPageContract[] {
    const nextEntries = this.createEntries(registration);
    this.assertNoDuplicateKeys(nextEntries);

    for (const entry of nextEntries) {
      this.entries.set(entry.canonicalKey, entry);
    }

    return nextEntries.map((entry) => this.cloneEntry(entry));
  }

  list(): RegisteredPluginDefaultPageContract[] {
    return Array.from(this.entries.values()).map((entry) => this.cloneEntry(entry));
  }

  listByPlugin(namespace: string, pluginSlug: string): RegisteredPluginDefaultPageContract[] {
    const expectedNamespace = this.normalizeRequiredString(namespace, 'namespace');
    const expectedPluginSlug = this.normalizeRequiredString(pluginSlug, 'pluginSlug');

    return this.list().filter((entry) => {
      return entry.namespace === expectedNamespace && entry.pluginSlug === expectedPluginSlug;
    });
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    const expectedNamespace = this.normalizeRequiredString(namespace, 'namespace');
    const expectedPluginSlug = this.normalizeRequiredString(pluginSlug, 'pluginSlug');

    for (const [canonicalKey, entry] of this.entries.entries()) {
      if (entry.namespace === expectedNamespace && entry.pluginSlug === expectedPluginSlug) {
        this.entries.delete(canonicalKey);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private createEntries(registration: PluginDefaultPageContractRegistration): RegisteredPluginDefaultPageContract[] {
    const namespace = this.normalizeRequiredString(registration.namespace, 'namespace');
    const pluginSlug = this.normalizeRequiredString(registration.pluginSlug, 'pluginSlug');
    const contracts = Array.isArray(registration.contracts) ? registration.contracts : [];

    if (!contracts.length) {
      throw new Error('[PluginDefaultPageContractRegistryService] registration must include at least one contract');
    }

    return contracts.map((contract) => this.createEntry(namespace, pluginSlug, contract));
  }

  private createEntry(
    namespace: string,
    pluginSlug: string,
    contract: PluginDefaultPageContract,
  ): RegisteredPluginDefaultPageContract {
    const key = this.normalizeRequiredString(contract.key, 'contract.key');
    const defaultSlug = this.normalizeRequiredString(contract.defaultSlug, 'contract.defaultSlug');
    const capability = this.normalizeRequiredString(contract.capability, 'contract.capability');
    const recipe = this.normalizeRequiredString(contract.recipe, 'contract.recipe');

    return {
      ...contract,
      key,
      defaultSlug,
      recordCollection: this.normalizeOptionalString(contract.recordCollection),
      capability,
      recipe,
      dependencies: this.normalizeDependencyArray(contract.dependencies),
      adoptionHints: this.normalizeStringArray(contract.adoptionHints),
      aliases: this.normalizeOptionalStringArray(contract.aliases),
      namespace,
      pluginSlug,
      canonicalKey: `${namespace}:${pluginSlug}:${key}`,
    };
  }

  private assertNoDuplicateKeys(entries: RegisteredPluginDefaultPageContract[]): void {
    const incomingKeys = new Set<string>();

    for (const entry of entries) {
      if (incomingKeys.has(entry.canonicalKey) || this.entries.has(entry.canonicalKey)) {
        throw new Error(
          `[PluginDefaultPageContractRegistryService] duplicate default page contract registration: ${entry.canonicalKey}`,
        );
      }

      incomingKeys.add(entry.canonicalKey);
    }
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[PluginDefaultPageContractRegistryService] ${label} must be a non-empty string`);
    }
    return normalized;
  }

  private normalizeOptionalStringArray(values?: string[]): string[] | undefined {
    const normalized = this.normalizeStringArray(values || []);
    return normalized.length ? normalized : undefined;
  }

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private normalizeDependencyArray(values: PluginDefaultPageContractDependency[]): PluginDefaultPageContractDependency[] {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    ) as PluginDefaultPageContractDependency[];
  }

  private normalizeStringArray(values: string[]): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );
  }

  private cloneEntry(entry: RegisteredPluginDefaultPageContract): RegisteredPluginDefaultPageContract {
    return {
      ...entry,
      dependencies: [...entry.dependencies],
      adoptionHints: [...entry.adoptionHints],
      aliases: entry.aliases ? [...entry.aliases] : undefined,
    };
  }
}
