import { Collection, CollectionQueryInterface, CandidateLookupOptions, UpsertByCandidatesOptions } from '../types';
import { BaseService } from './base-service';

/**
 * Collection Service.
 * 
 * Provides utilities for collection resolution, URL generation, and record lookup.
 * 
 * @example
 * ```typescript
 * import { CoreServices } from '@fromcode119/core';
 * 
 * const services = CoreServices.getInstance();
 * const collection = services.collection.resolveBySlug(collections, 'cms', 'pages');
 * const url = services.collection.generatePreviewUrl('https://example.com', record, collection);
 * ```
 */
export class CollectionService extends BaseService {
  get serviceName(): string {
    return 'CollectionService';
  }

  /**
   * Resolves a collection from the system manifest based on plugin and slug.
   * Handles framework-prefixed slugs, shortSlugs, and plugin context.
   * 
   * @param collections - Array of collections
   * @param pluginSlug - Plugin slug (defaults to "system")
   * @param slug - Collection slug
   * @returns Matching collection or undefined
   */
  resolveBySlug(
    collections: Collection[],
    pluginSlug: string,
    slug: string
  ): Collection | undefined {
    const normSlug = String(slug || '').toLowerCase();
    const normPluginSlug = String(pluginSlug || 'system').toLowerCase();

    return collections.find(c => {
      // Check if the actual collection slug (prefixed) matches the URL slug (short)
      const isSlugMatch = 
        String(c.shortSlug || '').toLowerCase() === normSlug || 
        String(c.slug || '').toLowerCase() === normSlug || 
        String((c as any).unprefixedSlug || '').toLowerCase() === normSlug;

      const isPluginMatch = String(c.pluginSlug || 'system').toLowerCase() === normPluginSlug;
      return isSlugMatch && isPluginMatch;
    });
  }

