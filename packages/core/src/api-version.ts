import { ApplicationUrlUtils } from './application-url-utils';

/**
 * API versioning utilities.
 *
 * @example
 * ApiVersionUtils.prefix()              // "/api/v1"
 * ApiVersionUtils.withVersion('/users') // "/api/v1/users"
 */
export class ApiVersionUtils {
  static readonly DEFAULT_API_BASE_PATH = '/api';
  static readonly DEFAULT_API_VERSION = 'v1';

  static get API_BASE_PATH(): string {
    return ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.API_APP)
      || ApiVersionUtils.DEFAULT_API_BASE_PATH;
  }

  static readFromEnv(): string {
    if (typeof process === 'undefined' || !process?.env) return '';
    return String(
      process.env.NEXT_PUBLIC_API_VERSION ||
        process.env.API_VERSION_PREFIX ||
        process.env.DEFAULT_API_VERSION ||
        ApiVersionUtils.DEFAULT_API_VERSION
    ).trim();
  }

  /** Normalize a version value (e.g., "v1", "1", 1 → "v1"). */
  static normalize(value?: unknown): string {
    const raw = String(value ?? ApiVersionUtils.readFromEnv()).trim();
    if (!raw) return '';
    const withoutApiPrefix = raw.replace(/^\/?api\//i, '').replace(/^\/+/, '');
    const cleaned = withoutApiPrefix.replace(/^\/+|\/+$/g, '');
    if (!cleaned) return '';
    return cleaned.startsWith('v') ? cleaned : `v${cleaned}`;
  }

  /** Build the full API version prefix (e.g., "/api/v1"). */
  static prefix(value?: unknown): string {
    const v = ApiVersionUtils.normalize(value);
    return v ? `${ApiVersionUtils.API_BASE_PATH}/${v}` : ApiVersionUtils.API_BASE_PATH;
  }

  /** Prepend API version prefix to a path. */
  static withVersion(path: string, versionValue?: unknown): string {
    const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
    return `${ApiVersionUtils.prefix(versionValue)}${normalizedPath}`;
  }
}