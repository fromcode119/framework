import { LayoutTargetKind } from '@core/layout/enums/layout-target-kind.enum';
import type { IRegisteredThemeLayoutDisableDefinition } from '@core/layout/interfaces/registered-theme-layout-disable-definition.interface';
import type { IRegisteredThemeLayoutReplacementDefinition } from '@core/layout/interfaces/registered-theme-layout-replacement-definition.interface';
import type { IThemeLayoutDisableDefinition } from '@core/layout/interfaces/theme-layout-disable-definition.interface';
import type { IThemeLayoutOverrideRegistration } from '@core/layout/interfaces/theme-layout-override-registration.interface';
import type { IThemeLayoutReplacementDefinition } from '@core/layout/interfaces/theme-layout-replacement-definition.interface';

export class ThemeLayoutOverrideRegistryService {
  private readonly disables = new Map<string, IRegisteredThemeLayoutDisableDefinition>();
  private readonly replacements = new Map<string, IRegisteredThemeLayoutReplacementDefinition>();

  get serviceName(): string {
    return 'ThemeLayoutOverrideRegistryService';
  }

  register(registration: IThemeLayoutOverrideRegistration): void {
    const themeSlug = this.normalizeRequiredString(registration.themeSlug, 'themeSlug');
    this.registerDisables(themeSlug, Array.isArray(registration.disables) ? registration.disables : []);
    this.registerReplacements(themeSlug, Array.isArray(registration.replacements) ? registration.replacements : []);
  }

  listDisables(): IRegisteredThemeLayoutDisableDefinition[] {
    return Array.from(this.disables.values()).map((entry) => ({ ...entry }));
  }

  listReplacements(): IRegisteredThemeLayoutReplacementDefinition[] {
    return Array.from(this.replacements.values()).map((entry) => ({ ...entry }));
  }

  unregisterByTheme(themeSlug: string): void {
    const normalizedThemeSlug = this.normalizeRequiredString(themeSlug, 'themeSlug');

    for (const [canonicalKey, entry] of this.disables.entries()) {
      if (entry.themeSlug === normalizedThemeSlug) {
        this.disables.delete(canonicalKey);
      }
    }

    for (const [canonicalKey, entry] of this.replacements.entries()) {
      if (entry.themeSlug === normalizedThemeSlug) {
        this.replacements.delete(canonicalKey);
      }
    }
  }

  clear(): void {
    this.disables.clear();
    this.replacements.clear();
  }

  private registerDisables(themeSlug: string, entries: IThemeLayoutDisableDefinition[]): void {
    for (const entry of entries) {
      const normalized = this.createDisableEntry(themeSlug, entry);
      if (this.disables.has(normalized.canonicalKey)) {
        throw new Error(`[ThemeLayoutOverrideRegistryService] duplicate theme disable registration: ${normalized.canonicalKey}`);
      }
      this.disables.set(normalized.canonicalKey, normalized);
    }
  }

  private registerReplacements(themeSlug: string, entries: IThemeLayoutReplacementDefinition[]): void {
    for (const entry of entries) {
      const normalized = this.createReplacementEntry(themeSlug, entry);
      if (this.replacements.has(normalized.canonicalKey)) {
        throw new Error(`[ThemeLayoutOverrideRegistryService] duplicate theme replacement registration: ${normalized.canonicalKey}`);
      }
      this.replacements.set(normalized.canonicalKey, normalized);
    }
  }

  private createDisableEntry(
    themeSlug: string,
    entry: IThemeLayoutDisableDefinition,
  ): IRegisteredThemeLayoutDisableDefinition {
    const targetKind = LayoutTargetKind.resolve(this.normalizeRequiredString(String(entry.targetKind ?? ''), 'entry.targetKind'));
    const targetKey = this.normalizeRequiredString(entry.targetKey, 'entry.targetKey');
    const namespace = this.normalizeRequiredString(entry.namespace, 'entry.namespace');
    const pluginSlug = this.normalizeRequiredString(entry.pluginSlug, 'entry.pluginSlug');

    return {
      themeSlug,
      namespace,
      pluginSlug,
      targetKey,
      targetKind,
      priority: this.normalizePriority(entry.priority),
      canonicalKey: `${themeSlug}:${targetKind}:${targetKey}:disable:${namespace}:${pluginSlug}`,
    };
  }

  private createReplacementEntry(
    themeSlug: string,
    entry: IThemeLayoutReplacementDefinition,
  ): IRegisteredThemeLayoutReplacementDefinition {
    const targetKind = LayoutTargetKind.resolve(this.normalizeRequiredString(String(entry.targetKind ?? ''), 'entry.targetKind'));
    const targetKey = this.normalizeRequiredString(entry.targetKey, 'entry.targetKey');
    const namespace = this.normalizeRequiredString(entry.namespace, 'entry.namespace');
    const pluginSlug = this.normalizeRequiredString(entry.pluginSlug, 'entry.pluginSlug');

    return {
      themeSlug,
      namespace,
      pluginSlug,
      targetKey,
      targetKind,
      component: entry.component,
      priority: this.normalizePriority(entry.priority),
      canonicalKey: `${themeSlug}:${targetKind}:${targetKey}:replace:${namespace}:${pluginSlug}:${this.resolveComponentKey(entry.component)}`,
    };
  }

  private resolveComponentKey(component: unknown): string {
    if (typeof component === 'function' && component.name) {
      return component.name;
    }

    if (component && typeof component === 'object') {
      const constructorName = (component as { constructor?: { name?: string } }).constructor?.name;
      if (constructorName) {
        return constructorName;
      }
    }

    return 'anonymous-component';
  }

  private normalizePriority(value?: number): number {
    return Number.isFinite(value) ? Number(value) : 100;
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[ThemeLayoutOverrideRegistryService] ${label} must be a non-empty string`);
    }
    return normalized;
  }
}