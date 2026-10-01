import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';

/**
 * Api 0 runs every plugin process, so whether one runs is its call. When it gives up on one, the other
 * api processes stop it too; their own failures stay their own, or two of them would stop each other's.
 */
describe('a plugin the platform stopped, with several api processes', () => {
  const env = { workers: process.env.API_WORKERS, index: process.env.API_WORKER_INDEX };
  afterEach(() => {
    vi.restoreAllMocks();
    if (env.workers === undefined) delete process.env.API_WORKERS; else process.env.API_WORKERS = env.workers;
    if (env.index === undefined) delete process.env.API_WORKER_INDEX; else process.env.API_WORKER_INDEX = env.index;
  });

  const service = () => {
    const plugins = new Map<string, any>([['shop', { manifest: { slug: 'shop' }, state: PluginState.ACTIVE }]]);
    const db = { update: vi.fn(async () => undefined) };
    return { plugins, db, state: new PluginRuntimeStateService({} as any, db, {} as any, plugins, new Map(), new Map(), new Map()) };
  };

  it('api 0 stops it, records it, and tells the others', async () => {
    process.env.API_WORKERS = '2';
    process.env.API_WORKER_INDEX = '0';
    const announce = vi.spyOn(ProcessSignals, 'announce');
    const { plugins, db, state } = service();
    await state.disableWithError('shop', 'process failed repeatedly');
    expect(plugins.get('shop').state).toBe(PluginState.ERROR);
    expect(db.update).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(ProcessSignal.PLUGIN_STOPPED, { slug: 'shop', message: 'process failed repeatedly' });
  });

  it('another api process stops it for itself only', async () => {
    process.env.API_WORKERS = '2';
    process.env.API_WORKER_INDEX = '1';
    const announce = vi.spyOn(ProcessSignals, 'announce');
    await service().state.disableWithError('shop', 'x');
    expect(announce).not.toHaveBeenCalledWith(ProcessSignal.PLUGIN_STOPPED, expect.anything());
  });

  it('mirroring api 0\'s stop changes this process\'s state and writes nothing', () => {
    const { plugins, db, state } = service();
    expect(state.markStopped('shop', 'stopped by api 0')).toBe(true);
    expect(plugins.get('shop')).toMatchObject({ state: PluginState.ERROR, error: 'stopped by api 0', stoppedByPlatform: true });
    expect(db.update).not.toHaveBeenCalled();
    expect(state.markStopped('missing', 'x')).toBe(false);
  });
});
