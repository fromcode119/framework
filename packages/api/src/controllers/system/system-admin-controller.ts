import { Request, Response } from 'express';
import { ApplicationDomainSettingsUtils, SystemConstants } from '@fromcode119/core';
import { SystemControllerRuntime } from './system-controller-runtime';

const WRITABLE_SETTINGS_KEYS = new Set<string>([
  SystemConstants.META_KEY.MAINTENANCE_MODE,
  SystemConstants.META_KEY.SITE_NAME,
  SystemConstants.META_KEY.SITE_URL,
  SystemConstants.META_KEY.FRONTEND_URL,
  SystemConstants.META_KEY.ADMIN_URL,
  SystemConstants.META_KEY.DOMAIN_ALIASES,
  SystemConstants.META_KEY.TIMEZONE,
  SystemConstants.META_KEY.PLATFORM_NAME,
  SystemConstants.META_KEY.PLATFORM_DOMAIN,
  SystemConstants.META_KEY.TELEMETRY_ENABLED,
  SystemConstants.META_KEY.LOCALIZATION_LOCALES,
  SystemConstants.META_KEY.ENABLED_LOCALES,
  SystemConstants.META_KEY.DEFAULT_LOCALE,
  SystemConstants.META_KEY.FALLBACK_LOCALE,
  SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE,
  SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE,
  SystemConstants.META_KEY.LOCALE_URL_STRATEGY,
  SystemConstants.META_KEY.PERMALINK_STRUCTURE,
  SystemConstants.META_KEY.ROUTING_HOME_TARGET,
  SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED,
  SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED,
  SystemConstants.META_KEY.EMAIL_NOTIFICATIONS,
]);

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
          ui: { ...(frontendMeta.activeTheme.ui || {}), css: [], entry: undefined },
        };
      }
      if (frontendMeta?.runtimeModules) {
        metadata.runtimeModules = frontendMeta.runtimeModules;
      }

      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      const settingsMap: Record<string, any> = {};
      settings.forEach((setting: any) => {
        if (!setting.key.startsWith('integration_')) {
          settingsMap[setting.key] = setting.value;
        }
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
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'Settings payload must be an object.' });
      }

      const unknownKeys = Object.keys(payload).filter((k) => !WRITABLE_SETTINGS_KEYS.has(k));
      if (unknownKeys.length > 0) {
        return res.status(400).json({ error: `Unknown or read-only settings key(s): ${unknownKeys.join(', ')}` });
      }

      const preparedPayload = await this.prepareSettingsPayload(payload as Record<string, unknown>);
      const timestamp = new Date();

      for (const [key, value] of Object.entries(preparedPayload)) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        const existing = await this.runtime.db.findOne(SystemConstants.TABLE.META, { key });

        if (existing) {
          await this.runtime.db.update(SystemConstants.TABLE.META, { key }, {
            value: serializedValue,
            updated_at: timestamp,
          });
          continue;
        }

        await this.runtime.db.insert(SystemConstants.TABLE.META, {
          key,
          value: serializedValue,
          updated_at: timestamp,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private async prepareSettingsPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const nextPayload = { ...payload };
    if (!this.hasPrimaryDomainChange(payload) && !(SystemConstants.META_KEY.DOMAIN_ALIASES in payload)) {
      return nextPayload;
    }

    const currentSettings = await this.readCurrentDomainSettings();
    const mergedAliases = ApplicationDomainSettingsUtils.mergeDomainAliasesForPrimaryChange({
      currentAliases:
        SystemConstants.META_KEY.DOMAIN_ALIASES in payload
          ? payload[SystemConstants.META_KEY.DOMAIN_ALIASES]
          : currentSettings.domainAliases,
      previousValues: [
        currentSettings.siteUrl,
        currentSettings.frontendUrl,
        currentSettings.adminUrl,
        currentSettings.platformDomain,
      ],
      nextValues: [
        nextPayload[SystemConstants.META_KEY.SITE_URL] ?? currentSettings.siteUrl,
        nextPayload[SystemConstants.META_KEY.FRONTEND_URL] ?? currentSettings.frontendUrl,
        nextPayload[SystemConstants.META_KEY.ADMIN_URL] ?? currentSettings.adminUrl,
        nextPayload[SystemConstants.META_KEY.PLATFORM_DOMAIN] ?? currentSettings.platformDomain,
      ],
    });

    if (mergedAliases.length > 0 || SystemConstants.META_KEY.DOMAIN_ALIASES in payload) {
      nextPayload[SystemConstants.META_KEY.DOMAIN_ALIASES] = mergedAliases;
    }

    return nextPayload;
  }

  private hasPrimaryDomainChange(payload: Record<string, unknown>): boolean {
    return [
      SystemConstants.META_KEY.SITE_URL,
      SystemConstants.META_KEY.FRONTEND_URL,
      SystemConstants.META_KEY.ADMIN_URL,
      SystemConstants.META_KEY.PLATFORM_DOMAIN,
    ].some((key) => key in payload);
  }

  private async readCurrentDomainSettings(): Promise<Record<string, string>> {
    const keys = [
      SystemConstants.META_KEY.SITE_URL,
      SystemConstants.META_KEY.FRONTEND_URL,
      SystemConstants.META_KEY.ADMIN_URL,
      SystemConstants.META_KEY.PLATFORM_DOMAIN,
      SystemConstants.META_KEY.DOMAIN_ALIASES,
    ];
    const settings = await Promise.all(
      keys.map((key) => this.runtime.db.findOne(SystemConstants.TABLE.META, { key })),
    );

    return {
      siteUrl: String(settings[0]?.value || ''),
      frontendUrl: String(settings[1]?.value || ''),
      adminUrl: String(settings[2]?.value || ''),
      platformDomain: String(settings[3]?.value || ''),
      domainAliases: String(settings[4]?.value || ''),
    };
  }

  async getFrontendMetadata(req: Request, res: Response) {
    const metadata = await this.runtime.themeManager.getFrontendMetadata(this.runtime.manager.getRuntimeModules());
    const adminMetadata = await this.runtime.manager.getAdminMetadata() as any;
    const publicSettings = await this.runtime.publicFrontendSettings.getSettings(this.runtime.db);
    const plugins = this.runtime.manager.getSortedPlugins(
      this.runtime.manager.getPlugins().filter((plugin: any) => plugin.state === 'active')
    ).map((plugin: any) => ({
      namespace: plugin.manifest.namespace,
      slug: plugin.manifest.slug,
      version: plugin.manifest.version,
      name: plugin.manifest.name,
      capabilities: plugin.manifest.capabilities,
      ui: {
        ...(plugin.manifest.ui || {}),
        headInjections: this.runtime.manager.getHeadInjections(plugin.manifest.slug),
      },
    }));

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json({
      ...metadata,
      menu: Array.isArray(adminMetadata?.menu)
        ? adminMetadata.menu
        : (Array.isArray((metadata as any)?.menu) ? (metadata as any).menu : []),
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
