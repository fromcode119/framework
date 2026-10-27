import { describe, expect, it } from 'vitest';
import { PluginDroppedTaskSweep } from '@core/plugin/services/runtime/plugin-dropped-task-sweep';

/**
 * A plugin release that dropped a task left its row active, so it read as due forever and fired at a
 * handler that no longer existed. After the plugins register, their tasks nothing registered stop.
 */
describe('PluginDroppedTaskSweep', () => {
  it('stops only the active tasks of registered plugins that nothing registered', async () => {
    const rows = [
      { name: 'zen-myself:voice-clips', plugin_slug: 'zen-myself' },
      { name: 'zen-myself:app-settings-migration', plugin_slug: 'zen-myself' },
      { name: 'held:sync', plugin_slug: 'held' },
      { name: 'content-workflows', plugin_slug: null },
    ];
    const handlers = new Set(['zen-myself:app-settings-migration']);
    const stopped: string[] = [];
    const db: any = { find: async (_table: string, query: any) => (query.where.is_active ? rows : []) };
    const scheduler: any = { hasHandler: (name: string) => handlers.has(name), unregister: async (name: string) => { stopped.push(name); } };

    const dropped = await PluginDroppedTaskSweep.run(db, scheduler, ['zen-myself']);

    expect(dropped).toEqual(['zen-myself:voice-clips']);
    expect(stopped).toEqual(['zen-myself:voice-clips']);
  });
});
