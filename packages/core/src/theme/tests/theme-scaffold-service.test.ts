import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@core/logging';
import { ThemeScaffoldService } from '@core/theme/theme-scaffold-service';
import type { IThemeBuilder } from '@core/theme/interfaces/theme-builder.interface';

/** What the assistant's `themes.create.scaffold` runs: a new theme, built, and activated only if it built. */
describe('ThemeScaffoldService', () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

  const setup = (builder: IThemeBuilder | null, existing: string[] = []) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-service-'));
    roots.push(root);
    const calls: string[] = [];
    const activate = vi.fn(async () => undefined);
    const service = new ThemeScaffoldService(
      new Logger({ namespace: 'test' }), root, (slug) => existing.includes(slug),
      async () => { calls.push('discover'); }, async (slug) => { calls.push('activate'); await activate(slug); }, () => builder,
    );
    return { root, service, activate, calls };
  };

  const input = { slug: 'corner-shop', name: 'Corner Shop', description: 'A shop.' };

  it('writes the theme, builds it, then activates it, in that order', async () => {
    const order: string[] = [];
    const builder: IThemeBuilder = { build: async (dir, slug) => { order.push(`build:${slug}:${fs.existsSync(path.join(dir, 'src/theme-boot.ts'))}`); } };
    const { service, calls, root } = setup(builder);

    const result = await service.scaffoldTheme(input);

    expect(order).toEqual(['build:corner-shop:true']);
    expect(calls).toEqual(['discover', 'activate']);
    expect(result).toMatchObject({ built: true, buildError: null, activated: true, activationError: null });
    expect(fs.existsSync(path.join(root, 'corner-shop/theme.json'))).toBe(true);
  });

  it('keeps a theme that failed to build but never activates it, and says why', async () => {
    const builder: IThemeBuilder = { build: async () => { throw new Error('Build failed at theme-bundle-compiler: no network'); } };
    const { service, activate, root } = setup(builder);

    const result = await service.scaffoldTheme(input);

    expect(activate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ built: false, activated: false });
    expect(result.buildError).toContain('no network');
    expect(result.activationError).toContain('Not activated');
    expect(fs.existsSync(path.join(root, 'corner-shop/src/theme-boot.ts'))).toBe(true);
  });

  it('never activates a theme it cannot build when this installation has no builder', async () => {
    const { service, activate } = setup(null);

    const result = await service.scaffoldTheme(input);

    expect(activate).not.toHaveBeenCalled();
    expect(result.built).toBe(false);
    expect(result.buildError).toContain('atlantis build theme corner-shop');
  });

  it('builds but does not activate when asked not to activate', async () => {
    const { service, activate } = setup({ build: async () => undefined });

    const result = await service.scaffoldTheme({ ...input, activate: false });

    expect(result).toMatchObject({ built: true, activated: false, activationError: null });
    expect(activate).not.toHaveBeenCalled();
  });

  it('uses the version it is given in the theme\'s manifest', async () => {
    const { service } = setup({ build: async () => undefined });

    const result = await service.scaffoldTheme({ ...input, version: '2.3.4' });

    expect(result.manifest.version).toBe('2.3.4');
  });

  it('refuses a slug that exists or is not a safe folder name, before writing anything', async () => {
    const { service, root } = setup({ build: async () => undefined }, ['taken']);

    await expect(service.scaffoldTheme({ ...input, slug: 'taken' })).rejects.toThrow('already exists');
    await expect(service.scaffoldTheme({ ...input, slug: '../escape' })).rejects.toThrow('not a theme slug');
    expect(fs.readdirSync(root)).toEqual([]);
  });
});
