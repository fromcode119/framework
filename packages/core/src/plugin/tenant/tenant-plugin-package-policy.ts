import fs from 'fs';
import path from 'path';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { PluginCapability } from '@core/enums/plugin-capability.enum';
import { PluginPermission } from '@core/security/enums/plugin-permission.enum';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';
import { TenantThemePackagePolicy } from '@core/theme/tenant-theme-package-policy';
import { CoercionUtils } from '@core/utils/coercion-utils';

/**
 * What a SITE is allowed to put in a plugin it uploads.
 *
 * The platform's plugins are curated: an operator installed or reviewed them, so they may migrate
 * the database, declare collections, reach the network and ship admin screens. A site's upload is
 * none of those things. It runs ONLY in its own process under its own user (the scanner refuses to
 * start it any other way), and this policy decides what that process may ask the platform for:
 *
 *  - NO SCHEMA. Migrations are `require()`d inside the api process, and collections become platform
 *    tables — both would let one customer's code change the database every customer shares.
 *  - NO ADMIN UI. An admin bundle runs in the admin origin; a platform administrator opening that
 *    site would execute it with platform rights. A storefront bundle is allowed: it runs where the
 *    site's own theme already runs, in the visitor's browser.
 *  - NO INSTALL STEP. Nothing is `npm install`ed for it: dependencies ship bundled, or not at all.
 *  - A CLOSED SET OF CAPABILITIES. Capabilities are declared by the plugin itself and approved on
 *    enable, so for a site's plugin the list below is the ceiling — routes, hooks, translations
 *    and cache. No network (it would reach the platform's internal services), no filesystem,
 *    no email, no jobs, no other plugins' APIs.
 *
 * REFUSED, NOT STRIPPED: the upload fails and names every reason, as the theme policy does.
 */
export class TenantPluginPackagePolicy {

  /** Everything a site's plugin may declare, as capabilities or permissions. */
  static readonly ALLOWED_CAPABILITIES: readonly string[] = [
    PluginCapability.API.value,
    PluginCapability.HOOKS.value,
    PluginCapability.I18N.value,
    PluginCapability.CACHE.value,
    PluginPermission.API_ROUTES.value,
  ];

  /** Manifest keys that ask the platform to change its schema, its admin, or other plugins. */
  private static readonly FORBIDDEN_MANIFEST_KEYS = [
    'migrations', 'seeds', 'collections', 'dependencies', 'admin', 'uiEntryPoint', 'runtimeModules',
  ] as const;

  /** Directories that only ever hold schema or admin code. */
  private static readonly FORBIDDEN_DIRS = [
    'migrations', PluginPackageLayout.MIGRATIONS_DIR, 'seeds', 'collections', path.join('src', 'collections'), 'node_modules',
  ] as const;

  /** The admin bundle, wherever the layout allows it to sit. */
  private static readonly ADMIN_BUNDLES = [
    path.join(PluginPackageLayout.UI_DIR, PluginPackageLayout.UI_ENTRY),
    path.join('ui', PluginPackageLayout.UI_ENTRY),
  ] as const;

  /** Every reason this package may not be installed for a site. Empty means it may. */
  static violations(contentDir: string, manifest: IPluginManifest): string[] {
    return [
      ...TenantPluginPackagePolicy.manifestViolations(manifest),
      ...TenantPluginPackagePolicy.sandboxViolations(manifest),
      ...TenantPluginPackagePolicy.capabilityViolations(manifest),
      ...TenantPluginPackagePolicy.directoryViolations(contentDir),
      ...TenantPluginPackagePolicy.packageJsonViolations(contentDir),
      ...TenantPluginPackagePolicy.fileViolations(contentDir),
    ];
  }

  /** Size on disk, for the quota. Symlinks are refused by `violations`, and never followed here. */
  static byteSize(contentDir: string): number {
    return TenantThemePackagePolicy.byteSize(contentDir);
  }

  private static manifestViolations(manifest: IPluginManifest): string[] {
    const found: string[] = [];
    const record = manifest as unknown as Record<string, unknown>;
    for (const key of TenantPluginPackagePolicy.FORBIDDEN_MANIFEST_KEYS) {
      if (TenantPluginPackagePolicy.isEmpty(record[key])) continue;
      found.push(TenantPluginPackagePolicy.manifestReason(key));
    }
    return found;
  }

