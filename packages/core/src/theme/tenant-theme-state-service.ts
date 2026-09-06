import { CoercionUtils } from '@core/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';

/**
 * Activating, disabling and configuring a theme FOR ONE TENANT.
 *
 * Framework-owned: `_system_tenant_themes` is a system table read through the RAW manager, so
 * snake_case column names. No plugin or theme code touches it.
 *
 * What it deliberately does NOT do: install, update or delete a theme. Those change the files every
 * tenant renders from and stay platform actions behind `PlatformAdminGuard`. This class only records
 * which of the installed themes a tenant has chosen — configuration, not code — which is why it needs
 * no restart: every write invalidates the cache the storefront's `/system/frontend` reads, and the
 * tenant's next request carries a new render signature.
 */
export class TenantThemeStateService {
  private static readonly ACTIVE = 'active';
  private static readonly INACTIVE = 'inactive';

  constructor(private readonly db: any) {}

  /** Make `slug` the tenant's active theme, retiring whichever one was active before. */
  async activate(tenantId: string, slug: string): Promise<void> {
    const { tenant, name } = this.identify(tenantId, slug);
    const rows: any[] = await this.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { tenant_id: tenant } });

    for (const row of rows ?? []) {
      const other = String(row?.theme_slug ?? '').trim();
      if (other && other !== name && String(row?.state ?? '') === TenantThemeStateService.ACTIVE) {
        await this.db.update(
          SystemConstants.TABLE.TENANT_THEMES,
          { tenant_id: tenant, theme_slug: other },
          { state: TenantThemeStateService.INACTIVE, updated_at: new Date() },
        );
      }
    }

    await this.write(tenant, name, TenantThemeStateService.ACTIVE, rows);
  }

  async disable(tenantId: string, slug: string): Promise<void> {
    const { tenant, name } = this.identify(tenantId, slug);
    const rows: any[] = await this.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { tenant_id: tenant } });
    await this.write(tenant, name, TenantThemeStateService.INACTIVE, rows);
  }

  /** The tenant's variable overrides for `slug`. Stored on the tenant's row; NULL means the theme's defaults. */
  async saveConfig(tenantId: string, slug: string, config: Record<string, unknown> | null): Promise<void> {
    const { tenant, name } = this.identify(tenantId, slug);
    const rows: any[] = await this.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { tenant_id: tenant } });
    const existing = (rows ?? []).find((row: any) => String(row?.theme_slug ?? '').trim() === name);
    const serialized = config === null ? null : JSON.stringify(config);

    if (existing) {
      await this.db.update(
        SystemConstants.TABLE.TENANT_THEMES,
        { tenant_id: tenant, theme_slug: name },
        { config: serialized, updated_at: new Date() },
      );
    } else {
      // Configuring a theme the tenant has not activated is allowed — an operator may prepare it
      // before switching — so the row is created inactive with the config attached.
      await this.db.insert(SystemConstants.TABLE.TENANT_THEMES, {
        tenant_id: tenant, theme_slug: name, state: TenantThemeStateService.INACTIVE, config: serialized,
      });
    }
    TenantThemeAccess.invalidate(tenant);
  }

  /**
   * A theme was DELETED from the platform: every tenant's row for it goes, or the tenant stays
   * "active" on files that no longer exist and its storefront logs NO SERVER RENDERING for as long
   * as nobody notices. Returns the tenants that were left with no theme, so the caller can say so.
   */
  async clearForTheme(slug: string): Promise<string[]> {
    const name = CoercionUtils.toString(slug).trim();
    if (!name) return [];
    const rows: any[] = await this.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { theme_slug: name } });
    const orphaned: string[] = [];
    for (const row of rows ?? []) {
      const tenant = String(row?.tenant_id ?? '').trim();
      if (!tenant) continue;
      if (String(row?.state ?? '') === TenantThemeStateService.ACTIVE) orphaned.push(tenant);
      await this.db.delete(SystemConstants.TABLE.TENANT_THEMES, { tenant_id: tenant, theme_slug: name });
      TenantThemeAccess.invalidate(tenant);
    }
    return orphaned;
  }

  private identify(tenantId: string, slug: string): { tenant: string; name: string } {
    const tenant = CoercionUtils.toString(tenantId).trim();
    const name = CoercionUtils.toString(slug).trim();
    if (!tenant || !name) {
      throw new Error('TenantThemeStateService: a tenant id and a theme slug are both required.');
    }
    return { tenant, name };
  }

  /** Upsert by hand: this runs through the manager, not raw SQL, so it works on every dialect. */
  private async write(tenant: string, name: string, state: string, rows: any[]): Promise<void> {
    const existing = (rows ?? []).find((row: any) => String(row?.theme_slug ?? '').trim() === name);
    if (existing) {
      await this.db.update(
        SystemConstants.TABLE.TENANT_THEMES,
        { tenant_id: tenant, theme_slug: name },
        { state, updated_at: new Date() },
      );
    } else {
      await this.db.insert(SystemConstants.TABLE.TENANT_THEMES, { tenant_id: tenant, theme_slug: name, state });
    }
    // Last, and never skipped: everything above is inert until the storefront stops serving the old
    // answer, and this is the line that makes "saved" into "in effect".
    TenantThemeAccess.invalidate(tenant);
  }
}
