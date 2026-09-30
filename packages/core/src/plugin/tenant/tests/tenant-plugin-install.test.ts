import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPaths } from '@core/config/paths';
import { SafeArchive } from '@core/security/safe-archive';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';
import { TenantPluginQuota } from '@core/plugin/tenant/tenant-plugin-quota';
import { TenantPluginInstaller } from '@core/plugin/tenant/tenant-plugin-installer';
import { TenantPluginPackagePolicy } from '@core/plugin/tenant/tenant-plugin-package-policy';
import { TenantPluginRefusal } from '@core/plugin/tenant/tenant-plugin-refusal';
import { TenantPluginRefusalReason } from '@core/plugin/tenant/enums/tenant-plugin-refusal-reason.enum';
import { PluginTenantStateService } from '@core/plugin/tenant/plugin-tenant-state-service';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';

/**
 * A SITE installing its own plugin. What matters is what is REFUSED: a site's plugin is code on the box
 * every customer shares, so it gets no schema, no admin UI, no install step, a closed set of
 * capabilities, a quota, and it never runs for another site.
 */

const DIRS: string[] = [];
const OPEN = { enabled: true, maxBytes: 1024 * 1024, maxPlugins: 2 };

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  DIRS.push(dir);
  return dir;
}

function pluginZip(manifest: Record<string, unknown>, files: Record<string, string> = {}): string {
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ name: 'Guestbook', version: '1.0.0', capabilities: ['api', 'hooks'], ...manifest })));
  zip.addFile('index.js', Buffer.from('module.exports = {};'));
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  const target = path.join(tempDir('fc-site-plugin-zip-'), 'plugin.zip');
  zip.writeZip(target);
  return target;
}

/** A plugin manager stand-in: discovery "finds" what was placed under the site's directory. */
function hostOn(pluginsRoot: string, options: { isolates?: boolean } = {}) {
  vi.spyOn(ProjectPaths, 'getPluginsDir').mockReturnValue(pluginsRoot);
  const plugins = new Map<string, any>();
  const host = {
    plugins,
    pluginHosts: { isolatesIdentity: () => options.isolates ?? true, reload: vi.fn(async () => true) },
    discoverPlugins: vi.fn(async () => {
      const tenants = ProjectPaths.tenantArtifactsRoot(pluginsRoot);
      for (const site of fs.existsSync(tenants) ? fs.readdirSync(tenants) : []) {
        for (const slug of fs.readdirSync(path.join(tenants, site)).filter((name) => !name.startsWith('.'))) {
          plugins.set(slug, { manifest: { slug }, state: 'inactive' });
          PluginOwners.record(slug, site);
        }
      }
    }),
    enable: vi.fn(async () => undefined),
    delete: vi.fn(async (slug: string) => { plugins.delete(slug); }),
  };
  return { host, installer: new TenantPluginInstaller(host) };
}

async function refusalOf(promise: Promise<unknown>): Promise<TenantPluginRefusal> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof TenantPluginRefusal) return err;
    throw err;
  }
  throw new Error('expected a refusal');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const slug of ['guestbook', 'other']) PluginOwners.forget(slug);
  while (DIRS.length) fs.rmSync(DIRS.pop() as string, { recursive: true, force: true });
});

