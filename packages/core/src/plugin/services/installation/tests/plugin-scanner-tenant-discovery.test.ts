import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPaths } from '@core/config/paths';
import { PluginDirectoryScannerService } from '@core/plugin/services/installation/plugin-directory-scanner-service';

/**
 * A plugin can belong to ONE SITE, and which site comes from the DIRECTORY it was found in.
 *
 * The stamping happens after the manifest is parsed, on purpose: a package that declares an
 * `ownerTenantId` of its own must not keep it, or an uploaded plugin would name itself the
 * platform's and every ownership gate built on the field would be one the uploader opens.
 */

const ROOTS: string[] = [];

function tempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  ROOTS.push(root);
  return root;
}

function writePlugin(dir: string, manifest: Record<string, unknown>): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: '1.0.0', name: 'X', ...manifest }));
  fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
}

/** A scanner pinned to throwaway roots, with dependency installation stubbed out. */
/**
 * A host registry that isolates identity, as the privileged spawner does. A SITE's plugin is only ever
 * started through it (never required here); the platform's plugins stay in-process unless they ask.
 */
function isolatingHosts() {
  return {
    isIsolated: vi.fn(async (sandbox: any) => sandbox?.enabled === true),
    isolatesIdentity: () => true,
    describe: vi.fn(async () => ({})),
  };
}

function scannerOn(pluginsRoot: string, themesRoot: string, hosts: unknown = isolatingHosts()) {
  vi.spyOn(ProjectPaths, 'getBundledPluginsDir').mockReturnValue(path.join(tempRoot('fc-bundled-'), 'none'));
  vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue(themesRoot);

  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return new (PluginDirectoryScannerService as any)(
    pluginsRoot,
    pluginsRoot,
    logger,
    { ensureInstalled: vi.fn(async () => undefined) },
    hosts,
  );
}

const ownersBySlug = (result: any): Record<string, unknown> =>
  Object.fromEntries((result?.discovered ?? []).map((item: any) => [item.plugin?.slug ?? item.plugin?.manifest?.slug, (item.plugin?.ownerTenantId ?? item.plugin?.manifest?.ownerTenantId)]));

afterEach(() => {
  vi.restoreAllMocks();
  while (ROOTS.length) fs.rmSync(ROOTS.pop() as string, { recursive: true, force: true });
});

