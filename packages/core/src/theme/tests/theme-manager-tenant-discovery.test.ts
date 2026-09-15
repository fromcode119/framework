import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeManager } from '@core/theme/theme-manager';

/**
 * A theme can belong to ONE SITE instead of to the platform, and which it is comes from the DIRECTORY
 * it was found in — never from the package.
 *
 * That distinction is the whole foundation the per-site upload work stands on: if a package could
 * declare itself the platform's, every gate built on top of `ownerTenantId` would be a gate an
 * uploader opens for themselves. So these tests write real directories and assert on what discovery
 * makes of them.
 */

const ROOTS: string[] = [];

function themesRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-themes-'));
  ROOTS.push(root);
  return root;
}

function writeTheme(dir: string, manifest: Record<string, unknown>): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ layouts: [], ...manifest }));
}

/** A manager pinned to a throwaway themes root, with nothing else wired. */
function managerOn(root: string): ThemeManager {
  const subject = new ThemeManager({} as any, {} as any);
  (subject as any).themesRoot = root;
  return subject;
}

const discovered = (subject: ThemeManager) => (subject as any).themes as Map<string, any>;

afterEach(() => {
  vi.restoreAllMocks();
  while (ROOTS.length) fs.rmSync(ROOTS.pop() as string, { recursive: true, force: true });
});

describe('theme discovery with per-site themes on disk', () => {
  it('leaves the platform’s own themes exactly as they were — no owner', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'aurora'), { slug: 'aurora', name: 'Aurora', version: '1.0.0' });
    const subject = managerOn(root);

    await subject.discoverThemes();

    expect(discovered(subject).get('aurora')?.ownerTenantId).toBeUndefined();
  });

  it('finds a site’s theme under tenants/<site>/ and stamps that site as the owner', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'tenants', 'acme', 'acme-reviews'), { slug: 'acme-reviews', name: 'Reviews', version: '0.1.0' });
    const subject = managerOn(root);

    await subject.discoverThemes();

    expect(discovered(subject).get('acme-reviews')?.ownerTenantId).toBe('acme');
  });

  it('does NOT let a package name its own owner — the directory decides', async () => {
    // The whole point. A theme uploaded by one site that declares itself the platform's (or another
    // site's) would otherwise be offered to everyone by every gate built on this field.
    const root = themesRoot();
    writeTheme(path.join(root, 'tenants', 'acme', 'sneaky'), { slug: 'sneaky', name: 'Sneaky', version: '1.0.0', ownerTenantId: 'globex' });
    const subject = managerOn(root);

    await subject.discoverThemes();

    expect(discovered(subject).get('sneaky')?.ownerTenantId).toBe('acme');
  });

  it('never reads `tenants` itself as a theme', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'tenants'), { slug: 'tenants', name: 'Not a theme', version: '1.0.0' });
    writeTheme(path.join(root, 'tenants', 'acme', 'real'), { slug: 'real', name: 'Real', version: '1.0.0' });
    const subject = managerOn(root);

    await subject.discoverThemes();

    expect(discovered(subject).has('tenants')).toBe(false);
    expect(discovered(subject).get('real')?.ownerTenantId).toBe('acme');
  });

  it('keeps each site’s themes apart, and finds every site’s', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'tenants', 'acme', 'acme-one'), { slug: 'acme-one', name: 'One', version: '1.0.0' });
    writeTheme(path.join(root, 'tenants', 'globex', 'globex-one'), { slug: 'globex-one', name: 'One', version: '1.0.0' });
    const subject = managerOn(root);

    await subject.discoverThemes();

    expect(discovered(subject).get('acme-one')?.ownerTenantId).toBe('acme');
    expect(discovered(subject).get('globex-one')?.ownerTenantId).toBe('globex');
  });

  it('keeps the PLATFORM’s copy when a slug is claimed twice, and says so', async () => {
    // The upload path refuses a duplicate slug, so this state means one arrived another way. Serving
    // a site's files where the platform's were expected is the worse failure of the two.
    const root = themesRoot();
    writeTheme(path.join(root, 'aurora'), { slug: 'aurora', name: 'Platform Aurora', version: '1.0.0' });
    writeTheme(path.join(root, 'tenants', 'acme', 'aurora'), { slug: 'aurora', name: 'Site Aurora', version: '9.9.9' });
    const subject = managerOn(root);
    const errors: string[] = [];
    vi.spyOn((subject as any).logger, 'error').mockImplementation((message: string) => { errors.push(String(message)); });

    await subject.discoverThemes();

    const kept = discovered(subject).get('aurora');
    expect(kept?.name).toBe('Platform Aurora');
    expect(kept?.ownerTenantId).toBeUndefined();
    expect(errors.join(' ')).toMatch(/claimed twice/i);
  });

  it('a site whose directory cannot be READ costs only that site — everyone else keeps their theme', async () => {
    // The failure this guards is total: an unguarded throw in the tenant walk aborts discovery, so
    // NO theme is found for anyone and every storefront on the box renders with none.
    const root = themesRoot();
    writeTheme(path.join(root, 'aurora'), { slug: 'aurora', name: 'Aurora', version: '1.0.0' });
    writeTheme(path.join(root, 'tenants', 'globex', 'globex-ok'), { slug: 'globex-ok', name: 'OK', version: '1.0.0' });
    const broken = path.join(root, 'tenants', 'acme');
    fs.mkdirSync(broken, { recursive: true });
    fs.chmodSync(broken, 0o000);
    const subject = managerOn(root);
    vi.spyOn((subject as any).logger, 'error').mockImplementation(() => undefined);

    try {
      await expect(subject.discoverThemes()).resolves.not.toThrow();
      expect(discovered(subject).has('aurora')).toBe(true);
      expect(discovered(subject).get('globex-ok')?.ownerTenantId).toBe('globex');
    } finally {
      fs.chmodSync(broken, 0o755);
    }
  });

  it('a DANGLING SYMLINK where a site directory should be is skipped, not fatal', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'aurora'), { slug: 'aurora', name: 'Aurora', version: '1.0.0' });
    fs.mkdirSync(path.join(root, 'tenants'), { recursive: true });
    fs.symlinkSync(path.join(root, 'does-not-exist'), path.join(root, 'tenants', 'acme'));
    const subject = managerOn(root);
    vi.spyOn((subject as any).logger, 'error').mockImplementation(() => undefined);

    await expect(subject.discoverThemes()).resolves.not.toThrow();
    expect(discovered(subject).has('aurora')).toBe(true);
  });

  it('names the failing site in the log, so the operator knows whose to fix', async () => {
    const root = themesRoot();
    fs.mkdirSync(path.join(root, 'tenants'), { recursive: true });
    fs.symlinkSync(path.join(root, 'nope'), path.join(root, 'tenants', 'acme'));
    const subject = managerOn(root);
    const errors: string[] = [];
    vi.spyOn((subject as any).logger, 'error').mockImplementation((message: string) => { errors.push(String(message)); });

    await subject.discoverThemes();

    expect(errors.join(' ')).toMatch(/acme/);
    expect(errors.join(' ')).toMatch(/every other site is unaffected/i);
  });

  it('survives a themes root with no tenants directory at all', async () => {
    const root = themesRoot();
    writeTheme(path.join(root, 'aurora'), { slug: 'aurora', name: 'Aurora', version: '1.0.0' });
    const subject = managerOn(root);

    await expect(subject.discoverThemes()).resolves.not.toThrow();
    expect(discovered(subject).size).toBe(1);
  });
});
