import { CoercionUtils } from '@core/utils/coercion-utils';
import { TenantKind } from '@core/tenant/tenant-kind';
import { TenantVisibility } from '@core/enums/tenant-visibility.enum';

/**
 * The operator-chosen identity of a tenant: id, slug, hosts, state — validated ONCE, here, before it
 * reaches a table or a filesystem path.
 *
 * Hosts are lowercased bare hostnames: no scheme, no path, no port. A host is a routing key; two
 * spellings of one host would be two keys, and `acme.com/` matching nothing is a support call.
 * The id is a path segment (uploads, backups), so it is confined to `[A-Za-z0-9_-]`.
 */
export class TenantIdentity {
  static readonly STATES = ['active', 'suspended'] as const;
  private static readonly ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;
  private static readonly SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
  private static readonly HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  private static readonly APPEARANCE = /^[a-z0-9][a-z0-9-]{0,62}$/;

  private constructor(
    readonly id: string,
    readonly slug: string,
    readonly primaryHost: string,
    readonly hostAliases: string[],
    readonly state: string,
    readonly kind: TenantKind,
    readonly visibility: TenantVisibility,
    readonly appearance: string,
  ) {}

  /** Every host this tenant answers on, primary first, deduped. */
  get hosts(): string[] {
    return [...new Set([this.primaryHost, ...this.hostAliases])];
  }

  static from(input: { id?: unknown; slug?: unknown; primaryHost?: unknown; hostAliases?: unknown; state?: unknown; kind?: unknown; visibility?: unknown; appearance?: unknown }): TenantIdentity {
    const slug = CoercionUtils.toKey(input.slug);
    if (!TenantIdentity.SLUG.test(slug)) {
      throw new Error(`Tenant slug "${slug}" must be lowercase letters, digits and dashes, starting with a letter or digit.`);
    }
    const id = CoercionUtils.toString(input.id) || slug;
    if (!TenantIdentity.ID.test(id)) {
      throw new Error(`Tenant id "${id}" must be letters, digits, dashes or underscores (it becomes a path segment).`);
    }
    const primaryHost = TenantIdentity.host(input.primaryHost, 'primary host');
    const aliases = TenantIdentity.aliases(input.hostAliases).filter((alias) => alias !== primaryHost);
    const state = CoercionUtils.toString(input.state) || 'active';
    if (!(TenantIdentity.STATES as readonly string[]).includes(state)) {
      throw new Error(`Tenant state "${state}" is not one of: ${TenantIdentity.STATES.join(', ')}.`);
    }
    // The kind is REQUIRED: a site and a workspace route, log in and look different, so a tenant
    // without one is not a tenant the platform can serve. (The migration stamps existing rows.)
    const kind = TenantKind.parse(input.kind);
    if (!kind) throw new Error(`Tenant kind "${CoercionUtils.toString(input.kind)}" must be "site" or "workspace".`);
    // A site is PRIVATE unless it says otherwise. This is the one place the rule lives: a caller
    // that names no visibility gets the closed answer, so a site created by any path — the admin, an
    // import, a script — arrives shut and is opened deliberately. Unlike `kind` this is not required,
    // because "unstated" has a safe and obvious meaning here and refusing would break every existing
    // caller for no gain.
    const visibility = TenantVisibility.find(input.visibility) ?? TenantVisibility.PRIVATE;
    const appearance = TenantIdentity.appearanceFor(kind, input.appearance);
    return new TenantIdentity(id, slug, primaryHost, aliases, state, kind, visibility, appearance);
  }

  /** A workspace names its appearance (`''` = the default console); a site has none and may not pass one. */
  private static appearanceFor(kind: TenantKind, value: unknown): string {
    const raw = CoercionUtils.toKey(value);
    if (!kind.isWorkspace) {
      if (raw) throw new Error('Only a workspace has an appearance; a site renders its theme and uses the shared admin.');
      return '';
    }
    if (!raw || raw === 'default') return '';
    if (!TenantIdentity.APPEARANCE.test(raw)) throw new Error(`Appearance "${raw}" must be lowercase letters, digits and dashes.`);
    return raw;
  }

  static host(value: unknown, label: string): string {
    const raw = CoercionUtils.toKey(value);
    if (!raw) throw new Error(`A tenant ${label} is required.`);
    if (/^[a-z]+:\/\//.test(raw) || raw.includes('/') || /:\d+$/.test(raw)) {
      throw new Error(`Tenant ${label} "${raw}" must be a bare hostname: no scheme, path or port.`);
    }
    if (!TenantIdentity.HOST.test(raw)) throw new Error(`Tenant ${label} "${raw}" is not a valid hostname.`);
    return raw;
  }

  static aliases(value: unknown): string[] {
    const list = Array.isArray(value)
      ? value
      : CoercionUtils.toString(value).split(/[\s,]+/);
    return [...new Set(list.map((entry) => CoercionUtils.toKey(entry)).filter(Boolean).map((entry) => TenantIdentity.host(entry, 'host alias')))];
  }
}
