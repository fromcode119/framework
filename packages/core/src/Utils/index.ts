import { Collection, CollectionQueryInterface, CandidateLookupOptions, UpsertByCandidatesOptions } from '../types';
export { API_RESOURCE_PATHS } from '../constants/api-paths';

/**
 * Shared utility functions for the framework core
 */

/**
 * Checks if a value is an object
 */
export function isObject(value: any): boolean {
    return value !== null && typeof value === 'object';
}

/**
 * Checks if a value is a plain object (not an array, Date, etc.)
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Asynchronous delay/sleep
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes locale codes to a standard format (e.g. "en_US" -> "en-us")
 */
export function normalizeLocaleCode(value: any): string {
    return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Reads API version input from environment variables.
 */
export function readApiVersionFromEnv(): string {
    if (typeof process === 'undefined' || !process?.env) return '';
    return String(
        process.env.NEXT_PUBLIC_API_VERSION ||
        process.env.API_VERSION_PREFIX ||
        process.env.DEFAULT_API_VERSION ||
        ''
    ).trim();
}

/**
 * Normalizes API version inputs like "1", "v1", "/api/v1" into "v1".
 * If no value is provided, it uses configured environment version values.
 */
export function normalizeApiVersion(value?: any): string {
    const raw = String(value ?? readApiVersionFromEnv()).trim();
    if (!raw) return '';

    const withoutApiPrefix = raw.replace(/^\/?api\//i, '').replace(/^\/+/, '');
    const cleaned = withoutApiPrefix.replace(/^\/+|\/+$/g, '');
    if (!cleaned) return '';

    return cleaned.startsWith('v') ? cleaned : `v${cleaned}`;
}

/**
 * Builds an API version prefix like "/api/v1" from loose input.
 * Falls back to configured env version; if still empty, returns "/api".
 */
export function buildApiVersionPrefix(value?: any): string {
    const normalizedVersion = normalizeApiVersion(value);
    return normalizedVersion ? `/api/${normalizedVersion}` : '/api';
}

/**
 * Prefixes an API resource path with a normalized version prefix.
 */
export function withApiVersion(path: string, versionValue?: any): string {
    const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
    return `${buildApiVersionPrefix(versionValue)}${normalizedPath}`;
}

/**
 * Validates if a string looks like a locale key (e.g. "en", "en-US")
 */
export function isLocaleLikeKey(key: string): boolean {
    return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(String(key || '').trim());
}

/**
 * Checks if a value is meaningful for localization (not just empty strings/objects)
 */
export function isMeaningfulLocalizedValue(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/**
 * Resolves localized text from a map or string based on preferred locale
 */
export function resolveLocalizedText(value: any, preferredLocale?: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            const resolved = resolveLocalizedText(item, preferredLocale);
            if (resolved) return resolved;
        }
        return '';
    }

    if (typeof value !== 'object') return '';

    const normalizedLocale = normalizeLocaleCode(preferredLocale);

    // 1. Try exact match (e.g. "en-us")
    if (normalizedLocale && value[normalizedLocale]) {
        return resolveLocalizedText(value[normalizedLocale], '');
    }

    // 2. Try language-only match (e.g. "en")
    const langOnly = normalizedLocale.split('-')[0];
    if (langOnly && value[langOnly]) {
        return resolveLocalizedText(value[langOnly], '');
    }

    // 3. Fallback to first available value
    const values = Object.values(value);
    for (const localizedValue of values) {
        const resolved = resolveLocalizedText(localizedValue, '');
        if (resolved) return resolved;
    }

    return '';
}

/**
 * Resolves a collection from the system manifest based on URL slugs.
 * Handles framework-prefixed Slugs, shortSlugs and plugin context.
 */
export function resolveCollection(
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
 * Generates a URL/Path for a record based on global settings and record data.
 */
export function generatePreviewUrl(
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
        let path = record.customPermalink.startsWith('/') ? record.customPermalink.substring(1) : record.customPermalink;

        // If we have a collection prefix, and the custom permalink doesn't already start with it, prepend it
        if (prefix && !path.startsWith(prefix + '/')) {
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
 * Best-effort text extraction that works with strings and block editor payloads
 */
export function extractTextFromContent(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content
        .map((block: any) => {
            if (!block) return '';
            if (typeof block === 'string') return block;
            if (block.content && typeof block.content === 'string') return block.content;
            if (block.text && typeof block.text === 'string') return block.text;
            // Rich text blocks may nest children with text
            if (Array.isArray(block.children)) {
                return block.children
                    .map((child: any) => (child && typeof child.text === 'string' ? child.text : ''))
                    .join(' ');
            }
            return '';
        })
        .filter(Boolean)
        .join(' ');
}

/**
 * Parses a value into a boolean. 
 * Supports strings like "true", "yes", "1", "on" as true.
 */
export function parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return ['true', 'yes', '1', 'on'].includes(lower);
    }
    return false;
}

/**
 * Normalizes a string by trimming it and ensuring it is a string
 */
export function normalizeString(value: any): string {
    return String(value || '').trim();
}

/**
 * Checks if a string looks like JSON (starts with { or [)
 */
export function looksLikeJson(value: string): boolean {
    const trimmed = value.trim();
    return (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
}

/**
 * Recursively collects all strings from an object or array, 
 * including strings found nested inside JSON strings.
 */
export function collectStringValues(input: any): string[] {
    if (typeof input === 'string') {
        if (!looksLikeJson(input)) return [input];
        try {
            return collectStringValues(JSON.parse(input));
        } catch {
            return [input];
        }
    }
    if (!input || typeof input !== 'object') return [];
    
    // Handle null/undefined (already handled by !input)
    
    return Object.values(input).flatMap((value) => collectStringValues(value));
}

/**
 * Sanitizes a key (tag, slug, etc) to be alphanumeric with dashes and underscores
 */
export function sanitizeKey(key: string): string {
    return String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Creates a slug from a string
 */
export function slugify(text: string): string {
    return String(text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD') // Support accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with -
        .replace(/-+/g, '-') // Remove repeated dashes
        .replace(/^-+|-+$/g, ''); // Trim dashes
}

/**
 * Parses shortcode-style attributes from a string
 * Example: 'source="cms" limit=5' -> { source: "cms", limit: "5" }
 */
export function parseAttributes(raw: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pattern = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\]]+))/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(raw)) !== null) {
        const [, key, doubleQuoted, singleQuoted, bare] = match;
        attributes[key] = String(doubleQuoted ?? singleQuoted ?? bare ?? '');
    }

    return attributes;
}