describe('plugin discovery with per-site plugins on disk', () => {
  it('leaves the platform’s own plugins unowned', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'alpha'), { slug: 'alpha' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});
    const owners = ownersBySlug(result);

    // Presence asserted first: `toBeUndefined()` alone would also pass if nothing were discovered.
    expect(Object.keys(owners)).toContain('alpha');
    expect(owners.alpha).toBeUndefined();
  });

  it('stamps a site’s plugin with the site it was found under', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'tenants', 'acme', 'acme-beta'), { slug: 'acme-beta' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});

    expect(ownersBySlug(result)['acme-beta']).toBe('acme');
  });

  it('OVERWRITES an owner the package declared for itself', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'tenants', 'acme', 'sneaky'), { slug: 'sneaky', ownerTenantId: 'globex' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});

    expect(ownersBySlug(result).sneaky).toBe('acme');
  });

  it('strips a declared owner from a PLATFORM plugin, rather than believing it', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'alpha'), { slug: 'alpha', ownerTenantId: 'acme' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});
    const owners = ownersBySlug(result);

    expect(Object.keys(owners)).toContain('alpha');
    expect(owners.alpha).toBeUndefined();
  });

  it('never reads `tenants` itself as a plugin', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'tenants'), { slug: 'tenants' });
    writePlugin(path.join(plugins, 'tenants', 'acme', 'real'), { slug: 'real' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});
    const owners = ownersBySlug(result);

    expect(Object.keys(owners)).not.toContain('tenants');
    expect(owners.real).toBe('acme');
  });

  it('a site whose directory cannot be READ costs only that site — everyone else keeps their plugins', async () => {
    // Unguarded, a throw in the tenant walk ends discovery for the whole platform: no plugin is
    // registered for anyone, not just for the site whose directory is broken.
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'alpha'), { slug: 'alpha' });
    writePlugin(path.join(plugins, 'tenants', 'globex', 'globex-ok'), { slug: 'globex-ok' });
    const broken = path.join(plugins, 'tenants', 'acme');
    fs.mkdirSync(broken, { recursive: true });
    fs.chmodSync(broken, 0o000);

    try {
      const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});
      const owners = ownersBySlug(result);

      expect(Object.keys(owners)).toContain('alpha');
      expect(owners['globex-ok']).toBe('globex');
    } finally {
      fs.chmodSync(broken, 0o755);
    }
  });

  it('a DANGLING SYMLINK where a site directory should be is skipped, not fatal', async () => {
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(plugins, 'alpha'), { slug: 'alpha' });
    fs.mkdirSync(path.join(plugins, 'tenants'), { recursive: true });
    fs.symlinkSync(path.join(plugins, 'does-not-exist'), path.join(plugins, 'tenants', 'acme'));

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});

    expect(Object.keys(ownersBySlug(result))).toContain('alpha');
  });

  it('does not walk a SITE theme for bundled plugins — an upload ships no code', async () => {
    // `tenants/` under the themes root is a container of sites, not a theme named "tenants", and a
    // site's theme may not carry plugins at all.
    const plugins = tempRoot('fc-plugins-');
    const themes = tempRoot('fc-themes-');
    writePlugin(path.join(themes, 'tenants', 'acme', 'their-theme', 'plugins', 'smuggled'), { slug: 'smuggled' });

    // A platform plugin alongside it, so "found nothing at all" cannot pass this test.
    writePlugin(path.join(plugins, 'alpha'), { slug: 'alpha' });

    const result = await scannerOn(plugins, themes).discoverPlugins(new Map(), {});
    const owners = ownersBySlug(result);

    expect(Object.keys(owners)).toContain('alpha');
    expect(Object.keys(owners)).not.toContain('smuggled');
  });

  it('never starts a site\'s plugin where the server cannot give it its own user', async () => {
    const plugins = tempRoot('fc-plugins-');
    writePlugin(path.join(plugins, 'tenants', 'acme', 'acme-beta'), { slug: 'acme-beta' });

    const noIdentity = { ...isolatingHosts(), isolatesIdentity: () => false };
    const result = await scannerOn(plugins, tempRoot('fc-themes-'), noIdentity).discoverPlugins(new Map(), {});

    expect(Object.keys(ownersBySlug(result))).not.toContain('acme-beta');
    expect(result.errored.map((item: any) => item.manifest?.slug)).toContain('acme-beta');
    expect(noIdentity.describe).not.toHaveBeenCalled();
  });

  it('runs a site\'s plugin isolated even when its manifest asks to share the api process', async () => {
    const plugins = tempRoot('fc-plugins-');
    writePlugin(path.join(plugins, 'tenants', 'acme', 'acme-beta'), { slug: 'acme-beta', sandbox: { memoryLimit: 64 } });
    const hosts = isolatingHosts();

    await scannerOn(plugins, tempRoot('fc-themes-'), hosts).discoverPlugins(new Map(), {});

    expect(hosts.isIsolated).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, memoryLimit: 64 }));
    expect(hosts.describe).toHaveBeenCalledWith('acme-beta', expect.any(String), expect.any(String), expect.anything(), expect.any(Boolean));
  });

  it('refuses a site\'s plugin that fails the site policy, even when it arrived by another route', async () => {
    const plugins = tempRoot('fc-plugins-');
    writePlugin(path.join(plugins, 'tenants', 'acme', 'acme-beta'), { slug: 'acme-beta', capabilities: ['network'] });

    const result = await scannerOn(plugins, tempRoot('fc-themes-')).discoverPlugins(new Map(), {});

    expect(Object.keys(ownersBySlug(result))).not.toContain('acme-beta');
    expect(String(result.errored.find((item: any) => item.manifest?.slug === 'acme-beta')?.error)).toContain('"network"');
  });
});
