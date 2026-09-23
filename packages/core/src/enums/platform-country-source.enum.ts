import { Enum } from '@fromcode119/react-class-components';

/** Where the platform country came from — so the admin can say it, not just use it. */
export class PlatformCountrySource extends Enum {
  /** The operator chose it in Settings → Localization. */
  static readonly SETTING = new PlatformCountrySource('setting');
  /** Nothing chosen; derived from the frontend language (e.g. `bg` → BG). */
  static readonly LANGUAGE = new PlatformCountrySource('language');
  /** Nothing chosen and the language names no region. */
  static readonly NONE = new PlatformCountrySource('none');

  private constructor(value: string) {
    super(value);
  }
}
