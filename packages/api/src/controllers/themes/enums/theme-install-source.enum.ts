import { Enum } from '@fromcode119/react-class-components';

/** Where a marketplace theme's package came from when it was installed. */
export class ThemeInstallSource extends Enum {
  /** A package this installation built itself (a Sources build offered in its own catalogue). */
  static readonly LOCAL = new ThemeInstallSource('local');
  /** A package downloaded from the marketplace. */
  static readonly MARKETPLACE = new ThemeInstallSource('marketplace');

  private constructor(value: string) {
    super(value);
  }
}
