import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { PackageArchiver } from '@sources/build/package-archiver';

/**
 * This packer builds the artifact the MARKETPLACE distributes, so what it excludes is the same
 * policy `clean_pack_directory` in build-plugins.sh enforces for local tarballs. The two drifted:
 * `scripts/` and loose `*.mjs` were stripped by the shell script — after a script carrying real
 * credentials was published inside a plugin tarball — but not here, so the same file would still
 * ship through the marketplace path. These pin both halves: what must never ship, and what must.
 */
describe('PackageArchiver.createZip exclusions', () => {
  const created: string[] = [];

  function fixture(files: string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-archiver-'));
    created.push(root);
    for (const file of files) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `content of ${file}`);
    }
    return root;
  }

  async function entries(sourceDir: string): Promise<string[]> {
    const zip = path.join(sourceDir, '..', `${path.basename(sourceDir)}.zip`);
    created.push(zip);
    await new PackageArchiver().createZip(sourceDir, zip);
    return execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
      .split('\n').map((line) => line.trim()).filter(Boolean);
  }

  afterEach(() => {
    while (created.length) fs.rmSync(created.pop() as string, { recursive: true, force: true });
  });

  it('never ships the files that leaked credentials before', async () => {
    const list = await entries(fixture([
      'index.js',
      'manifest.json',
      'scripts/deploy-with-secrets.mjs',
      'scripts/helper.js',
      'tools/one-off.mjs',
      'tests/integration.mjs',
      'src/service.test.js',
    ]));

    expect(list).toContain('index.js');
    expect(list).toContain('manifest.json');
    for (const leaked of [
      'scripts/deploy-with-secrets.mjs', 'scripts/helper.js',
      'tools/one-off.mjs', 'tests/integration.mjs', 'src/service.test.js',
    ]) {
      expect(list).not.toContain(leaked);
    }
  });

  it('KEEPS the server render bundle and a theme seed despite the blanket *.mjs rule', async () => {
    // Stripping ui-ssr shipped plugins whose storefront surfaces rendered nothing at all.
    const list = await entries(fixture([
      'index.js', 'ui-ssr/entry.mjs', 'ui-ssr/chunks/vendor.mjs', 'seed.mjs', 'other.mjs',
    ]));

    expect(list).toContain('ui-ssr/entry.mjs');
    expect(list).toContain('ui-ssr/chunks/vendor.mjs');
    expect(list).toContain('seed.mjs');
    expect(list).not.toContain('other.mjs');
  });

  it('drops src/ui (build input) but keeps the runtime dirs read from disk', async () => {
    const list = await entries(fixture([
      'index.js',
      'src/ui/panel.css',
      'src/ui/i18n/en.json',
      'src/i18n/en.json',
      'src/templates/emails/admin.html',
      'ui/bundle.js',
      'ui/style.css',
    ]));

    expect(list).not.toContain('src/ui/panel.css');
    expect(list).not.toContain('src/ui/i18n/en.json');
    // registerTranslations('src/i18n') and the Handlebars loader read these at RUNTIME.
    expect(list).toContain('src/i18n/en.json');
    expect(list).toContain('src/templates/emails/admin.html');
    expect(list).toContain('ui/bundle.js');
    expect(list).toContain('ui/style.css');
  });
});
