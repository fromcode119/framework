import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PackCleaner } from '@extension-builder/pack/pack-cleaner';
import { IntegrityStamper } from '@extension-builder/pack/integrity-stamper';

function stagedExtension(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'));
  const put = (rel: string, body = 'x') => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  };
  put('manifest.json', JSON.stringify({ slug: 'demo', name: 'Demo' }, null, 2));
  put('index.js');
  put('index.ts');
  put('seed.mjs');
  put('ui-ssr/entry.mjs');
  put('ui-ssr/logo.png');            // a copied public asset — must not ship
  put('helper.mjs');                 // a dev helper — must not ship
  put('src/i18n/bg.json');           // read from disk at runtime — must stay
  put('src/templates/mail.html');    // read from disk at runtime — must stay
  put('src/ui/panel.css');           // build input — must not ship
  put('tests/probe.mjs');
  put('scripts/deploy.mjs');
  put('.npmrc', '//registry:_authToken=SECRET');
  put('.env', 'SECRET=1');
  put('deploy.pem');
  put('foo.test.ts');
  put('tsconfig.json');
  mkdirSync(join(dir, 'node_modules', 'left'), { recursive: true });
  return dir;
}

describe('PackCleaner', () => {
  it('keeps what the RUNTIME reads from disk', () => {
    const dir = stagedExtension();
    PackCleaner.clean(dir);
    for (const kept of ['manifest.json', 'index.js', 'seed.mjs', 'ui-ssr/entry.mjs', 'src/i18n/bg.json', 'src/templates/mail.html']) {
      expect(existsSync(join(dir, kept)), `${kept} must survive`).toBe(true);
    }
  });

  it('strips source, build input, dev helpers and credential-bearing files', () => {
    const dir = stagedExtension();
    PackCleaner.clean(dir);
    for (const gone of ['index.ts', 'helper.mjs', 'src/ui/panel.css', 'src/ui', 'tests', 'scripts',
      '.npmrc', '.env', 'deploy.pem', 'foo.test.ts', 'tsconfig.json', 'node_modules', 'ui-ssr/logo.png']) {
      expect(existsSync(join(dir, gone)), `${gone} must NOT ship`).toBe(false);
    }
  });
});

describe('IntegrityStamper', () => {
  it('re-stamps after cleaning, so the artifact hashes to the value in its own manifest', async () => {
    const dir = stagedExtension();
    const sourceStamp = await IntegrityStamper.stampSourceDir(dir);
    PackCleaner.clean(dir);
    const packedStamp = await IntegrityStamper.stampPackedDir(dir);

    expect(packedStamp).not.toBe(sourceStamp);   // cleaning changed the contents
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).checksum).toBe(packedStamp);
  });
});
