import { SiteRecord } from '@/lib/tenants/site-record';

/** The New/Edit site form's state — immutable; `with()` returns the next value. */
export class SiteFormValues {
  constructor(
    readonly slug: string,
    readonly id: string,
    readonly idFollowsSlug: boolean,
    readonly primaryHost: string,
    readonly hostAliases: string,
    readonly state: string,
    readonly adminEmail: string,
    readonly theme: string,
    readonly plugins: string[],
    /** `site` or `workspace`; chosen once, at creation (T6). */
    readonly kind: string,
    readonly visibility: string,
    /** Workspace only: appearance id, `''` = default console. */
    readonly appearance: string,
    /** Workspace only: the preset the operator picked, if any (it fills plugins + appearance, visibly). */
    readonly preset: string,
  ) {}

  static empty(): SiteFormValues {
    // A new site is PRIVATE. The form shows the closed answer preselected, so publishing is
    // something somebody chooses rather than something that happens by not choosing.
    return new SiteFormValues('', '', true, '', '', 'active', '', '', [], 'site', 'private', '', '');
  }

  static fromSite(site: SiteRecord): SiteFormValues {
    return new SiteFormValues(site.slug, site.id, false, site.primaryHost, site.hostAliases.join(', '), site.state, '', site.theme ?? '', site.plugins, site.kind, site.visibility, site.appearance, '');
  }

  get isWorkspace(): boolean {
    return this.kind === 'workspace';
  }

  with(patch: Partial<SiteFormValues>): SiteFormValues {
    return new SiteFormValues(
      patch.slug ?? this.slug,
      patch.id ?? this.id,
      patch.idFollowsSlug ?? this.idFollowsSlug,
      patch.primaryHost ?? this.primaryHost,
      patch.hostAliases ?? this.hostAliases,
      patch.state ?? this.state,
      patch.adminEmail ?? this.adminEmail,
      patch.theme ?? this.theme,
      patch.plugins ?? this.plugins,
      patch.kind ?? this.kind,
      patch.visibility ?? this.visibility,
      patch.appearance ?? this.appearance,
      patch.preset ?? this.preset,
    );
  }

  get aliasList(): string[] {
    return this.hostAliases.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean);
  }

  /** The create payload. */
  toCreatePayload(): Record<string, unknown> {
    return {
      slug: this.slug.trim(), id: this.id.trim() || undefined, primaryHost: this.primaryHost.trim(), hostAliases: this.aliasList,
      adminEmail: this.adminEmail.trim() || undefined, theme: this.isWorkspace ? undefined : (this.theme || undefined), plugins: this.plugins,
      kind: this.kind, visibility: this.visibility, appearance: this.isWorkspace ? this.appearance : undefined, preset: this.isWorkspace && this.preset ? this.preset : undefined,
    };
  }

  /** The identity-only patch a detail page sends. */
  toUpdatePayload(): Record<string, unknown> {
    return {
      slug: this.slug.trim(),
      primaryHost: this.primaryHost.trim(),
      hostAliases: this.aliasList,
      state: this.state,
      visibility: this.visibility,
      // ENTITLEMENT — what this site may run — is edited on the Access tab and saved here. Their
      // SETTINGS are not: those live on each plugin's and the theme's own page, with this site
      // selected. Carrying both was what made this page a worse copy of pages that already exist.
      plugins: this.plugins,
      ...(this.isWorkspace ? { appearance: this.appearance } : { theme: this.theme }),
    };
  }

  /**
   * The identity an import/adopt uses (no plugins/theme: those come from the archive or the deployment).
   *
   * `kind` IS part of the identity and was missing here, so Adopt and Import could never succeed —
   * the server requires it ("site" or "workspace"), and both screens showed a Kind dropdown whose
   * value nothing ever sent. A control writing a value nothing reads is the bug this codebase is
   * least allowed to have, and it made adopting a deployment impossible from the admin.
   *
   * `appearance` rides along only for a workspace: the server refuses a site that names one, because
   * a site renders its theme and uses the shared admin.
   */
  toIdentity(): Record<string, unknown> {
    return {
      slug: this.slug.trim(),
      id: this.id.trim() || undefined,
      primaryHost: this.primaryHost.trim(),
      hostAliases: this.aliasList,
      kind: this.kind,
      ...(this.isWorkspace ? { appearance: this.appearance } : {}),
    };
  }
}
