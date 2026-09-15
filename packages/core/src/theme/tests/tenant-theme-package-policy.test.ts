import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { TenantThemePackagePolicy } from '@core/theme/tenant-theme-package-policy';

/**
 * A site's uploaded theme carries no server code.
 *
 * The reason is not fastidiousness: a theme's `ui-ssr/entry.mjs` is loaded by a native `import()`
 * inside the Next.js frontend process, so server code in an uploaded package runs with the
 * frontend's privileges for EVERY tenant on the box. These tests are the gate on that.
 */

const DIRS: string[] = [];

function packageDir(build: (dir: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pkg-'));
  DIRS.push(dir);
  fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ slug: 'acme-one', name: 'One', version: '1.0.0', layouts: [] }));
  fs.mkdirSync(path.join(dir, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ui', 'index.js'), 'export default 1;');
  build(dir);
  return dir;
}

const manifest = (extra: Record<string, unknown> = {}) =>
  ({ slug: 'acme-one', name: 'One', version: '1.0.0', layouts: [], ...extra }) as any;

afterEach(() => {
  while (DIRS.length) fs.rmSync(DIRS.pop() as string, { recursive: true, force: true });
});

describe('what a site may upload as a theme', () => {
  it('accepts a plain browser theme — theme.json plus ui/', () => {
    const dir = packageDir(() => undefined);

    expect(TenantThemePackagePolicy.violations(dir, manifest())).toEqual([]);
  });

  it('REFUSES ui-ssr/, and says why in the operator’s terms', () => {
    const dir = packageDir((root) => {
      fs.mkdirSync(path.join(root, 'ui-ssr'));
      fs.writeFileSync(path.join(root, 'ui-ssr', 'entry.mjs'), 'export default 1;');
    });

    const violations = TenantThemePackagePolicy.violations(dir, manifest());

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/ui-ssr/);
    expect(violations[0]).toMatch(/browser only|no server code/i);
  });

  it('refuses bundled plugin directories, which are code on the shared box', () => {
    const withPlugins = packageDir((root) => fs.mkdirSync(path.join(root, 'plugins')));
    const withBundled = packageDir((root) => fs.mkdirSync(path.join(root, 'bundled-plugins')));
    const withModules = packageDir((root) => fs.mkdirSync(path.join(root, 'node_modules')));

    expect(TenantThemePackagePolicy.violations(withPlugins, manifest())).toHaveLength(1);
    expect(TenantThemePackagePolicy.violations(withBundled, manifest())).toHaveLength(1);
    expect(TenantThemePackagePolicy.violations(withModules, manifest())).toHaveLength(1);
  });

  it('refuses a manifest that asks the platform to DO something at install time', () => {
    const dir = packageDir(() => undefined);

    expect(TenantThemePackagePolicy.violations(dir, manifest({ seeds: 'seeds.js' }))[0]).toMatch(/seeds/);
    expect(TenantThemePackagePolicy.violations(dir, manifest({ dependencies: { alpha: '^1' } }))[0]).toMatch(/dependencies/);
    expect(TenantThemePackagePolicy.violations(dir, manifest({ bundledPlugins: ['x.zip'] }))[0]).toMatch(/bundledPlugins/);
  });

  it('treats an EMPTY declaration as no declaration, rather than failing a harmless package', () => {
    const dir = packageDir(() => undefined);

    expect(TenantThemePackagePolicy.violations(dir, manifest({ dependencies: {}, bundledPlugins: [], seeds: '' }))).toEqual([]);
  });

  it('REFUSES a symbolic link anywhere, even one pointing inside the package', () => {
    // The archive extractor blocks traversal on the way in; this is the second question. A link is
    // read through when the asset route serves it, and by then it points wherever it points.
    const dir = packageDir((root) => {
      fs.symlinkSync('/etc/passwd', path.join(root, 'ui', 'secrets.txt'));
    });

    const violations = TenantThemePackagePolicy.violations(dir, manifest());

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/symbolic link/i);
    expect(violations[0]).toMatch(/ui\/secrets\.txt/);
  });

  it('refuses a native binary', () => {
    const dir = packageDir((root) => fs.writeFileSync(path.join(root, 'ui', 'fast.node'), 'binary'));

    expect(TenantThemePackagePolicy.violations(dir, manifest())[0]).toMatch(/native binary/i);
  });

  it('reports EVERY reason at once, so an uploader does not find them one upload at a time', () => {
    const dir = packageDir((root) => {
      fs.mkdirSync(path.join(root, 'ui-ssr'));
      fs.mkdirSync(path.join(root, 'plugins'));
      fs.writeFileSync(path.join(root, 'ui', 'fast.node'), 'binary');
    });

    const violations = TenantThemePackagePolicy.violations(dir, manifest({ seeds: 'seeds.js' }));

    expect(violations.length).toBeGreaterThanOrEqual(4);
  });

  it('measures the package without following links, so a link cannot understate or inflate it', () => {
    const dir = packageDir((root) => {
      fs.writeFileSync(path.join(root, 'ui', 'big.css'), 'x'.repeat(5000));
      fs.symlinkSync('/etc/passwd', path.join(root, 'ui', 'link.txt'));
    });

    const size = TenantThemePackagePolicy.byteSize(dir);

    expect(size).toBeGreaterThan(5000);
    expect(size).toBeLessThan(20000);
  });
});
