import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Rows an archive carries that the destination must NOT take.
 *
 * Two kinds, and both are about the destination rather than the archive. A platform-level setting
 * belongs to the deployment that exported it — URLs, rate limits, retention — and the destination has
 * its own. A setting belonging to a plugin the destination does not have would arrive as configuration
 * for something that cannot read it.
 *
 * Shared, because both importers need exactly the same answer: a site on a platform and a standalone
 * deployment differ in who owns the rows, not in which rows are theirs to take.
 */
export class TenantImportRowFilter {
  /** `true` when the row should be skipped. */
  static forTable(table: TenantTableDescriptor, installedPlugins: Set<string>): (row: Record<string, unknown>) => boolean {
    if (table.name === SystemConstants.TABLE.META) {
      const platform = new Set(TenantBespokePolicies.platformKeys());
      return (row) => platform.has(String(row.key ?? ''));
    }
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) {
      return (row) => !installedPlugins.has(String(row.plugin_slug ?? ''));
    }
    return () => false;
  }
}
