import { Enum } from '@fromcode119/react-class-components/lang';

/** Why a site's plugin upload or removal was refused — each maps to one HTTP status in the api. */
export class TenantPluginRefusalReason extends Enum {
  /** The platform has not turned site plugin uploads on. */
  static readonly DISABLED = new TenantPluginRefusalReason('disabled');
  /** The server cannot run a plugin under its own user. */
  static readonly ISOLATION_UNAVAILABLE = new TenantPluginRefusalReason('isolation_unavailable');
  /** The package is not a readable plugin. */
  static readonly INVALID = new TenantPluginRefusalReason('invalid');
  /** The package asks for something a site's plugin may not have. */
  static readonly POLICY = new TenantPluginRefusalReason('policy');
  /** Another plugin on the server already has this slug. */
  static readonly SLUG_TAKEN = new TenantPluginRefusalReason('slug_taken');
  /** Over the site's space or count. */
  static readonly QUOTA = new TenantPluginRefusalReason('quota');
  /** Not one of this site's plugins. */
  static readonly NOT_FOUND = new TenantPluginRefusalReason('not_found');

  private constructor(value: string) {
    super(value);
  }
}