describe('site plugin package policy', () => {
  it('accepts a plugin that only asks for what a site may have', () => {
    const dir = tempDir('fc-policy-');
    fs.writeFileSync(path.join(dir, 'index.js'), '');
    expect(TenantPluginPackagePolicy.violations(dir, { slug: 'x', capabilities: ['api', 'hooks', 'cache', 'i18n'] } as any)).toEqual([]);
  });

  it('names every reason at once: schema, admin UI, network, shared sandbox, npm dependencies', () => {
    const dir = tempDir('fc-policy-');
    fs.mkdirSync(path.join(dir, 'migrations'));
    fs.writeFileSync(path.join(dir, 'migrations', '001.js'), '');
    fs.mkdirSync(path.join(dir, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'ui', 'bundle.js'), '');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { lodash: '4' } }));
    const reasons = TenantPluginPackagePolicy.violations(dir, {
      slug: 'x', capabilities: ['network', 'database:schema', 'content'], collections: ['a'], sandbox: false, admin: { menu: [] },
    } as any).join(' | ');
    for (const expected of ['"collections"', '"admin"', '"sandbox": false', '"network"', '"database:schema"', '"content"', 'migrations/', 'admin bundle', 'npm dependencies']) {
      expect(reasons).toContain(expected);
    }
  });

  it('refuses every way into the ADMIN: an empty `admin`, `ui.entry` and `ui.adminCss` — but keeps the storefront keys', () => {
    // The admin imports `ui.entry` on the plugin's own page whether or not `admin` is declared, and
    // `admin: {}` is empty yet truthy where the admin decides to load a plugin's UI.
    const dir = tempDir('fc-policy-');
    fs.writeFileSync(path.join(dir, 'index.js'), '');
    const reasons = TenantPluginPackagePolicy.violations(dir, {
      slug: 'x', admin: {}, ui: { entry: 'frontend.js', adminCss: ['a.css'] },
    } as any).join(' | ');
    for (const expected of ['"admin"', '"ui.entry"', '"ui.adminCss"']) expect(reasons).toContain(expected);

    expect(TenantPluginPackagePolicy.violations(dir, { slug: 'x', ui: { frontendEntry: 'frontend.js', css: ['s.css'] } } as any)).toEqual([]);
  });

  it('refuses an entry file outside the plugin\'s own directory', () => {
    // Its process would `require` whatever the path names — another site's plugin, under its own user.
    const dir = tempDir('fc-policy-');
    fs.writeFileSync(path.join(dir, 'index.js'), '');
    for (const main of ['../other/index.js', '/etc/passwd']) {
      expect(TenantPluginPackagePolicy.violations(dir, { slug: 'x', main } as any).join(' | ')).toContain('outside');
    }
    expect(TenantPluginPackagePolicy.violations(dir, { slug: 'x', main: 'dist/index.js' } as any)).toEqual([]);
  });
});

describe('site plugin install', () => {
  it('refuses when the platform has not turned site uploads on', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue({ ...OPEN, enabled: false });
    const { installer } = hostOn(tempDir('fc-plugins-'));
    expect((await refusalOf(installer.install('acme', pluginZip({ slug: 'guestbook' })))).reason).toBe(TenantPluginRefusalReason.DISABLED);
  });

  it('refuses when the server cannot run a plugin under its own user', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue(OPEN);
    const { installer } = hostOn(tempDir('fc-plugins-'), { isolates: false });
    expect((await refusalOf(installer.install('acme', pluginZip({ slug: 'guestbook' })))).reason).toBe(TenantPluginRefusalReason.ISOLATION_UNAVAILABLE);
  });

  it('places it in the site\'s own directory, owned by the site, and enables it on the platform axis', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue(OPEN);
    const root = tempDir('fc-plugins-');
    const { host, installer } = hostOn(root);
    await installer.install('acme', pluginZip({ slug: 'guestbook' }));
    expect(fs.existsSync(path.join(ProjectPaths.getPluginsDirFor('acme'), 'guestbook', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'guestbook'))).toBe(false);
    expect(PluginOwners.ownerOf('guestbook')).toBe('acme');
    expect(host.enable).toHaveBeenCalledWith('guestbook');
  });

  it('refuses a slug the platform or another site already has, and never overwrites it', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue(OPEN);
    const root = tempDir('fc-plugins-');
    const { installer } = hostOn(root);
    await installer.install('globex', pluginZip({ slug: 'guestbook' }));
    expect((await refusalOf(installer.install('acme', pluginZip({ slug: 'guestbook' })))).reason).toBe(TenantPluginRefusalReason.SLUG_TAKEN);
    fs.mkdirSync(path.join(root, 'other'));
    expect((await refusalOf(installer.install('acme', pluginZip({ slug: 'other' })))).reason).toBe(TenantPluginRefusalReason.SLUG_TAKEN);
  });

  it('refuses a package the policy refuses, naming why', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue(OPEN);
    const { installer } = hostOn(tempDir('fc-plugins-'));
    const refusal = await refusalOf(installer.install('acme', pluginZip({ slug: 'guestbook', capabilities: ['network'] })));
    expect(refusal.reason).toBe(TenantPluginRefusalReason.POLICY);
    expect(refusal.message).toContain('"network"');
  });

  it('holds the site to its count', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue({ ...OPEN, maxPlugins: 1 });
    const { installer } = hostOn(tempDir('fc-plugins-'));
    await installer.install('acme', pluginZip({ slug: 'guestbook' }));
    expect((await refusalOf(installer.install('acme', pluginZip({ slug: 'other' })))).reason).toBe(TenantPluginRefusalReason.QUOTA);
  });

  it('removes only the site\'s own plugin; another site\'s is "not found"', async () => {
    vi.spyOn(TenantPluginQuota, 'current').mockResolvedValue(OPEN);
    const { host, installer } = hostOn(tempDir('fc-plugins-'));
    await installer.install('globex', pluginZip({ slug: 'guestbook' }));
    expect((await refusalOf(installer.remove('acme', 'guestbook'))).reason).toBe(TenantPluginRefusalReason.NOT_FOUND);
    await installer.remove('globex', 'guestbook');
    expect(host.delete).toHaveBeenCalledWith('guestbook');
    expect(PluginOwners.ownerOf('guestbook')).toBeNull();
  });
});

