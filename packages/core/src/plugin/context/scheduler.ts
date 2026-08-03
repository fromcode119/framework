import { ScheduleType } from '@fromcode119/scheduler';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';

export class SchedulerContextProxy {
  static createSchedulerProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      return {
        register: async (name: string, schedule: string, handler: any, options: { type?: ScheduleType } = {}) => {
          if (!hasCapability('scheduler')) handleViolation('scheduler');
          const fullName = `${plugin.manifest.slug}:${name}`;
          await manager.scheduler.register(fullName, schedule, handler, {
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