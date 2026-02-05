import { DatabaseManager } from '@fromcode/database';
import { Logger } from '../../logging/logger';

export class PluginStateService {
  private logger = new Logger({ namespace: 'PluginState' });

  constructor(private db: DatabaseManager) {}

  async loadInstalledPluginsState(): Promise<Record<string, { state: string; approvedCapabilities: string[]; healthStatus: 'healthy' | 'warning' | 'error'; sandboxConfig?: any }>> {
    try {
      const result = await this.db.find('_system_plugins', {
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
        registry[row.slug] = { 
          state: row.state,
          approvedCapabilities: row.capabilities ? (typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities) : [],
          healthStatus: row.health_status || 'healthy',
          sandboxConfig: row.sandbox_config
        };
      });
      return registry;
    } catch (err) {
      this.logger.error('Failed to load plugin registry from DB', err);
      return {};
    }
  }

  async savePluginState(slug: string, state: string, capabilities?: string[], version?: string) {
    try {
      const values: any = { 
        slug, 
        state, 
        updated_at: new Date() 
      };
      
      if (capabilities) {
        values.capabilities = JSON.stringify(capabilities);
      }
      if (version) {
        values.version = version;
      }

      const existing = await this.db.findOne('_system_plugins', { slug });
      if (existing) {
        await this.db.update('_system_plugins', { slug }, values);
      } else {
        await this.db.insert('_system_plugins', values);
      }
    } catch (err) {
      this.logger.error(`Failed to save plugin state for ${slug} to DB`, err);
    }
  }

  async getPluginConfig(slug: string): Promise<any> {
    try {
      const row = await this.db.findOne('_system_plugin_settings', { plugin_slug: slug });
      return row?.settings || {};
    } catch (err) {
      return {};
    }
  }

  async savePluginConfig(slug: string, config: any): Promise<void> {
    try {
      const existing = await this.db.findOne('_system_plugin_settings', { plugin_slug: slug });
      if (existing) {
        await this.db.update('_system_plugin_settings', { plugin_slug: slug }, {
          settings: config,
          updated_at: new Date()
        });
      } else {
        await this.db.insert('_system_plugin_settings', {
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
      await this.db.insert('_system_logs', {
        level,
        message,
        plugin_slug: pluginSlug,
        context: context ? (this.db.dialect === 'sqlite' ? JSON.stringify(context) : context) : null,
        timestamp: new Date()
      });
    } catch (err) {
      this.logger.error('Failed to write log to DB', err);
    }
  }
}
