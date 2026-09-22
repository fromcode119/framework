import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PackCleaner } from '../pack/pack-cleaner';

describe('PackCleaner', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-cleaner-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (relative: string, contents = 'x'): string => {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
    return full;
  };

  const exists = (relative: string): boolean => fs.existsSync(path.join(dir, relative));

  it('strips a local database left beside the source', () => {
    // The incident: a 1.5MB `ruvector.db` sat untracked in plugins/numerology and packed into the
    // tarball, bound for production.
    write('ruvector.db');
    write('ui/ruvector.db');
    write('index.js');

    PackCleaner.clean(dir);

    expect(exists('ruvector.db')).toBe(false);
    expect(exists('ui/ruvector.db')).toBe(false);
    expect(exists('index.js')).toBe(true);
  });

  it('strips dumps, logs and backups', () => {
    write('data.sqlite');
    write('data.sqlite3');
    write('schema.dump');
    write('debug.log');
    write('manifest.json.bak');

    PackCleaner.clean(dir);

    expect(exists('data.sqlite')).toBe(false);
    expect(exists('data.sqlite3')).toBe(false);
    expect(exists('schema.dump')).toBe(false);
    expect(exists('debug.log')).toBe(false);
    expect(exists('manifest.json.bak')).toBe(false);
  });

  it('keeps every build artifact a plugin must ship, all of which are gitignored', () => {
    // This is why the rule above is a deny-list and NOT ".respect .gitignore": each of these is
    // build output, none is committed, and dropping them ships an empty plugin that fails silently.
    write('index.js');
    write('manifest.json');
    write('package.json');
    write('dist/migrations/2026-01-01-thing.js');
    write('ui/bundle.js');
    write('ui/bundle.js.gz');
    write('ui/style.css');
    write('src/i18n/en.json');
    write('src/templates/report.hbs');

    PackCleaner.clean(dir);

    expect(exists('index.js')).toBe(true);
    expect(exists('manifest.json')).toBe(true);
    expect(exists('package.json')).toBe(true);
    expect(exists('dist/migrations/2026-01-01-thing.js')).toBe(true);
    expect(exists('ui/bundle.js')).toBe(true);
    expect(exists('ui/bundle.js.gz')).toBe(true);
    expect(exists('ui/style.css')).toBe(true);
    expect(exists('src/i18n/en.json')).toBe(true);
    expect(exists('src/templates/report.hbs')).toBe(true);
  });

  it('still strips the credential-bearing files earlier incidents added', () => {
    write('.npmrc');
    write('.env');
    write('.env.production');
    write('deploy.pem');
    write('scripts/seed.mjs');
    write('tests/integration.mjs');

    PackCleaner.clean(dir);

    expect(exists('.npmrc')).toBe(false);
    expect(exists('.env')).toBe(false);
    expect(exists('.env.production')).toBe(false);
    expect(exists('deploy.pem')).toBe(false);
    expect(exists('scripts/seed.mjs')).toBe(false);
    expect(exists('tests/integration.mjs')).toBe(false);
  });
});
