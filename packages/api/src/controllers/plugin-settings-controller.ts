import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode/core';

export class PluginSettingsController {
  private logger = new Logger({ namespace: 'plugin-settings-controller' });
  private static readonly DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES = 'system_locales';

  constructor(private manager: PluginManager) {}

  /**
   * GET /api/v1/plugins/:slug/settings
   * Returns current settings values merged with defaults
   */
  async getSettings(req: Request, res: Response) {
    const { slug } = req.params;
    
    // Check if plugin exists
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    // Get schema
    const schema = await this.getEffectiveSchema(slug);
    
    // Get stored values from current manifest config
    const storedSettings = plugin.manifest.config?.settings || {};
    
    if (!schema) {
      // Just return current config/settings if no schema is registered
      return res.json({ settings: storedSettings });
    }
    
    // Merge with defaults
    const defaults = this.getDefaults(schema.fields || []);
    const merged = { ...defaults, ...storedSettings };
    
    res.json({ settings: merged });
  }

  /**
   * PUT /api/v1/plugins/:slug/settings
   * Updates plugin settings
   */
  async updateSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const newSettings = req.body;
    
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.getEffectiveSchema(slug);
    
    // Validate against schema if it exists
    if (schema) {
      const errors = await this.validateSettings(newSettings, schema);
      if (errors) {
        return res.status(400).json({ errors });
      }
      
      // Call custom validation if provided
      if (schema.validate) {
        const customErrors = await schema.validate(newSettings, (this.manager as any).createContext(plugin));
        if (customErrors) {
          return res.status(400).json({ errors: customErrors });
        }
      }
    }
    
    // Get old settings for comparison
    const oldSettings = plugin.manifest.config?.settings || {};
    
