import { PlatformFeature } from '@core/theme/enums/platform-feature.enum';
import type { IThemeScaffoldInput } from '@core/theme/scaffold/interfaces/theme-scaffold-input.interface';

/**
 * What surrounds the source: the manifest with its editable settings, the package and compiler
 * configuration, the git ignore list, the README and the first test. The manifest declares the colours
 * and fonts as theme settings, so a new theme is editable under Themes from its first build.
 */
export class ThemeScaffoldProjectFiles {
  static files(input: IThemeScaffoldInput): Record<string, string> {
    return {
      'theme.json': ThemeScaffoldProjectFiles.json(ThemeScaffoldProjectFiles.manifest(input)),
      'package.json': ThemeScaffoldProjectFiles.json(ThemeScaffoldProjectFiles.packageJson(input)),
      'tsconfig.json': ThemeScaffoldProjectFiles.json(ThemeScaffoldProjectFiles.tsconfig()),
      'vitest.config.ts': ThemeScaffoldProjectFiles.vitestConfig(),
      '.gitignore': ThemeScaffoldProjectFiles.gitignore(),
      'README.md': ThemeScaffoldProjectFiles.readme(input),
      'src/tests/layout-catalog.test.ts': ThemeScaffoldProjectFiles.catalogTest(),
    };
  }

  private static json(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  private static manifest(input: IThemeScaffoldInput): Record<string, unknown> {
    const text = (label: string, type: string, description?: string) => ({ label, type, group: 'Brand', ...(description ? { description } : {}) });
    return {
      slug: input.slug,
      name: input.name,
      version: input.version || '0.1.0',
      description: input.description,
      // `ui.entry` and `ui.css` are what the build writes into ui/; nothing exists until `atlantis build theme`.
      ui: { entry: 'bundle.js', css: [`${input.slug}-theme.css`] },
      // Each variable is a theme setting the operator edits under Themes, and reaches the page as the CSS
      // variable `--theme-<name>` (primaryColor becomes --theme-primary-color). Defaults live here.
      variables: {
        primaryColor: '#1f2937',
        accentColor: '#b45309',
        backgroundColor: '#ffffff',
        surfaceColor: '#f5f5f4',
        textColor: '#1c1917',
        headingFont: 'system-ui',
        bodyFont: 'system-ui',
      },
      variableSchema: {
        primaryColor: text('Primary colour', 'color', 'Buttons and links.'),
        accentColor: text('Accent colour', 'color', 'Highlights and badges.'),
        backgroundColor: text('Page background', 'color'),
        surfaceColor: text('Panels background', 'color'),
        textColor: text('Text colour', 'color'),
        headingFont: text('Heading font', 'font'),
        bodyFont: text('Body font', 'font'),
      },
      // The layouts a CMS page can choose; src/layouts/layout-catalog.ts lists the same keys (a test checks it).
      layouts: [
        { name: 'page.default', label: 'Standard page', description: 'Content in a comfortable reading width.' },
        { name: 'page.wide', label: 'Wide page', description: 'Full-width sections with no side margins, for landing and home pages.' },
      ],
      defaultLayout: 'page.default',
      // What the theme's source imports from the SDK; a platform without it refuses the theme instead of loading a broken one.
      requires: [PlatformFeature.THEME_RUNTIME.value],
      blocks: [],
      slots: [],
      capabilities: ['content', 'i18n', 'theming'],
      dependencies: { cms: '0.1.1' },
      vendorChunks: {},
      // Globs the build reads to find the theme's styles and block renderers. No renderers until you write some.
      build: { styles: ['./styles/*.css'], components: [], eagerComponents: [] },
    };
  }

  private static packageJson(input: IThemeScaffoldInput): Record<string, unknown> {
    return {
      name: `${input.slug}-theme`,
      private: true,
      version: input.version || '0.1.0',
      type: 'module',
      description: input.description,
      overrides: { react: '19.0.0', 'react-dom': '19.0.0' },
      scripts: {
        build: `echo "Build from the workspace root: atlantis build theme ${input.slug}" && exit 1`,
        test: 'vitest run --config vitest.config.ts',
      },
      dependencies: { react: '19.0.0', 'react-dom': '19.0.0' },
      devDependencies: { typescript: '^5.5.0', vitest: '^4.1.8', '@types/react': '19.0.0', '@types/react-dom': '19.0.0' },
    };
  }

  private static tsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        target: 'ES2020',
        // Reactor's @prop and @state are legacy decorators, and its class fields must not use define semantics.
        useDefineForClassFields: false,
        experimentalDecorators: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'], '@theme/*': ['./src/*'] },
      },
      include: ['src'],
    };
  }

  private static vitestConfig(): string {
    return [
      "import { defineConfig } from 'vitest/config';",
      "import path from 'node:path';",
      '',
      'export default defineConfig({',
      "  resolve: { alias: { '@theme': path.resolve(__dirname, 'src') } },",
      "  test: { environment: 'node', globals: true, include: ['src/tests/**/*.test.ts'] },",
      '});',
      '',
    ].join('\n');
  }

  private static gitignore(): string {
    return [
      'node_modules',
      '# Build output, anchored to the root so src/lib/ui/ stays visible to git.',
      '/ui/',
      '/ui-ssr/',
      '/seed.mjs',
      '*.tsbuildinfo',
      '.DS_Store',
      '',
    ].join('\n');
  }

  private static readme(input: IThemeScaffoldInput): string {
    return [
      `# ${input.name}`,
      '',
      input.description,
      '',
      '## Work on it',
      '',
      '```bash',
      `atlantis build theme ${input.slug}    # compile src/ into ui/`,
      `atlantis theme dev ${input.slug}      # rebuild on every change`,
      '```',
      '',
      '## Where things are',
      '',
      '- `theme.json`: the theme\'s settings (colours, fonts: editable under Themes) and its layouts.',
      '- `src/layouts/`: the layouts a CMS page can choose. Add one to `layout-catalog.ts` and to `theme.json`.',
      '- `src/components/app.tsx`: the site chrome. Put the header, menu and footer here.',
      '- `src/styles/`: the stylesheets. Colours and fonts come from the `--theme-*` variables, never from a copy here.',
      '- `src/i18n/`: the words the theme\'s own components show.',
      '',
      'The CMS and the plugins supply the content blocks; a theme only supplies design and chrome.',
      '',
    ].join('\n');
  }

  private static catalogTest(): string {
    return [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "import { describe, expect, it } from 'vitest';",
      "import { ThemeLayoutCatalog } from '@theme/layouts/layout-catalog';",
      '',
      "describe('layout catalogue', () => {",
      "  it('lists the same layouts as theme.json, so the admin picker and the runtime agree', () => {",
      "    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../theme.json'), 'utf8'));",
      "    expect(manifest.layouts.map((layout: { name: string }) => layout.name)).toEqual(ThemeLayoutCatalog.TEMPLATES.map((template) => template.key));",
      '    expect(manifest.defaultLayout).toBe(ThemeLayoutCatalog.DEFAULT_KEY);',
      '  });',
      '});',
      '',
    ].join('\n');
  }
}
