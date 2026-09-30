import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { ITenantPluginHost } from '@core/plugin/tenant/interfaces/tenant-plugin-host.interface';
import { ProjectPaths } from '@core/config/paths';
import { SafeArchive } from '@core/security/safe-archive';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';
import { TenantPluginQuota } from '@core/plugin/tenant/tenant-plugin-quota';
import { TenantPluginRunRules } from '@core/plugin/tenant/tenant-plugin-run-rules';
import { TenantPluginPackagePolicy } from '@core/plugin/tenant/tenant-plugin-package-policy';
import { TenantPluginRefusal } from '@core/plugin/tenant/tenant-plugin-refusal';
import { TenantPluginRefusalReason } from '@core/plugin/tenant/enums/tenant-plugin-refusal-reason.enum';

/**
 * A SITE installing and removing a plugin of its own.
 *
 * Nothing here is the platform's install path. No migrations run, nothing is `npm install`ed, and the
 * plugin lands in `plugins/tenants/<site>/`, where discovery tags it as that site's and starts it only
 * isolated under its own user (`TenantPluginRunRules`). Every refusal is a `TenantPluginRefusal` that
 * names its reason, so the site's admin sees why, not a bare failure.
 */
export class TenantPluginInstaller {
  constructor(private readonly host: ITenantPluginHost) {}

  /** What this site may do right now, for the upload screen. */
  async quota(tenantId: string): Promise<{ enabled: boolean; isolated: boolean; maxBytes: number; maxPlugins: number; usedBytes: number; plugins: number }> {
    const limits = await TenantPluginQuota.current();
    const own = TenantPluginInstaller.ownDirs(tenantId);
    return {
      enabled: limits.enabled,
      isolated: Boolean(this.host.pluginHosts?.isolatesIdentity()),
      maxBytes: limits.maxBytes,
      maxPlugins: limits.maxPlugins,
      usedBytes: own.reduce((total, dir) => total + TenantPluginPackagePolicy.byteSize(dir), 0),
      plugins: own.length,
    };
  }

  async install(tenantId: string, archivePath: string): Promise<IPluginManifest> {
    const limits = await TenantPluginQuota.current();
    if (!limits.enabled) throw new TenantPluginRefusal(TenantPluginRefusalReason.DISABLED, 'The platform does not allow sites to upload their own plugins.');
    if (!this.host.pluginHosts?.isolatesIdentity()) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.ISOLATION_UNAVAILABLE, 'This server cannot run a site\'s plugin under its own user, so it does not accept one.');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-site-plugin-'));
    try {
      TenantPluginInstaller.extract(archivePath, tempDir, limits.maxBytes);
      const contentDir = TenantPluginInstaller.findManifestDir(tempDir, 3);
      if (!contentDir) throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, 'The package has no manifest.json.');
      const manifest = TenantPluginInstaller.readManifest(contentDir);
      const slug = String(manifest.slug);

      const refusal = TenantPluginRunRules.refusal(contentDir, manifest, this.host.pluginHosts);
      if (refusal) throw new TenantPluginRefusal(TenantPluginRefusalReason.POLICY, refusal);
      this.assertSlugFree(tenantId, slug);
      TenantPluginInstaller.assertWithinQuota(tenantId, slug, contentDir, limits);

      const target = path.join(TenantPluginInstaller.siteRoot(tenantId), slug);
      const replacing = this.host.plugins.get(slug);
      TenantPluginInstaller.replaceDir(contentDir, target);

