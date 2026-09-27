import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { TenantPluginPackagePolicy } from '@core/plugin/tenant/tenant-plugin-package-policy';

/**
 * The conditions a SITE's plugin runs under, applied every time one is discovered — not only when it
 * is uploaded. A file placed in `plugins/tenants/<site>/` by any other route (a restore, a copy, an
 * older release) meets the same rules, because discovery is what actually starts code.
 *
 *  - It passes the package policy, re-read from disk.
 *  - It runs in its OWN PROCESS UNDER ITS OWN USER. The platform's isolation default and an
 *    operator's saved sandbox choice do not apply: a site's code never runs inside the api, and never
 *    as the same user as another plugin. Where the box cannot drop identity (no privileged spawner),
 *    it does not run at all.
 *  - Nothing is installed for it: no npm step on the shared box.
 */
export class TenantPluginRunRules {
  /** Why this site's plugin must not be started, or null when it may. */
  static refusal(pluginPath: string, manifest: IPluginManifest, hosts: { isolatesIdentity(): boolean } | null | undefined): string | null {
    if (!hosts) {
      return 'Plugin isolation is not available on this server, and a site\'s plugin runs only isolated.';
    }
    if (!hosts.isolatesIdentity()) {
      return 'This server cannot run a plugin under its own user (no privileged spawner), and a site\'s plugin runs only that way.';
    }
    const violations = TenantPluginPackagePolicy.violations(pluginPath, manifest);
    return violations.length ? `This site's plugin ${violations.join(' It ')}` : null;
  }

  /** The sandbox a site's plugin runs with: whatever limits it asked for, and always isolated. */
  static isolated(sandbox: unknown): Record<string, unknown> {
    return { ...CoercionUtils.toObject(sandbox), enabled: true, allowNative: false };
  }
}
