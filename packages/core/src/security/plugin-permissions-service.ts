import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import { PluginPermission } from '@core/security/enums/plugin-permission.enum';

/**
 * Plugin Permissions Service
 * Handles validation and enforcement of plugin-level permissions
 */
export class PluginPermissionsService {
  /**
   * Checks if a plugin has a specific permission
   * Supports wildcards like 'database:*'
   */
  // Accepts a member OR a raw manifest string; `Enum.toString()` yields the bare value, so one
  // normalization here keeps every caller free of `.value` plumbing.
  static hasPermission(manifest: IPluginManifest, permission: PluginPermission | string): boolean {
    const perms = (manifest.permissions || []).map(p => p.toLowerCase());
    // `capabilities` is declared as `(string | PluginCapability)[]`: a manifest is JSON so the values
    // are strings at runtime, but the type also admits members. `String()` normalizes both — an Enum's
    // toString() yields its bare value.
    const caps = (manifest.capabilities || []).map(c => String(c).toLowerCase());
    const allAllowed = [...perms, ...caps];
    const target = String(permission).toLowerCase();

    if (allAllowed.includes('*')) return true;
    if (allAllowed.includes(target)) return true;
    
    // Database permission hierarchy
    if (target.startsWith('database:')) {
      if (allAllowed.includes('database') || allAllowed.includes('database:*')) return true;
      if (target === 'database:read' && allAllowed.includes('database:write')) return true;
    }

    // Wildcard support (e.g., database:read matches database:*)
    for (const allowed of allAllowed) {
      if (allowed.endsWith(':*')) {
        const prefix = allowed.slice(0, -1);
        if (target.startsWith(prefix)) return true;
      }
    }
    
    return false;
  }

  /**
   * Validates if a plugin is allowed to perform a certain action
   * @param pluginSlug - The slug of the plugin
   * @param manifest - The plugin manifest
   * @param permission - The permission required
   * @throws Error if permission is denied
   */
  static ensure(pluginSlug: string, manifest: IPluginManifest, permission: PluginPermission | string): void {
    if (!this.hasPermission(manifest, permission)) {
      throw new Error(`Plugin '${pluginSlug}' attempted to access '${permission}' but does not have the required permission in its manifest.`)
    }
  }

  /**
   * Filters a list of plugins by those that have a specific permission
   */
  static filterByPermission(plugins: { slug: string; manifest: IPluginManifest }[], permission: PluginPermission | string) {
    return plugins.filter(p => this.hasPermission(p.manifest, permission))
  }
}