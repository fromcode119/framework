import { Enum } from '@fromcode119/reactor';

/** Where a resolved layout came from. */
export class LayoutResolutionSource extends Enum {
  static readonly PLUGIN = new LayoutResolutionSource('plugin');
  static readonly THEME_REPLACEMENT = new LayoutResolutionSource('theme-replacement');

  private constructor(value: string) {
    super(value);
  }
}
