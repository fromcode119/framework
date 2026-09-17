import fs from 'fs';
import path from 'path';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { ManifestNormalizer } from '@core/manifest-normalizer';
import { ProjectPaths } from '@core/config/paths';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { ThemeState } from '@core/theme/enums/theme-state.enum';
import type { Logger } from '@core/logging';

/**
 * Finds the themes that exist on disk, and works out which one is active.
 *
 * Two SOURCES, kept apart on purpose: the platform's own themes directory, and the per-tenant
 * directories a site installs into. A tenant's own copy shadows a platform theme of the same slug,
 * because a site that installed one meant to use it.
 *
 * Split out of `ThemeManager` (541 lines). It owns no state: the manifest map is passed BY REFERENCE
 * and the active slug through a setter, the same way `ThemeConfigService` already took that map.
 * That is what keeps ONE manager holding one truth about what is installed, instead of two objects
 * with two maps that drift apart.
 */
export class ThemeDiscoveryService {
  constructor(
    private readonly db: any,
    private readonly logger: Logger,
    private readonly themes: Map<string, IThemeManifest>,
    /** A GETTER, not the value: the manager owns the root and tests relocate it after construction.
     *  Captured by value, a relocation was silently ignored and discovery kept reading the old path. */
    private readonly themesRoot: () => string,
    private readonly setActiveTheme: (slug: string | null) => void,
    private readonly materializeDefaultPages: () => Promise<void>,
    private readonly resolveThemeDirectory: (slug: string) => string,
  ) {}

  /**
   * Every installed theme: the platform's, directly under the root, and each site's own under
   * `tenants/<siteId>/`.
   *
   * One map, keyed by slug, exactly as before — a theme's slug is globally unique whoever owns it,
   * which is what lets the ten registries keyed on it go on working. Ownership rides on the manifest
   * (`ownerTenantId`) and is taken from the DIRECTORY, never from the package: a theme cannot declare
   * itself the platform's.
   *
   * A slug collision between a site's theme and the platform's does not silently resolve here. The
   * upload path refuses it at the door, and if one ever reaches disk anyway the platform's copy wins
   * and the collision is logged, because quietly serving a site's file where the platform's was
   * expected is the worse failure.
   */
  async discoverThemes() {
    this.logger.info(`Scanning for themes in ${this.themesRoot()}...`);
    this.themes.clear();
    if (!fs.existsSync(this.themesRoot())) { fs.mkdirSync(this.themesRoot(), { recursive: true }); return; }

    for (const dir of fs.readdirSync(this.themesRoot())) {
      if (dir.startsWith('.')) continue;
      if (ProjectPaths.isTenantArtifactsDir(dir)) continue;
      this.loadDiscoveredTheme(path.join(this.themesRoot(), dir), dir);
    }
    this.discoverTenantThemes();
  }

  /**
   * Each site's own uploaded themes, one directory per site under `tenants/`.
   *
   * ONE SITE'S BAD DIRECTORY MUST NOT COST EVERY OTHER SITE ITS THEME. These entries are written by
   * upload, so unlike the platform's own they are not curated: a dangling symlink, a directory removed
   * between the readdir and the stat, or a mode nobody can read will throw from `statSync`/`readdirSync`
   * — and an unguarded throw here aborts the whole scan, which means NO themes are discovered at all
   * and every storefront on the box renders with none. So each site is walked inside its own try, and a
   * site that cannot be read is logged and skipped while the rest carry on.
   */
  private discoverTenantThemes(): void {
    const tenantsRoot = ProjectPaths.tenantArtifactsRoot(this.themesRoot());
    if (!fs.existsSync(tenantsRoot)) return;

    let tenantIds: string[] = [];
    try {
      tenantIds = fs.readdirSync(tenantsRoot);
    } catch (e) {
      this.logger.error(`Could not read ${tenantsRoot}; no site's own themes were discovered.`, e);
      return;
    }

    for (const tenantId of tenantIds) {
      if (tenantId.startsWith('.')) continue;
      const tenantRoot = path.join(tenantsRoot, tenantId);
      try {
        if (!fs.statSync(tenantRoot).isDirectory()) continue;
        for (const dir of fs.readdirSync(tenantRoot)) {
          if (dir.startsWith('.')) continue;
          this.loadDiscoveredTheme(path.join(tenantRoot, dir), `${tenantId}/${dir}`, tenantId);
        }
      } catch (e) {
        this.logger.error(
          `Could not read the themes of site "${tenantId}" at ${tenantRoot}. That site has no theme of `
          + 'its own until this is fixed; every other site is unaffected.',
          e,
        );
      }
    }
  }

  /** Reads one theme directory into the map. `ownerTenantId` absent means the platform owns it. */
  private loadDiscoveredTheme(themePath: string, label: string, ownerTenantId?: string): void {
    const manifestPath = path.join(themePath, 'theme.json');
    if (!fs.existsSync(manifestPath)) return;
    try {
      const manifest: IThemeManifest = ManifestNormalizer.theme(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), themePath);
      const existing = this.themes.get(manifest.slug);
      if (existing) {
        this.logger.error(
          `Theme slug "${manifest.slug}" is claimed twice on disk — keeping `
          + `${existing.ownerTenantId ? `site "${existing.ownerTenantId}"'s` : "the platform's"} copy and ignoring `
          + `${ownerTenantId ? `site "${ownerTenantId}"'s` : "the platform's"} at ${label}. A slug is unique across the `
          + 'whole platform; the upload path refuses a duplicate, so this one reached disk another way.',
        );
        if (!existing.ownerTenantId) return;
        if (!ownerTenantId) this.themes.set(manifest.slug, { ...manifest, ownerTenantId });
        return;
      }
      this.themes.set(manifest.slug, ownerTenantId ? { ...manifest, ownerTenantId } : manifest);
      this.logger.info(
        `Discovered theme: ${manifest.slug} v${manifest.version}`
        + (ownerTenantId ? ` (uploaded by site "${ownerTenantId}")` : ''),
      );
    } catch (e) {
      this.logger.error(`Failed to load theme manifest from ${label}`, e);
    }
  }

  loadThemeManifestFromDisk(slug: string): IThemeManifest | null {
    try {
      const themeDirectory = this.resolveThemeDirectory(slug);
      const manifestPath = path.join(themeDirectory, 'theme.json');
      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      const manifest: IThemeManifest = ManifestNormalizer.theme(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), themeDirectory);
      this.themes.set(manifest.slug, manifest);
      return manifest;
    } catch (error) {
      this.logger.warn(`Failed to refresh theme manifest for ${slug}: ${(error as Error).message}`);
      return null;
    }
  }

  async loadActiveTheme() {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value });
      if (row) {
        this.setActiveTheme(row.slug);
        this.logger.info(`Active theme set to: ${row.slug}`);
        // Boot has no tenant. On a multi-tenant deployment default pages are tenant-scoped rows, so
        // materializing here would write orphans no tenant can see (T0 §8.8's shape) — each tenant's
        // pages are materialized when ITS theme is activated, on its own connection.
        if (!TenantMode.isEnabled()) await this.materializeDefaultPages();
      }
    } catch (e) { this.logger.error("Failed to load active theme from DB", e); }
  }
}
