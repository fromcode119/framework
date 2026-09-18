import fs from 'fs';
import path from 'path';
import { ManifestNormalizer } from '@core/manifest-normalizer';
import { TypeUtils } from '@core/utils/type-utils';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * InstalledPluginManifestService
 *
 * The manifest.json reading and sandbox/config-carry rules an installed plugin needs, whether it is
 * being discovered at BOOT (`PluginDirectoryScannerService`) or finalized after a HOT install/update
 * (`PluginInstallationService`). The two callers used to diverge here: boot ran `ManifestNormalizer`,
 * lowercased the slug, stamped `ownerTenantId` and merged the operator's persisted sandbox config; a
 * hot install/update parsed the raw manifest and registered it as-is, so a saved memory/timeout limit
 * (or plugin settings) reverted to the platform default the moment a plugin was reinstalled — until
 * the next full api restart put the scanner back in charge.
 *
 * Deliberately does NOT call `PluginPackageLayout.resolve()` — the two callers run it at a different
 * point in their own sequence (see the comment above each call site), so it stays theirs to invoke.
 */
export class InstalledPluginManifestService {
  /**
   * Reads and normalizes `manifest.json` the same way for every caller: `ManifestNormalizer.plugin()`
   * (category default, version fallback from package.json), a lowercased slug, and `ownerTenantId`
   * stamped from the directory it was found in — never left as whatever the manifest itself claims.
   */
  static read(pluginPath: string, ownerTenantId?: string): IPluginManifest {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // `ownerTenantId` is stamped onto the manifest at runtime (from the directory it was found in);
    // it is not part of the authored `IPluginManifest` shape, so this stays `any` until returned.
    const manifest: any = ManifestNormalizer.plugin(raw, pluginPath);

    if (manifest.slug) {
      manifest.slug = manifest.slug.toLowerCase();
    }

    if (ownerTenantId) manifest.ownerTenantId = ownerTenantId;
    else delete manifest.ownerTenantId;

    return manifest as IPluginManifest;
  }

  /**
   * The operator's persisted sandbox config wins over whatever the manifest itself declares — the
   * same rule the boot scanner has always applied. `undefined`/absent defers to the manifest; an
   * empty object says nothing (so a manifest's own `sandbox: false` or object still wins over it);
   * anything else REPLACES the manifest's value outright. Returns the effective value so a caller
   * that also needs it (e.g. `hosts.isIsolated`) does not have to re-derive the same rule.
   */
  static applyPersistedSandbox(
    manifest: IPluginManifest,
    persisted: { sandboxConfig?: unknown } | undefined,
    inMemoryFallback?: unknown,
  ): unknown {
    const hasPersistedSandboxConfig = !!persisted
      && Object.prototype.hasOwnProperty.call(persisted, 'sandboxConfig')
      && persisted.sandboxConfig !== undefined;
    const savedSandboxConfig = hasPersistedSandboxConfig ? persisted!.sandboxConfig : inMemoryFallback;
    // `{}` says nothing about the plugin; a manifest's `sandbox: false` / object must win over it.
    const meaningfulSaved = savedSandboxConfig !== undefined
      && !(TypeUtils.isPlainObject(savedSandboxConfig) && Object.keys(savedSandboxConfig).length === 0);
    const effective = meaningfulSaved ? savedSandboxConfig : (manifest as unknown as { sandbox?: unknown }).sandbox;
    // Default to sandbox enabled unless explicitly set to false.
    const resolved = effective !== undefined ? effective : true;
    (manifest as unknown as { sandbox?: unknown }).sandbox = resolved;
    return resolved;
  }

  /**
   * Carries the operator's own plugin settings forward across a hot reinstall/update. The disk
   * manifest only ever holds the AUTHOR's declared defaults; `manifest.config` is where the running
   * plugin's saved settings live (hydrated at boot, kept current by `savePluginConfig`), and a
   * fresh-from-disk manifest replacing it would silently reset the plugin to its shipped defaults.
   */
  static carryRuntimeState(manifest: IPluginManifest, existing: ILoadedPlugin): void {
    (manifest as unknown as { config?: unknown }).config = (existing.manifest as unknown as { config?: unknown })?.config;
  }
}
