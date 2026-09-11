import { ScheduleType } from '@fromcode119/scheduler';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { PluginScheduledTenantRun } from '@core/plugin/tenant/plugin-scheduled-tenant-run';

export class SchedulerContextProxy {
  static createSchedulerProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      return {
        /**
         * Registers a task, wrapped so it can actually reach tenant data.
         *
         * The wrap happens HERE rather than in the scheduler package, which knows nothing about
         * tenants and should not: this is the layer that already owns the plugin's handler. It also
         * covers both execution paths, because the inline runner and the queue worker both end up
         * calling the handler that was registered.
         */
        register: async (name: string, schedule: string, handler: any, options: { type?: ScheduleType } = {}) => {
          if (!hasCapability('scheduler')) handleViolation('scheduler');
          const fullName = `${plugin.manifest.slug}:${name}`;
          await manager.scheduler.register(fullName, schedule, PluginScheduledTenantRun.wrap({
            pluginSlug: plugin.manifest.slug,
            taskName: name,
            db: manager.db,
            handler,
          }), {
            ...options,
            plugin_slug: plugin.manifest.slug
          });
        },
        runNow: (name: string) => {
          if (!hasCapability('scheduler')) handleViolation('scheduler');
          return manager.scheduler.runTask(`${plugin.manifest.slug}:${name}`);
        },
        schedule: async (name: string, when: Date | string, data: any) => {
          if (!hasCapability('scheduler') && !hasCapability('jobs')) handleViolation('scheduler');

          const delay = new Date(when).getTime() - Date.now();
          if (delay <= 0) {
            return manager.jobs.addJob(plugin.manifest.slug, name, data);
          } else {
            return manager.jobs.addJob(plugin.manifest.slug, name, data, { delay });
          }
        }
      };

  }
}