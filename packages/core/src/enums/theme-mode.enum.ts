import { Enum } from '@fromcode119/reactor';

/** Light/dark colour scheme. */
export class ThemeMode extends Enum {
  static readonly LIGHT = new ThemeMode('light');
  static readonly DARK = new ThemeMode('dark');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a stored/raw string to a member; defaults to LIGHT. */
  static resolve(value: unknown): ThemeMode {
    if (value instanceof ThemeMode) return value;
    const found = ThemeMode.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ThemeMode | undefined) ?? ThemeMode.LIGHT;
  }
}