describe('a site\'s plugin never runs for another site', () => {
  it('refuses switching it on for any other site, from any caller of the state writer', async () => {
    PluginOwners.record('guestbook', 'globex');
    const db: any = { findOne: vi.fn(), insert: vi.fn(), update: vi.fn() };
    await expect(new PluginTenantStateService(db).enable('acme', 'guestbook')).rejects.toThrow(/belongs to another site/);
    expect(db.insert).not.toHaveBeenCalled();
    expect(PluginOwners.mayRunFor('guestbook', 'globex')).toBe(true);
    expect(PluginOwners.mayRunFor('platform-plugin', 'acme')).toBe(true);
  });

  it('is never offered to other plugins as a peer', () => {
    PluginOwners.record('guestbook', 'globex');
    const plugin: any = { state: 'active', publicAPI: { hello: () => 1 }, manifest: { slug: 'guestbook' } };
    expect(PluginsManagerResolver.refusalReason(plugin, 'globex')).toContain('one site\'s own plugin');
  });
});

describe('bounded archive extraction', () => {
  it('refuses an archive that unpacks past the limit before writing it', () => {
    const zip = new AdmZip();
    zip.addFile('big.txt', Buffer.alloc(64 * 1024, 'a'));
    const file = path.join(tempDir('fc-zip-'), 'big.zip');
    zip.writeZip(file);
    const target = tempDir('fc-out-');
    expect(() => SafeArchive.extractZip(file, target, 1024)).toThrow(/unpacks to more than/);
    expect(fs.existsSync(path.join(target, 'big.txt'))).toBe(false);
  });

  it('refuses an entry that declares itself EMPTY but carries data — the unbounded case of the inflater', () => {
    // adm-zip caps inflation at the declared size, except a declared 0. 50 KB on the wire became 50 MB
    // in the api's memory before any limit was consulted.
    const zip = new AdmZip();
    zip.addFile('bomb.txt', Buffer.alloc(8 * 1024 * 1024, 'a'));
    const bytes = zip.toBuffer();
    bytes.writeUInt32LE(0, bytes.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04])) + 22);
    bytes.writeUInt32LE(0, bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 24);
    const file = path.join(tempDir('fc-zip-'), 'bomb.zip');
    fs.writeFileSync(file, bytes);
    const target = tempDir('fc-out-');

    expect(() => SafeArchive.extractZip(file, target, 1024 * 1024)).toThrow(/declares no content/);
    expect(fs.existsSync(path.join(target, 'bomb.txt'))).toBe(false);

    // An honestly empty file still unpacks.
    const empty = new AdmZip();
    empty.addFile('empty.txt', Buffer.alloc(0));
    const emptyFile = path.join(tempDir('fc-zip-'), 'empty.zip');
    empty.writeZip(emptyFile);
    SafeArchive.extractZip(emptyFile, target, 1024);
    expect(fs.readFileSync(path.join(target, 'empty.txt')).length).toBe(0);
  });
});
