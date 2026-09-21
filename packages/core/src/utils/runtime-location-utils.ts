import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { RequestSurfaceUtils } from '@core/utils/request-surface-utils';
import { EnvUtils } from '@core/utils/env-utils';

export class RuntimeLocationUtils {
  static getCurrentPathname(): string {
    return RuntimeLocationUtils.readCurrentUrl()?.pathname || '';
  }

  static toAdminPath(path: string): string {
    return RuntimeLocationUtils.prefixBasePath(
      path,
      RuntimeLocationUtils.resolveCurrentAdminBasePath(),
    );
  }

  static isAdminRuntime(): boolean {
    const currentUrl = RuntimeLocationUtils.readCurrentUrl();
    if (!currentUrl) {
      return false;
    }

    return ApplicationUrlUtils.hasHostRole(currentUrl, ApplicationUrlUtils.ADMIN_APP)
      || RequestSurfaceUtils.isAdminPath(currentUrl.pathname);
  }

  static isFrontendRuntime(): boolean {
    const currentUrl = RuntimeLocationUtils.readCurrentUrl();
    if (!currentUrl) {
      return false;
    }

    return ApplicationUrlUtils.hasHostRole(currentUrl, ApplicationUrlUtils.FRONTEND_APP)
      || RequestSurfaceUtils.isFrontendPath(currentUrl.pathname);
  }

  static getAdminBasePath(): string {
    return ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || RequestSurfaceUtils.ADMIN_BASE_PATH;
  }

  static prefixBasePath(path: string, basePath: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBasePath = RuntimeLocationUtils.normalizeBasePath(basePath);
    if (!normalizedBasePath) {
      return normalizedPath;
    }
    if (normalizedPath === normalizedBasePath || normalizedPath.startsWith(`${normalizedBasePath}/`)) {
      return normalizedPath;
    }
    return normalizedPath === '/' ? normalizedBasePath : `${normalizedBasePath}${normalizedPath}`;
  }

  private static readCurrentUrl(): URL | null {
    if (EnvUtils.isServer()) {
      return null;
    }

    try {
      return new URL(window.location.href);
    } catch {
      return null;
    }
  }

  /**
   * Where the console is mounted on the page currently being viewed.
   *
   * THE SEGMENT COMES FROM CONFIGURATION, never from a word in this file. This used to search the
   * pathname for the literal segment `admin` — so the console could only ever be mounted somewhere
   * containing that exact word, and a deployment that configured any other prefix built links that
   * silently pointed nowhere. A name no operator chose, deciding behaviour, is the same fault as
   * routing a host to the api because it started with `api.`.
   *
   * The current pathname is still what decides, because the configured value alone cannot tell a
   * console served at the ROOT of its own host from one served under a prefix — and a dedicated
   * admin host has no prefix at all, so prefixing its links would break every one of them. What the
   * pathname is checked AGAINST is the declared value.
   *
   * No pathname to read (server-side rendering) falls back to the declared value, as before.
   */
  private static resolveCurrentAdminBasePath(): string {
    const pathname = RuntimeLocationUtils.getCurrentPathname();
    if (!pathname) {
      return RuntimeLocationUtils.getAdminBasePath();
    }

    const configured = RuntimeLocationUtils.normalizeBasePath(RuntimeLocationUtils.getAdminBasePath());
    if (!configured) {
      return '';
    }

    // Served under the configured prefix, or at the root of a host of its own. Those are the only
    // two shapes, and the pathname says which without anything here knowing what the prefix is called.
    return pathname === configured || pathname.startsWith(`${configured}/`) ? configured : '';
  }

  private static normalizeBasePath(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed === '/') {
      return '';
    }

    return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
  }
}