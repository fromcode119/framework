import { CoercionUtils } from '@fromcode119/core/client';
import { SiteMember } from '@/lib/tenants/site-member';

/** One site (tenant) as `/system/admin/tenants` describes it. */
export class SiteRecord {
  private constructor(
    readonly id: string,
    readonly slug: string,
    readonly primaryHost: string,
    readonly hostAliases: string[],
    readonly state: string,
    readonly memberCount: number,
    readonly plugins: string[],
    readonly theme: string | null,
    readonly lastExport: string | null,
    /** `site` (storefront) or `workspace` (its domain serves the console). */
    readonly kind: string,
    /** Workspace only: the appearance its console is locked to; `''` = default console. */
    readonly appearance: string,
    /** Storefront pages this site actually has. Zero on a storefront site means its seed never ran. */
    readonly pageCount: number,
  ) {}

  get isWorkspace(): boolean {
    return this.kind === 'workspace';
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  get hosts(): string[] {
    return [this.primaryHost, ...this.hostAliases];
  }

  /** The site's storefront, for an "open" link. `http` in local development is the operator's business elsewhere — this only names the host. */
  get storefrontUrl(): string {
    return `//${this.primaryHost}`;
  }

  static from(raw: unknown): SiteRecord {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    return new SiteRecord(
      CoercionUtils.toString(input.id),
      CoercionUtils.toString(input.slug),
      CoercionUtils.toString(input.primaryHost),
      Array.isArray(input.hostAliases) ? input.hostAliases.map((h: unknown) => CoercionUtils.toString(h)) : [],
      CoercionUtils.toString(input.state) || 'active',
      CoercionUtils.toNumber(input.memberCount),
      Array.isArray(input.plugins) ? input.plugins.map((p: unknown) => CoercionUtils.toString(p)) : [],
      input.theme ? CoercionUtils.toString(input.theme) : null,
      input.lastExport ? CoercionUtils.toString(input.lastExport) : null,
      CoercionUtils.toString(input.kind) || 'site',
      CoercionUtils.toString(input.appearance),
      CoercionUtils.toNumber(input.pageCount),
    );
  }

  static fromList(raw: unknown): SiteRecord[] {
    return Array.isArray(raw) ? raw.map((entry) => SiteRecord.from(entry)) : [];
  }
}
