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
    /** Workspace only: appearance id, `''` = default console. */
    readonly appearance: string,
    /** Workspace only: the preset the operator picked, if any (it fills plugins + appearance, visibly). */
    readonly preset: string,
  ) {}

  static empty(): SiteFormValues {
    return new SiteFormValues('', '', true, '', '', 'active', '', '', [], 'site', '', '');
  }

  static fromSite(site: SiteRecord): SiteFormValues {
    return new SiteFormValues(site.slug, site.id, false, site.primaryHost, site.hostAliases.join(', '), site.state, '', site.theme ?? '', site.plugins, site.kind, site.appearance, '');
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
      kind: this.kind, appearance: this.isWorkspace ? this.appearance : undefined, preset: this.isWorkspace && this.preset ? this.preset : undefined,
    };
  }

  /** The identity-only patch a detail page sends. */
  toUpdatePayload(): Record<string, unknown> {
    return {
      slug: this.slug.trim(),
      primaryHost: this.primaryHost.trim(),
      hostAliases: this.aliasList,
      state: this.state,
      // Theme and plugins are part of an EDIT now, not only of creation. A workspace has no storefront,
      // so it sends no theme rather than sending an empty one, which would read as "clear the theme".
      plugins: this.plugins,
      ...(this.isWorkspace ? { appearance: this.appearance } : { theme: this.theme }),
    };
  }

  /** The identity an import/adopt uses (no plugins/theme: those come from the archive or the deployment). */
  toIdentity(): Record<string, unknown> {
    return { slug: this.slug.trim(), id: this.id.trim() || undefined, primaryHost: this.primaryHost.trim(), hostAliases: this.aliasList };
  }
}
