import { ApplicationUrlUtils, RuntimeAssetConstants, RuntimeLocationUtils } from '@fromcode119/core/client';
import lucideIconNames from '@react/icons/lucide-icon-names.generated.json';

/**
 * The URL of one Lucide icon's data module: `<this app's origin>[<admin base path>]/fc-runtime/icons/
 * <lucide version>/<kebab>.js`.
 *
 * The modules are emitted into EACH Next app's own `public/` directory (`build:frontend-icons`), so the
 * app that served the document serves its icons — the storefront from its root, the admin from under its
 * base path, exactly as the admin resolves its other public assets (`RuntimeLocationUtils.toAdminPath`).
 * Nothing crosses an origin, and there is no hardcoded host: the origin comes from
 * `ApplicationUrlUtils.inferBrowserBaseUrl` (empty on the server, which yields a root-relative path).
 *
 * The version segment comes from the generated names file, which the drift test pins to the installed
 * lucide-react, so a URL can never point at a version directory the emitter did not write.
 */
export class LucideIconAssetUrl {
  /** The lucide-react version whose data modules are on disk. */
  static get version(): string {
    return lucideIconNames.lucideReact;
  }

  /** Path from the app root: `/fc-runtime/icons/<version>/<kebab>.js`, under the admin base path in the admin. */
  static path(kebab: string): string {
    const relative = `/${RuntimeAssetConstants.SEGMENT}/${RuntimeAssetConstants.ICONS_SEGMENT}/${LucideIconAssetUrl.version}/${kebab}.js`;
    return RuntimeLocationUtils.isAdminRuntime() ? RuntimeLocationUtils.toAdminPath(relative) : relative;
  }

  /** Absolute URL on the current app's origin (root-relative when there is no window). */
  static for(kebab: string): string {
    return ApplicationUrlUtils.joinApiPath(ApplicationUrlUtils.inferBrowserBaseUrl(), LucideIconAssetUrl.path(kebab));
  }
}
