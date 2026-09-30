import { describe, expect, it } from 'vitest';
import { PluginInstallOperationService } from '@api/services/plugin-install-operation-service';

/** Two workers sharing one store: the admin's progress poll finds the operation whichever worker it reaches. */
describe('plugin install progress across api workers', () => {
  const store = () => {
    const values = new Map<string, unknown>();
    return {
      get: async (key: string) => (values.has(key) ? JSON.parse(JSON.stringify(values.get(key))) : null),
      set: async (key: string, value: unknown) => { values.set(key, JSON.parse(JSON.stringify(value))); },
    };
  };

  it('another worker reads the running and the finished operation', async () => {
    const shared = store();
    const running = new (PluginInstallOperationService as any)() as PluginInstallOperationService;
    const polled = new (PluginInstallOperationService as any)() as PluginInstallOperationService;
    running.useSharedStore(shared);
    polled.useSharedStore(shared);
    let finish!: () => void;
    const operation = running.start('finance', 'marketplace install', async (report) => {
      report({ phase: 'running-migrations', message: 'Running migration x', pluginSlug: 'finance', migrationName: 'x' } as any);
      await new Promise<void>((resolve) => { finish = resolve; });
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await polled.get(operation.id)).toMatchObject({ status: 'running', phase: 'running-migrations', migrationNames: ['x'] });
    finish();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await polled.get(operation.id)).toMatchObject({ status: 'completed', phase: 'completed' });
  });

  it('without a shared store, an unknown id is simply not found', async () => {
    const worker = new (PluginInstallOperationService as any)() as PluginInstallOperationService;
    expect(await worker.get('missing')).toBeNull();
  });
});