    // Update config in DB via manager
    const currentConfig = plugin.manifest.config || {};
    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: newSettings
    });
    
    // Call onSave hook in schema if provided
    if (schema && schema.onSave) {
      try {
        await schema.onSave(oldSettings, newSettings, (this.manager as any).createContext(plugin));
      } catch (err: any) {
        this.logger.error(`onSave hook failed for plugin "${slug}": ${err.message}`);
      }
    }
    
    // Emit hook for other plugins
    this.manager.emit('plugin:settings:updated', {
      pluginSlug: slug,
      oldSettings,
      newSettings,
    });
    
    res.json({ success: true, settings: newSettings });
  }

  /**
   * GET /api/v1/plugins/:slug/settings/schema
   * Returns field definitions for UI rendering
   */
  async getSchema(req: Request, res: Response) {
    const { slug } = req.params;
    const schema = await this.getEffectiveSchema(slug);
    
    if (!schema) {
      const allRegistered = Array.from(this.manager.getAllPluginSettings().keys());
      this.logger.warn(`Settings requested for "${slug}" but not found. Registered plugins: ${allRegistered.join(', ')}`);
      
      // Check plugin state
      const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
      if (plugin) {
        this.logger.debug(`Plugin "${slug}" found with state: ${plugin.state}`);
      }

      return res.status(404).json({ error: 'Plugin has no settings registered' });
    }
    
    res.json(schema);
  }

  /**
   * POST /api/v1/plugins/:slug/settings/reset
   * Resets all settings to defaults
   */
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

  /**
   * GET /api/v1/plugins/:slug/settings/export
   * Exports settings as JSON file
   */
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

  /**
   * POST /api/v1/plugins/:slug/settings/import
   * Imports settings from JSON
   */
  async importSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const importedSettings = req.body;
    
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.getEffectiveSchema(slug);
    if (schema) {
      // Validate imported data against schema
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
      
      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = `${field.label || field.name} is required`;
        continue;
      }
      
      // Type validation
      if (value !== undefined && value !== null) {
        switch (field.type) {
          case 'number': {
            const num = Number(value);
            if (isNaN(num)) {
              errors[field.name] = 'Must be a number';
            } else {
              if (field.min !== undefined && num < field.min) {
                errors[field.name] = `Must be at least ${field.min}`;
              }
              if (field.max !== undefined && num > field.max) {
                errors[field.name] = `Must be at most ${field.max}`;
              }
            }
            break;
          }
          
          case 'text':
            if (typeof value !== 'string') {
              errors[field.name] = 'Must be a string';
            } else {
              if (field.minLength && value.length < field.minLength) {
                errors[field.name] = `Must be at least ${field.minLength} characters`;
              }
              if (field.maxLength && value.length > field.maxLength) {
                errors[field.name] = `Must be at most ${field.maxLength} characters`;
              }
            }
            break;
          
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
              errors[field.name] = 'Must be true or false';
            }
            break;
          
          case 'select':
            if (field.options) {
              const validValues = field.options.map((opt: any) => opt.value);
              const isMultiSelect = Boolean(field?.admin?.multiple || field?.multiple);
              if (isMultiSelect) {
                const selectedValues = Array.isArray(value)
                  ? value
                  : (typeof value === 'string' ? value.split(',').map((part) => part.trim()).filter(Boolean) : []);
                const hasInvalid = selectedValues.some((selected) => !validValues.includes(selected));
                if (hasInvalid) {
                  errors[field.name] = 'Invalid option selected';
                }
              } else if (!validValues.includes(value)) {
                errors[field.name] = 'Invalid option selected';
              }
            }
            break;
        }
      }
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  }

  private async getEffectiveSchema(pluginSlug: string): Promise<any | undefined> {
    const schema = this.manager.getPluginSettings(pluginSlug);
    if (!schema) return schema;
    if (!Array.isArray(schema.fields)) return schema;

    let changed = false;
    let systemLocaleOptions: Array<{ label: string; value: string }> | null = null;

    const fields = await Promise.all(schema.fields.map(async (field: any) => {
      const source = String(field?.admin?.optionsSource || field?.admin?.optionSource || '')
        .trim()
        .toLowerCase();
      if (source !== PluginSettingsController.DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES) {
        return field;
      }

      if (!systemLocaleOptions) {
        systemLocaleOptions = await this.getSystemLocaleOptions();
      }

      if (!systemLocaleOptions.length) {
        return field;
      }

      changed = true;
      return {
        ...field,
        type: 'select',
        options: systemLocaleOptions,
        admin: {
          ...(field.admin || {})
        }
      };
    }));

    return changed ? { ...schema, fields } : schema;
  }

  private async getSystemLocaleOptions(): Promise<Array<{ label: string; value: string }>> {
    const db = (this.manager as any).db;
    if (!db?.findOne) {
      return [];
    }

    const toCode = (value: any): string => String(value || '').trim().toLowerCase().replace(/_/g, '-');
    const options: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const pushOption = (code: string, label?: string) => {
      const normalized = toCode(code);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      options.push({
        value: normalized,
        label: String(label || normalized.toUpperCase())
      });
    };

    try {
      const localesRow = await db.findOne('_system_meta', { key: 'localization_locales' });
      const rawLocales = String(localesRow?.value || '').trim();
      if (rawLocales) {
        try {
          const parsed = JSON.parse(rawLocales);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item?.enabled === false) return;
              pushOption(item?.code || item?.isoCode || item?.locale, item?.name);
            });
          }
        } catch {
          // Ignore malformed locale registry and fallback to enabled_locales.
        }
      }

      if (!options.length) {
        const enabledRow = await db.findOne('_system_meta', { key: 'enabled_locales' });
        String(enabledRow?.value || '')
          .split(',')
          .map((part: string) => toCode(part))
          .filter(Boolean)
          .forEach((code: string) => pushOption(code, code.toUpperCase()));
      }

      if (!options.length) {
        const defaultLocaleRow = await db.findOne('_system_meta', { key: 'default_locale' });
        const fallbackLocaleRow = await db.findOne('_system_meta', { key: 'fallback_locale' });
        pushOption(defaultLocaleRow?.value, undefined);
        pushOption(fallbackLocaleRow?.value, undefined);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to derive locale options from global settings: ${error?.message || 'unknown error'}`);
    }

    return options;
  }
}
