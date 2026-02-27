import { ApiPath, buildApiVersionPrefix, normalizeApiVersion } from '@fromcode119/sdk';

export const SERVER_API_VERSION = normalizeApiVersion();
export const SERVER_API_VERSION_PREFIX = buildApiVersionPrefix();
const SERVER_FETCH_TIMEOUT_MS = Number(process.env.SERVER_FETCH_TIMEOUT_MS || 12000);
const DEBUG_SERVER_FETCH = process.env.DEBUG_SERVER_FETCH === '1';

export function buildSystemResolvePath(query: URLSearchParams | string) {
  const queryString = typeof query === 'string' ? query : query.toString();
  return `${ApiPath.SYSTEM.RESOLVE}?${queryString}`;
}

export function buildSettingsCollectionPath(limit = 500) {
  const query = new URLSearchParams();
  query.set('limit', String(limit));
  return `${ApiPath.COLLECTIONS.SETTINGS}?${query.toString()}`;
}

export function buildCollectionLookupPath(collectionSlug: string, options: { id?: string; limit?: number } = {}) {
  const slug = encodeURIComponent(String(collectionSlug || '').trim());
  const query = new URLSearchParams();
  if (options.id) query.set('id', String(options.id));
  query.set('limit', String(options.limit ?? 1));
  return `${ApiPath.COLLECTIONS.BASE}/${slug}?${query.toString()}`;
}

export function extractFirstDoc(result: any): any {
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result?.docs)) return result.docs[0] || null;
  return result?.doc || result || null;
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string };
  return value.name === 'AbortError' || value.code === 'ABORT_ERR';
}

function describeError(error: unknown) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isLikelyFrontendBase(value: string) {
  try {
    const candidate = new URL(value).origin.toLowerCase();
    const configuredFrontendOrigins = [
      process.env.FRONTEND_URL,
      process.env.NEXT_PUBLIC_FRONTEND_URL
    ]
      .map((origin) => String(origin || '').trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).origin.toLowerCase();
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    return configuredFrontendOrigins.includes(candidate);
  } catch {
    return false;
  }
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

export function getServerApiPrefixes() {
  const bases = unique(
    [
      process.env.INTERNAL_API_URL,
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
      'http://localhost:3000',
      'http://localhost:4000'
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter((value) => !isLikelyFrontendBase(value))
      .map(trimTrailingSlash)
  );

  return bases.map((base) => `${base}${SERVER_API_VERSION_PREFIX}`);
}

export async function serverFetchJson(path: string) {
  const prefixes = getServerApiPrefixes();
  let lastError: unknown = null;

  for (const prefix of prefixes) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${prefix}${path}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError) {
    if (isAbortError(lastError)) {
      if (DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Fetch timed out for ${path}`);
      }
    } else {
      console.error(`[frontend] Failed to fetch ${path}: ${describeError(lastError)}`);
    }
  }
  return null;
}

export async function serverFetchResponse(path: string) {
  const prefixes = getServerApiPrefixes();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (const prefix of prefixes) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${prefix}${path}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  if (lastError) {
    if (isAbortError(lastError)) {
      if (DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Fetch response timed out for ${path}`);
      }
    } else {
      console.error(`[frontend] Failed to fetch response ${path}: ${describeError(lastError)}`);
    }
  }
  return null;
}
