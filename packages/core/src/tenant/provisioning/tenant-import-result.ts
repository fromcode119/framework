import { TenantRecord } from '@core/tenant/tenant-record';

/** What an import DID — the counterpart of `TenantImportPlan`, which is what it was going to do. */
export class TenantImportResult {
  constructor(
    readonly tenant: TenantRecord,
    /** table → rows inserted */
    readonly inserted: Record<string, number>,
    readonly remappedTables: string[],
    readonly members: number,
    readonly pluginsEnabled: string[],
    readonly themeActivated: string | null,
    readonly warnings: string[],
  ) {}

  get totalRows(): number {
    return Object.values(this.inserted).reduce((sum, count) => sum + count, 0);
  }

  toJSON(): Record<string, unknown> {
    return {
      tenant: { id: this.tenant.id, slug: this.tenant.slug, primaryHost: this.tenant.primaryHost, hostAliases: this.tenant.hostAliases, state: this.tenant.state },
      inserted: this.inserted,
      totalRows: this.totalRows,
      remappedTables: this.remappedTables,
      members: this.members,
      pluginsEnabled: this.pluginsEnabled,
      themeActivated: this.themeActivated,
      warnings: this.warnings,
    };
  }
}