      if (replacing && (await this.host.pluginHosts!.reload(slug, { ...manifest, sandbox: TenantPluginRunRules.isolated(manifest.sandbox), ownerTenantId: tenantId }))) {
        // A plugin the platform stopped (a crash loop, a resource limit) has no process for the reload to
        // replace: uploading a fixed version is how the site asks for it back, so start it on the new code.
        if (replacing.stoppedByPlatform) await this.host.enable(slug);
        return manifest;
      }
      await this.host.discoverPlugins();
      const loaded = this.host.plugins.get(slug);
      if (!loaded || PluginOwners.ownerOf(slug) !== tenantId) {
        throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, `"${slug}" was placed but did not load; see the plugin's error on the Plugins page.`);
      }
      await this.host.enable(slug);
      return manifest;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /** Removes one of THIS site's plugins. Anything else is "not found" — a site cannot probe others'. */
  async remove(tenantId: string, slug: string): Promise<void> {
    if (PluginOwners.ownerOf(slug) !== tenantId) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.NOT_FOUND, `This site has no plugin "${slug}".`);
    }
    await this.host.delete(slug);
    PluginOwners.forget(slug);
    fs.rmSync(path.join(TenantPluginInstaller.siteRoot(tenantId), slug), { recursive: true, force: true });
  }

  /** A slug is one plugin across the whole server: the platform's, or exactly one site's. */
  private assertSlugFree(tenantId: string, slug: string): void {
    const owner = PluginOwners.ownerOf(slug);
    const taken = (this.host.plugins.has(slug) && owner !== tenantId)
      || fs.existsSync(path.join(ProjectPaths.getPluginsDir(), slug))
      || TenantPluginInstaller.otherSitesWith(tenantId, slug);
    if (taken) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.SLUG_TAKEN, `A plugin named "${slug}" already exists on this server. Give yours a different slug.`);
    }
  }

  private static assertWithinQuota(tenantId: string, slug: string, contentDir: string, limits: { maxBytes: number; maxPlugins: number }): void {
    const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
    const incoming = TenantPluginPackagePolicy.byteSize(contentDir);
    const others = TenantPluginInstaller.ownDirs(tenantId).filter((dir) => path.basename(dir) !== slug);
    if (others.length >= limits.maxPlugins) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.QUOTA, `This site already has ${others.length} of its own plugins, which is the limit. Delete one first.`);
    }
    const held = others.reduce((total, dir) => total + TenantPluginPackagePolicy.byteSize(dir), 0);
    if (held + incoming > limits.maxBytes) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.QUOTA, `This site's plugins would total ${megabytes(held + incoming)} MB, over the ${megabytes(limits.maxBytes)} MB it may store.`);
    }
  }

  private static readManifest(contentDir: string): IPluginManifest {
    let manifest: IPluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8'));
    } catch {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, 'manifest.json is not valid JSON.');
    }
    const slug = String(manifest?.slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, `Invalid plugin slug "${slug}". Use lowercase letters, digits and dashes.`);
    }
    return { ...manifest, slug };
  }

  /**
   * ZIP ONLY, and bounded: a site's upload unpacks to at most what the site may store. The tar path
   * has no size bound, so a site does not get it.
   */
  private static extract(archivePath: string, targetDir: string, maxBytes: number): void {
    const head = Buffer.alloc(2);
    const fd = fs.openSync(archivePath, 'r');
    try { fs.readSync(fd, head, 0, 2, 0); } finally { fs.closeSync(fd); }
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, 'Upload the plugin as a .zip package.');
    }
    try {
      SafeArchive.extractZip(archivePath, targetDir, maxBytes);
    } catch (err: any) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, String(err?.message || 'The package could not be unpacked.'));
    }
  }

  private static findManifestDir(dir: string, depth: number): string | null {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
    if (depth <= 0) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '__MACOSX') continue;
      const found = TenantPluginInstaller.findManifestDir(path.join(dir, entry.name), depth - 1);
      if (found) return found;
    }
    return null;
  }

  /** Copies the new files next to the old, then swaps, so a failed copy leaves the site's plugin intact. */
  private static replaceDir(sourceDir: string, target: string): void {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // A dot-directory: discovery skips those, so a scan mid-copy never meets a half-written plugin.
    const incoming = path.join(path.dirname(target), `.incoming-${path.basename(target)}`);
    fs.rmSync(incoming, { recursive: true, force: true });
    fs.cpSync(sourceDir, incoming, { recursive: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(incoming, target);
  }

  /**
   * The site's own directory. `getPluginsDirFor` answers a malformed id with the PLATFORM root, and a
   * site's plugin placed there would be discovered as the platform's — unisolated, unpoliced — so that
   * answer is refused here rather than trusted.
   */
  private static siteRoot(tenantId: string): string {
    const root = ProjectPaths.getPluginsDirFor(tenantId);
    if (path.resolve(root) === path.resolve(ProjectPaths.getPluginsDir())) {
      throw new TenantPluginRefusal(TenantPluginRefusalReason.INVALID, 'This site has no directory of its own for plugins.');
    }
    return root;
  }

  private static ownDirs(tenantId: string): string[] {
    const root = TenantPluginInstaller.siteRoot(tenantId);
    try {
      return fs.readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => path.join(root, entry.name));
    } catch {
      return [];
    }
  }

  private static otherSitesWith(tenantId: string, slug: string): boolean {
    const root = ProjectPaths.tenantArtifactsRoot(ProjectPaths.getPluginsDir());
    try {
      return fs.readdirSync(root).some((site) => site !== tenantId && fs.existsSync(path.join(root, site, slug)));
    } catch {
      return false;
    }
  }
}
