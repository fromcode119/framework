import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Something this platform can do that a theme may depend on, named so a theme can say it needs it.
 *
 * Features, not version numbers: an author cannot know the release a capability will ship in, and a
 * number invites the wrong comparison (a fork, a backport). A theme lists what it needs under `requires`
 * in `theme.json`; a platform without it refuses the theme with the feature's name.
 */
export class PlatformFeature extends Enum {
  /** The theme runtime in `@fromcode119/sdk/react`: `ThemeComponent`, `ThemeProvider`, `ThemeLayoutShell`. */
  static readonly THEME_RUNTIME = new PlatformFeature('theme-runtime');

  private constructor(value: string) {
    super(value);
  }
}
