import { buildApiVersionPrefix } from './api-version';
import { ApiPath } from './constants';

function collectionsBasePath(): string {
  return `${buildApiVersionPrefix()}${ApiPath.COLLECTIONS.BASE}`;
}

export type CollectionQueryPrimitive = string | number | boolean | null | undefined;

export interface CollectionListPathOptions {
  limit?: number;
  search?: string;
  filters?: Record<string, CollectionQueryPrimitive>;
}

const normalizeCollectionSlug = (value: string): string => String(value || '').trim();

const encodePath = (value: string): string => encodeURIComponent(String(value || '').trim());

const appendParam = (params: URLSearchParams, key: string, value: CollectionQueryPrimitive) => {
  if (value === undefined || value === null) return;
  const text = String(value).trim();
  if (!text) return;
  params.set(key, text);
};

export function buildCollectionListPath(collectionSlug: string, options: CollectionListPathOptions = {}): string {
  const slug = normalizeCollectionSlug(collectionSlug);
  if (!slug) return collectionsBasePath();

  const params = new URLSearchParams();

  const limit = Number(options.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(limit));
  }

  appendParam(params, 'search', options.search);

  const filters = options.filters || {};
  for (const [key, value] of Object.entries(filters)) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) continue;
    appendParam(params, normalizedKey, value);
  }

  const query = params.toString();
  const basePath = `${collectionsBasePath()}/${encodePath(slug)}`;
  return query ? `${basePath}?${query}` : basePath;
}

export function buildCollectionDocPath(collectionSlug: string, recordId: string | number): string {
  const slug = normalizeCollectionSlug(collectionSlug);
  const id = String(recordId || '').trim();
  if (!slug || !id) return collectionsBasePath();
  return `${collectionsBasePath()}/${encodePath(slug)}/${encodePath(id)}`;
}

export function extractCollectionDocs(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.docs)) return response.docs;
  return [];
}

