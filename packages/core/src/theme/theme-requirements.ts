import { PlatformFeature } from '@core/theme/enums/platform-feature.enum';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';

/**
 * Whether this platform can run a theme, from what the theme says it needs.
 *
 * Checked where a theme enters (every install path) and where it is switched on, because a theme that
 * imports something this platform lacks does not degrade: its bundle fails to load and the site shows
 * nothing. Refusing it up front, with the missing feature named, is the only safe outcome.
 */
export class ThemeRequirements {
  /** The features of the platform running now. A feature is added here in the same change that adds it. */
  private static readonly PROVIDED: readonly string[] = [PlatformFeature.THEME_RUNTIME.value];

  /** What `requires` names that this platform does not provide, in the order the theme listed it. */
  static missing(manifest: Pick<IThemeManifest, 'requires'>): string[] {
    const requires = Array.isArray(manifest?.requires) ? manifest.requires : [];
    const names = requires.map((name) => String(name ?? '').trim()).filter(Boolean);
    return [...new Set(names)].filter((name) => !ThemeRequirements.PROVIDED.includes(name));
  }

  /** Throws a message an operator can act on when this platform cannot run the theme. */
  static assertMet(manifest: Pick<IThemeManifest, 'requires' | 'name' | 'slug'>): void {
    const missing = ThemeRequirements.missing(manifest);
    if (!missing.length) return;
    const theme = String(manifest.name || manifest.slug || 'This theme');
    throw new Error(
      `${theme} needs ${missing.length === 1 ? 'a feature' : 'features'} this platform does not have yet: ${missing.join(', ')}. `
      + 'Update the platform, then install the theme.',
    );
  }
}
