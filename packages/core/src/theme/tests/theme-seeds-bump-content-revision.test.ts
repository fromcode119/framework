import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
import { SiteContentRevision } from '@core/tenant/site-content-revision';

/**
 * Running a theme's seeds changes what the site's pages are built from, so the storefront must stop
 * serving what it rendered before: a page that answered 404 before the seed created it stayed a
 * cached 404.
 */
const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const DIRS: string[] = [];

function themeWithSeed(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-seed-'));
  DIRS.push(root);
  fs.mkdirSync(path.join(root, 'zen'));
  fs.writeFileSync(path.join(root, 'zen', 'seed.mjs'), 'export default {};\n');
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (DIRS.length) fs.rmSync(DIRS.pop() as string, { recursive: true, force: true });
});

describe('ThemeInstallerService.runSeeds', () => {
  it('bumps the current site content revision once the seed has run', async () => {
    const root = themeWithSeed();
    const order: string[] = [];
    const seeder: any = { seed: vi.fn(async () => { order.push('seed'); }) };
    const bump = vi.spyOn(SiteContentRevision, 'bumpCurrentSite').mockImplementation(() => { order.push('bump'); });
    const installer = new ThemeInstallerService(logger, root, seeder, async () => ({}) as any, null, async () => undefined, (slug) => path.join(root, slug));

    await installer.runSeeds({ slug: 'zen', seeds: 'seed.mjs' } as any);

    expect(bump).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['seed', 'bump']);
  });

  it('does not bump when the seed fails', async () => {
    const root = themeWithSeed();
    const seeder: any = { seed: vi.fn(async () => { throw new Error('boom'); }) };
    const bump = vi.spyOn(SiteContentRevision, 'bumpCurrentSite').mockImplementation(() => undefined);
    const installer = new ThemeInstallerService(logger, root, seeder, async () => ({}) as any, null, async () => undefined, (slug) => path.join(root, slug));

    await expect(installer.runSeeds({ slug: 'zen', seeds: 'seed.mjs' } as any)).rejects.toThrow('boom');
    expect(bump).not.toHaveBeenCalled();
  });
});
