import { describe, expect, it } from 'vitest';
import { ThemeScaffold } from '@core/theme/scaffold/theme-scaffold';

const files = (slug = 'my-shop') => ThemeScaffold.files({ slug, name: 'My Shop', description: 'A shop.' });

/** A new theme must start on a shape the platform builds and runs; these pin that shape. */
describe('ThemeScaffold', () => {
  it('writes the manifest, project config, source, styles and a test', () => {
    const paths = Object.keys(files());

    for (const expected of ['theme.json', 'package.json', 'tsconfig.json', 'vitest.config.ts', '.gitignore', 'README.md',
      'src/theme-boot.ts', 'src/theme.config.ts', 'src/layouts/layout-catalog.ts', 'src/layouts/page-layout.tsx',
      'src/components/app.tsx', 'src/styles/tokens.css', 'src/styles/base.css', 'src/i18n/en.json', 'src/tests/layout-catalog.test.ts']) {
      expect(paths, expected).toContain(expected);
    }
  });

  it('declares settings the operator can edit, each with a label and a control, and a default', () => {
    const manifest = JSON.parse(files()['theme.json']);

    expect(Object.keys(manifest.variableSchema).sort()).toEqual(Object.keys(manifest.variables).sort());
    for (const setting of Object.values<any>(manifest.variableSchema)) {
      expect(setting.label).toBeTruthy();
      expect(['color', 'font', 'text', 'number', 'image', 'select']).toContain(setting.type);
    }
  });

  it('names the theme in its stylesheet, its identity and its build output, and nowhere leaves the placeholder', () => {
    const all = files('my-shop');

    expect(all['src/constants/theme-identity.ts']).toContain("SLUG = 'my-shop'");
    expect(JSON.parse(all['theme.json']).ui.css).toEqual(['my-shop-theme.css']);
    expect(all['src/styles/base.css']).toContain('.my-shop-page');
    for (const [path, content] of Object.entries(all)) {
      expect(content, path).not.toContain('__SLUG__');
      expect(content, path).not.toMatch(/\bshop-page\b(?<!my-shop-page)/);
    }
  });

  it('lists the layouts in theme.json and in the catalogue under the same keys', () => {
    const all = files();
    const manifest = JSON.parse(all['theme.json']);

    for (const layout of manifest.layouts) expect(all['src/layouts/layout-catalog.ts']).toContain(`'${layout.name}'`);
    expect(all['src/layouts/layout-catalog.ts']).toContain(`DEFAULT_KEY = '${manifest.defaultLayout}'`);
  });

  it('imports only files the scaffold itself writes', () => {
    const all = files();
    const written = new Set(Object.keys(all));
    const known = (importPath: string) => ['', '.ts', '.tsx'].some((ext) => written.has(`src/${importPath}${ext}`));

    for (const [path, content] of Object.entries(all)) {
      if (!path.startsWith('src/')) continue;
      for (const match of content.matchAll(/from '@theme\/([^']+)'/g)) expect(known(match[1]), `${path} imports ${match[1]}`).toBe(true);
    }
  });

  it('refuses a slug that is not a safe folder name', () => {
    for (const bad of ['', '../escape', 'Has Space', 'UPPER', 'a/b', '-lead']) {
      expect(() => files(bad)).toThrow();
    }
  });

  it('turns a name into a slug', () => {
    expect(ThemeScaffold.slugFor('  My Shop & Co.  ')).toBe('my-shop-co');
  });
});
