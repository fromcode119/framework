import type {
  PluginLayoutDefinition,
  PluginLayoutRegistration,
  RegisteredPluginLayoutDefinition,
} from '../../types';

export class PluginLayoutRegistryService {
  private readonly entries = new Map<string, RegisteredPluginLayoutDefinition>();

  get serviceName(): string {
    return 'PluginLayoutRegistryService';
  }

  register(registration: PluginLayoutRegistration): RegisteredPluginLayoutDefinition[] {
    const normalizedEntries = this.createEntries(registration);
    this.assertNoDuplicateKeys(normalizedEntries);

    for (const entry of normalizedEntries) {
      this.entries.set(entry.canonicalKey, entry);
    }

    return normalizedEntries.map((entry) => ({ ...entry }));
  }

  list(): RegisteredPluginLayoutDefinition[] {
    return Array.from(this.entries.values()).map((entry) => ({ ...entry }));
  }

  listPages(): RegisteredPluginLayoutDefinition[] {
    return this.list().filter((entry) => entry.targetKind === 'page');
  }

  listByTargetKind(targetKind: RegisteredPluginLayoutDefinition['targetKind']): RegisteredPluginLayoutDefinition[] {
    return this.list().filter((entry) => entry.targetKind === targetKind);
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

  private createEntries(registration: PluginLayoutRegistration): RegisteredPluginLayoutDefinition[] {
    const namespace = this.normalizeRequiredString(registration.namespace, 'namespace');
    const pluginSlug = this.normalizeRequiredString(registration.pluginSlug, 'pluginSlug');
    const layouts = Array.isArray(registration.layouts) ? registration.layouts : [];

    if (!layouts.length) {
      throw new Error('[PluginLayoutRegistryService] registration must include at least one design');
    }

    return layouts.map((design) => this.createEntry(namespace, pluginSlug, design));
  }

  private createEntry(
    namespace: string,
    pluginSlug: string,
    design: PluginLayoutDefinition,
  ): RegisteredPluginLayoutDefinition {
    const targetKind = this.normalizeRequiredString(design.targetKind, 'design.targetKind') as RegisteredPluginLayoutDefinition['targetKind'];
    const targetKey = this.normalizeRequiredString(design.targetKey, 'design.targetKey');
    this.assertTargetKey(pluginSlug, targetKind, targetKey);

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

  private assertNoDuplicateKeys(entries: RegisteredPluginLayoutDefinition[]): void {
    const incomingKeys = new Set<string>();

    for (const entry of entries) {
      if (incomingKeys.has(entry.canonicalKey) || this.entries.has(entry.canonicalKey)) {
        throw new Error(`[PluginLayoutRegistryService] duplicate default design registration: ${entry.canonicalKey}`);
      }
      incomingKeys.add(entry.canonicalKey);
    }
  }

  private assertTargetKey(pluginSlug: string, targetKind: string, targetKey: string): void {
    if (!targetKey.startsWith(`${pluginSlug}.`)) {
      throw new Error(
        `[PluginLayoutRegistryService] ${targetKind} targetKey must start with "${pluginSlug}.": ${targetKey}`,
      );
    }
  }

  private normalizePriority(value?: number): number {
    return Number.isFinite(value) ? Number(value) : 0;
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[PluginLayoutRegistryService] ${label} must be a non-empty string`);
    }
    return normalized;
  }
}
