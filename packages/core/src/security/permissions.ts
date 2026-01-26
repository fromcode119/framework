import { PluginManifest } from '../types';

/**
 * Valid permissions that a plugin can request
 */
export type PluginPermission = 
  | 'database:read'
  | 'database:write'
  | 'api:routes'
  | 'navigation'
  | 'hooks'
  | 'admin:ui'
  | 'collections:modify'

/**
 * Plugin Permissions Service
 * Handles validation and enforcement of plugin-level permissions
 */
export class PluginPermissionsService {
  /**
   * Checks if a plugin has a specific permission
   * @param manifest - The plugin manifest
   * @param permission - The permission to check
   * @returns boolean
   */
  static hasPermission(manifest: PluginManifest, permission: PluginPermission | string): boolean {
    // Core plugins or system-critical paths might have all permissions
    // but for now we follow explicit manifest permissions or capabilities.
    const perms = manifest.permissions || [];
    const caps = manifest.capabilities || [];
    
    return perms.includes(permission as string) || caps.includes(permission as any);
  }

  /**
   * Validates if a plugin is allowed to perform a certain action
   * @param pluginSlug - The slug of the plugin
   * @param manifest - The plugin manifest
   * @param permission - The permission required
   * @throws Error if permission is denied
   */
  static ensure(pluginSlug: string, manifest: PluginManifest, permission: PluginPermission | string): void {
    if (!this.hasPermission(manifest, permission)) {
      throw new Error(`Plugin '${pluginSlug}' attempted to access '${permission}' but does not have the required permission in its manifest.`)
    }
  }

  /**
   * Filters a list of plugins by those that have a specific permission
   */
  static filterByPermission(plugins: { slug: string; manifest: PluginManifest }[], permission: PluginPermission | string) {
    return plugins.filter(p => this.hasPermission(p.manifest, permission))
  }
}
