import { afterAll, describe, expect, it } from 'vitest';
import { fork, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { PluginGuestAttachment } from '@core/plugin/host/connections/plugin-guest-attachment';
import { PluginGuestConnections } from '@core/plugin/host/connections/plugin-guest-connections';

/**
 * A REAL plugin process whose api goes away — what a deploy does to it.
 *
 * Api A starts it; api B attaches. When A disconnects, the process must keep serving B (its calls now
 * go to B), and when B goes too it waits `lingerMs` for another api, then exits. Before this, losing
 * the api that started it was an immediate exit, and every deploy started every plugin again.
 */
describe('a plugin process that outlives the api that started it', () => {
  const guestMain = path.resolve(__dirname, '../../../../../dist/plugin/host/plugin-guest-main.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-outlive-'));
  const secret = 'outlive-secret';
  const children: ChildProcess[] = [];

  const serveAs = (name: string, channel: PluginChannel) => channel.serve(async (type, payload: any) => {
    if (type === 'call') return (payload?.steps ?? []).map((step: { name: string }) => step.name).join('.') === 'settings.get' ? { answeredBy: name } : [];
    return true;
  });
  const invoke = (channel: PluginChannel, name: string, token: string) =>
    channel.request('invoke', { kind: 'public-api', name, args: [], token, tenantId: null, locale: 'en', siteLocale: 'en', peers: {}, enabledPlugins: [] }, 10_000);

  /** Starts the fixture plugin under api A; answers A's channel and where B attaches. */
  const start = async (lingerMs: number) => {
    const pluginDir = fs.mkdtempSync(path.join(dir, 'plugin-'));
    const socketDir = path.join(pluginDir, 'sockets');
    fs.mkdirSync(socketDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(pluginDir, 'index.js'), [
      'let ctx = null;',
      "module.exports = { manifest: { slug: 'outlive-probe', version: '1.0.0' }, onInit: async (context) => { ctx = context; }, publicAPI: { whoAnswers: async () => ctx.settings.get() } };",
    ].join('\n'));
    const child = fork(guestMain, [], { cwd: dir, env: {} as NodeJS.ProcessEnv, serialization: 'advanced', stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    const apiA = new PluginChannel(new IpcMessagePort(child));
    serveAs('A', apiA);
    await apiA.request('boot', {
      slug: 'outlive-probe', pluginDir, entryPath: path.join(pluginDir, 'index.js'), manifest: { slug: 'outlive-probe', version: '1.0.0' },
      socketPath: path.join(socketDir, 'routes.sock'), socketMode: 0o600, projectRoot: dir, defaultLocale: 'en',
      plugin: { slug: 'outlive-probe', namespace: '', version: '1.0.0', dataDir: './data', rootDir: pluginDir, config: {} },
      attachSecret: secret, lingerMs,
    }, 20_000);
    await apiA.request('invoke', { kind: 'lifecycle', name: 'onInit', args: [], token: 't-a', tenantId: null, locale: 'en', siteLocale: 'en', peers: {}, enabledPlugins: [] }, 20_000);
    await apiA.request('invoke', { kind: 'lifecycle', name: 'onEnable', args: [], token: 't-a', tenantId: null, locale: 'en', siteLocale: 'en', peers: {}, enabledPlugins: [] }, 20_000);
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
    return { child, exited, control: path.join(socketDir, PluginGuestConnections.CONTROL_SOCKET) };
  };
  const alive = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  afterAll(() => {
    for (const child of children) child.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps serving the api that attached once the one that started it is gone', async () => {
    const { child, exited, control } = await start(60_000);
    const apiB = await PluginGuestAttachment.attach(control, secret, 5_000);
    serveAs('B', apiB.channel);
    // It finished starting, so an api may take it over.
    expect(apiB.enabled).toBe(true);

    child.disconnect();
    await pause(300);
    expect(alive(child)).toBe(true);
    // Its calls go to B now — the only api left — even for work B did not start.
    expect(await invoke(apiB.channel, 'whoAnswers', 't-b')).toEqual({ answeredBy: 'B' });

    child.kill('SIGKILL');
    await exited;
  }, 60_000);

  it('waits for another api when none holds it, then exits', async () => {
    const { child, exited, control } = await start(1_500);
    child.disconnect();
    await pause(500);
    expect(alive(child)).toBe(true);
    // An api attaching during the wait takes it over…
    const apiB = await PluginGuestAttachment.attach(control, secret, 5_000);
    serveAs('B', apiB.channel);
    expect(await invoke(apiB.channel, 'whoAnswers', 't-b')).toEqual({ answeredBy: 'B' });
    // …and when that one goes too, the process waits again and exits.
    apiB.channel.close();
    apiB.port.close();
    expect(await exited).toBe(0);
  }, 60_000);

  it('exits with its api at once where nothing can take it over (lingerMs 0)', async () => {
    const { child, exited } = await start(0);
    child.disconnect();
    expect(await exited).toBe(0);
  }, 30_000);
});
