import { Enum } from '@fromcode119/reactor';

/** Active tab on the theme settings page. */
export class ThemeSettingsTab extends Enum {
  static readonly OVERVIEW = new ThemeSettingsTab('overview');
  static readonly SETTINGS = new ThemeSettingsTab('settings');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a `?tab=` string to a member; defaults to OVERVIEW. */
  static resolve(value: unknown): ThemeSettingsTab {
    if (value instanceof ThemeSettingsTab) return value;
    const found = ThemeSettingsTab.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ThemeSettingsTab | undefined) ?? ThemeSettingsTab.OVERVIEW;
  }
}
