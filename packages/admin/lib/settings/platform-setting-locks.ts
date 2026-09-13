import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Which settings on a screen belong to the PLATFORM rather than to the site being administered.
 *
 * The list is the SERVER's — `TenantBespokePolicies.platformKeys()`, the same definition the row-level
 * policy and the tenant importer read — so the admin never keeps a second copy to drift from. It is
 * fetched, not guessed: a site administrator may read a deployment truth like the marketplace URL, but
 * a save is refused, and a form that renders it as an editable input is offering a control that cannot
 * act.
 *
 * `editable` is true on a single-tenant deployment and for a platform admin — there, nothing is locked.
 */
export class PlatformSettingLocks {
  private constructor(
    private readonly keys: Set<string>,
    private readonly editable: boolean,
    private readonly tenantMode: boolean,
  ) {}

  /** Nothing locked — the state before the answer arrives, and after a failed request. */
  static none(): PlatformSettingLocks {
    return new PlatformSettingLocks(new Set(), true, false);
  }

  static async load(): Promise<PlatformSettingLocks> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS_PLATFORM_KEYS).catch(() => null);
    if (!response) return PlatformSettingLocks.none();
    const keys: string[] = Array.isArray(response.keys) ? response.keys.map((key: unknown) => String(key)) : [];
    return new PlatformSettingLocks(new Set(keys), response.editable !== false, response.tenantMode === true);
  }

  /** Is this setting owned by the platform AND out of this account's reach? */
  locks(key: string): boolean {
    return !this.editable && this.keys.has(key);
  }

  /**
   * Is this setting platform-wide — worth SAYING so, even to someone who may change it?
   *
   * False on a single-tenant deployment however the key is declared: with one site there is no
   * second scope to contrast with, so naming one would be noise on a screen the owner wants compact.
   */
  isPlatform(key: string): boolean {
    return this.tenantMode && this.keys.has(key);
  }
}
