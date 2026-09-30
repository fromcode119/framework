import { Enum } from '@fromcode119/react-class-components/lang';

/** Where a role is defined: the platform's catalog, the same on every site, or one site's own. */
export class RoleScope extends Enum {
  /** `_system_roles` — visible to every site, defined only in platform scope. */
  static readonly PLATFORM = new RoleScope('platform');

  /** `_system_site_roles` — one site's own, invisible to every other. */
  static readonly SITE = new RoleScope('site');

  private constructor(value: string) {
    super(value);
  }
}
