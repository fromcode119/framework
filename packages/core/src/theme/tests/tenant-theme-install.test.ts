import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPaths } from '@core/config/paths';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';

/**
 * Installing a theme a SITE uploaded.
 *
 * Three refusals a shared box needs, and none of them is cosmetic:
 *
 *  - the package may carry no server code (the policy has its own tests);
 *  - a slug already taken is refused, never overwritten — the platform path `rm -rf`s the target,
 *    and on a shared box that target could be the platform's theme or another customer's;
 *  - the site's quota is enforced, because the themes volume is ONE host directory for the whole
 *    machine, so an unbounded upload is a denial of service against every other tenant.
 */

const DIRS: string[] = [];
const QUOTA = { maxBytes: 1024 * 1024, maxThemes: 3 };

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  DIRS.push(dir);
  return dir;
}

/** A theme package as a real .zip, which is what an upload actually arrives as. */
function themeZip(manifest: Record<string, unknown>, files: Record<string, string> = {}): string {
  const zip = new AdmZip();
  zip.addFile('theme.json', Buffer.from(JSON.stringify({ name: 'X', version: '1.0.0', layouts: [], ...manifest })));
  zip.addFile('ui/index.js', Buffer.from('export default 1;'));
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  const target = path.join(tempDir('fc-zip-'), 'theme.zip');
  zip.writeZip(target);
  return target;
}

function installerOn(themesRoot: string) {
  vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue(themesRoot);
  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return new ThemeInstallerService(
    logger,
    themesRoot,
    {} as any,
    async () => ({}) as any,
    // No plugin manager: a site's theme installs no plugins, and reaching for one would be the bug.
    null,
    async () => undefined,
    (slug: string) => path.join(themesRoot, slug),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  while (DIRS.length) fs.rmSync(DIRS.pop() as string, { recursive: true, force: true });
});

