/** ThemeScaffoldService — creates new theme boilerplate on disk. Extracted from ThemeManager (ARC-007). */

import path from 'path';
import fs from 'fs';
import { Logger } from '@fromcode119/sdk';
import type { ScaffoldThemeInput, ScaffoldThemeResult } from './theme-scaffold-service.interfaces';

export class ThemeScaffoldService {
  constructor(
    private readonly logger: Logger,
    private readonly themesRoot: string,
    private readonly hasTheme: (slug: string) => boolean,
    private readonly discoverThemes: () => Promise<void>,
    private readonly activateTheme: (slug: string) => Promise<void>,
  ) {}

  async scaffoldTheme(input: ScaffoldThemeInput): Promise<ScaffoldThemeResult> {
    const slug = String(input.slug || '').trim().toLowerCase();
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const version = String(input.version || '1.0.0').trim() || '1.0.0';
    const activate = input.activate !== false;

    if (!slug || !name) throw new Error('Theme slug and name are required');

    const themePath = path.join(this.themesRoot, slug);
    if (this.hasTheme(slug)) throw new Error(`Theme "${slug}" already exists.`);
    if (fs.existsSync(themePath)) throw new Error(`Theme path already exists: ${themePath}`);

    fs.mkdirSync(path.join(themePath, 'ui'), { recursive: true });

    const themeManifest = {
      slug, name, version, description,
      author: 'Forge',
      ui: { entry: 'index.js', css: ['theme.css'] },
      variables: { primary: '#0ea5e9', accent: '#f97316', background: '#ffffff', surface: '#f8fafc', text: '#0f172a' },
    };

    const uiEntry = [
      "import './theme.css';", '',
      'export const init = () => {',
      `  console.info('[theme:${slug}] initialized.');`,
      '};', '',
      'if (typeof window !== "undefined") {',
      '  init();',
      '}', '',
    ].join('\n');

    const themeCss = [
      ':root {',
      '  --theme-primary: #0ea5e9;',
      '  --theme-accent: #f97316;',
      '  --theme-background: #ffffff;',
      '  --theme-surface: #f8fafc;',
      '  --theme-text: #0f172a;',
      '}', '',
    ].join('\n');

    fs.writeFileSync(path.join(themePath, 'theme.json'), `${JSON.stringify(themeManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'index.js'), uiEntry, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'theme.css'), themeCss, 'utf8');

    await this.discoverThemes();

    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      try { await this.activateTheme(slug); activated = true; }
      catch (error: any) { activationError = String(error?.message || 'Activation failed'); }
    }

    this.logger.info(`Theme "${slug}" scaffolded at ${themePath}`);
    return { slug, name, path: themePath, activated, activationError, manifest: themeManifest };
  }

  generateCssVariables(variables: Record<string, string>): string {
    const lines = Object.entries(variables).map(([key, value]) => {
      const cssKey = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `${cssKey}: ${value};`;
    });
    return `:root {\n  ${lines.join('\n  ')}\n}`;
  }
}
