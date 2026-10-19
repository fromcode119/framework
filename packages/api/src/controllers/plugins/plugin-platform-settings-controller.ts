import { Request, Response } from 'express';
import { PluginManager, Logger, CoercionUtils, PluginPlatformSettings, RequestContextUtils, TenantMode } from '@fromcode119/core';
import { PluginSettingsSupport } from '@api/controllers/plugins/plugin-settings-support';
import { AdminSchemaLocalization } from '@api/services/system/admin-schema-localization';

/**
 * The console's side of a plugin's PLATFORM settings (`context.platform.registerSettings`) — one value
 * per installation, such as a provider app's id and secret. Answered only where no site or workspace is
 * bound, behind the platform-admin guard: a site's administrator never sees, let alone changes, them.
 * Secret fields are masked on read and sealed on save by the same rules as a plugin's own settings.
 */
export class PluginPlatformSettingsController {
  static readonly INSIDE_TENANT = 'PLATFORM_SETTINGS_INSIDE_TENANT';

  private logger = new Logger({ namespace: 'plugin-platform-settings-controller' });
  private support: PluginSettingsSupport;
  private store: PluginPlatformSettings;

  constructor(private manager: PluginManager) {
    this.support = new PluginSettingsSupport(manager, this.logger);
    this.store = new PluginPlatformSettings(manager.db);
  }

  async getSchema(req: Request, res: Response) {
    const resolved = this.resolve(req, res);
    if (!resolved) return;
    res.json((await AdminSchemaLocalization.forRequest(this.manager, req)).settings(resolved.slug, resolved.schema));
  }

  async getSettings(req: Request, res: Response) {
    const resolved = this.resolve(req, res);
    if (!resolved) return;
    const fields = resolved.schema.fields;
    const merged = { ...this.support.getDefaults(fields), ...(await this.store.stored(resolved.slug)) };
    res.json({ settings: this.support.maskPasswordFields(merged, fields) });
  }

  async updateSettings(req: Request, res: Response) {
    const resolved = this.resolve(req, res);
    if (!resolved) return;
    const incoming = CoercionUtils.toObject(req.body) as Record<string, any>;
    const errors = await this.support.validateSettings(incoming, resolved.schema);
    if (errors) return res.status(400).json({ errors });

    const existing = await this.store.stored(resolved.slug);
    const sealed = this.support.encryptPasswordFields(incoming, existing, resolved.schema.fields);
    await this.store.save(resolved.slug, sealed);
    this.logger.info(`Platform settings of "${resolved.slug}" saved`);
    res.json({ success: true, settings: this.support.maskPasswordFields(sealed, resolved.schema.fields) });
  }

  /** The plugin and its platform schema, or null once a refusal has been sent. */
  private resolve(req: Request, res: Response): { slug: string; schema: { fields: Array<Record<string, any>>; tabs?: unknown[] } } | null {
    if (TenantMode.isEnabled() && RequestContextUtils.getTenantId()) {
      res.status(409).json({
        error: 'Platform settings are set on the platform itself, never inside a site or workspace',
        code: PluginPlatformSettingsController.INSIDE_TENANT,
      });
      return null;
    }
    const slug = CoercionUtils.toString(req.params.slug);
    const plugin = this.manager.getPlugins().find((p) => p.manifest.slug === slug);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return null;
    }
    const schema = PluginPlatformSettings.schema(slug);
    if (!schema) {
      res.status(404).json({ error: 'Plugin has no platform settings registered' });
      return null;
    }
    return { slug, schema };
  }
}
