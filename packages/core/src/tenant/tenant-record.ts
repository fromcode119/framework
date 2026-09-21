import { CoercionUtils } from '@core/utils/coercion-utils';
import { TenantState } from '@core/enums/tenant-state.enum';
import { TenantVisibility } from '@core/enums/tenant-visibility.enum';
import { TenantEnvironment } from '@core/enums/tenant-environment.enum';
import { TenantKind } from '@core/tenant/tenant-kind';
import { TenantHostRole } from '@core/tenant/tenant-host-role';

/**
 * One tenant.
 *
 * A data CLASS rather than an interface because the host matching and the active check are
 * behaviour that belongs with the data instead of being repeated at every call site.
 */
export class TenantRecord {

  readonly id: string;
  readonly slug: string;
  readonly primaryHost: string;
  readonly hostAliases: string[];
  readonly state: string;
  readonly kind: TenantKind;
  /** Whether the site is open to the public. A different axis from `state` — see TenantVisibility. */
  readonly visibility: TenantVisibility;
  /** Whether the site may reach the outside world at all. A third axis — see TenantEnvironment. */
  readonly environment: TenantEnvironment;
  /** Workspace only: the appearance its domain is locked to; `''` = the default console. */
  readonly appearance: string;
  /**
   * What each host answers with, where the operator has said. Host -> role.
   *
   * A host absent from this map takes the tenant's own default. Nothing is ever inferred from the
   * NAME of a host — see {@link TenantHostRole} for the magic this replaced.
   */
  readonly hostRoles: Readonly<Record<string, string>>;

  private constructor(input: {
    id: string; slug: string; primaryHost: string; hostAliases: string[]; state: string; kind: TenantKind;
    visibility: TenantVisibility; environment: TenantEnvironment; appearance: string;
    hostRoles: Record<string, string>;
  }) {
    this.id = input.id;
    this.slug = input.slug;
    this.primaryHost = input.primaryHost;
    this.hostAliases = input.hostAliases;
    this.state = input.state;
    this.kind = input.kind;
    this.visibility = input.visibility;
    this.environment = input.environment;
    this.appearance = input.appearance;
    this.hostRoles = Object.freeze({ ...input.hostRoles });
  }

  get isWorkspace(): boolean {
    return this.kind.isWorkspace;
  }

  /**
   * What this host answers with: the declared role, or this tenant's own default.
   *
   * THE HOSTNAME IS NEVER READ. A host used to become the api by starting with `api.`, which meant a
   * shop alias called `api.shop.com` silently stopped serving the shop and nothing said why. The
   * role is now something an operator sets and can see.
   */
  roleFor(host: string): TenantHostRole {
    const normalized = String(host ?? '').trim().toLowerCase();
    return TenantHostRole.find(this.hostRoles[normalized]) ?? TenantHostRole.defaultFor(this.isWorkspace);
  }

  /** The hosts DECLARED to answer as the api, for device and app traffic. */
  apiHosts(): string[] {
    return this.hosts().filter((host) => this.roleFor(host) === TenantHostRole.API);
  }

  get isActive(): boolean {
    return this.state === TenantState.ACTIVE.value;
  }

  /** Whether an anonymous visitor may read this site. A suspended site is never readable. */
  get isReadable(): boolean {
    return this.isActive && this.visibility.isReadable;
  }

  /** Whether search engines may index it. Only an active, PUBLIC site is. */
  get isIndexable(): boolean {
    return this.isActive && this.visibility.isIndexable;
  }

  /** Every host that resolves to this tenant: lowercased, deduped, primary first. */
  hosts(): string[] {
    const all = [this.primaryHost, ...this.hostAliases]
      .map((host) => String(host ?? '').trim().toLowerCase())
      .filter((host) => host.length > 0);
    return [...new Set(all)];
  }

  /**
   * Hydrates from a RAW framework row.
   *
   * `_system_tenants` is a system table read through the raw database manager, which does NOT
   * denormalize — only DatabaseContextProxy does that, and only for plugin code. So the keys here
   * are the real snake_case COLUMN names. One canonical name, never a camel/snake dual read.
   */
  static from(row: Record<string, unknown>): TenantRecord {
    const id = CoercionUtils.toString(row?.id);
    if (!id) {
      throw new Error('TenantRecord.from: row has no id; refusing to build an unidentified tenant.');
    }
    return new TenantRecord({
      id,
      slug: CoercionUtils.toString(row?.slug),
      primaryHost: CoercionUtils.toString(row?.primary_host),
      hostAliases: TenantRecord.parseAliases(row?.host_aliases),
      state: CoercionUtils.toString(row?.state),
      // Migration 027 stamps every row; a blank here can only be a row read before it ran, and
      // `site` is that migration's declared default — mirrored, not invented.
      kind: TenantKind.parse(row?.kind) ?? TenantKind.SITE,
      // Migration 039 stamps every row, and sets every tenant that existed at upgrade time to
      // `public` — they were serving before this column existed and go on serving. A blank can only
      // be a row read before that ran; PRIVATE is the column's declared default, mirrored here and
      // deliberately the closed answer rather than the open one.
      visibility: TenantVisibility.find(row?.visibility) ?? TenantVisibility.PRIVATE,
      // Migration 044 stamps every row, and its declared default is `production` — every site that
      // existed before this column did was live and goes on sending. A blank can only be a row read
      // before that ran, so PRODUCTION is mirrored here rather than invented. Unlike visibility, the
      // safe direction is the permissive one: silently muting a working shop's order confirmations
      // would go unnoticed for days.
      environment: TenantEnvironment.find(row?.environment) ?? TenantEnvironment.PRODUCTION,
      appearance: CoercionUtils.toString(row?.appearance),
      hostRoles: TenantRecord.parseHostRoles(row?.host_roles),
    });
  }

  /**
   * A malformed alias list yields an EMPTY list, never a match-anything. A tenant that silently
   * claimed every host would route another customer's traffic straight into it.
   */
  private static parseAliases(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => CoercionUtils.toString(entry));
    const raw = CoercionUtils.toString(value);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => CoercionUtils.toString(entry));
    } catch {
      return [];
    }
  }

  /**
   * The declared host roles, host -> role. JSONB on some dialects, JSON text on others.
   *
   * A role nobody recognises is DROPPED rather than kept: an unknown value would otherwise fall
   * through `roleFor` to the default anyway, and keeping it in the map would show the operator a
   * setting that does nothing. Hosts are lower-cased here so the lookup never has to guess.
   */
  private static parseHostRoles(value: unknown): Record<string, string> {
    const source = TenantRecord.readRoleObject(value);
    const roles: Record<string, string> = {};

    for (const [host, role] of Object.entries(source)) {
      const key = CoercionUtils.toString(host).trim().toLowerCase();
      const member = TenantHostRole.find(role);
      if (key && member) roles[key] = String(member.value);
    }

    return roles;
  }

  private static readRoleObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    const raw = CoercionUtils.toString(value);
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
}
