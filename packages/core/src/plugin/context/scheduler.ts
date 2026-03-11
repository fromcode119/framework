import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';


export class SchedulerContextProxy {
  static createSchedulerProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      return {
        register: async (name: string, schedule: string, handler: any, options: { type?: 'cron' | 'interval' } = {}) => {
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