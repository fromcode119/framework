import { CoercionUtils } from '@core/utils/coercion-utils';
import { TenantState } from '@core/enums/tenant-state.enum';
import { TenantKind } from '@core/tenant/tenant-kind';

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
  /** Workspace only: the appearance its domain is locked to; `''` = the default console. */
  readonly appearance: string;

  private constructor(input: {
    id: string; slug: string; primaryHost: string; hostAliases: string[]; state: string; kind: TenantKind; appearance: string;
  }) {
    this.id = input.id;
    this.slug = input.slug;
    this.primaryHost = input.primaryHost;
    this.hostAliases = input.hostAliases;
    this.state = input.state;
    this.kind = input.kind;
    this.appearance = input.appearance;
  }

  get isWorkspace(): boolean {
    return this.kind.isWorkspace;
  }

  /** The `api.` aliases: hosts the gateway sends to the api, for device and app traffic. */
  apiHosts(): string[] {
    return this.hosts().filter((host) => host.startsWith('api.'));
  }

  get isActive(): boolean {
    return this.state === TenantState.ACTIVE.value;
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
      appearance: CoercionUtils.toString(row?.appearance),
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
}
