import { BaseService } from '@core/services/base-service';

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
    return false;
  }

  isInternalCollectionIdentifier(value: string): boolean {
    const rawValue = String(value || '').trim().toLowerCase();
    return rawValue.startsWith('_') || this.isPhysicalIdentifier(rawValue);
  }

  createPhysicalSlug(pluginSlug: string, collectionSlug: string): string {
    const normalizedPluginSlug = this.normalizeIdentifierSegment(pluginSlug);
    const normalizedCollectionSlug = this.normalizeIdentifierSegment(collectionSlug);
    if (!normalizedPluginSlug || !normalizedCollectionSlug) {
      return '';
    }

    return `${normalizedPluginSlug}_${normalizedCollectionSlug}`;
  }

  extractPluginSlug(value: string): string {
    const rawValue = String(value || '').trim().toLowerCase();
    if (!rawValue) {
      return '';
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

  /**
   * Resolves a collection reference to the slug a collection is actually registered under.
   *
   * A reference that NAMES a plugin is resolved inside that plugin first. It has to be, because the
   * candidate set for `catalog-categories` includes the bare tail `categories` — and `categories`
   * is the `shortSlug` of a content plugin's collection too. Without the restriction the winner was
   * whichever of the two happened to sit earlier in the registry, so a product's category reference
   * resolved against the content plugin's categories table, every id 404'd, and the admin drew each one as
   * "Deleted item (13)" over a category that existed the whole time. The field was right, the data
   * was right, and the lookup silently crossed a plugin boundary.
   *
   * The unrestricted pass still runs when the restricted one finds nothing, so a bare reference like
   * `media` — no plugin in the name — resolves exactly as before.
   */
  resolveRegisteredSlug(
    rawSlug: string,
    collections: Array<{ slug?: string; shortSlug?: string; pluginSlug?: string; unprefixedSlug?: string }>,
    requestedPluginSlug?: string,
  ): string {
    const rawValue = String(rawSlug || '').trim();
    if (!rawValue) {
      return '';
    }

    const explicitPluginFilter = this.normalizeIdentifierSegment(requestedPluginSlug || '');
    if (explicitPluginFilter) {
      // The caller named the plugin: never widen past it, or the filter would not be one.
      return this.matchRegisteredSlug(rawValue, collections, explicitPluginFilter) || rawValue;
    }

    const impliedPluginFilter = this.normalizeIdentifierSegment(this.extractPluginSlug(rawValue));
    if (impliedPluginFilter) {
      const owned = this.matchRegisteredSlug(rawValue, collections, impliedPluginFilter);
      if (owned) {
        return owned;
      }
    }

    return this.matchRegisteredSlug(rawValue, collections, '') || rawValue;
  }

  private matchRegisteredSlug(
    rawValue: string,
    collections: Array<{ slug?: string; shortSlug?: string; pluginSlug?: string; unprefixedSlug?: string }>,
    pluginFilter: string,
  ): string {
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

    // Empty, not `rawValue`: the caller distinguishes "no collection matched" from "matched itself".
    return '';
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
