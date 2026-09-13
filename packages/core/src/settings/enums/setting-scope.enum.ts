import { Enum } from '@fromcode119/react-class-components';

/**
 * Who a system setting's value is FOR: the whole deployment, or one site on it.
 *
 * This is a property of what READS the setting — never of what an operator chose, never stored, never
 * inferred at runtime from whether a request happens to carry a tenant. See
 * {@link SystemSettingRegistry}, the one place every key is assigned one of these.
 */
export class SettingScope extends Enum {
  /** Read at boot, in the background, or by platform infrastructure — one value for every site. */
  static readonly PLATFORM = new SettingScope('platform');
  /** Read for the site the request is about — one value per site. */
  static readonly SITE = new SettingScope('site');

  private constructor(value: string) {
    super(value);
  }

  get isPlatform(): boolean {
    return this === SettingScope.PLATFORM;
  }
}
