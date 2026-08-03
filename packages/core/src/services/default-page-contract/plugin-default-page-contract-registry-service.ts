import type { IPluginDefaultPageContract } from '@core/default-page-contract/interfaces/plugin-default-page-contract.interface';
import type { IPluginDefaultPageContractRegistration } from '@core/default-page-contract/interfaces/plugin-default-page-contract-registration.interface';
import type { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';
import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

export class PluginDefaultPageContractRegistryService extends BaseService {
  private readonly entries = new Map<string, IRegisteredPluginDefaultPageContract>();

  get serviceName(): string {
    return 'PluginDefaultPageContractRegistryService';
  }

  register(registration: IPluginDefaultPageContractRegistration): IRegisteredPluginDefaultPageContract[] {
    const nextEntries = this.createEntries(registration);
    if (nextEntries.length > 0) {
      this.unregisterByPlugin(nextEntries[0].namespace, nextEntries[0].pluginSlug);
      for (const entry of nextEntries) {
        this.entries.delete(entry.canonicalKey);
      }
    }
    this.assertNoDuplicateKeys(nextEntries);

    for (const entry of nextEntries) {
      this.entries.set(entry.canonicalKey, entry);
    }

    return nextEntries.map((entry) => this.cloneEntry(entry));
  }

  list(): IRegisteredPluginDefaultPageContract[] {
    return Array.from(this.entries.values()).map((entry) => this.cloneEntry(entry));
  }

  listByPlugin(namespace: string, pluginSlug: string): IRegisteredPluginDefaultPageContract[] {
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

  private createEntries(registration: IPluginDefaultPageContractRegistration): IRegisteredPluginDefaultPageContract[] {
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
    contract: IPluginDefaultPageContract,
  ): IRegisteredPluginDefaultPageContract {
    const key = this.normalizeRequiredString(contract.key, 'contract.key');
    const defaultSlug = this.normalizeRequiredString(contract.defaultSlug, 'contract.defaultSlug');
    const capability = this.normalizeRequiredString(contract.capability, 'contract.capability');
    const recipe = this.normalizeRequiredString(contract.recipe, 'contract.recipe');

    return {
      ...contract,
      key,
      // PLUGIN BOUNDARY: plugins compile separately and register these as RAW STRINGS. Hydrate them
      // here or every downstream `mode === PluginDefaultPageContractMaterializationMode.X` comparison
      // is silently false — which stops pages being materialized at all.
      kind: PluginDefaultPageContractKind.resolve(contract.kind),
      materializationMode: PluginDefaultPageContractMaterializationMode.resolve(contract.materializationMode),
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

  private assertNoDuplicateKeys(entries: IRegisteredPluginDefaultPageContract[]): void {
    const incomingKeys = new Set<string>();

    for (const entry of entries) {
      if (incomingKeys.has(entry.canonicalKey)) {
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
    // Manifests supply raw strings, so resolve each to a member and drop anything unrecognised —
    // the old `as` cast silently let unknown dependency names through as if they were valid.
    const resolved = values
      .map((value) => PluginDefaultPageContractDependency.resolve(value))
      .filter((value): value is PluginDefaultPageContractDependency => Boolean(value));
    return Array.from(new Set(resolved));
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

  private cloneEntry(entry: IRegisteredPluginDefaultPageContract): IRegisteredPluginDefaultPageContract {
    return {
      ...entry,
      dependencies: [...entry.dependencies],
      adoptionHints: [...entry.adoptionHints],
      aliases: entry.aliases ? [...entry.aliases] : undefined,
    };
  }
}
