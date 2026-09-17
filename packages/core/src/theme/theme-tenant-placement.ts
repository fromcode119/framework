import fs from 'fs';
import path from 'path';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { ProjectPaths } from '@core/config/paths';
import { TenantThemePackagePolicy } from '@core/theme/tenant-theme-package-policy';

/**
 * Putting a theme into ONE SITE's own directory, and refusing it when that site has no room.
 *
 * A site installing its own theme is not the platform installing one: the files land under that
 * tenant's directory, where only it can see them, and the space they take is charged against that
 * site's quota. The quota is checked BEFORE the move, because a half-written theme over the limit is
 * worse than a refused one — and the refusal names the sizes in megabytes, since a number of bytes
 * is not something an operator can act on.
 *
 * Split out of `ThemeInstallerService` (441 lines).
 */
export class ThemeTenantPlacement {
  constructor(
    private readonly discoverThemes: () => Promise<void>,
    private readonly findThemeManifestDir: (dir: string) => string | null,
    private readonly moveDir: (src: string, dest: string) => void,
  ) {}

  /**
   * Puts a SITE's theme in its own directory, having refused everything a site may not do.
   *
   * No backup of a replaced directory, unlike the platform path: a site replacing its own theme is
   * replacing something only it can see, and writing a backup archive per upload into the shared
   * backups volume would be a second way for one site to fill the box.
   */
  async placeForTenant(
    sourceDir: string,
    ownerTenantId: string,
    themesMap: Map<string, IThemeManifest>,
    quota: { maxBytes: number; maxThemes: number },
  ): Promise<IThemeManifest> {
    const contentDir = this.findThemeManifestDir(sourceDir);
    if (!contentDir) throw new Error('Invalid theme: theme.json not found anywhere in the package.');
    const manifest: IThemeManifest = JSON.parse(fs.readFileSync(path.join(contentDir, 'theme.json'), 'utf8'));
    const slug = String(manifest.slug ?? '').trim();
    if (!slug) throw new Error('Invalid theme: missing "slug" in theme.json.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new Error(`Invalid theme slug "${slug}". Use lowercase letters, digits and dashes — it becomes a directory name and a URL.`);
    }

    const violations = TenantThemePackagePolicy.violations(contentDir, manifest);
    if (violations.length) {
      throw new Error(
        `This theme cannot be installed for a site because it ${violations.join(' It ')} `
        + 'A site\'s theme renders in the browser only.',
      );
    }

    // Global uniqueness. `place` would delete whatever is at the target, and on a shared box that
    // could be the platform's theme or another customer's — so the answer is a refusal naming the
    // holder, never an overwrite.
    const existing = themesMap.get(slug);
    if (existing && existing.ownerTenantId !== ownerTenantId) {
      throw new Error(
        `The theme slug "${slug}" is already taken on this platform by `
        + `${existing.ownerTenantId ? `another site` : 'the platform'}. Theme slugs are unique across the whole `
        + 'platform, so rename yours — prefixing it with your site name is the usual way.',
      );
    }

    const tenantRoot = ProjectPaths.getThemesDirFor(ownerTenantId);
    const targetDir = path.join(tenantRoot, slug);
    this.assertWithinQuota(tenantRoot, targetDir, contentDir, quota);

    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    this.moveDir(contentDir, targetDir);

    await this.discoverThemes();
    // Nothing else runs. No seeds, no dependency install, no bundled plugins — the policy above has
    // already refused a package that asks for any of them.
    return themesMap.get(slug) || { ...manifest, ownerTenantId };
  }

  /**
   * Refuses an upload that would take the site past what it may store.
   *
   * The themes volume is ONE host directory shared by every tenant on the machine, so an unbounded
   * upload is a denial of service against every other customer, not merely against the uploader.
   * A theme being REPLACED does not count towards the count, and its current size is not counted
   * either — the new copy stands where the old one did.
   */
  private assertWithinQuota(
    tenantRoot: string,
    targetDir: string,
    contentDir: string,
    quota: { maxBytes: number; maxThemes: number },
  ): void {
    const incoming = TenantThemePackagePolicy.byteSize(contentDir);
    if (incoming > quota.maxBytes) {
      throw new Error(
        `This theme is ${ThemeTenantPlacement.megabytes(incoming)} MB, over the `
        + `${ThemeTenantPlacement.megabytes(quota.maxBytes)} MB a site may store in one theme.`,
      );
    }

    let siblings: string[] = [];
    try {
      siblings = fs.existsSync(tenantRoot) ? fs.readdirSync(tenantRoot).filter((name) => !name.startsWith('.')) : [];
    } catch {
      siblings = [];
    }
    const replacing = siblings.includes(path.basename(targetDir));
    if (!replacing && siblings.length >= quota.maxThemes) {
      throw new Error(
        `This site already has ${siblings.length} of its own themes, which is the limit. `
        + 'Delete one before uploading another.',
      );
    }

    const held = siblings
      .filter((name) => name !== path.basename(targetDir))
      .reduce((total, name) => total + TenantThemePackagePolicy.byteSize(path.join(tenantRoot, name)), 0);
    if (held + incoming > quota.maxBytes) {
      throw new Error(
        `This site's themes would total ${ThemeTenantPlacement.megabytes(held + incoming)} MB, over the `
        + `${ThemeTenantPlacement.megabytes(quota.maxBytes)} MB it may store.`,
      );
    }
  }

  private static megabytes(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }
}
