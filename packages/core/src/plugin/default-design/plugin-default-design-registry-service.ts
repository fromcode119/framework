import type {
  PluginDefaultDesignDefinition,
  PluginDefaultDesignRegistration,
  RegisteredPluginDefaultDesignDefinition,
} from '../../types';

export class PluginDefaultDesignRegistryService {
  private readonly entries = new Map<string, RegisteredPluginDefaultDesignDefinition>();

  get serviceName(): string {
    return 'PluginDefaultDesignRegistryService';
  }

  register(registration: PluginDefaultDesignRegistration): RegisteredPluginDefaultDesignDefinition[] {
    const normalizedEntries = this.createEntries(registration);
    this.assertNoDuplicateKeys(normalizedEntries);

    for (const entry of normalizedEntries) {
      this.entries.set(entry.canonicalKey, entry);
    }

    return normalizedEntries.map((entry) => ({ ...entry }));
  }

  list(): RegisteredPluginDefaultDesignDefinition[] {
    return Array.from(this.entries.values()).map((entry) => ({ ...entry }));
  }

  listPages(): RegisteredPluginDefaultDesignDefinition[] {
    return this.list().filter((entry) => entry.targetKind === 'page');
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    const normalizedNamespace = this.normalizeRequiredString(namespace, 'namespace');
    const normalizedPluginSlug = this.normalizeRequiredString(pluginSlug, 'pluginSlug');

    for (const [canonicalKey, entry] of this.entries.entries()) {
      if (entry.namespace === normalizedNamespace && entry.pluginSlug === normalizedPluginSlug) {
        this.entries.delete(canonicalKey);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private createEntries(registration: PluginDefaultDesignRegistration): RegisteredPluginDefaultDesignDefinition[] {
    const namespace = this.normalizeRequiredString(registration.namespace, 'namespace');
    const pluginSlug = this.normalizeRequiredString(registration.pluginSlug, 'pluginSlug');
    const designs = Array.isArray(registration.designs) ? registration.designs : [];

    if (!designs.length) {
      throw new Error('[PluginDefaultDesignRegistryService] registration must include at least one design');
    }

    return designs.map((design) => this.createEntry(namespace, pluginSlug, design));
  }

  private createEntry(
    namespace: string,
    pluginSlug: string,
    design: PluginDefaultDesignDefinition,
  ): RegisteredPluginDefaultDesignDefinition {
    const targetKind = this.normalizeRequiredString(design.targetKind, 'design.targetKind') as RegisteredPluginDefaultDesignDefinition['targetKind'];
    const targetKey = this.normalizeRequiredString(design.targetKey, 'design.targetKey');
    this.assertPageTargetKey(pluginSlug, targetKind, targetKey);

    return {
      namespace,
      pluginSlug,
      targetKey,
      targetKind,
      component: design.component,
      priority: this.normalizePriority(design.priority),
      required: Boolean(design.required),
      canonicalKey: `${namespace}:${pluginSlug}:${targetKind}:${targetKey}`,
    };
  }

  private assertNoDuplicateKeys(entries: RegisteredPluginDefaultDesignDefinition[]): void {
    const incomingKeys = new Set<string>();

    for (const entry of entries) {
      if (incomingKeys.has(entry.canonicalKey) || this.entries.has(entry.canonicalKey)) {
        throw new Error(`[PluginDefaultDesignRegistryService] duplicate default design registration: ${entry.canonicalKey}`);
      }
      incomingKeys.add(entry.canonicalKey);
    }
  }

  private assertPageTargetKey(pluginSlug: string, targetKind: string, targetKey: string): void {
    if (targetKind !== 'page') {
      return;
    }

    if (!targetKey.startsWith(`${pluginSlug}.`)) {
      throw new Error(
        `[PluginDefaultDesignRegistryService] page targetKey must start with "${pluginSlug}.": ${targetKey}`,
      );
    }
  }

  private normalizePriority(value?: number): number {
    return Number.isFinite(value) ? Number(value) : 0;
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[PluginDefaultDesignRegistryService] ${label} must be a non-empty string`);
    }
    return normalized;
  }
}