import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessSignals, ProcessSignal } from '@fromcode119/core';
import { PluginsChangedSignal } from '@api/services/plugins-changed-signal';
import { ApiWorkerSupervisor } from '@api/server/api-worker-supervisor';

/** What another api process hears when one changes the platform's plugins (`API_WORKERS`). */
describe('PluginsChangedSignal', () => {
  afterEach(() => vi.restoreAllMocks());
  const fromAnother = (signal: ProcessSignal, payload: Record<string, unknown>) =>
    (ProcessSignals as any).receive(JSON.stringify({ origin: 'another-api-process', signal: String(signal.value), payload }));

  const manager = () => {
    const host = { holdUntilRestart: vi.fn() };
    return { host, manager: { pluginHosts: { get: (slug: string) => (slug === 'shop' ? host : null) }, markStoppedElsewhere: vi.fn() } };
  };

  it('is said before the work (so nobody starts again what a disable stops) and after it', async () => {
    const announce = vi.spyOn(ProcessSignals, 'announce');
    const order: string[] = [];
    announce.mockImplementation(() => { order.push('announce'); });
    await PluginsChangedSignal.around('shop', async () => { order.push('work'); });
    expect(order).toEqual(['announce', 'work', 'announce']);
  });

  it('a supervised api process holds the plugin and asks for its restart', () => {
    vi.spyOn(ApiWorkerSupervisor, 'requestRestart').mockReturnValue(true);
    const { host, manager: m } = manager();
    PluginsChangedSignal.listen(m, () => undefined);
    fromAnother(ProcessSignal.PLUGINS_CHANGED, { slug: 'shop' });
    expect(ApiWorkerSupervisor.requestRestart).toHaveBeenCalled();
    expect(host.holdUntilRestart).toHaveBeenCalled();
  });

  it('an api process alone (or another deploy\'s) does nothing', () => {
    vi.spyOn(ApiWorkerSupervisor, 'requestRestart').mockReturnValue(false);
    const { host, manager: m } = manager();
    PluginsChangedSignal.listen(m, () => undefined);
    fromAnother(ProcessSignal.PLUGINS_CHANGED, { slug: 'shop' });
    expect(host.holdUntilRestart).not.toHaveBeenCalled();
  });

  it('mirrors a plugin api 0 stopped, without a restart', () => {
    const restart = vi.spyOn(ApiWorkerSupervisor, 'requestRestart');
    const { host, manager: m } = manager();
    PluginsChangedSignal.listen(m, () => undefined);
    fromAnother(ProcessSignal.PLUGIN_STOPPED, { slug: 'shop', message: 'failed repeatedly' });
    expect(m.markStoppedElsewhere).toHaveBeenCalledWith('shop', 'failed repeatedly');
    expect(host.holdUntilRestart).toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
  });
});

describe('ApiWorkerSupervisor', () => {
  const env = process.env.EXTENSION_HOST_SOCKET;
  afterEach(() => { if (env === undefined) delete process.env.EXTENSION_HOST_SOCKET; else process.env.EXTENSION_HOST_SOCKET = env; });

  it('says why several api processes cannot run without the extension-host', () => {
    delete process.env.EXTENSION_HOST_SOCKET;
    expect(ApiWorkerSupervisor.unsupportedReason()).toContain('needs the extension-host');
    process.env.EXTENSION_HOST_SOCKET = '/run/fromcode/spawner.sock';
    expect(ApiWorkerSupervisor.unsupportedReason()).toBeNull();
  });

  it('outside a supervised api process, a restart request is declined', () => {
    expect(ApiWorkerSupervisor.requestRestart()).toBe(false);
  });
});
