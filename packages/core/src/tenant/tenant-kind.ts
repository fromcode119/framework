import { Enum } from '@fromcode119/reactor';

/**
 * What a tenant is (T6).
 * - `site`: a storefront on its domain (a theme); its admins use the shared admin host.
 * - `workspace`: no storefront — the domain IS the console, locked to the tenant's appearance
 *   (a product console installed as an appearance); the api sits on an `api.` alias of the domain.
 * The kind is chosen at creation and never changes; it decides routing, the appearance floor,
 * whether a theme is allowed and whether default pages are materialized.
 */
export class TenantKind extends Enum {
  static readonly SITE = new TenantKind('site');
  static readonly WORKSPACE = new TenantKind('workspace');

  private constructor(value: string) {
    super(value);
  }

  /** Strict: an unknown value is `undefined`, never a guessed kind. */
  static parse(value: unknown): TenantKind | undefined {
    if (value instanceof TenantKind) return value;
    return TenantKind.fromValue(String(value ?? '').trim().toLowerCase()) as TenantKind | undefined;
  }

  get isWorkspace(): boolean {
    return this === TenantKind.WORKSPACE;
  }
}