describe('installing a theme uploaded by a site', () => {
  it('puts the files under that site’s own directory, and nowhere else', async () => {
    const themesRoot = tempDir('fc-themes-');
    const zip = themeZip({ slug: 'acme-one' });

    await installerOn(themesRoot).installForTenant(zip, 'acme', new Map(), QUOTA);

    expect(fs.existsSync(path.join(themesRoot, 'tenants', 'acme', 'acme-one', 'theme.json'))).toBe(true);
    // Never at the shared root, which is where every other site would see it.
    expect(fs.existsSync(path.join(themesRoot, 'acme-one'))).toBe(false);
  });

  it('REFUSES a slug the platform already holds, instead of deleting the platform’s theme', async () => {
    const themesRoot = tempDir('fc-themes-');
    const platformTheme: IThemeManifest = { slug: 'aurora', name: 'Aurora', version: '1.0.0', layouts: [] } as any;
    const zip = themeZip({ slug: 'aurora' });

    await expect(installerOn(themesRoot).installForTenant(zip, 'acme', new Map([['aurora', platformTheme]]), QUOTA))
      .rejects.toThrow(/already taken .* by the platform/i);
  });

  it('REFUSES a slug ANOTHER SITE holds, and does not name that site', async () => {
    const themesRoot = tempDir('fc-themes-');
    const theirs: IThemeManifest = { slug: 'reviews', name: 'Reviews', version: '1.0.0', layouts: [], ownerTenantId: 'globex' } as any;
    const zip = themeZip({ slug: 'reviews' });

    const attempt = installerOn(themesRoot).installForTenant(zip, 'acme', new Map([['reviews', theirs]]), QUOTA);

    await expect(attempt).rejects.toThrow(/already taken/i);
    // Refusing must not disclose who the other customer is.
    await expect(attempt).rejects.not.toThrow(/globex/);
  });

  it('ALLOWS a site to replace its own theme', async () => {
    const themesRoot = tempDir('fc-themes-');
    const mine: IThemeManifest = { slug: 'acme-one', name: 'Mine', version: '1.0.0', layouts: [], ownerTenantId: 'acme' } as any;

    await installerOn(themesRoot).installForTenant(themeZip({ slug: 'acme-one', version: '2.0.0' }), 'acme', new Map([['acme-one', mine]]), QUOTA);

    const written = JSON.parse(fs.readFileSync(path.join(themesRoot, 'tenants', 'acme', 'acme-one', 'theme.json'), 'utf8'));
    expect(written.version).toBe('2.0.0');
  });

  it('refuses a package carrying server code, naming the reason', async () => {
    const themesRoot = tempDir('fc-themes-');
    const zip = themeZip({ slug: 'acme-two' }, { 'ui-ssr/entry.mjs': 'export default 1;' });

    await expect(installerOn(themesRoot).installForTenant(zip, 'acme', new Map(), QUOTA))
      .rejects.toThrow(/ui-ssr|browser only/i);
  });

  it('refuses a slug that is not a safe directory and URL name', async () => {
    const themesRoot = tempDir('fc-themes-');

    await expect(installerOn(themesRoot).installForTenant(themeZip({ slug: '../escape' }), 'acme', new Map(), QUOTA))
      .rejects.toThrow(/invalid theme slug/i);
  });

  it('refuses an upload over the per-theme size limit', async () => {
    const themesRoot = tempDir('fc-themes-');
    const zip = themeZip({ slug: 'acme-big' }, { 'ui/big.css': 'x'.repeat(4096) });

    await expect(installerOn(themesRoot).installForTenant(zip, 'acme', new Map(), { maxBytes: 1024, maxThemes: 3 }))
      .rejects.toThrow(/over the .* MB/i);
  });

  it('refuses once the site holds as many themes as it may', async () => {
    const themesRoot = tempDir('fc-themes-');
    const installer = installerOn(themesRoot);
    const quota = { maxBytes: 1024 * 1024, maxThemes: 2 };

    await installer.installForTenant(themeZip({ slug: 'acme-a' }), 'acme', new Map(), quota);
    await installer.installForTenant(themeZip({ slug: 'acme-b' }), 'acme', new Map(), quota);

    await expect(installer.installForTenant(themeZip({ slug: 'acme-c' }), 'acme', new Map(), quota))
      .rejects.toThrow(/limit/i);
  });

  it('counts a REPLACEMENT against neither the count nor the total', async () => {
    const themesRoot = tempDir('fc-themes-');
    const installer = installerOn(themesRoot);
    const quota = { maxBytes: 1024 * 1024, maxThemes: 1 };

    await installer.installForTenant(themeZip({ slug: 'acme-a' }), 'acme', new Map(), quota);

    // At the limit, but replacing the one it already has — the new copy stands where the old one did.
    await expect(installer.installForTenant(themeZip({ slug: 'acme-a', version: '3.0.0' }), 'acme', new Map(), quota))
      .resolves.toBeTruthy();
  });

  it('counts a site’s OTHER themes towards its total, not just the incoming one', async () => {
    const themesRoot = tempDir('fc-themes-');
    const installer = installerOn(themesRoot);
    const quota = { maxBytes: 6000, maxThemes: 5 };

    await installer.installForTenant(themeZip({ slug: 'acme-a' }, { 'ui/a.css': 'x'.repeat(4000) }), 'acme', new Map(), quota);

    await expect(installer.installForTenant(themeZip({ slug: 'acme-b' }, { 'ui/b.css': 'x'.repeat(4000) }), 'acme', new Map(), quota))
      .rejects.toThrow(/would total/i);
  });

  it('keeps each site’s quota its own — one site’s themes do not count against another’s', async () => {
    const themesRoot = tempDir('fc-themes-');
    const installer = installerOn(themesRoot);
    const quota = { maxBytes: 6000, maxThemes: 1 };

    await installer.installForTenant(themeZip({ slug: 'acme-a' }, { 'ui/a.css': 'x'.repeat(4000) }), 'acme', new Map(), quota);

    await expect(installer.installForTenant(themeZip({ slug: 'globex-a' }, { 'ui/a.css': 'x'.repeat(4000) }), 'globex', new Map(), quota))
      .resolves.toBeTruthy();
  });

  it('requires a site — an upload with no site selected is refused', async () => {
    const themesRoot = tempDir('fc-themes-');

    await expect(installerOn(themesRoot).installForTenant(themeZip({ slug: 'x' }), '  ', new Map(), QUOTA))
      .rejects.toThrow(/site must be selected/i);
  });
});
