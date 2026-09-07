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
  ) {}

  toJSON(): Record<string, unknown> {
    return {
      ...TenantSummary.tenantJson(this.tenant),
      memberCount: this.memberCount,
      pageCount: this.pageCount,
      plugins: this.plugins,
      theme: this.theme,
      lastExport: this.lastExport,
    };
  }

  static tenantJson(tenant: TenantRecord): Record<string, unknown> {
    return { id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases, state: tenant.state, isActive: tenant.isActive, kind: tenant.kind.value, appearance: tenant.appearance };
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