/**
 * Normalizes an API/DB result into a flat array of documents
 */
export function toDocs(result: any): any[] {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.docs)) return result.docs;
    return [];
}

/**
 * Find a record by searching multiple candidate values across multiple fields
 * Useful for resolving records by slug, permalink, or other identifiers
 */
export async function findRecordByCandidates(
    collection: CollectionQueryInterface,
    candidates: string[],
    options?: CandidateLookupOptions
) {
    const fields = options?.fields || ['slug', 'customPermalink', 'path'];
    const scanLimit = options?.scanLimit ?? 2000;
    const normalizedCandidates = Array.from(
        new Set(candidates.map((candidate) => normalizeString(candidate)).filter(Boolean))
    );

    if (!normalizedCandidates.length) return null;

    for (const field of fields) {
        for (const candidate of normalizedCandidates) {
            try {
                const direct = await collection.findOne({ [field]: candidate });
                if (direct) return direct;
            } catch {
                // Ignore missing/unsupported columns for this collection shape.
            }
        }
    }

    const candidateSet = new Set(normalizedCandidates);
    const docs = toDocs(await collection.find({ limit: scanLimit }));
    return (
        docs.find((doc: any) => {
            const values = fields.flatMap((field) => collectStringValues(doc?.[field])).map(normalizeString);
            return values.some((value) => candidateSet.has(value));
        }) || null
    );
}

/**
 * Upsert a record by searching multiple candidate values
 * Updates if found, inserts if not found
 */
export async function upsertRecordByCandidates(
    collection: CollectionQueryInterface,
    candidates: string[],
    data: Record<string, any>,
    options?: UpsertByCandidatesOptions
) {
    const existing = await findRecordByCandidates(collection, candidates, options);
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
        // If insert failed due to a uniqueness race/miss, retry as update by searching again.
        const retryExisting = await findRecordByCandidates(collection, candidates, {
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
