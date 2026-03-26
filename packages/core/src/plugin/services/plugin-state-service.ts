import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '../../logging';
import { SystemConstants } from '../../constants';

export class PluginStateService {
  private logger = new Logger({ namespace: 'PluginState' });

  constructor(private db: IDatabaseManager) {}

  async loadInstalledPluginsState(): Promise<Record<string, { state: string; approvedCapabilities: string[]; healthStatus: 'healthy' | 'warning' | 'error'; sandboxConfig?: any }>> {
    try {
      const result = await this.db.find(SystemConstants.TABLE.PLUGINS, {
        columns: {
          slug: true,
          state: true,
          capabilities: true,
          health_status: true,
          sandbox_config: true
        }
      });

      const registry: Record<string, { state: string; approvedCapabilities: string[]; healthStatus: 'healthy' | 'warning' | 'error'; sandboxConfig?: any }> = {};
      result.forEach((row) => {
        // Use lowercase slug for the registry key to ensure case-insensitive lookup
        const slug = row.slug?.toLowerCase();
        if (slug) {
          registry[slug] = { 
            state: row.state,
            approvedCapabilities: row.capabilities ? (typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities) : [],
            healthStatus: row.health_status || 'healthy',
            sandboxConfig: row.sandbox_config
          };
        }
      });
      return registry;
    } catch (err) {
      this.logger.error('Failed to load plugin registry from DB', err);
      return {};
    }
  }

  async savePluginState(slug: string, state: string, capabilities?: string[], version?: string) {
    const normSlug = slug.toLowerCase();
    try {
      const healthStatus = state === 'error' ? 'error' : 'healthy';
      const values: any = { 
        slug: normSlug, 
        state, 
        health_status: healthStatus,
        updated_at: new Date() 
      };
      
      if (capabilities) {
        values.capabilities = JSON.stringify(capabilities);
      }
      if (version) {
        values.version = version;
      }

      // Check for existing entry using both manifest slug and potential existing DB casing
      // We use lowercase normalization for the query if possible, or try exact match
      const existing = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: normSlug });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.PLUGINS, { slug: normSlug }, values);
      } else {
        // Fallback: search case-insensitively if exact lowercase match fails
        // some adapters might support ILIKE or we can just hope findOne handles it if configured
        await this.db.insert(SystemConstants.TABLE.PLUGINS, values);
      }
    } catch (err) {
      this.logger.error(`Failed to save plugin state for ${normSlug} to DB`, err);
    }
  }

  async getPluginConfig(slug: string): Promise<any> {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: slug });
      return row?.settings || {};
    } catch (err) {
      return {};
    }
  }

  async savePluginConfig(slug: string, config: any): Promise<void> {
    try {
      const existing = await this.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: slug });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: slug }, {
          settings: config,
          updated_at: new Date()
        });
      } else {
        await this.db.insert(SystemConstants.TABLE.PLUGIN_SETTINGS, {
          plugin_slug: slug,
          settings: config,
          updated_at: new Date()
        });
      }
    } catch (err) {
      this.logger.error(`Failed to save config for plugin ${slug}`, err);
      throw err;
    }
  }

  async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    try {
      await this.db.insert(SystemConstants.TABLE.LOGS, {
        level,
        message,
        plugin_slug: pluginSlug,
        context: context || null,
        timestamp: new Date()
      });
    } catch (err) {
      this.logger.error('Failed to write log to DB', err);
    }
  }
}
