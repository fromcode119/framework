import { Enum } from '@fromcode119/reactor';

/** Active tab on the security settings page. */
export class SecurityTab extends Enum {
  static readonly DASHBOARD = new SecurityTab('dashboard');
  static readonly SETTINGS = new SecurityTab('settings');

  private constructor(value: string) {
    super(value);
  }
}
