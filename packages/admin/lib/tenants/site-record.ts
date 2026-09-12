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
    /** `private` | `unlisted` | `public` — whether the site is open to visitors and to crawlers. */
    readonly visibility: string,
    /** Workspace only: the appearance its console is locked to; `''` = default console. */
    readonly appearance: string,
    /** Storefront pages this site actually has. Zero on a storefront site means its seed never ran. */
    readonly pageCount: number,
    /** Export archives for this site, newest first, each with the id the download route takes. */
    readonly exports: Array<{ id: string; filename: string; sizeBytes: number; modifiedAt: string }>,
  ) {}

  get isWorkspace(): boolean {
    return this.kind === 'workspace';
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  /** Open to everyone and indexable. Anything else is shown as a warning in the admin. */
  get isPublic(): boolean {
    return this.visibility === 'public';
  }

  /** Closed to visitors entirely — only this site's own admins see it. */
  get isPrivate(): boolean {
    return this.visibility === 'private';
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
      // `private` when the server said nothing: the closed answer, matching the column's default.
      // Reading an unknown site as public would show "open" for a site nobody has published.
      CoercionUtils.toString(input.visibility) || 'private',
      CoercionUtils.toString(input.appearance),
      CoercionUtils.toNumber(input.pageCount),
      Array.isArray(input.exports) ? input.exports.map((e: any) => ({
        id: CoercionUtils.toString(e?.id),
        filename: CoercionUtils.toString(e?.filename),
        sizeBytes: CoercionUtils.toNumber(e?.sizeBytes),
        modifiedAt: CoercionUtils.toString(e?.modifiedAt),
      })) : [],
    );
  }

  static fromList(raw: unknown): SiteRecord[] {
    return Array.isArray(raw) ? raw.map((entry) => SiteRecord.from(entry)) : [];
  }
}
