import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginGuestAttachment } from '@core/plugin/host/connections/plugin-guest-attachment';
import { SpawnerClient } from '@core/process/spawner-client';

/** A host with only what taking over touches. */
class HostFixture {
  static build(overrides: Record<string, unknown> = {}): any {
    const host = Object.create(PluginHost.prototype) as any;
    Object.assign(host, {
      slug: 'alpha', manifest: { version: '1.2.0' }, limits: { memoryMb: 256, timeoutMs: 30_000 }, generationCount: 0, guest: null, takenOver: null,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      serve: vi.fn(), notified: vi.fn(), exited: vi.fn(),
      ...overrides,
    });
    return host;
  }
}

describe('taking over a running plugin process', () => {
  afterEach(() => { vi.restoreAllMocks(); SpawnerClient.publish(null); });

  const label = (version: string, memoryMb = 256) => ({ slug: 'alpha', version, memoryMb, attachSecret: `secret-${version}-${memoryMb}` });
  const spawner = (listing: unknown[]) => ({
    hostedBy: SpawnerClient.HOSTED_BY_EXTENSION_HOST,
    inventory: vi.fn(async () => listing),
    claim: vi.fn(async () => ({ pid: 42 })),
    onExit: vi.fn(), onOutput: vi.fn(), kill: vi.fn(), forget: vi.fn(),
  });
  const attachment = (registrations: unknown[] = [], enabled = true) => ({
    channel: { serve: vi.fn(), onNotify: vi.fn(), close: vi.fn(), isClosed: false },
    port: { close: vi.fn() }, connectionId: 'conn-9', pid: 42,
    described: { contractKeys: ['onInit'], publicApiKeys: [], manifest: {} }, registrations, protocol: {}, enabled,
  });

  it('attaches to the process of the same version and heap, claims it, and keeps what it registered', async () => {
    const client = spawner([
      { id: 'plugin-alpha.old.1', pid: 40, label: label('1.1.0'), holders: 1, guestDir: '/run/fromcode/plugin-alpha.old.1/guest' },
      { id: 'plugin-alpha.old.2', pid: 41, label: label('1.2.0', 512), holders: 1, guestDir: '/run/fromcode/plugin-alpha.old.2/guest' },
      { id: 'plugin-alpha.old.3', pid: 42, label: label('1.2.0'), holders: 1, guestDir: '/run/fromcode/plugin-alpha.old.3/guest' },
    ]);
    SpawnerClient.publish(client as unknown as SpawnerClient);
    const registrations = [{ kind: 'declaration', steps: [{ name: 'collections' }, { name: 'register', args: [{}] }] }, { kind: 'route', method: 'get', path: '/alpha/ping', handlerId: 'h1' }];
    const attach = vi.spyOn(PluginGuestAttachment, 'attach').mockResolvedValue(attachment(registrations) as any);
    const host = HostFixture.build();

    const generation = await host.takeOver();

    expect(attach).toHaveBeenCalledWith('/run/fromcode/plugin-alpha.old.3/guest/control.sock', 'secret-1.2.0-256', expect.any(Number));
    expect(client.claim).toHaveBeenCalledWith('plugin-alpha.old.3');
    expect(generation.connectionId).toBe('conn-9');
    expect(generation.attachSecret).toBe('secret-1.2.0-256');
    expect(generation.guest.pid).toBe(42);
    expect(host.takenOver).toEqual(registrations);
  });

  it('starts a new process when nothing matching runs, or where nothing can outlive an api', async () => {
    SpawnerClient.publish(spawner([{ id: 'plugin-alpha.old.1', pid: 40, label: label('1.1.0'), holders: 1, guestDir: '/x' }]) as unknown as SpawnerClient);
    expect(await HostFixture.build().takeOver()).toBeNull();
    SpawnerClient.publish({ ...spawner([]), hostedBy: SpawnerClient.HOSTED_BY_API } as unknown as SpawnerClient);
    expect(await HostFixture.build().takeOver()).toBeNull();
  });

  it("leaves a process that never finished starting — its api died mid-boot — and starts a new one", async () => {
    const client = spawner([{ id: 'plugin-alpha.old.3', pid: 42, label: label('1.2.0'), holders: 0, guestDir: '/x' }]);
    SpawnerClient.publish(client as unknown as SpawnerClient);
    vi.spyOn(PluginGuestAttachment, 'attach').mockResolvedValue(attachment([], false) as any);
    const host = HostFixture.build();
    expect(await host.takeOver()).toBeNull();
    expect(client.claim).not.toHaveBeenCalled();
    expect(host.logger.warn).toHaveBeenCalledWith(expect.stringContaining('had not finished starting'));
  });

  it('starts a new process, and says so, when the extension-host is too old to list its processes', async () => {
    SpawnerClient.publish({ ...spawner([]), inventory: vi.fn(async () => { throw new Error('spawner: unknown message "inventory"'); }) } as unknown as SpawnerClient);
    const host = HostFixture.build();
    expect(await host.takeOver()).toBeNull();
    expect(host.logger.warn).toHaveBeenCalledWith(expect.stringContaining('could not list its processes'));
  });

  it('starts a new process, and says so, when the running one cannot be attached to', async () => {
    SpawnerClient.publish(spawner([{ id: 'plugin-alpha.old.3', pid: 42, label: label('1.2.0'), holders: 0, guestDir: '/x' }]) as unknown as SpawnerClient);
    vi.spyOn(PluginGuestAttachment, 'attach').mockRejectedValue(new Error('attach refused — wrong secret'));
    const host = HostFixture.build();
    expect(await host.takeOver()).toBeNull();
    expect(host.logger.warn).toHaveBeenCalledWith(expect.stringContaining('could not take over running process 42'));
  });
});

describe('the boot of a plugin whose process was taken over', () => {
  it("restores what it registered instead of running its onInit again, and only notes onEnable", async () => {
    const applied: string[] = [];
    const host = HostFixture.build({
      context: {},
      takenOver: [{ kind: 'declaration', name: 'first' }, { kind: 'route', name: 'second' }],
      registrations: { apply: vi.fn(async (_ctx: unknown, registration: { name: string }) => { applied.push(registration.name); }) },
      wasEnabled: false,
    });
    expect(await host.restoreTakenOver('onInit')).toBe(true);
    expect(applied).toEqual(['first', 'second']);
    // The per-site passes that follow: their data is already there.
    expect(await host.restoreTakenOver('onInit')).toBe(true);
    expect(applied).toEqual(['first', 'second']);
    expect(await host.restoreTakenOver('onEnable')).toBe(true);
    expect(host.wasEnabled).toBe(true);
    // From here on, lifecycle calls run in the process as usual.
    expect(await host.restoreTakenOver('onDisable')).toBe(false);
  });
});

describe('the entry file a plugin process starts from', () => {
  it('exists — from src (the dev server) and from dist (production)', async () => {
    const fs = await import('fs');
    const { PluginHostGenerations } = await import('@core/plugin/host/generations/plugin-host-generations');
    const fromSrc = PluginHostGenerations.guestMainPath();
    expect(fromSrc.endsWith('/dist/plugin/host/plugin-guest-main.js')).toBe(true);
    expect(fs.existsSync(fromSrc)).toBe(true);
    const built = await import('path').then((path) => path.resolve(__dirname, '../../../../../dist/plugin/host/generations/plugin-host-generations.js'));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fromDist = require(built).PluginHostGenerations.guestMainPath();
    expect(fs.existsSync(fromDist)).toBe(true);
    expect(fromDist.endsWith('/dist/plugin/host/plugin-guest-main.js')).toBe(true);
  });
});
