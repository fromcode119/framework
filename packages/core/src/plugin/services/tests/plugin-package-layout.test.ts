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

  it('is idempotent — resolving twice changes nothing', () => {
    const root = makePackage(['index.js', 'src/ui/bundle.js', 'dist/migrations/001-init.js']);
    const once = JSON.stringify(PluginPackageLayout.resolve(root, { slug: 'x' } as any));
    const twice = JSON.stringify(PluginPackageLayout.resolve(root, JSON.parse(once)));
    expect(twice).toBe(once);
  });
});
