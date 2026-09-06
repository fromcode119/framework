import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';

const created: string[] = [];

function makePackage(files: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-layout-'));
  created.push(root);
  for (const file of files) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '');
  }
  return root;
}

afterEach(() => {
  while (created.length) fs.rmSync(created.pop() as string, { recursive: true, force: true });
});

describe('PluginPackageLayout.resolve', () => {
  it('fills the server entry unconditionally, so a source-only archive still fails validation', () => {
    const root = makePackage([]);
    const manifest = PluginPackageLayout.resolve(root, { slug: 'x' } as any) as any;
    expect(manifest.main).toBe('index.js');
  });

  it('fills the UI bundles only when the package actually ships them', () => {
    const withUi = makePackage(['index.js', 'src/ui/bundle.js', 'src/ui/frontend.js']);
    const uiManifest = PluginPackageLayout.resolve(withUi, { slug: 'x' } as any) as any;
    expect(uiManifest.ui.entry).toBe('bundle.js');
    expect(uiManifest.ui.frontendEntry).toBe('frontend.js');

    const adminOnly = makePackage(['index.js', 'src/ui/bundle.js']);
    const adminManifest = PluginPackageLayout.resolve(adminOnly, { slug: 'x' } as any) as any;
    expect(adminManifest.ui.entry).toBe('bundle.js');
    expect(adminManifest.ui.frontendEntry).toBeUndefined();

    const noUi = makePackage(['index.js']);
    const bare = PluginPackageLayout.resolve(noUi, { slug: 'x' } as any) as any;
    expect(bare.ui).toBeUndefined();
  });

  it('accepts the mirrored ui/ directory as well as src/ui/', () => {
    const root = makePackage(['index.js', 'ui/bundle.js']);
    const manifest = PluginPackageLayout.resolve(root, { slug: 'x' } as any) as any;
    expect(manifest.ui.entry).toBe('bundle.js');
  });

  it('drops a conventional UI entry whose bundle is missing, instead of advertising a 404 asset', () => {
    const root = makePackage(['index.js']);
    const manifest = PluginPackageLayout.resolve(root, { slug: 'x', ui: { entry: 'bundle.js', loadStrategy: 'idle' } } as any) as any;
    expect(manifest.ui.entry).toBeUndefined();
    expect(manifest.ui.loadStrategy).toBe('idle');
  });

  it('fills the migrations directory only when the package ships one', () => {
    const withMigrations = makePackage(['index.js', 'dist/migrations/001-init.js']);
    expect((PluginPackageLayout.resolve(withMigrations, { slug: 'x' } as any) as any).migrations).toBe('dist/migrations');

    const without = makePackage(['index.js']);
    expect((PluginPackageLayout.resolve(without, { slug: 'x' } as any) as any).migrations).toBeUndefined();
  });

  it('never overrides a value the manifest declares explicitly', () => {
    const root = makePackage(['index.js', 'src/ui/bundle.js', 'dist/migrations/001-init.js']);
    const manifest = PluginPackageLayout.resolve(root, {
      slug: 'x',
      main: 'server/entry.js',
      migrations: 'build/sql',
      ui: { entry: 'admin.js' },
    } as any) as any;

    expect(manifest.main).toBe('server/entry.js');
    expect(manifest.migrations).toBe('build/sql');
    expect(manifest.ui.entry).toBe('admin.js');
  });

  /**
   * A plugin's admin UI is styled by utilities the admin's own stylesheet cannot contain — plugins
   * install at runtime, so the plugin set is unknown when that stylesheet is built. The plugin ships
   * its own `style.css` instead and the admin loads it from `ui.css`. Deriving that here is what
   * keeps every manifest from restating a path the build already decided.
   */
  it('derives ui.css from the stylesheet the plugin ships', () => {
    const styled = makePackage(['index.js', 'src/ui/bundle.js', 'src/ui/style.css']);
    const manifest = PluginPackageLayout.resolve(styled, { slug: 'x' } as any) as any;
    expect(manifest.ui.adminCss).toEqual(['style.css']);

    // An archive may carry the mirrored `ui/` copy instead of `src/ui/`.
    const mirrored = makePackage(['index.js', 'ui/bundle.js', 'ui/style.css']);
    expect((PluginPackageLayout.resolve(mirrored, { slug: 'x' } as any) as any).ui.adminCss).toEqual(['style.css']);
  });

  it('advertises no stylesheet when the plugin ships none', () => {
    const root = makePackage(['index.js', 'src/ui/bundle.js']);
    const manifest = PluginPackageLayout.resolve(root, { slug: 'x' } as any) as any;
    expect(manifest.ui.adminCss).toBeUndefined();
  });

  it('withdraws only its OWN guess, never an operator declaration', () => {
    // A stale `["style.css"]` on a package that ships none would have the admin fetch a 404.
    const root = makePackage(['index.js', 'src/ui/bundle.js']);
    const derived = PluginPackageLayout.resolve(root, { slug: 'x', ui: { adminCss: ['style.css'] } } as any) as any;
    expect(derived.ui.adminCss).toBeUndefined();

    // A manifest naming its own stylesheets is left exactly as declared, present on disk or not.
    const declared = PluginPackageLayout.resolve(root, { slug: 'x', ui: { adminCss: ['theme.css'] } } as any) as any;
    expect(declared.ui.adminCss).toEqual(['theme.css']);

    // A plugin's own `css` is for BOTH surfaces and must never be touched by the admin derivation.
    const shared = PluginPackageLayout.resolve(root, { slug: 'x', ui: { css: ['shared.css'] } } as any) as any;
    expect(shared.ui.css).toEqual(['shared.css']);
  });

  it('is idempotent — resolving twice changes nothing', () => {
    const root = makePackage(['index.js', 'src/ui/bundle.js', 'dist/migrations/001-init.js']);
    const once = JSON.stringify(PluginPackageLayout.resolve(root, { slug: 'x' } as any));
    const twice = JSON.stringify(PluginPackageLayout.resolve(root, JSON.parse(once)));
    expect(twice).toBe(once);
  });
});
