import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InstalledPluginManifestService } from '@core/plugin/services/installation/installed-plugin-manifest-service';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * The rules the boot scanner has always applied to an installed plugin's manifest, extracted so a
 * hot install/update finalizes a plugin's manifest the SAME way instead of registering it raw.
 */
describe('InstalledPluginManifestService', () => {
  describe('read', () => {
    let root: string;
    let pluginPath: string;

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-plugin-manifest-read-test-'));
      pluginPath = path.join(root, 'sample-widget');
      fs.mkdirSync(pluginPath, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(root, { recursive: true, force: true });
    });

    function writeManifest(content: Record<string, unknown>): void {
      fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify(content));
    }

    it('lowercases the slug', () => {
      writeManifest({ slug: 'Sample-Widget', name: 'Sample Widget', version: '1.2.3' });
      const manifest = InstalledPluginManifestService.read(pluginPath);
      expect(manifest.slug).toBe('sample-widget');
    });

    it('defaults category to "general" when the manifest declares none', () => {
      writeManifest({ slug: 'sample-widget', name: 'Sample Widget', version: '1.2.3' });
      const manifest = InstalledPluginManifestService.read(pluginPath);
      expect((manifest as unknown as { category?: string }).category).toBe('general');
    });

    it('fills version from package.json when the manifest declares none', () => {
      writeManifest({ slug: 'sample-widget', name: 'Sample Widget' });
      fs.writeFileSync(path.join(pluginPath, 'package.json'), JSON.stringify({ version: '9.9.9' }));
      const manifest = InstalledPluginManifestService.read(pluginPath);
      expect(manifest.version).toBe('9.9.9');
    });

    it('falls back to 1.0.0 when neither the manifest nor package.json declare a version', () => {
      writeManifest({ slug: 'sample-widget', name: 'Sample Widget' });
      const manifest = InstalledPluginManifestService.read(pluginPath);
      expect(manifest.version).toBe('1.0.0');
    });

    it('strips a declared ownerTenantId when none is passed', () => {
      writeManifest({ slug: 'sample-widget', name: 'Sample Widget', version: '1.0.0', ownerTenantId: 'someone-elses-tenant' });
      const manifest = InstalledPluginManifestService.read(pluginPath);
      expect((manifest as unknown as { ownerTenantId?: string }).ownerTenantId).toBeUndefined();
    });

    it('stamps the given ownerTenantId, overriding whatever the manifest itself declared', () => {
      writeManifest({ slug: 'sample-widget', name: 'Sample Widget', version: '1.0.0', ownerTenantId: 'someone-elses-tenant' });
      const manifest = InstalledPluginManifestService.read(pluginPath, 'tenant-42');
      expect((manifest as unknown as { ownerTenantId?: string }).ownerTenantId).toBe('tenant-42');
    });
  });

  describe('applyPersistedSandbox', () => {
    function manifestWith(sandbox: unknown): { sandbox?: unknown } {
      return sandbox === undefined ? {} : { sandbox };
    }

    it('persisted undefined defers to the manifest value', () => {
      const manifest = manifestWith({ memoryLimit: 64 });
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, undefined);
      expect(effective).toEqual({ memoryLimit: 64 });
      expect(manifest.sandbox).toEqual({ memoryLimit: 64 });
    });

    it('persisted {} says nothing and defers to the manifest value', () => {
      const manifest = manifestWith({ memoryLimit: 64 });
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, { sandboxConfig: {} });
      expect(effective).toEqual({ memoryLimit: 64 });
    });

    it("a manifest's sandbox: false wins over a persisted {}", () => {
      const manifest = manifestWith(false);
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, { sandboxConfig: {} });
      expect(effective).toBe(false);
      expect(manifest.sandbox).toBe(false);
    });

    it('persisted false replaces the manifest value', () => {
      const manifest = manifestWith({ memoryLimit: 64 });
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, { sandboxConfig: false });
      expect(effective).toBe(false);
      expect(manifest.sandbox).toBe(false);
    });

    it('a persisted object REPLACES the manifest value entirely', () => {
      const manifest = manifestWith({ memoryLimit: 64, timeout: 1000 });
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, { sandboxConfig: { memoryLimit: 512 } });
      expect(effective).toEqual({ memoryLimit: 512 });
      expect(manifest.sandbox).toEqual({ memoryLimit: 512 });
    });

    it('defaults to sandbox enabled (true) when nothing anywhere declares one', () => {
      const manifest = manifestWith(undefined);
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, undefined);
      expect(effective).toBe(true);
      expect(manifest.sandbox).toBe(true);
    });

    it('falls back to the in-memory value when nothing is persisted and the manifest declares none', () => {
      const manifest = manifestWith(undefined);
      const effective = InstalledPluginManifestService.applyPersistedSandbox(manifest as any, undefined, { memoryLimit: 128 });
      expect(effective).toEqual({ memoryLimit: 128 });
    });
  });

  describe('carryRuntimeState', () => {
    it("carries the existing (running) plugin's config forward onto the fresh manifest", () => {
      const manifest: any = { slug: 'sample-widget', name: 'Sample Widget', version: '2.0.0' };
      const existing = {
        manifest: { slug: 'sample-widget', name: 'Sample Widget', version: '1.0.0', config: { key: 'saved' } },
      } as unknown as ILoadedPlugin;

      InstalledPluginManifestService.carryRuntimeState(manifest, existing);

      expect(manifest.config).toBe(existing.manifest.config);
    });
  });
});
