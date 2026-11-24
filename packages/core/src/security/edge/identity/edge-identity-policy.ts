import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * How long edge identities last (Settings → Security → Edges), and the name they are issued under.
 *
 * Read from the platform's settings; a value nobody saved is the setting's declared default, the same one
 * the console shows. The trust domain is the platform's own API host — never a name written in code.
 */
export class EdgeIdentityPolicy {
  constructor(
    readonly trustDomain: string,
    readonly tokenMinutes: number,
    readonly certificateHours: number,
    readonly intermediateDays: number,
  ) {}

  /** The policy from the settings cache, under `trustDomain`. Refuses an empty trust domain. */
  static from(settings: Map<string, string>, trustDomain: string): EdgeIdentityPolicy {
    const domain = String(trustDomain ?? '').trim().toLowerCase();
    if (!domain) throw new Error('Edges need the platform\'s API address: set the API URL of this deployment first.');
    const keys = SystemConstants.META_KEY;
    const read = (key: typeof keys[keyof typeof keys]): number => {
      const value = Number.parseInt(String(settings.get(key) ?? SystemSettingRegistry.defaultValueOf(key) ?? ''), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const policy = new EdgeIdentityPolicy(domain, read(keys.EDGE_ENROLLMENT_TOKEN_MINUTES), read(keys.EDGE_CERTIFICATE_HOURS), read(keys.EDGE_CA_INTERMEDIATE_DAYS));
    if (!policy.tokenMinutes || !policy.certificateHours || !policy.intermediateDays) {
      throw new Error('Settings → Security → Edges: every lifetime must be a whole number above zero.');
    }
    // A working certificate must outlive at least two edge certificates, or edges would be cut off at rotation.
    if (policy.intermediateDays * 24 < policy.certificateHours * 2) {
      throw new Error('Settings → Security → Edges: the working certificate must last at least twice as long as an edge certificate.');
    }
    return policy;
  }
}
