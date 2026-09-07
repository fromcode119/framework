import { CoercionUtils } from '@core/coercion-utils';

/**
 * `manifest.json` of a tenant archive — what the archive claims to contain, written by the exporter
 * and checked by the importer before a single row is touched.
 *
 * `source` names where the rows came from: a tenant of a multi-tenant platform, or a whole
 * single-tenant deployment being moved onto one (the local `app.db`, production). The importer
 * treats both the same; the word is there so an operator reading the file knows.
 */
export class TenantArchiveManifest {
  static readonly FORMAT_VERSION = 1;

  constructor(
    readonly formatVersion: number,
    readonly exportedAt: string,
    readonly frameworkVersion: string,
    readonly source: 'tenant' | 'single-tenant',
    readonly tenant: { id: string; slug: string; primaryHost: string; hostAliases: string[]; state: string; kind: string; appearance: string },
    readonly plugins: Array<{ slug: string; version: string }>,
    readonly theme: { slug: string; version: string; config: Record<string, unknown> | null } | null,
    readonly tables: Array<{ name: string; rows: number; columns: string[]; hasSerialId: boolean }>,
    readonly users: number,
    readonly files: { count: number; bytes: number },
    readonly warnings: string[],
  ) {}

  get tableNames(): string[] {
    return this.tables.map((table) => table.name);
  }

  get totalRows(): number {
    return this.tables.reduce((sum, table) => sum + table.rows, 0);
  }

  toJSON(): Record<string, unknown> {
    return {
      formatVersion: this.formatVersion,
      exportedAt: this.exportedAt,
      frameworkVersion: this.frameworkVersion,
      source: this.source,
      tenant: this.tenant,
      plugins: this.plugins,
      theme: this.theme,
      tables: this.tables,
      users: this.users,
      files: this.files,
      warnings: this.warnings,
    };
  }

  /** Hydrates and VALIDATES. An archive whose manifest does not parse is refused, never guessed at. */
  static from(raw: unknown): TenantArchiveManifest {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const formatVersion = CoercionUtils.toNumber(input.formatVersion);
    if (formatVersion !== TenantArchiveManifest.FORMAT_VERSION) {
      throw new Error(`Tenant archive format ${formatVersion || 'unknown'} is not supported (this platform reads format ${TenantArchiveManifest.FORMAT_VERSION}).`);
    }
    const tenant = input.tenant ?? {};
    const slug = CoercionUtils.toString(tenant.slug);
    if (!slug) throw new Error('Tenant archive manifest names no tenant slug.');
    const source = input.source === 'single-tenant' ? 'single-tenant' : 'tenant';
    return new TenantArchiveManifest(
      formatVersion,
      CoercionUtils.toString(input.exportedAt),
      CoercionUtils.toString(input.frameworkVersion),
      source,
      {
        id: CoercionUtils.toString(tenant.id),
        slug,
        primaryHost: CoercionUtils.toString(tenant.primaryHost),
        hostAliases: Array.isArray(tenant.hostAliases) ? tenant.hostAliases.map((h: unknown) => CoercionUtils.toString(h)) : [],
        state: CoercionUtils.toString(tenant.state) || 'active',
        // Archives written before T6 name no kind: they were exported from storefront sites.
        kind: CoercionUtils.toString(tenant.kind) || 'site',
        appearance: CoercionUtils.toString(tenant.appearance),
      },
      Array.isArray(input.plugins) ? input.plugins.map((p: any) => ({ slug: CoercionUtils.toString(p?.slug), version: CoercionUtils.toString(p?.version) })) : [],
      input.theme && typeof input.theme === 'object'
        ? { slug: CoercionUtils.toString(input.theme.slug), version: CoercionUtils.toString(input.theme.version), config: input.theme.config ?? null }
        : null,
      Array.isArray(input.tables)
        ? input.tables.map((t: any) => ({
          name: CoercionUtils.toString(t?.name),
          rows: CoercionUtils.toNumber(t?.rows),
          columns: Array.isArray(t?.columns) ? t.columns.map((c: unknown) => CoercionUtils.toString(c)) : [],
          hasSerialId: t?.hasSerialId === true,
        }))
        : [],
      CoercionUtils.toNumber(input.users),
      { count: CoercionUtils.toNumber(input.files?.count), bytes: CoercionUtils.toNumber(input.files?.bytes) },
      Array.isArray(input.warnings) ? input.warnings.map((w: unknown) => CoercionUtils.toString(w)) : [],
    );
  }
}
