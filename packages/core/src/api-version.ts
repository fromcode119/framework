import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { ApiVersionDefaults } from '@core/constants/api-version-defaults.constants';

/**
 * Where the api's routes live: directly under its base path (`/api/...`). There is no version
 * segment and nothing configures one. An address handed out while `/api/...` was served keeps
 * working through the api's legacy alias (`UnversionedApiAliasMiddleware`), never through this class.
 *
 * @example
 * ApiVersionUtils.prefix()              // "/api"
 * ApiVersionUtils.withVersion('/users') // "/api/users"
 */
export class ApiVersionUtils {
  static readonly DEFAULT_API_BASE_PATH = ApiVersionDefaults.BASE_PATH;

  static get API_BASE_PATH(): string {
    return ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.API_APP)
      || ApiVersionUtils.DEFAULT_API_BASE_PATH;
  }

  /** The prefix every api route is mounted at (e.g. "/api"). */
  static prefix(): string {
    return ApiVersionUtils.API_BASE_PATH;
  }

  /** Prepend the api prefix to a path. */
  static withVersion(path: string): string {
    const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
    return `${ApiVersionUtils.prefix()}${normalizedPath}`;
  }
}
