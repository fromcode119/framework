import { CoercionUtils, TenantRecord } from '@fromcode119/core';

/** One tenant as the Sites admin sees it: the registry row plus what is attached to it. */
export class TenantSummary {
  constructor(
    readonly tenant: TenantRecord,
    readonly memberCount: number,
    readonly plugins: string[],
    readonly theme: string | null,
    readonly members: Array<{ userId: string; email: string; roles: string[]; state: string }>,
    readonly lastExport: string | null,
  ) {}

  toJSON(): Record<string, unknown> {
    return {
      ...TenantSummary.tenantJson(this.tenant),
      memberCount: this.memberCount,
      plugins: this.plugins,
      theme: this.theme,
      members: this.members,
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
