import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { SystemControllerRuntime } from './system-controller-runtime';

export class SystemAdminController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getAdminMetadata(req: Request, res: Response) {
    try {
      const metadata = await this.runtime.manager.getAdminMetadata() as any;
      const runtimeModules = this.runtime.manager.getRuntimeModules();
      const frontendMeta = await this.runtime.themeManager.getFrontendMetadata(runtimeModules);

      if (frontendMeta?.activeTheme) {
        metadata.activeTheme = {
          ...frontendMeta.activeTheme,
          ui: { ...(frontendMeta.activeTheme.ui || {}), css: [] },
        };
      }
      if (frontendMeta?.runtimeModules) {
        metadata.runtimeModules = frontendMeta.runtimeModules;
      }

      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      const settingsMap: Record<string, any> = {};
      settings.forEach((setting: any) => {
        settingsMap[setting.key] = setting.value;
      });
      metadata.settings = settingsMap;
      metadata.secondaryPanel = metadata.secondaryPanel || this.runtime.buildDefaultSecondaryPanel();
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSettings(req: Request, res: Response) {
    try {
      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      const settingsMap: Record<string, any> = {};
      settings.forEach((setting: any) => {
        try {
          if (typeof setting.value === 'string' && (setting.value.startsWith('{') || setting.value.startsWith('['))) {
            settingsMap[setting.key] = JSON.parse(setting.value);
            return;
          }
          settingsMap[setting.key] = setting.value;
        } catch {
          settingsMap[setting.key] = setting.value;
        }
      });
      res.json(settingsMap);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const payload = req.body;
      for (const [key, value] of Object.entries(payload)) {
        await this.runtime.db.upsert(SystemConstants.TABLE.META, {
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          updated_at: new Date(),
        }, {
          target: 'key',
          set: {
            value: typeof value === 'string' ? value : JSON.stringify(value),
            updated_at: new Date(),
          },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getFrontendMetadata(req: Request, res: Response) {
    const metadata = await this.runtime.themeManager.getFrontendMetadata(this.runtime.manager.getRuntimeModules());
    const adminMetadata = await this.runtime.manager.getAdminMetadata() as any;
    const publicSettings = await this.runtime.publicFrontendSettings.getSettings(this.runtime.db);
    const plugins = this.runtime.manager.getSortedPlugins(
      this.runtime.manager.getPlugins().filter((plugin: any) => plugin.state === 'active')
    ).map((plugin: any) => ({
      slug: plugin.manifest.slug,
      version: plugin.manifest.version,
      name: plugin.manifest.name,
      capabilities: plugin.manifest.capabilities,
      ui: {
        ...(plugin.manifest.ui || {}),
        headInjections: this.runtime.manager.getHeadInjections(plugin.manifest.slug),
      },
    }));

    res.json({
      ...metadata,
      menu: Array.isArray(adminMetadata?.menu)
        ? adminMetadata.menu
        : (Array.isArray((metadata as any)?.menu) ? (metadata as any).menu : []),
      secondaryPanel: adminMetadata?.secondaryPanel || this.runtime.buildDefaultSecondaryPanel(),
      plugins,
      publicSettings,
    });
  }

  async getThemes(req: Request, res: Response) {
    res.json(this.runtime.themeManager.getThemes());
  }

  async activateTheme(req: Request, res: Response) {
    try {
      await this.runtime.themeManager.activateTheme(req.body.slug);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: Request, res: Response) {
    const stats = await Promise.all(this.runtime.manager.getCollections().map(async (collection) => {
      try {
        return {
          slug: collection.slug,
          shortSlug: collection.shortSlug || collection.slug,
          count: await this.runtime.db.count(collection.tableName || collection.slug),
          system: !!collection.system,
          hidden: !!collection.admin?.hidden,
          icon: collection.admin?.icon,
          priority: collection.admin?.priority || collection.priority || 100,
          pluginSlug: collection.pluginSlug || 'system',
        };
      } catch {
        return { slug: collection.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.runtime.manager.getSecuritySummary());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
