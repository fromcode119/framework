import path from 'path';
import fs from 'fs';
import { SystemConstants } from '@core/constants/system.constants';
import { FrameworkRootLocator } from '@core/config/framework-root-locator';
import { UploadPaths } from '@core/config/upload-paths';

/**
 * Shared utility for resolving system paths across the framework core and CLI.
 */

export class ProjectPaths extends UploadPaths {
  /**
   * Where the FRAMEWORK's own extensions live — shipped inside the image, not installed by anyone.
   *
   * Separate from the plugins root on purpose: that one is a mount an operator owns, and a bundled
   * extension must survive whatever is (or is not) mounted there. Everything here is always present
   * and always active; nothing installs or removes it.
   */
  static getBundledPluginsDir(): string {
    const configured = String(process.env.BUNDLED_PLUGINS_DIR || '').trim();
    return ProjectPaths.resolveFromRoot(ProjectPaths.getProjectRoot(), configured || 'bundled-plugins');
  }

  static getPluginsDir(): string {
      const root = ProjectPaths.getProjectRoot();
      const isDev = FrameworkRootLocator.isFrameworkRoot(root);
      const candidates = [
        process.env.PLUGINS_DIR,
        isDev ? '../../plugins' : null,
        isDev ? '../plugins' : null,
        'plugins'
      ]
        .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
        .map((value) => ProjectPaths.resolveFromRoot(root, value as string));

      const deduped = Array.from(new Set(candidates));
      const ranked = deduped
        .map((dir) => ({ dir, manifests: FrameworkRootLocator.countPluginManifests(dir) }))
        .filter((item) => item.manifests > 0)
        .sort((a, b) => b.manifests - a.manifests);
      if (ranked.length > 0) return ranked[0].dir;

      const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
      if (existing) return existing;

      return path.resolve(root, 'plugins');

  }

  static getThemesDir(): string {
      const root = ProjectPaths.getProjectRoot();
      const isDev = FrameworkRootLocator.isFrameworkRoot(root);
      const candidates = [
        process.env.THEMES_DIR,
        isDev ? '../../themes' : null,
        isDev ? '../themes' : null,
        'themes'
      ]
        .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
        .map((value) => ProjectPaths.resolveFromRoot(root, value as string));

      const deduped = Array.from(new Set(candidates));
      const ranked = deduped
        .map((dir) => ({ dir, manifests: FrameworkRootLocator.countThemeManifests(dir) }))
        .filter((item) => item.manifests > 0)
        .sort((a, b) => b.manifests - a.manifests);
      if (ranked.length > 0) return ranked[0].dir;

      const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
      if (existing) return existing;

      return path.resolve(root, 'themes');

  }

  /**
   * Where a SITE's own uploaded themes live: `<themes root>/tenants/<tenantId>`.
   *
   * The platform's themes stay where they have always been, directly under the root. A site's are one
   * level down, under a directory named for it, so the two can never collide on disk and a site's
   * artifacts can be removed with the site itself.
   *
   * Framework-owned path resolution, for the reason {@link withTenantSubdirectory} already gives: a
   * hand-built relative path has broken every image on this platform once. The tenant id is validated
   * here rather than trusted, and an id that fails validation resolves to NO tenant directory rather
   * than to something adjacent.
   */
  static getThemesDirFor(tenantId: string): string {
    return ProjectPaths.tenantArtifactDir(ProjectPaths.getThemesDir(), tenantId);
  }

  /** Where a SITE's own uploaded plugins live: `<plugins root>/tenants/<tenantId>`. See {@link getThemesDirFor}. */
  static getPluginsDirFor(tenantId: string): string {
    return ProjectPaths.tenantArtifactDir(ProjectPaths.getPluginsDir(), tenantId);
  }

  /** The directory holding every site's artifacts under a root — the one `tenants/` level itself. */
  static tenantArtifactsRoot(base: string): string {
    return path.join(base, SystemConstants.STORAGE.TENANTS_SUBDIR);
  }

