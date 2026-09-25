import { SystemConstants } from '@core/constants/system.constants';
import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { NetworkEdgeProviderRegistry } from '@core/security/providers/network-edge-provider-registry';
import type { ISystemSettingDescriptor } from '@core/settings/interfaces/system-setting-descriptor.interface';
import { SystemSettingDescriptors } from '@core/settings/system-setting-descriptors';


/**
 * The single place a system setting's SCOPE is declared.
 *
 * Before this registry, scope was decided by whether a key happened to appear in a hand-written array
 * (`TenantBespokePolicies.PLATFORM_KEYS`) — so a key was per-site by omission, silently, and every
 * reader involved fails closed, which is exactly how `admin_search_indexing`, `framework_repository`
 * and `sources_workspace_root` shipped broken: the write landed under whichever tenant the request
 * carried, the platform-only reader never found it, and nothing on the page or in a log said so.
 *
 * Keying the registry by the META_KEY map's own values makes that specific bug a compile error: every
 * value `META_KEY` declares must have an entry here, or the file does not build.
 *
 * MUST NOT import `TenantMode` or `PlatformSettingsService` — scope belongs to the setting, mode
 * belongs to the deployment, and only `SystemSettingsController.updateSettings` branches on mode.
 */
export class SystemSettingRegistry {
  private static readonly KEY = SystemConstants.META_KEY;

  /** Every declared setting — see {@link SystemSettingDescriptors}. */
  private static readonly REGISTRY = SystemSettingDescriptors.ALL;

  private static platformKeysCache: string[] | null = null;
  private static writableKeysCache: Set<string> | null = null;
  private static exposedKeysCache: Set<string> | null = null;

  /** The descriptor for a declared key. Throws for anything not in `META_KEY` — never guesses. */
  static describe(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): ISystemSettingDescriptor {
    const descriptor = SystemSettingRegistry.REGISTRY[key];
    if (!descriptor) {
      throw new Error(`SystemSettingRegistry: "${key}" is not a declared system setting.`);
    }
    return descriptor;
  }

  static scopeOf(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): SettingScope {
    return SystemSettingRegistry.describe(key).scope;
  }

  static isPlatform(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): boolean {
    return SystemSettingRegistry.scopeOf(key).isPlatform;
  }

  /**
   * Is this key DECLARED and SITE-scoped? True only for a key the registry knows and marks SITE.
   *
   * An undeclared key answers FALSE rather than throwing, on purpose: `PlatformSettingsService`
   * also carries keys that never came from `META_KEY`, and the point of the guard is to catch a
   * scope MISMATCH, not to police every string that reaches the settings store.
   */
  static isDeclaredSiteScoped(key: string): boolean {
    const descriptor = (SystemSettingRegistry.REGISTRY as Record<string, ISystemSettingDescriptor>)[key];
    return Boolean(descriptor) && !descriptor.scope.isPlatform;
  }

  /** Every declared key that may be returned to an admin client. */
  static exposedKeys(): Set<string> {
    if (!SystemSettingRegistry.exposedKeysCache) {
      SystemSettingRegistry.exposedKeysCache = new Set(
        Object.entries(SystemSettingRegistry.REGISTRY)
          .filter(([, descriptor]) => descriptor.exposed)
          .map(([key]) => key),
      );
    }
    return SystemSettingRegistry.exposedKeysCache;
  }



  /** Every seeded default, resolved — the list the boot seed writes. */
  static seedDefaults(): Array<{ key: string; value: string; description: string; group: string }> {
    return Object.entries(SystemSettingRegistry.REGISTRY)
      .filter(([, descriptor]) => Boolean(descriptor.seed))
      .map(([key, descriptor]) => {
        const seed = descriptor.seed!;
        return {
          key,
          value: typeof seed.value === 'function' ? seed.value() : seed.value,
          description: seed.description,
          group: seed.group,
        };
      });
  }

  /**
   * The declared default of every EXPOSED seeded setting, keyed by setting — what a reader uses when a
   * site has no value, handed to the admin so an empty field can say so instead of looking unset.
   */
  static exposedDefaults(): Record<string, string> {
    const exposed = SystemSettingRegistry.exposedKeys();
    return Object.fromEntries(
      SystemSettingRegistry.seedDefaults()
        .filter((entry) => exposed.has(entry.key))
        .map((entry) => [entry.key, entry.value]),
    );
  }

  /** A single declared default, for a reader that needs it without running the seed. */
  static defaultValueOf(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): string {
    const seed = SystemSettingRegistry.describe(key).seed;
    if (!seed) return '';
    return typeof seed.value === 'function' ? seed.value() : seed.value;
  }

  static isWritable(key: string): boolean {
    return SystemSettingRegistry.writableKeys().has(key);
  }

  /**
   * Every key the platform owns a row for — PLATFORM and INHERITED alike.
   *
   * This is what the `_system_meta` row-level policy publishes to tenants, so an INHERITED key MUST
   * stay in it: dropping one would hide the platform's value from every site that has not set its own,
   * which is the inheritance itself.
   *
   * Deep-equal to the pre-registry 18-key list — see the guard test.
   */
  static platformKeys(): string[] {
    if (!SystemSettingRegistry.platformKeysCache) {
      SystemSettingRegistry.platformKeysCache = Object.entries(SystemSettingRegistry.REGISTRY)
        .filter(([, descriptor]) => descriptor.scope.isPlatform)
        .map(([key]) => key);
    }
    return [...SystemSettingRegistry.platformKeysCache];
  }

  /**
   * The keys a site may override with its own row.
   *
   * A SUBSET of {@link platformKeys}, never a rival to it: these keys keep their platform row and its
   * visibility, and gain a per-site one. The admin needs them apart because the two scopes show and
   * write them differently; the database does not, which is why the policy still reads the full list.
   */
  static inheritedKeys(): string[] {
    return Object.entries(SystemSettingRegistry.REGISTRY)
      .filter(([, descriptor]) => descriptor.scope.isInherited)
      .map(([key]) => key);
  }

  /** SITE keys whose value only a platform admin may write — see `platformAdminWrites`. */
  static platformAdminWrittenKeys(): Set<string> {
    return new Set(
      Object.entries(SystemSettingRegistry.REGISTRY)
        .filter(([, descriptor]) => descriptor.platformAdminWrites === true)
        .map(([key]) => key),
    );
  }

  /** Every key the generic settings PUT may accept. */
  static writableKeys(): Set<string> {
    if (!SystemSettingRegistry.writableKeysCache) {
      SystemSettingRegistry.writableKeysCache = new Set(
        Object.entries(SystemSettingRegistry.REGISTRY)
          .filter(([, descriptor]) => descriptor.writable)
          .map(([key]) => key),
      );
    }
    return SystemSettingRegistry.writableKeysCache;
  }
}
