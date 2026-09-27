/**
 * Which site owns a plugin, when a site does.
 *
 * Learned from the DIRECTORY a plugin was discovered in (`plugins/tenants/<site>/…`), never from its
 * manifest — an uploaded plugin naming its own owner would claim to be the platform's. The scanner
 * records every discovered plugin here, platform ones as unowned, so a slug that moved or was removed
 * never keeps a stale owner.
 *
 * Read by everything that decides who may run a plugin: turning a plugin on for a site refuses one
 * owned by another site, and the platform may not offer a site's plugin to other sites.
 */
export class PluginOwners {
  private static readonly owners = new Map<string, string>();

  static record(slug: string, ownerTenantId: string | undefined): void {
    const key = PluginOwners.key(slug);
    if (!key) return;
    if (ownerTenantId) PluginOwners.owners.set(key, ownerTenantId);
    else PluginOwners.owners.delete(key);
  }

  static forget(slug: string): void {
    PluginOwners.owners.delete(PluginOwners.key(slug));
  }

  /** The owning site, or null when the platform owns it (or nothing is known about it). */
  static ownerOf(slug: string): string | null {
    return PluginOwners.owners.get(PluginOwners.key(slug)) ?? null;
  }

  /** Whether `tenantId` may run this plugin at all, before its own switch is considered. */
  static mayRunFor(slug: string, tenantId: string): boolean {
    const owner = PluginOwners.ownerOf(slug);
    return owner === null || owner === String(tenantId ?? '').trim();
  }

  static ownedBy(tenantId: string): string[] {
    const tenant = String(tenantId ?? '').trim();
    return [...PluginOwners.owners.entries()].filter(([, owner]) => owner === tenant).map(([slug]) => slug);
  }

  private static key(slug: string): string {
    return String(slug ?? '').trim().toLowerCase();
  }
}