  /**
   * Is this a directory entry that holds SITES' artifacts rather than an artifact itself?
   *
   * Discovery walks the root looking for theme/plugin directories, and `tenants/` is not one — it is
   * the container for every site's. Asked as a named question rather than compared inline, so the
   * scanners do not each carry their own copy of the literal.
   */
  static isTenantArtifactsDir(name: string): boolean {
    return name === SystemConstants.STORAGE.TENANTS_SUBDIR;
  }

  /**
   * `<base>/tenants/<tenantId>`, or `<base>` itself when the id is missing or malformed.
   *
   * Falling back to the base is the same choice {@link withTenantSubdirectory} makes, and it is the
   * safe one HERE too: a rejected id must never produce a path built from the rejected text.
   */
  private static tenantArtifactDir(base: string, tenantId: string): string {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant || !/^[A-Za-z0-9_-]+$/.test(tenant)) return base;
    return path.join(ProjectPaths.tenantArtifactsRoot(base), tenant);
  }

  static getAppearancesDir(): string {
      const root = ProjectPaths.getProjectRoot();
      const isDev = FrameworkRootLocator.isFrameworkRoot(root);
      // APPEARANCE_DIR is the ONE name for this root — declared per service in compose, exactly as
      // PLUGINS_DIR and THEMES_DIR are. A SHARED_APPEARANCE_DIR used to be consulted first, which
      // meant the same directory had two names and a deployment could set either (or, worse, one
      // each on two services) with nothing to say so. The relative guesses below are the fallback for
      // a checkout that declares nothing.
      const candidates = [
        process.env.APPEARANCE_DIR,
        isDev ? '../../appearance' : null,
        isDev ? '../appearance' : null,
        'appearance'
      ]
        .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
        .map((value) => ProjectPaths.resolveFromRoot(root, value as string));

      const deduped = Array.from(new Set(candidates));
      const ranked = deduped
        .map((dir) => ({ dir, manifests: FrameworkRootLocator.countAppearanceManifests(dir) }))
        .filter((item) => item.manifests > 0)
        .sort((a, b) => b.manifests - a.manifests);
      if (ranked.length > 0) return ranked[0].dir;

      const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
      if (existing) return existing;

      return path.resolve(root, 'appearance');

  }

  static getPackagesDir(): string {
      // Allow explicit override via environment variable
      if (process.env.FROMCODE_PACKAGES_DIR) {
        return path.resolve(process.env.FROMCODE_PACKAGES_DIR);
      }

      const root = ProjectPaths.getProjectRoot();

      // Search upward from project root to find packages directory
      // This works both in framework monorepo and in standalone apps
      const candidates = [
        path.resolve(root, 'packages'),
        path.resolve(root, '..', 'packages'),
        path.resolve(root, '..', '..', 'packages'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          // Verify it's actually a packages directory by checking for core package
          const corePath = path.join(candidate, 'core');
          if (fs.existsSync(corePath) && fs.statSync(corePath).isDirectory()) {
            return candidate;
          }
        }
      }

      // Default fallback
      return path.resolve(root, 'packages');

  }

  static getRepositoryRoot(): string {
      return ProjectPaths.getProjectRoot();

  }

  /**
   * The deployment's own writable directory — `<root>/data`.
   *
   * Already mounted in every topology because the build agent clones into it and backups stage there;
   * its compose comment says outright that its contents are the deployment's and must survive an
   * image upgrade. That is exactly the property generated secrets need, which is why they live here
   * rather than in a directory of their own that an operator would have to know to mount.
   *
   * Deliberately NOT overridable by an environment variable. The whole point of the work this serves
   * is to stop requiring env to run the platform, and a knob that exists only so a test can redirect
   * a write is a control nobody asked for — callers that need another directory are given one.
   */
  static getDataDir(): string {
      return ProjectPaths.resolveFromRoot(ProjectPaths.getProjectRoot(), 'data');
  }

  static getRepositoryArtifactsDir(subDir?: string): string {
      const artifactsRoot = path.resolve(ProjectPaths.getRepositoryRoot(), 'artifacts');
      return subDir ? path.join(artifactsRoot, subDir) : artifactsRoot;

  }

}