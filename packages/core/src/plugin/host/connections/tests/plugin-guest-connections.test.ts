import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fork, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { PluginGuestAttachment } from '@core/plugin/host/connections/plugin-guest-attachment';
import { PluginGuestConnections } from '@core/plugin/host/connections/plugin-guest-connections';

/**
 * A REAL plugin process, attached to by a second api — what a deploy needs to take running plugins over.
 *
 * Runs core's built plugin runtime (`dist`, as production does) with a small fixture plugin. Api A starts
 * and boots it; api B attaches through its control socket. The test proves B learns what the process
 * registered, and that a call the plugin makes goes back to the api whose invocation it is running in —
 * a token is only valid at the api that minted it.
 */
describe('a plugin process with two apis attached', () => {
  const guestMain = path.resolve(__dirname, '../../../../../dist/plugin/host/plugin-guest-main.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-attach-'));
  const pluginDir = path.join(dir, 'plugin');
  const socketDir = path.join(dir, 'sockets');
  const secret = 'attach-secret-for-the-test';
  let child: ChildProcess;
  let apiA: PluginChannel;

  /** An api's side of the channel: answers every call, `settings.get` with its own name. */
  const serveAs = (name: string, channel: PluginChannel, calls: string[]) => channel.serve(async (type, payload: any) => {
    if (type === 'register') return true;
    if (type === 'call') {
      const steps = (payload?.steps ?? []).map((step: { name: string }) => step.name).join('.');
      calls.push(`${name}:${steps}`);
      return steps === 'settings.get' ? { answeredBy: name } : [];
    }
    return true;
  });

  const invoke = (channel: PluginChannel, name: string, token: string) =>
    channel.request('invoke', { kind: 'public-api', name, args: [], token, tenantId: null, locale: 'en', siteLocale: 'en', peers: {}, enabledPlugins: [] }, 10_000);

  const callsA: string[] = [];

  beforeAll(async () => {
    expect(fs.existsSync(guestMain), `${guestMain} is missing — build core`).toBe(true);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(socketDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(pluginDir, 'index.js'), [
      'let ctx = null;',
      'module.exports = {',
      "  manifest: { slug: 'attach-probe', version: '1.0.0' },",
      '  onInit: async (context) => {',
      '    ctx = context;',
      "    context.api.get('/ping', (req, res) => res.json({ ok: true }));",
      "    context.hooks.on('probe.event', () => undefined);",
      '  },',
      '  publicAPI: { whoAnswers: async () => ctx.settings.get() },',
      '};',
    ].join('\n'));
    child = fork(guestMain, [], { cwd: dir, env: {} as NodeJS.ProcessEnv, serialization: 'advanced', stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    apiA = new PluginChannel(new IpcMessagePort(child));
    serveAs('A', apiA, callsA);
    await apiA.request('boot', {
      slug: 'attach-probe', pluginDir, entryPath: path.join(pluginDir, 'index.js'), manifest: { slug: 'attach-probe', version: '1.0.0' },
      socketPath: path.join(socketDir, 'routes.sock'), socketMode: 0o600, projectRoot: dir, defaultLocale: 'en',
      plugin: { slug: 'attach-probe', namespace: '', version: '1.0.0', dataDir: './data', rootDir: pluginDir, config: {} },
      attachSecret: secret,
    }, 20_000);
    await apiA.request('invoke', { kind: 'lifecycle', name: 'onInit', args: [], token: 'token-a', tenantId: null, locale: 'en', siteLocale: 'en', peers: {}, enabledPlugins: [] }, 20_000);
  }, 60_000);

  afterAll(() => {
    child?.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lets a second api attach with the secret, and tells it the protocol, the boot answer and what stands', async () => {
    const attachment = await PluginGuestAttachment.attach(path.join(socketDir, PluginGuestConnections.CONTROL_SOCKET), secret, 5_000);
    try {
      expect(attachment.pid).toBe(child.pid);
      expect(attachment.described.publicApiKeys).toEqual(['whoAnswers']);
      expect(attachment.registrations.map((r) => r.kind)).toEqual(['route', 'hook']);
      expect(attachment.registrations[0]).toMatchObject({ method: 'get', path: '/attach-probe/ping' });
    } finally {
      attachment.channel.close();
    }
  });

  it('sends a call back to the api whose invocation made it', async () => {
    const attachment = await PluginGuestAttachment.attach(path.join(socketDir, PluginGuestConnections.CONTROL_SOCKET), secret, 5_000);
    const callsB: string[] = [];
    serveAs('B', attachment.channel, callsB);
    try {
      expect(await invoke(attachment.channel, 'whoAnswers', 'token-b')).toEqual({ answeredBy: 'B' });
      expect(await invoke(apiA, 'whoAnswers', 'token-a')).toEqual({ answeredBy: 'A' });
      expect(callsB).toContain('B:settings.get');
      expect(callsA.filter((call) => call === 'A:settings.get')).toHaveLength(1);
    } finally {
      attachment.channel.close();
    }
  });

  it('refuses an api without the secret, and serves it nothing', async () => {
    await expect(PluginGuestAttachment.attach(path.join(socketDir, PluginGuestConnections.CONTROL_SOCKET), 'wrong', 5_000)).rejects.toThrow('wrong secret');
  });
});
