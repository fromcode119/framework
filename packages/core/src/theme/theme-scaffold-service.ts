/** ThemeScaffoldService — creates a new theme on disk, builds it, and activates it only once it is built. */

import path from 'path';
import fs from 'fs';
import { Logger } from '@core/logging';
import { ThemeScaffold } from '@core/theme/scaffold/theme-scaffold';
import type { IScaffoldThemeInput } from '@core/theme/interfaces/scaffold-theme-input.interface';
import type { IScaffoldThemeResult } from '@core/theme/interfaces/scaffold-theme-result.interface';
import type { IThemeBuilder } from '@core/theme/interfaces/theme-builder.interface';

export class ThemeScaffoldService {
  constructor(
    private readonly logger: Logger,
    private readonly themesRoot: string,
    private readonly hasTheme: (slug: string) => boolean,
    private readonly discoverThemes: () => Promise<void>,
    private readonly activateTheme: (slug: string) => Promise<void>,
    /** The builder, when this installation has one. Asked at call time: the API supplies it after boot. */
    private readonly builder: () => IThemeBuilder | null,
  ) {}

  /**
   * The same theme `atlantis theme create` writes, compiled, and activated only if it compiled.
   *
   * It used to write a pre-bundle `ui/index.js` and activate at once. The theme a scaffold writes now has
   * a `src/` the platform cannot serve, so activating before the build would put an unbuilt theme in
   * front of every visitor. A failed build leaves the source on disk and says which step failed.
   */
  async scaffoldTheme(input: IScaffoldThemeInput): Promise<IScaffoldThemeResult> {
    const slug = String(input.slug || '').trim().toLowerCase();
    const name = String(input.name || '').trim();
    const activate = input.activate !== false;

    if (!slug || !name) throw new Error('Theme slug and name are required');

    const themePath = path.join(this.themesRoot, slug);
    if (this.hasTheme(slug)) throw new Error(`Theme "${slug}" already exists.`);
    if (fs.existsSync(themePath)) throw new Error(`Theme path already exists: ${themePath}`);

    const files = ThemeScaffold.files({
      slug,
      name,
      description: String(input.description || '').trim(),
      version: String(input.version || '').trim() || undefined,
    });
    for (const [relativePath, content] of Object.entries(files)) {
      const target = path.join(themePath, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    }

    const buildError = await this.build(themePath, slug);
    // After the build: it stamps `theme.json`, and discovery should read the manifest as it now is.
    await this.discoverThemes();

    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      if (buildError) {
        activationError = `Not activated: ${buildError}`;
      } else {
        try { await this.activateTheme(slug); activated = true; }
        catch (error: any) { activationError = String(error?.message || 'Activation failed'); }
      }
    }

    this.logger.info(`Theme "${slug}" scaffolded at ${themePath}${buildError ? ` (build failed: ${buildError})` : ''}`);
    return {
      slug, name, path: themePath, built: !buildError, buildError, activated, activationError,
      manifest: JSON.parse(files['theme.json']),
    };
  }

  /** The reason the build did not happen or failed, or null when the theme is built. */
  private async build(themePath: string, slug: string): Promise<string | null> {
    const builder = this.builder();
    if (!builder) return 'this installation has no theme builder; run `atlantis build theme ' + slug + '` on the server';
    try {
      await builder.build(themePath, slug);
      return null;
    } catch (error: any) {
      return String(error?.message || 'The build failed');
    }
  }
}