  /**
   * Generates a preview URL for a record based on global settings and record data.
   * 
   * Priority:
   * 1. Record's customPermalink (if set)
   * 2. Permalink structure with placeholders (:year, :month, :day, :id, :slug)
   * 
   * @param baseUrl - Base URL (e.g., "https://example.com")
   * @param record - Record object with id, slug, createdAt, customPermalink
   * @param collection - Collection definition
   * @param options - Optional permalink structure and prefix
   * @returns Generated preview URL
   */
  generatePreviewUrl(
    baseUrl: string,
    record: any,
    collection: Collection,
    options?: {
      permalinkStructure?: string;
      prefix?: string;
    }
  ): string {
    if (!record || !baseUrl) return '#';

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const prefix = (options?.prefix || '').replace(/^\//, '').replace(/\/$/, '');

    // PRIORITY: If we have an explicit custom permalink override, use it
    if (record.customPermalink) {
      const rawCustomPermalink = String(record.customPermalink || '').trim();
      const isAbsoluteOverride = rawCustomPermalink.startsWith('/');
      let path = rawCustomPermalink.replace(/^\/+/, '');

      // Relative custom permalinks inherit the collection prefix
      // Absolute custom permalinks (starting with "/") bypass it
      if (!isAbsoluteOverride && prefix && !path.startsWith(prefix + '/')) {
        path = `${prefix}/${path}`.replace(/\/+/g, '/');
      }

      return `${cleanBaseUrl}/${path.startsWith('/') ? path.substring(1) : path}?preview=1`;
    }

    // FALLBACK: Use the global structure logic
    const idValue = record.id || 'new';
    const pathValue = record.slug || idValue;
    const structure = options?.permalinkStructure || '/:slug';

    const now = new Date(record.createdAt || Date.now());
    const replacements: Record<string, string> = {
      ':year': now.getFullYear().toString(),
      ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
      ':day': now.getDate().toString().padStart(2, '0'),
      ':id': String(idValue),
      ':slug': String(pathValue),
    };

    let path = structure;
    Object.entries(replacements).forEach(([key, val]) => {
      path = path.replace(key, val);
    });

    // Clean up double slashes and ensure leading slash
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = '/' + path;

    // Prepend the collection-specific prefix
    if (prefix) {
      path = `/${prefix}${path}`;
    }

    return `${cleanBaseUrl}${path}?preview=1`;
  }

  /**
   * Normalizes an API/DB result into a flat array of documents.
   * 
   * @param result - API result (array or object with docs property)
   * @returns Array of documents
   */
  toDocs(result: any): any[] {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.docs)) return result.docs;
    return [];
  }

  /**
   * Finds a record by searching multiple candidate values across multiple fields.
   * Useful for resolving records by slug, permalink, or other identifiers.
   * 
   * @param collection - Collection query interface
   * @param candidates - Array of possible values
   * @param options - Lookup options (fields, scanLimit)
   * @returns Matching record or null
   */
  async findByCandidates(
    collection: CollectionQueryInterface,
    candidates: string[],
    options?: CandidateLookupOptions
  ): Promise<any | null> {
    const fields = options?.fields || ['slug', 'customPermalink', 'path'];
    const scanLimit = options?.scanLimit ?? 2000;
    const normalizedCandidates = Array.from(
      new Set(candidates.map((candidate) => String(candidate || '').trim()).filter(Boolean))
    );

    if (!normalizedCandidates.length) return null;

    // Direct field lookup
    for (const field of fields) {
      for (const candidate of normalizedCandidates) {
        try {
          const direct = await collection.findOne({ [field]: candidate });
          if (direct) return direct;
        } catch {
          // Ignore missing/unsupported columns
        }
      }
    }

    // Fallback: Scan all records
    const candidateSet = new Set(normalizedCandidates);
    const docs = this.toDocs(await collection.find({ limit: scanLimit }));
    return (
      docs.find((doc: any) => {
        const values = fields
          .flatMap((field) => this.collectStringsFromValue(doc?.[field]))
          .map((v) => String(v || '').trim());
        return values.some((value) => candidateSet.has(value));
      }) || null
    );
  }

  /**
   * Finds a record by searching multiple candidate values and upserts it.
   * Updates if found, inserts if not found.
   * 
   * @param collection - Collection query interface
   * @param candidates - Array of possible values
   * @param data - Data to insert or update
   * @param options - Upsert options
   * @returns Object with record and created flag
   */
  async findAndUpsert(
    collection: CollectionQueryInterface,
    candidates: string[],
    data: Record<string, any>,
    options?: UpsertByCandidatesOptions
  ): Promise<{ record: any; created: boolean }> {
    const existing = await this.findByCandidates(collection, candidates, options);
    const idField = options?.idField || 'id';

    if (existing) {
      const where =
        (typeof options?.updateWhere === 'function' && options.updateWhere(existing)) ||
        (existing?.[idField] !== undefined ? { [idField]: existing[idField] } : { slug: existing?.slug });
      const updated = await collection.update(where, data);
      return { record: updated, created: false };
    }

    try {
      const created = await collection.insert(data);
      return { record: created, created: true };
    } catch (insertErr) {
      // If insert failed due to uniqueness race, retry as update
      const retryExisting = await this.findByCandidates(collection, candidates, {
        fields: options?.fields,
        scanLimit: Math.max(options?.scanLimit ?? 2000, 5000)
      });
      if (retryExisting) {
        const where =
          (typeof options?.updateWhere === 'function' && options.updateWhere(retryExisting)) ||
          (retryExisting?.[idField] !== undefined ? { [idField]: retryExisting[idField] } : { slug: retryExisting?.slug });
        const updated = await collection.update(where, data);
        return { record: updated, created: false };
      }
      throw insertErr;
    }
  }

  /**
   * Helper: Recursively collect strings from a value.
   */
  private collectStringsFromValue(input: any): string[] {
    if (typeof input === 'string') return [input];
    if (!input || typeof input !== 'object') return [];
    return Object.values(input).flatMap((value) => this.collectStringsFromValue(value));
  }
}