import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode119/core';
import { PluginSettingsSupport } from './plugin-settings-support';

export class PluginSettingsController {
  private logger = new Logger({ namespace: 'plugin-settings-controller' });
  private support: PluginSettingsSupport;

  constructor(private manager: PluginManager) {
    this.support = new PluginSettingsSupport(manager, this.logger);
  }

  async getSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.support.getEffectiveSchema(slug);
    const storedSettings = plugin.manifest.config?.settings || {};

    if (!schema) {
      return res.json({ settings: storedSettings });
    }

    const defaults = this.support.getDefaults(schema.fields || []);
    const merged = { ...defaults, ...storedSettings };
    const masked = this.support.maskPasswordFields(merged, schema.fields || []);

    res.json({ settings: masked });
  }

  async updateSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const newSettings = req.body;

    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.support.getEffectiveSchema(slug);

    if (schema) {
      const errors = await this.support.validateSettings(newSettings, schema);
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
    const settingsToSave = this.support.encryptPasswordFields(newSettings, oldSettings, schema?.fields || []);
    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: settingsToSave
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

    res.json({ success: true, settings: this.support.maskPasswordFields(settingsToSave, schema?.fields || []) });
  }

  async getSchema(req: Request, res: Response) {
    const { slug } = req.params;
    const schema = await this.support.getEffectiveSchema(slug);

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
    const schema = await this.support.getEffectiveSchema(slug);

    if (!schema) {
      return res.status(404).json({ error: 'Plugin has no settings registered' });
    }

    const defaults = this.support.getDefaults(schema.fields || []);
    const encryptedDefaults = this.support.encryptPasswordFields(defaults, {}, schema.fields || []);
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    const currentConfig = plugin?.manifest.config || {};

    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: encryptedDefaults
    });

    res.json({ success: true, settings: this.support.maskPasswordFields(encryptedDefaults, schema.fields || []) });
  }

  async exportSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.support.getEffectiveSchema(slug);
    const settings = plugin.manifest.config?.settings || {};
    const exportable = this.support.stripPasswordFields(settings, schema?.fields || []);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-settings-${Date.now()}.json"`
    );
    res.send(JSON.stringify(exportable, null, 2));
  }

  async importSettings(req: Request, res: Response) {
    const { slug } = req.params;
    const importedSettings = req.body;

    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const schema = await this.support.getEffectiveSchema(slug);
    if (!schema) {
      return res.status(422).json({ error: 'Cannot import settings: plugin schema not registered. Ensure the plugin is enabled.' });
    }

    const errors = await this.support.validateSettings(importedSettings, schema);
    if (errors) {
      return res.status(400).json({ errors });
    }
    if (schema.validate) {
      const customErrors = await schema.validate(importedSettings, (this.manager as any).createContext(plugin));
      if (customErrors) {
        return res.status(400).json({ errors: customErrors });
      }
    }

    const currentConfig = plugin.manifest.config || {};
    const existingSettings = plugin.manifest.config?.settings || {};
    const settingsToSave = this.support.encryptPasswordFields(importedSettings, existingSettings, schema?.fields || []);
    await this.manager.savePluginConfig(slug, {
      ...currentConfig,
      settings: settingsToSave
    });

    if (schema?.onSave) {
      try {
        await schema.onSave(existingSettings, importedSettings, (this.manager as any).createContext(plugin));
      } catch (err: any) {
        this.logger.error(`onSave hook failed for plugin "${slug}" during import: ${err.message}`);
      }
    }

    res.json({ success: true, imported: Object.keys(importedSettings).length });
  }
}