  private static manifestReason(key: string): string {
    if (key === 'admin' || key === 'uiEntryPoint' || key === 'runtimeModules') {
      return `declares "${key}" — a site's plugin adds nothing to the admin, where it would run with the rights of whoever opens it.`;
    }
    if (key === 'dependencies') return 'depends on other plugins — a site\'s plugin stands alone.';
    return `declares "${key}" — a site's plugin does not change the database every site shares.`;
  }

  private static sandboxViolations(manifest: IPluginManifest): string[] {
    const sandbox = manifest.sandbox;
    if (sandbox === false) return ['asks to run inside the platform ("sandbox": false) — a site\'s plugin always runs in its own process.'];
    const record = CoercionUtils.toObject(sandbox);
    if (record.enabled === false) return ['asks to run inside the platform ("sandbox.enabled": false) — a site\'s plugin always runs in its own process.'];
    if (record.allowNative === true) return ['asks for native host access ("sandbox.allowNative") — a site\'s plugin may not have it.'];
    return [];
  }

  private static capabilityViolations(manifest: IPluginManifest): string[] {
    const declared = [...(manifest.capabilities ?? []), ...(manifest.permissions ?? [])]
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
    const refused = [...new Set(declared.filter((value) => !TenantPluginPackagePolicy.ALLOWED_CAPABILITIES.includes(value)))];
    if (!refused.length) return [];
    return [
      `asks for ${refused.map((value) => `"${value}"`).join(', ')}, which a site's plugin may not have `
      + `(allowed: ${TenantPluginPackagePolicy.ALLOWED_CAPABILITIES.join(', ')}).`,
    ];
  }

  private static directoryViolations(contentDir: string): string[] {
    const found: string[] = [];
    for (const name of TenantPluginPackagePolicy.FORBIDDEN_DIRS) {
      if (!TenantPluginPackagePolicy.hasEntries(path.join(contentDir, name))) continue;
      found.push(name === 'node_modules'
        ? 'contains "node_modules/" — bundle dependencies into the plugin\'s own files.'
        : `contains "${name}/" — a site's plugin does not change the database every site shares.`);
    }
    for (const bundle of TenantPluginPackagePolicy.ADMIN_BUNDLES) {
      if (fs.existsSync(path.join(contentDir, bundle))) {
        found.push(`contains an admin bundle ("${bundle}") — a site's plugin adds nothing to the admin.`);
      }
    }
    return found;
  }

  /** npm dependencies would need an install step on the shared box, which a site's plugin never gets. */
  private static packageJsonViolations(contentDir: string): string[] {
    const file = path.join(contentDir, 'package.json');
    if (!fs.existsSync(file)) return [];
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      const needsInstall = ['dependencies', 'optionalDependencies', 'peerDependencies']
        .filter((key) => !TenantPluginPackagePolicy.isEmpty(pkg[key]));
      return needsInstall.length
        ? [`lists npm ${needsInstall.join(' and ')} in package.json — nothing is installed for a site's plugin, so bundle them.`]
        : [];
    } catch {
      return ['has a package.json that is not valid JSON.'];
    }
  }

  /** Symlinks and native addons, anywhere in the package. */
  private static fileViolations(contentDir: string): string[] {
    const found: string[] = [];
    const walk = (dir: string, relative: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        found.push(`could not be read at "${relative || '.'}".`);
        return;
      }
      for (const entry of entries) {
        const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isSymbolicLink()) { found.push(`contains a symbolic link at "${entryRelative}"; an uploaded plugin is plain files.`); continue; }
        if (entry.isDirectory()) { walk(path.join(dir, entry.name), entryRelative); continue; }
        if (path.extname(entry.name).toLowerCase() === '.node') found.push(`contains a native binary at "${entryRelative}".`);
      }
    };
    walk(contentDir, '');
    return found;
  }

  private static hasEntries(dir: string): boolean {
    try {
      return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((name) => !name.startsWith('.'));
    } catch {
      return false;
    }
  }

  private static isEmpty(value: unknown): boolean {
    if (value === undefined || value === null || value === false) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (value instanceof Object) return Object.keys(value).length === 0;
    return String(value).trim() === '';
  }
}
