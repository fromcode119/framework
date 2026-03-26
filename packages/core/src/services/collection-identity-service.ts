import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { BaseService } from './base-service';

export class CollectionIdentityService extends BaseService {
  get serviceName(): string {
    return 'CollectionIdentityService';
  }

  normalizeKey(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
  }

  isPhysicalIdentifier(value: string): boolean {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return PhysicalTableNameUtils.hasPlatformPrefix(normalizedValue);
  }

  isInternalCollectionIdentifier(value: string): boolean {
    const rawValue = String(value || '').trim().toLowerCase();
    return rawValue.startsWith('_') || this.isPhysicalIdentifier(rawValue);
  }

  createPhysicalSlug(pluginSlug: string, collectionSlug: string): string {
    return PhysicalTableNameUtils.create(pluginSlug, collectionSlug);
  }

  extractPluginSlug(value: string): string {
    const rawValue = String(value || '').trim().toLowerCase();
    if (!rawValue) {
      return '';
    }

    const parsedReference = PhysicalTableNameUtils.parse(rawValue);
    if (parsedReference) {
      return parsedReference.pluginSlug;
    }

    if (rawValue.startsWith('@')) {
      const parts = rawValue.slice(1).split('/').filter(Boolean);
      return parts[0] || '';
    }

    if (rawValue.includes('/')) {
      const parts = rawValue.split('/').filter(Boolean);
      return parts.length >= 2 ? this.normalizeIdentifierSegment(parts[0]) : '';
    }

    const separator = rawValue.includes('-') ? '-' : rawValue.includes('_') ? '_' : '';
    if (!separator) {
      return '';
    }

    const parts = rawValue.split(separator).filter(Boolean);
    return parts.length >= 2 ? this.normalizeIdentifierSegment(parts[0]) : '';
  }

  buildReferenceCandidates(value: string, requestedPluginSlug?: string): string[] {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return [];
    }

    const candidates = new Set<string>();
    const push = (candidate: unknown) => {
      const normalizedCandidate = String(candidate || '').trim();
      if (!normalizedCandidate) {
        return;
      }

      candidates.add(normalizedCandidate);
      candidates.add(normalizedCandidate.replace(/_/g, '-'));
      candidates.add(normalizedCandidate.replace(/-/g, '_'));
    };

    push(rawValue);

    const parsedReference = PhysicalTableNameUtils.parse(rawValue);
    if (parsedReference) {
      push(parsedReference.physicalName);
      push(parsedReference.semanticName);
      push(parsedReference.tableName);
      push(parsedReference.tableName.replace(/_/g, '-'));
      push(`${parsedReference.pluginSlug}-${parsedReference.tableName.replace(/_/g, '-')}`);
      return Array.from(candidates);
    }

    const pluginSlug = this.normalizeIdentifierSegment(requestedPluginSlug || this.extractPluginSlug(rawValue));
    const collectionSlug = this.resolveCollectionTail(rawValue, pluginSlug);
    if (collectionSlug) {
      push(collectionSlug);
      push(collectionSlug.replace(/_/g, '-'));
    }

    if (pluginSlug && collectionSlug) {
      push(`@${pluginSlug}/${collectionSlug.replace(/_/g, '-')}`);
      push(`${pluginSlug}-${collectionSlug.replace(/_/g, '-')}`);
      push(this.createPhysicalSlug(pluginSlug, collectionSlug));
    }

    return Array.from(candidates);
  }

  resolveRegisteredSlug(
    rawSlug: string,
    collections: Array<{ slug?: string; shortSlug?: string; pluginSlug?: string; unprefixedSlug?: string }>,
    requestedPluginSlug?: string,
  ): string {
    const rawValue = String(rawSlug || '').trim();
    if (!rawValue) {
      return '';
    }

    const pluginFilter = this.normalizeIdentifierSegment(requestedPluginSlug || '');
    const candidates = new Set(
      this.buildReferenceCandidates(rawValue, pluginFilter).map((candidate) => this.normalizeKey(candidate)),
    );

    for (const collection of collections || []) {
      const collectionPluginSlug = this.normalizeIdentifierSegment(collection?.pluginSlug || 'system');
      if (pluginFilter && collectionPluginSlug !== pluginFilter) {
        continue;
      }

      const semanticReference = collectionPluginSlug && collection?.shortSlug
        ? `@${collectionPluginSlug}/${String(collection.shortSlug).trim().replace(/_/g, '-')}`
        : '';
      const combinedReference = collectionPluginSlug && collection?.shortSlug
        ? `${collectionPluginSlug}-${String(collection.shortSlug).trim().replace(/_/g, '-')}`
        : '';

      const probes = [
        collection?.slug,
        collection?.shortSlug,
        collection?.unprefixedSlug,
        semanticReference,
        combinedReference,
      ]
        .map((candidate) => this.normalizeKey(candidate))
        .filter(Boolean);

      if (probes.some((probe) => candidates.has(probe))) {
        return String(collection?.slug || rawValue);
      }
    }

    return rawValue;
  }

  private normalizeIdentifierSegment(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  private resolveCollectionTail(rawValue: string, pluginSlug: string): string {
    if (!rawValue) {
      return '';
    }

    if (rawValue.startsWith('@')) {
      const parts = rawValue.slice(1).split('/').filter(Boolean);
      return this.normalizeIdentifierSegment(parts.slice(1).join('_'));
    }

    if (rawValue.includes('/')) {
      const parts = rawValue.split('/').filter(Boolean);
      return this.normalizeIdentifierSegment(parts.slice(1).join('_'));
    }

    const normalizedValue = String(rawValue || '').trim().toLowerCase();
    const kebabPrefix = pluginSlug ? `${pluginSlug.replace(/_/g, '-')}-` : '';
    const snakePrefix = pluginSlug ? `${pluginSlug}_` : '';
    if (kebabPrefix && normalizedValue.startsWith(kebabPrefix)) {
      return this.normalizeIdentifierSegment(normalizedValue.slice(kebabPrefix.length));
    }
    if (snakePrefix && normalizedValue.startsWith(snakePrefix)) {
      return this.normalizeIdentifierSegment(normalizedValue.slice(snakePrefix.length));
    }

    return this.normalizeIdentifierSegment(normalizedValue);
  }
}
