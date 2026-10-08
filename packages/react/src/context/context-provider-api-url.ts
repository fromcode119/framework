import { ApiVersionUtils } from '@fromcode119/core/client';

/** Where a request to the api goes: an absolute address as given, a path under the api's base and version otherwise. */
export class ContextProviderApiUrl {
  static resolve(base: string, path: string): string {
    const normalizedPath = path.trim();
    if (normalizedPath.startsWith('http')) return normalizedPath;
    const versionPrefix = ApiVersionUtils.prefix(ApiVersionUtils.normalize());
    const relativePath = normalizedPath.startsWith(versionPrefix) ? normalizedPath.slice(versionPrefix.length) : normalizedPath;
    return `${base}${versionPrefix}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
  }
}
