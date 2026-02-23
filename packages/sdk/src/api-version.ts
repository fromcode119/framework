/**
 * Shared API version utilities for the Fromcode framework.
 */

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
