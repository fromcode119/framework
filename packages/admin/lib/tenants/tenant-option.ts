/**
 * One entry in the tenant switcher.
 *
 * A data class rather than a shape, so the display label lives with the data instead of being
 * rebuilt at each call site.
 */
export class TenantOption {
  readonly id: string;
  readonly slug: string;
  readonly primaryHost: string;

  /**
   * True when the account reaches this tenant only through the platform-admin role, not through a
   * membership — i.e. it is about to work inside a customer it does not belong to. The switcher
   * says so on screen; the audit log alone is too late.
   */
  readonly platformAccess: boolean;
  /** `site` or `workspace` (T6): a workspace is opened as its appearance or configured in the default console. */
  readonly kind: string;
  /** Workspace only: the appearance its own admins see; `''` = default console. */
  readonly appearance: string;

  private constructor(id: string, slug: string, primaryHost: string, platformAccess: boolean, kind: string, appearance: string) {
    this.kind = kind;
    this.appearance = appearance;
    this.id = id;
    this.slug = slug;
    this.primaryHost = primaryHost;
    this.platformAccess = platformAccess;
  }

  /** What the operator reads. Falls back to the host, then the id — never an empty control. */
  get isWorkspace(): boolean {
    return this.kind === 'workspace';
  }

  /** What "open as its appearance" means for this workspace, in words. */
  get appearanceLabel(): string {
    return this.appearance || 'default console';
  }

  get label(): string {
    return this.slug || this.primaryHost || this.id;
  }

  static fromList(rows: unknown): TenantOption[] {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row: any) => new TenantOption(
        String(row?.id ?? '').trim(),
        String(row?.slug ?? '').trim(),
        String(row?.primaryHost ?? '').trim(),
        row?.platformAccess === true,
        String(row?.kind ?? 'site').trim() || 'site',
        String(row?.appearance ?? '').trim(),
      ))
      .filter((option) => option.id.length > 0);
  }
}
