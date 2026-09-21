import { SiteRecord } from '@/lib/tenants/site-record';

/** The New/Edit site form's state — immutable; `with()` returns the next value. */
export class SiteFormValues {
  constructor(
    readonly slug: string,
    readonly id: string,
    readonly idFollowsSlug: boolean,
    readonly primaryHost: string,
    readonly hostAliases: string,
    /** Host -> role, for hosts where the operator chose one. Absent means this site's default. */
    readonly hostRoles: Record<string, string>,
    readonly state: string,
    readonly adminEmail: string,
    readonly theme: string,
    readonly plugins: string[],
    /** `site` or `workspace`; chosen once, at creation (T6). */
    readonly kind: string,
    readonly visibility: string,
    /** `production` or `non-production` — whether this site may email, pay, ship or run jobs. */
    readonly environment: string,
    /** Workspace only: appearance id, `''` = default console. */
    readonly appearance: string,
    /** Workspace only: the preset the operator picked, if any (it fills plugins + appearance, visibly). */
    readonly preset: string,
  ) {}

  static empty(): SiteFormValues {
    // A new site is PRIVATE. The form shows the closed answer preselected, so publishing is
    // something somebody chooses rather than something that happens by not choosing.
    // A new site is PRODUCTION: every site created through this form is a real one, and a shop born
    // silently muted would not be noticed until a customer said an order confirmation never arrived.
    // The import path sets `non-production` explicitly instead of relying on this.
    return new SiteFormValues('', '', true, '', '', {}, 'active', '', '', [], 'site', 'private', 'production', '', '');
  }

  static fromSite(site: SiteRecord): SiteFormValues {
    return new SiteFormValues(site.slug, site.id, false, site.primaryHost, site.hostAliases.join(', '), site.hostRoles, site.state, '', site.theme ?? '', site.plugins, site.kind, site.visibility, site.environment, site.appearance, '');
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
      patch.hostRoles ?? this.hostRoles,
      patch.state ?? this.state,
      patch.adminEmail ?? this.adminEmail,
      patch.theme ?? this.theme,
      patch.plugins ?? this.plugins,
      patch.kind ?? this.kind,
      patch.visibility ?? this.visibility,
      patch.environment ?? this.environment,
      patch.appearance ?? this.appearance,
      patch.preset ?? this.preset,
    );
  }

  /** The declared roles, narrowed to the hosts currently in the form. */
  get declaredRoles(): Record<string, string> {
    const hosts = new Set([this.primaryHost.trim().toLowerCase(), ...this.aliasList.map((h) => h.toLowerCase())]);
    return Object.fromEntries(
      Object.entries(this.hostRoles).filter(([host]) => hosts.has(host.toLowerCase())),
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
      kind: this.kind, visibility: this.visibility, environment: this.environment, appearance: this.isWorkspace ? this.appearance : undefined, preset: this.isWorkspace && this.preset ? this.preset : undefined,
    };
  }

  /** The identity-only patch a detail page sends. */
  toUpdatePayload(): Record<string, unknown> {
    return {
      slug: this.slug.trim(),
      primaryHost: this.primaryHost.trim(),
      hostAliases: this.aliasList,
      // Only roles for hosts that still exist: a role left behind by a removed host would describe
      // nothing, and would spring back to life the day somebody re-used that name.
      hostRoles: this.declaredRoles,
      state: this.state,
      visibility: this.visibility,
      environment: this.environment,
      // ENTITLEMENT — what this site may run — is edited on the Access tab and saved here. Their
      // SETTINGS are not: those live on each plugin's and the theme's own page, with this site
      // selected. Carrying both was what made this page a worse copy of pages that already exist.
      plugins: this.plugins,
      // Both kinds carry `appearance` now: a workspace's is the tenant row's kind lock, a site's is
      // its own `admin_appearance` setting — different persistence, same field here. Only a site
      // also has a storefront theme.
      appearance: this.appearance,
      ...(this.isWorkspace ? {} : { theme: this.theme }),
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
      // BOTH of these were shown and neither was sent. The import screen rendered "Visible to" and
      // "Environment" as ordinary controls, dropped them here, and the server then applied its own
      // defaults — so the form could read "Production" while the site it created was non-production.
      // A control that writes a value nothing reads is the thing this codebase is not allowed to
      // have, and on this screen the value decides whether a copy of a live shop can email its
      // customers.
      visibility: this.visibility,
      environment: this.environment,
      ...(this.isWorkspace ? { appearance: this.appearance } : {}),
    };
  }
}
