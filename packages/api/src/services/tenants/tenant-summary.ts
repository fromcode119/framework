import { CoercionUtils, TenantRecord } from '@fromcode119/core';

/** One tenant as the Sites admin sees it: the registry row plus what is attached to it. */
export class TenantSummary {
  constructor(
    readonly tenant: TenantRecord,
    readonly memberCount: number,
    readonly plugins: string[],
    readonly theme: string | null,
    readonly lastExport: string | null,
    /**
     * How many storefront pages the site actually has.
     *
     * A real, derived number rather than a "last seeded" timestamp: nothing records when a seed ran, and
     * inventing a date the operator never set would be exactly the kind of value that cannot be traced
     * to a control. Zero pages on a storefront site is the visible symptom of a seed that never ran.
     */
    readonly pageCount: number,
    /** Every export archive this site has, with the id the download route takes. */
    readonly exports: Array<{ id: string; filename: string; sizeBytes: number; modifiedAt: string }> = [],
    /**
     * The appearance this tenant actually wears. A workspace's is `tenant.appearance` (the kind
     * lock), already correct from `tenantJson` below — but a SITE's is its own `admin_appearance`
     * SETTING, not the tenant row (which is always `''` there), so the caller reads it separately
     * and passes it here. Without this override the Sites page always showed "Default console" for
     * a site no matter what an operator had assigned it.
     */
    readonly appearance: string = tenant.appearance,
  ) {}

  toJSON(): Record<string, unknown> {
    return {
      ...TenantSummary.tenantJson(this.tenant),
      memberCount: this.memberCount,
      pageCount: this.pageCount,
      exports: this.exports,
      plugins: this.plugins,
      theme: this.theme,
      lastExport: this.lastExport,
      appearance: this.appearance,
    };
  }

  static tenantJson(tenant: TenantRecord): Record<string, unknown> {
    return {
      id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases,
      state: tenant.state, isActive: tenant.isActive, kind: tenant.kind.value,
      // Both the stored value and what it MEANS. The admin shows a badge and a banner from these, and
      // deriving "is this site hidden" from the string at three call sites is how they drift apart.
      visibility: String(tenant.visibility.value),
      environment: String(tenant.environment.value),
      isIndexable: tenant.isIndexable,
      appearance: tenant.appearance,
    };
  }

  /** `roles` is JSON in Postgres; a raw-manager read may hand it back as text. */
  static roles(value: unknown): string[] {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch { parsed = []; }
    }
    return Array.isArray(parsed) ? parsed.map((role) => CoercionUtils.toString(role)).filter(Boolean) : [];
  }
}
