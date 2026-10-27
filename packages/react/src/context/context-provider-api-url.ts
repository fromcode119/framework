import { ApiVersionUtils } from '@fromcode119/core/client';

/** Where a request to the api goes: an absolute address as given, a path under the api's prefix otherwise. */
export class ContextProviderApiUrl {
  static resolve(base: string, path: string): string {
    const normalizedPath = path.trim();
    if (normalizedPath.startsWith('http')) return normalizedPath;
    const apiPrefix = ApiVersionUtils.prefix();
    const relativePath = normalizedPath.startsWith(`${apiPrefix}/`) ? normalizedPath.slice(apiPrefix.length) : normalizedPath;
    return `${base}${apiPrefix}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
  }
}
