import path from 'path';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { FrameworkRootLocator } from '@core/config/framework-root-locator';

/**
 * Where UPLOADED files live, and the root everything else is resolved against.
 *
 * The base of {@link ProjectPaths} rather than a module beside it: these answers are the ones the
 * rest of the path resolution is built on, and every caller reaches them through `ProjectPaths`
 * exactly as before.
 */
export abstract class UploadPaths {
  /** Where the framework lives — discovered, then cached. See {@link FrameworkRootLocator}. */
  static getProjectRoot(): string {
    return FrameworkRootLocator.getProjectRoot();
  }

  /** Resolve a configured value against the framework root, honouring an absolute override. */
  protected static resolveFromRoot(root: string, value: string): string {
    return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
  }

  /**
   * The uploads directory, resolved against the PROJECT ROOT — never against `process.cwd()`.
   *
   * `STORAGE_UPLOAD_DIR` is set to a RELATIVE value (`./public/uploads`) in the shipped compose file,
   * while the api process runs with cwd `/app/packages/api`. Any consumer that used the env value
   * directly therefore resolved to `/app/packages/api/public/uploads`, which does not exist — the content
   * image optimizer 404'd on EVERY image on the site while the static `/uploads` route (which resolves
   * correctly) served the same files fine. Three call sites had three different resolutions of this one
   * setting; this is the single one.
   */
  static getUploadsDir(): string {
      return UploadPaths.withTenantSubdirectory(UploadPaths.getUploadsRoot());
  }

  /**
   * The uploads directory SHARED by every site — the parent of each site's own.
   *
   * Distinct from {@link getUploadsDir}, which answers with the bound site's subdirectory of this. The
   * two are easy to confuse and the confusion is one-way dangerous: using the ROOT where the site's
   * was meant puts one customer's file where every other customer can read it, while the reverse only
   * fails to find something.
   *
   * Legitimate callers are the ones that are genuinely about the whole tree: the static mount's
   * fallback for files written before sites had their own directories, the free-space check, and
   * anything constructing a driver that will apply the per-site part itself, per request.
   */
  static getUploadsRoot(): string {
      const root = UploadPaths.getProjectRoot();
      const configured = String(process.env[SystemConstants.STORAGE.UPLOAD_DIR_ENV] || '').trim();
      return UploadPaths.resolveFromRoot(root, configured || SystemConstants.STORAGE.DEFAULT_UPLOADS_SUBDIR);
  }

  /**
   * A tenant's files live in their own subdirectory of the uploads root.
   *
   * Single-tenant deployments get the base directory unchanged — every existing installation keeps
   * the paths it already has, and nothing needs moving.
   *
   * PUBLIC because the storage driver's root is an operator-CONFIGURABLE directory, not just this
   * module's default: the same per-site rule has to apply to whatever base they named, and the only
   * honest place to express that is here, where the segment is validated.
   *
   * The tenant id is used as a single path SEGMENT and is validated before use: a tenant id is
   * framework-controlled, but joining an unvalidated identifier into a filesystem path is how
   * traversal bugs happen, so the check is here rather than assumed upstream. Framework-owned path
   * resolution only — a hand-built relative upload path has already broken every image on this
   * platform once.
   */
  static withTenantSubdirectory(base: string): string {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return base;
    if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) return base;
    return path.join(base, SystemConstants.STORAGE.TENANTS_SUBDIR, tenantId);
  }

  /**
   * The PRIVATE uploads directory — files that must never be served statically.
   *
   * Resolved against the project root for the same reason `getUploadsDir` is: a relative env value
   * against a per-process cwd resolved three different ways once already.
   *
   * The caller's contract is that this directory is never passed to `express.static`. `isServedStatically`
   * exists so that invariant can be asserted rather than assumed.
   */
  static getPrivateUploadsDir(): string {
      const root = UploadPaths.getProjectRoot();
      const configured = String(process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV] || '').trim();
      return UploadPaths.resolveFromRoot(root, configured || SystemConstants.STORAGE.DEFAULT_PRIVATE_SUBDIR);
  }

  /**
   * True when `candidate` sits inside `servedDir` and would therefore be reachable from a static mount.
   * Compared on resolved paths with a trailing separator, so `/a/private-x` is not read as being inside
   * `/a/private`.
   */
  static isServedStatically(candidate: string, servedDir: string): boolean {
      const target = path.resolve(String(candidate || ''));
      const served = path.resolve(String(servedDir || ''));
      if (target === served) return true;
      return target.startsWith(served.endsWith(path.sep) ? served : `${served}${path.sep}`);
  }
}
