import type { PhysicalTableReference } from './physical-table-name-utils.interfaces';
import { NamingStrategy } from './naming-strategy';

export class PhysicalTableNameUtils {
  static readonly PLATFORM_PREFIX = 'fcp_' as const;

  static createPluginPrefix(pluginSlug: string): string {
    const normalizedPlugin = NamingStrategy.toSnakeIdentifier(pluginSlug);
    if (!normalizedPlugin) {
      return '';
    }

    return `${PhysicalTableNameUtils.PLATFORM_PREFIX}${normalizedPlugin}_`;
  }

  static create(pluginSlug: string, tableName: string): string {
    const normalizedPlugin = NamingStrategy.toSnakeIdentifier(pluginSlug);
    const normalizedTable = NamingStrategy.toSnakeIdentifier(tableName);
    if (!normalizedPlugin || !normalizedTable) {
      return '';
    }

    return `${PhysicalTableNameUtils.createPluginPrefix(normalizedPlugin)}${normalizedTable}`;
  }

  static hasPlatformPrefix(value: string): boolean {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return normalizedValue.startsWith(PhysicalTableNameUtils.PLATFORM_PREFIX);
  }

  static parse(value: string): PhysicalTableReference | null {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return null;
    }

    if (rawValue.startsWith('@')) {
      return PhysicalTableNameUtils.parseSemanticReference(rawValue);
    }

    if (rawValue.startsWith(PhysicalTableNameUtils.PLATFORM_PREFIX)) {
      return PhysicalTableNameUtils.parsePhysicalName(rawValue);
    }

    return null;
  }

  static toSemanticReference(value: string): string {
    const parsed = PhysicalTableNameUtils.parse(value);
    return parsed?.semanticName || '';
  }

  private static parseSemanticReference(value: string): PhysicalTableReference | null {
    const parts = value.slice(1).split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const pluginSlug = NamingStrategy.toSnakeIdentifier(parts[0]);
    const tableName = NamingStrategy.toSnakeIdentifier(parts.slice(1).join('_'));
    if (!pluginSlug || !tableName) {
      return null;
    }

    return PhysicalTableNameUtils.createReference(pluginSlug, tableName);
  }

  private static parsePhysicalName(value: string): PhysicalTableReference | null {
    const withoutPrefix = value.slice(PhysicalTableNameUtils.PLATFORM_PREFIX.length);
    const separatorIndex = withoutPrefix.indexOf('_');
    if (separatorIndex <= 0 || separatorIndex >= withoutPrefix.length - 1) {
      return null;
    }

    const pluginSlug = NamingStrategy.toSnakeIdentifier(withoutPrefix.slice(0, separatorIndex));
    const tableName = NamingStrategy.toSnakeIdentifier(withoutPrefix.slice(separatorIndex + 1));
    if (!pluginSlug || !tableName) {
      return null;
    }

    return PhysicalTableNameUtils.createReference(pluginSlug, tableName);
  }

  private static createReference(pluginSlug: string, tableName: string): PhysicalTableReference {
    return {
      pluginSlug,
      tableName,
      physicalName: PhysicalTableNameUtils.create(pluginSlug, tableName),
      semanticName: `@${pluginSlug}/${tableName.replace(/_/g, '-')}`,
    };
  }
}
