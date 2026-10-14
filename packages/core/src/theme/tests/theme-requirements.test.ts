import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
import { ThemeManager } from '@core/theme/theme-manager';
import { ThemeRequirements } from '@core/theme/theme-requirements';

/**
 * A theme that imports something this platform lacks does not degrade: its bundle fails to load and the
 * site shows nothing. So it is refused where it enters and where it is switched on, with the missing
 * feature named.
 */
describe('ThemeRequirements', () => {
  it('lists what a theme needs that this platform does not provide, once each, in order', () => {
    expect(ThemeRequirements.missing({ requires: ['theme-runtime'] })).toEqual([]);
    expect(ThemeRequirements.missing({ requires: ['later-b', 'theme-runtime', 'later-a', 'later-b'] })).toEqual(['later-b', 'later-a']);
  });

  it('treats a theme that says nothing as needing nothing, and ignores junk entries', () => {
    expect(ThemeRequirements.missing({})).toEqual([]);
    expect(ThemeRequirements.missing({ requires: [] })).toEqual([]);
    expect(ThemeRequirements.missing({ requires: 'theme-runtime' as never })).toEqual([]);
    expect(ThemeRequirements.missing({ requires: [null, '  ', 42] as never })).toEqual(['42']);
  });

  it('names the theme and the feature in the message', () => {
    expect(() => ThemeRequirements.assertMet({ slug: 'shop', name: 'Shop', requires: ['later-a'] }))
      .toThrow('Shop needs a feature this platform does not have yet: later-a. Update the platform, then install the theme.');
    expect(() => ThemeRequirements.assertMet({ slug: 'shop', requires: ['x', 'y'] })).toThrow('shop needs features this platform does not have yet: x, y');
  });
});

describe('where a theme that needs more than this platform has is refused', () => {
  const dirs: string[] = [];
  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  afterEach(() => {
    vi.restoreAllMocks();
    while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
  });
  const dir = (prefix: string) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); dirs.push(d); return d; };

  it('an install: nothing is placed and the installed theme is left as it was', async () => {
    const root = dir('fc-themes-');
    const installedDir = path.join(root, 'shop');
    fs.mkdirSync(path.join(installedDir, 'ui'), { recursive: true });
    fs.writeFileSync(path.join(installedDir, 'theme.json'), JSON.stringify({ slug: 'shop', name: 'Shop', version: '0.1.0', layouts: [] }));
    fs.writeFileSync(path.join(installedDir, 'ui', 'bundle.js'), '// installed\n');
    const incoming = dir('fc-pkg-');
    fs.writeFileSync(path.join(incoming, 'theme.json'), JSON.stringify({ slug: 'shop', name: 'Shop', version: '0.2.0', layouts: [], requires: ['later-a'] }));
    const installer = new ThemeInstallerService(logger, root, {} as any, async () => ({}) as any, null, async () => undefined, (slug) => path.join(root, slug));

    await expect(installer.installFromDirectory(incoming, new Map())).rejects.toThrow('later-a');
    expect(fs.readFileSync(path.join(installedDir, 'ui', 'bundle.js'), 'utf8')).toBe('// installed\n');
    expect(JSON.parse(fs.readFileSync(path.join(installedDir, 'theme.json'), 'utf8')).version).toBe('0.1.0');
  });

  it('an activation: the theme is not switched on', async () => {
    const db = { findOne: vi.fn(), insert: vi.fn(), update: vi.fn() };
    const subject = new ThemeManager(db as any, {});
    (subject as any).themes.set('shop', { slug: 'shop', name: 'Shop', version: '0.1.0', requires: ['later-a'] });

    await expect(subject.activateTheme('shop')).rejects.toThrow('Shop needs a feature');
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
