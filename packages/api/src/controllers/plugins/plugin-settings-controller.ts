import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';

export class PluginSettingsController {
  private logger = new Logger({ namespace: 'plugin-settings-controller' });
  private static readonly DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES = 'system_locales';

  constructor(private manager: PluginManager) {}

  async getSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.getEffectiveSchema(slug);
    const storedSettings = plugin.manifest.config?.settings || {};

    if (!schema) {
      return res.json({ settings: storedSettings });
    }

    const defaults = this.getDefaults(schema.fields || []);
    const merged = { ...defaults, ...storedSettings };

    res.json({ settings: merged });
  }

  async updateSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const newSettings = req.body;

    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.getEffectiveSchema(slug);

    if (schema) {
      const errors = await this.validateSettings(newSettings, schema);
      if (errors) {
        return res.status(400).json({ errors });
      }

      if (schema.validate) {
        const customErrors = await schema.validate(newSettings, (this.manager as any).createContext(plugin));
        if (customErrors) {
          return res.status(400).json({ errors: customErrors });
        }
      }
    }

    const oldSettings = plugin.manifest.config?.settings || {};
    const currentConfig = plugin.manifest.config || {};
    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: newSettings
    });

    if (schema && schema.onSave) {
      try {
        await schema.onSave(oldSettings, newSettings, (this.manager as any).createContext(plugin));
      } catch (err: any) {
        this.logger.error(`onSave hook failed for plugin "${slug}": ${err.message}`);
      }
    }

    this.manager.emit('plugin:settings:updated', {
      pluginSlug: slug,
      oldSettings,
      newSettings,
    });

    res.json({ success: true, settings: newSettings });
  }

  async getSchema(req: Request, res: Response) {
    const { slug } = req.params;
    const schema = await this.getEffectiveSchema(slug);

    if (!schema) {
      const allRegistered = Array.from(this.manager.getAllPluginSettings().keys());
      this.logger.warn(`Settings requested for "${slug}" but not found. Registered plugins: ${allRegistered.join(', ')}`);

      const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
      if (plugin) {
        this.logger.debug(`Plugin "${slug}" found with state: ${plugin.state}`);
      }

      return res.status(404).json({ error: 'Plugin has no settings registered' });
    }

    res.json(schema);
  }

  async resetSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const schema = await this.getEffectiveSchema(slug);

    if (!schema) {
      return res.status(404).json({ error: 'Plugin has no settings registered' });
    }

    const defaults = this.getDefaults(schema.fields || []);
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    const currentConfig = plugin?.manifest.config || {};

    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: defaults
    });

    res.json({ success: true, settings: defaults });
  }

  async exportSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const settings = plugin.manifest.config?.settings || {};

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-settings-${Date.now()}.json"`
    );
    res.send(JSON.stringify(settings, null, 2));
  }

  async importSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const importedSettings = req.body;

    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.getEffectiveSchema(slug);
    if (schema) {
      const errors = await this.validateSettings(importedSettings, schema);
      if (errors) {
        return res.status(400).json({ errors });
      }
    }

    const currentConfig = plugin.manifest.config || {};
    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: importedSettings
    });

    res.json({ success: true, imported: Object.keys(importedSettings).length });
  }

  private getDefaults(fields: any[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    return defaults;
  }

  private async validateSettings(
    settings: Record<string, any>,
    schema: any
  ): Promise<Record<string, string> | null> {
    const errors: Record<string, string> = {};
    const fields = schema.fields || [];

    for (const field of fields) {
      const value = settings[field.name];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = 'This field is required';
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      switch (field.type) {
        case 'number':
          if (typeof value !== 'number' || Number.isNaN(value)) {
            errors[field.name] = 'Must be a number';
          } else if (field.min !== undefined && value < field.min) {
            errors[field.name] = `Must be at least ${field.min}`;
          } else if (field.max !== undefined && value > field.max) {
            errors[field.name] = `Must be at most ${field.max}`;
          }
          break;
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors[field.name] = 'Must be a valid email';
          }
          break;
        case 'url':
          try {
            new URL(String(value));
          } catch {
            errors[field.name] = 'Must be a valid URL';
          }
          break;
        case 'select':
          if (Array.isArray(field.options) && !field.options.some((option: any) => option?.value === value)) {
            errors[field.name] = 'Must be a valid option';
          }
          break;
        default:
          break;
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  private async getEffectiveSchema(slug: string): Promise<any | null> {
    const settingsRegistry = this.manager.getPluginSettings(slug);
    if (!settingsRegistry) {
      return null;
    }

    const schema = { ...settingsRegistry };
    schema.fields = await this.resolveDynamicOptions(schema.fields || []);
    return schema;
  }

  private async resolveDynamicOptions(fields: any[]): Promise<any[]> {
    const resolvedFields: any[] = [];

    for (const field of fields) {
      if (field?.dynamicOptionsSource === PluginSettingsController.DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES) {
        const localeOptions = await this.buildSystemLocaleOptions();
        resolvedFields.push({
          ...field,
          options: localeOptions,
        });
        continue;
      }

      resolvedFields.push(field);
    }

    return resolvedFields;
  }

  private async buildSystemLocaleOptions(): Promise<Array<{ label: string; value: string }>> {
    try {
      const locales = await (this.manager as any).db.settings.findFirst({
        where: (settings: any, operators: any) => operators.eq(settings.key, SystemConstants.META_KEY.LOCALIZATION_LOCALES),
      });

      const rawValue = locales?.value;
      if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        return [];
      }

      const parsed = JSON.parse(rawValue);
      const localeList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.locales)
          ? parsed.locales
          : [];

      return localeList
        .map((locale: any) => {
          const code = String(locale?.code || '').trim();
          if (!code) {
            return null;
          }

          const label = String(locale?.label || locale?.name || code).trim() || code;
          return { label, value: code };
        })
        .filter((option: { label: string; value: string } | null): option is { label: string; value: string } => option !== null);
    } catch (error: any) {
      this.logger.warn(`Failed to resolve system locale options: ${error?.message || 'unknown error'}`);
      return [];
    }
  }
}