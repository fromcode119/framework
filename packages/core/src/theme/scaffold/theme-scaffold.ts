import { ThemeScaffoldContextFiles } from '@core/theme/scaffold/theme-scaffold-context-files';
import { ThemeScaffoldLayoutFiles } from '@core/theme/scaffold/theme-scaffold-layout-files';
import { ThemeScaffoldProjectFiles } from '@core/theme/scaffold/theme-scaffold-project-files';
import { ThemeScaffoldStyleFiles } from '@core/theme/scaffold/theme-scaffold-style-files';
import type { IThemeScaffoldInput } from '@core/theme/scaffold/interfaces/theme-scaffold-input.interface';

/**
 * The files a new theme starts with: a theme that builds, boots and renders a page inside the layouts
 * the CMS offers, with its colours and fonts as editable theme settings.
 *
 * The templates are code, not fixtures on disk, because the CLI ships as a bundle with no source tree
 * beside it. They are generated from a theme that builds, so the starting point is the shape the platform
 * runs today and not a stub that has to be rediscovered file by file.
 */
export class ThemeScaffold {
  static readonly SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  /** `My Shop` becomes `my-shop`. */
  static slugFor(name: string): string {
    return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /** Path (inside the theme folder) to file content. Throws for a slug that is not a safe folder name. */
  static files(input: IThemeScaffoldInput): Record<string, string> {
    if (!ThemeScaffold.SLUG_PATTERN.test(input.slug)) {
      throw new Error(`"${input.slug}" is not a theme slug: use lowercase letters, digits and hyphens.`);
    }
    return {
      ...ThemeScaffoldProjectFiles.files(input),
      ...ThemeScaffoldContextFiles.files(input.slug),
      ...ThemeScaffoldLayoutFiles.files(input.slug),
      ...ThemeScaffoldStyleFiles.files(input.slug),
    };
  }
}
