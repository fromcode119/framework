import { describe, expect, it } from 'vitest';
import { PluginHostRuntimeReader } from '@core/plugin/host/runtime/plugin-host-runtime-reader';
import { PluginGuestRuntimeReporter } from '@core/plugin/host/runtime/plugin-guest-runtime-reporter';

/** What the admin is told about a plugin's process — including WHY a part of it is missing. */
describe('PluginHostRuntimeReader', () => {
  const facts = { slug: 'demo', running: true, pid: 4242, uid: 20001, limits: { memoryMb: 256, timeoutMs: 30000 }, recentRestarts: 1 };

  it('combines the api facts with what the process reports about itself', async () => {
    const report = PluginGuestRuntimeReporter.report({ snapshot: () => [{ kind: 'route', method: 'get', path: '/demo/x' }] });
    const runtime = await PluginHostRuntimeReader.read(facts, { request: async () => report } as any);
    expect(runtime).toMatchObject({ hostedBy: 'api', pid: 4242, uid: 20001, recentRestarts: 1, reportError: null });
    expect(runtime.report?.registrations).toEqual([{ kind: 'route', method: 'get', path: '/demo/x' }]);
    expect(runtime.report?.memory.rssBytes).toBeGreaterThan(0);
  });

  it('asks nothing of a process that is not running', async () => {
    let asked = false;
    const runtime = await PluginHostRuntimeReader.read({ ...facts, running: false, pid: null }, { request: async () => { asked = true; } } as any);
    expect(asked).toBe(false);
    expect(runtime).toMatchObject({ running: false, report: null, reportError: null });
  });

  it('says why when a running process does not answer, instead of reporting it empty', async () => {
    const runtime = await PluginHostRuntimeReader.read(facts, { request: async () => { throw new Error('request "runtime" timed out'); } } as any);
    expect(runtime.report).toBeNull();
    expect(runtime.reportError).toBe('request "runtime" timed out');
  });
});
