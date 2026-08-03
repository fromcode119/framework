import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginConfigValueService } from '@core/plugin/services/plugin-config-value-service';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginStateService {
  private logger = new Logger({ namespace: 'PluginState' });

  constructor(private db: IDatabaseManager) {}

  async loadInstalledPluginsState(): Promise<Record<string, { state: PluginState; approvedCapabilities: string[]; healthStatus: PluginRegistryHealth; heldReason?: PluginHeldReason; sandboxConfig?: any; version?: string; signatureVerified?: boolean }>> {
    try {
      const result = await this.db.find(SystemConstants.TABLE.PLUGINS, {
        columns: {
          slug: true,
          state: true,
          capabilities: true,
          health_status: true,
          held_reason: true,
          sandbox_config: true,
          version: true,
          signature_verified: true
        }
      });

      const registry: Record<string, { state: PluginState; approvedCapabilities: string[]; healthStatus: PluginRegistryHealth; heldReason?: PluginHeldReason; sandboxConfig?: any; version?: string; signatureVerified?: boolean }> = {};
      result.forEach((row) => {
        // Use lowercase slug for the registry key to ensure case-insensitive lookup
        const slug = row.slug?.toLowerCase();
        if (slug) {
          registry[slug] = {
            state: PluginState.resolve(row.state),
            approvedCapabilities: row.capabilities ? (typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities) : [],
            healthStatus: PluginRegistryHealth.resolve(row.health_status) ?? PluginRegistryHealth.HEALTHY,
            heldReason: PluginHeldReason.resolve(row.held_reason),
            sandboxConfig: row.sandbox_config,
            version: row.version,
            signatureVerified: Boolean(row.signature_verified)
          };
        }
      });
      return registry;
    } catch (err) {
      this.logger.error('Failed to load plugin registry from DB', err);
      return {};
    }
  }

  async savePluginState(slug: string, state: PluginState, capabilities?: string[], version?: string) {
    const normSlug = slug.toLowerCase();
    try {
      const healthStatus = state === PluginState.ERROR ? PluginRegistryHealth.ERROR : PluginRegistryHealth.HEALTHY;
      const values: any = { 
        slug: normSlug, 
        state: state.value,
        health_status: healthStatus.value,
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

  /**
   * Mark a plugin's health as failed WITHOUT touching its desired `state`.
   *
   * `state` (active | inactive) is the operator's intent; `health_status` is runtime
   * health. Failures must only flip health to 'error' so the desired state survives and
   * the plugin can recover to exactly where it was (active stays active) once it boots
   * cleanly again. Saving any non-error state via savePluginState resets health to 'healthy'.
   */
  async markPluginHealthError(slug: string): Promise<void> {
    const normSlug = slug.toLowerCase();
    try {
      const existing = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: normSlug });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.PLUGINS, { slug: normSlug }, {
          health_status: PluginRegistryHealth.ERROR.value,
          updated_at: new Date(),
        });
      }
    } catch (err) {
      this.logger.error(`Failed to mark plugin health error for ${normSlug} in DB`, err);
    }
  }

  /**
   * Mark a plugin as HELD: not activated (`state='inactive'`, stays fail-closed) but flagged on the
   * orthogonal health axis (`health_status='warning'`) with a machine-readable `held_reason`, so the
   * operator sees WHY it isn't running (vs. a silent, deliberate-looking disable). Distinct from
   * savePluginState (which would reset health to 'healthy') and from markPluginHealthError (which
   * preserves state and sets 'error'). `capabilities`/`version` are intentionally left untouched so
   * re-approval via enable() is the single place that advances the approved set.
   */
  async markPluginHeld(slug: string, heldReason: PluginHeldReason): Promise<void> {
    const normSlug = slug.toLowerCase();
    try {
      const existing = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: normSlug });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.PLUGINS, { slug: normSlug }, {
          state: PluginState.INACTIVE.value,
          health_status: PluginRegistryHealth.WARNING.value,
          held_reason: heldReason.value,
          updated_at: new Date(),
        });
      }
    } catch (err) {
      this.logger.error(`Failed to mark plugin held for ${normSlug} in DB`, err);
    }
  }

  /** Clear a capability-drift hold: reset health to healthy and null the reason. State is left as-is
   *  (enable() sets 'active' separately). Best-effort. */
  async clearPluginHeld(slug: string): Promise<void> {
    const normSlug = slug.toLowerCase();
    try {
      const existing = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: normSlug });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.PLUGINS, { slug: normSlug }, {
          health_status: PluginRegistryHealth.HEALTHY.value,
          held_reason: null,
          updated_at: new Date(),
        });
      }
    } catch (err) {
      this.logger.error(`Failed to clear plugin held for ${normSlug} in DB`, err);
    }
  }

  async getPluginConfig(slug: string): Promise<any> {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: slug });
      return PluginConfigValueService.getConfig(row?.settings);
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
        level: PluginStateService.sanitizeLogText(level) || 'INFO',
        message: PluginStateService.sanitizeLogText(message) || '',
        plugin_slug: PluginStateService.sanitizeLogText(pluginSlug),
        context: PluginStateService.sanitizeLogContext(context),
        timestamp: new Date()
      });
    } catch (err) {
      this.logger.error('Failed to write log to DB', err);
    }
  }

  private static sanitizeLogText(value: unknown): string | null {
    const normalized = String(value ?? '');
    if (!normalized) {
      return null;
    }

    return normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  private static sanitizeLogContext(value: unknown): unknown {
    if (value == null) {
      return null;
    }

    if (typeof value === 'string') {
      return PluginStateService.sanitizeLogText(value);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => PluginStateService.sanitizeLogContext(entry));
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          PluginStateService.sanitizeLogContext(entry),
        ]),
      );
    }

    return value;
  }
}
