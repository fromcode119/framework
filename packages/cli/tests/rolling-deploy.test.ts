import { describe, expect, it } from 'vitest';
import { DeployCapacity, DeployMode } from '@fromcode119/core';
import { DeployStrategy } from '@cli/services/deploy/deploy-strategy';
import { RollingDeploy } from '@cli/services/deploy/rolling-deploy';
import { DeployService } from '@cli/services/deploy/deploy-service';

const FREE = [
  '               total        used        free      shared  buff/cache   available',
  'Mem:      8122138624  3467000000   576000000    76000000  4104000000  4486000000',
].join('\n');
const STATS = ['deploy-api-1|2.016GiB / 3.5GiB', 'deploy-admin-1|107.3MiB / 512MiB', 'deploy-frontend-1|365.9MiB / 512MiB', 'deploy-db-1|83MiB / 384MiB'].join('\n');

describe('DeployCapacity', () => {
  it('sizes the overlap by the largest swapped app, with a boot margin, against what is available', () => {
    const capacity = DeployCapacity.from(FREE, STATS, DeployStrategy.ROLLED);
    expect(capacity.largestService).toBe('api');
    expect(capacity.neededBytes).toBe(Math.round(DeployCapacity.bytes('2.016GiB') * DeployCapacity.BOOT_MARGIN));
    expect(capacity.availableBytes).toBe(4486000000);
    expect(capacity.fits).toBe(true);
  });

  it('refuses when the overlap would eat the reserve', () => {
    const tight = FREE.replace('4486000000', String(2_900_000_000));
    expect(DeployCapacity.from(tight, STATS, DeployStrategy.ROLLED).fits).toBe(false);
  });

  it('ignores containers that are not swapped', () => {
    const capacity = DeployCapacity.from(FREE, 'deploy-db-1|9GiB / 9GiB\ndeploy-admin-1|100MiB / 512MiB', DeployStrategy.ROLLED);
    expect(capacity.largestService).toBe('admin');
  });
});

/** A stack whose db answers the given mode and migration version, and whose image ships `files`. */
class StackFixture {
  static stack(options: { mode: string; applied: number; files: string[] }): any {
    return {
      declared: async () => [],
      containerIds: async () => [],
      query: async (sql: string) => (sql.includes('deploy_mode') ? options.mode : String(options.applied)),
      migrationFiles: async () => options.files,
    };
  }

  static shell(available: number): any {
    return { run: async (cmd: string) => ({ code: 0, stderr: '', stdout: cmd.startsWith('free') ? FREE.replace('4486000000', String(available)) : STATS }) };
  }
}

describe('DeployStrategy', () => {
  const files = ['053_sources_table_on_sqlite.js', '054_timestamps_carry_their_zone.js', 'index.js'];

  it('restarts when the operator chose restart', async () => {
    const plan = await new DeployStrategy(StackFixture.stack({ mode: 'restart', applied: 54, files }), StackFixture.shell(4_486_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.RESTART);
  });

  it('restarts once for the release that introduces the edge — it must take the ports from the gateway', async () => {
    const stack = { ...StackFixture.stack({ mode: 'rolling', applied: 54, files }), declared: async () => ['edge'], containerIds: async () => [] };
    const plan = await new DeployStrategy(stack as any, StackFixture.shell(4_486_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.RESTART);
    expect(plan.reason).toContain('introduces the edge');
  });

  it('rolls when chosen, with no new migrations and room to spare', async () => {
    const plan = await new DeployStrategy(StackFixture.stack({ mode: 'rolling', applied: 54, files }), StackFixture.shell(4_486_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.ROLLING);
  });

  it('falls back to restart for a release with new core migrations, and says which', async () => {
    const plan = await new DeployStrategy(StackFixture.stack({ mode: 'rolling', applied: 53, files }), StackFixture.shell(4_486_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.RESTART);
    expect(plan.reason).toContain('migration 54');
  });

  it('falls back to restart when the image cannot be listed, rather than assuming nothing to migrate', async () => {
    const plan = await new DeployStrategy(StackFixture.stack({ mode: 'rolling', applied: 54, files: [] }), StackFixture.shell(4_486_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.RESTART);
  });

  it('falls back to restart without the memory for the overlap', async () => {
    const plan = await new DeployStrategy(StackFixture.stack({ mode: 'rolling', applied: 54, files }), StackFixture.shell(2_000_000_000)).choose();
    expect(plan.mode).toBe(DeployMode.RESTART);
    expect(plan.reason).toContain('not enough memory');
  });
});

/** Containers per service; `healthy` decides whether a NEW container comes up. */
class ComposeFixture {
  readonly containers: Record<string, string[]> = { api: ['api-old'], admin: ['admin-old'], frontend: ['front-old'], gateway: ['gw-old'] };
  readonly stopped: string[] = [];
  gatewayRestarts = 0;
  private next = 0;

  constructor(private readonly healthy: (service: string) => boolean) {}

  readonly ensured: string[] = [];
  declares: string[] = [];
  /** Plugin processes per extension-host container; the old host's drain as the api moves them. */
  readonly plugins: Record<string, number> = {};
  /** Whether a new extension-host starts listening, and whether the api moves plugins off the old one. */
  hostListens = true;
  pluginsMove = true;
  readonly order: string[] = [];

  readonly stack: any = {
    declared: async (services: readonly string[]) => services.filter((service) => this.declares.includes(service)),
    ensure: async (service: string) => { this.ensured.push(service); this.containers[service] ??= [`${service}-running`]; return 0; },
    containerIds: async (service: string) => [...(this.containers[service] ?? [])],
    scale: async (service: string, count: number) => {
      while (this.containers[service].length < count) this.containers[service].push(`${service}-new-${this.next++}`);
      return 0;
    },
    probeContainer: async (id: string) => {
      const service = Object.keys(this.containers).find((key) => this.containers[key].includes(id)) ?? '';
      if (!id.includes('-new-') || !this.healthy(service)) return '';
      this.order.push(service);
      return service === 'api' ? '{"status":"ok","version":"0.2.196"}' : '200';
    },
    stopAndRemove: async (id: string) => {
      this.stopped.push(id);
      for (const key of Object.keys(this.containers)) this.containers[key] = this.containers[key].filter((c) => c !== id);
      return 0;
    },
    restartService: async () => { this.gatewayRestarts += 1; return 0; },
    // Containers a deploy started are on the release; the rest on the one before.
    imageOf: async (id: string) => (id.includes('-new-') ? 'ghcr.io/fromcode119/framework-api:v0.2.196' : 'ghcr.io/fromcode119/framework-api:v0.2.195'),
    logsOf: async (id: string) => (id.includes('-new-') && this.hostListens ? '[extension-host] listening on /run/fromcode/h-new/spawner.sock' : ''),
    processesFromUid: async (id: string) => {
      const count = this.plugins[id] ?? 0;
      // The api moves one plugin per look once the new host is there.
      if (this.pluginsMove && count > 0 && (this.containers['extension-host'] ?? []).some((c) => c.includes('-new-'))) this.plugins[id] = count - 1;
      return count;
    },
  };
}

describe('RollingDeploy', () => {
  it('swaps each app only after its new copy answers, then restarts the gateway', async () => {
    const compose = new ComposeFixture(() => true);
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    expect(compose.stopped).toEqual(['api-old', 'admin-old', 'front-old']);
    expect(['api', 'admin', 'frontend'].every((service) => compose.containers[service].length === 1 && compose.containers[service][0].includes('-new-'))).toBe(true);
    // No edge: the gateway owns the public ports and is restarted, not rolled.
    expect(compose.containers.gateway).toEqual(['gw-old']);
    expect(compose.gatewayRestarts).toBe(1);
  });

  it('starts extension-host first when the release declares it, so the new api has somewhere to start plugins', async () => {
    const compose = new ComposeFixture(() => true);
    compose.declares = ['extension-host'];
    // Already on this release: nothing to roll.
    compose.stack.imageOf = async () => 'ghcr.io/fromcode119/framework-api:v0.2.196';
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    expect(compose.ensured).toEqual(['extension-host']);
    expect(compose.stopped).not.toContain('extension-host-running');
  });

  it('rolls an older extension-host AFTER the apps: the new one starts beside it, and the old one goes once no plugin runs there', async () => {
    const compose = new ComposeFixture(() => true);
    compose.declares = ['extension-host'];
    compose.containers['extension-host'] = ['host-old'];
    compose.plugins['host-old'] = 3;
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    // The api that moves the plugins must already be on this release.
    expect(compose.stopped.indexOf('host-old')).toBeGreaterThan(compose.stopped.indexOf('front-old'));
    expect(compose.plugins['host-old']).toBe(0);
    expect(compose.containers['extension-host']).toHaveLength(1);
    expect(compose.containers['extension-host'][0]).toContain('-new-');
  });

  it('keeps the running extension-host, and every plugin in it, when the new one never listens', async () => {
    const compose = new ComposeFixture(() => true);
    compose.declares = ['extension-host'];
    compose.containers['extension-host'] = ['host-old'];
    compose.hostListens = false;
    expect(await new RollingDeploy(compose.stack, async () => undefined, 0).run('v0.2.196')).toBe(false);
    expect(compose.containers['extension-host']).toEqual(['host-old']);
    expect(compose.stopped).toContain('extension-host-new-3');
  });

  it('stops the old extension-host anyway, and says so, when plugins do not move in time', async () => {
    const compose = new ComposeFixture(() => true);
    compose.declares = ['extension-host'];
    compose.containers['extension-host'] = ['host-old'];
    compose.plugins['host-old'] = 2;
    compose.pluginsMove = false;
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (line: string) => { warnings.push(String(line)); };
    try {
      expect(await new RollingDeploy(compose.stack, async () => undefined, 1_000, 0).run('v0.2.196')).toBe(true);
    } finally {
      console.warn = warn;
    }
    expect(compose.stopped).toContain('host-old');
    expect(warnings.join('\n')).toContain('2 plugin process(es) had not moved');
  });

  it('rolls the gateway like the apps when the edge holds the ports — no restart, no gap', async () => {
    const compose = new ComposeFixture(() => true);
    compose.declares = ['edge'];
    compose.containers.edge = ['edge-running'];
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    expect(compose.gatewayRestarts).toBe(0);
    expect(compose.stopped).toContain('gw-old');
    expect(compose.containers.gateway).toHaveLength(1);
    expect(compose.containers.gateway[0]).toContain('-new-');
  });

  it('leaves a release without extension-host exactly as before', async () => {
    const compose = new ComposeFixture(() => true);
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    expect(compose.ensured).toEqual([]);
  });

  it('keeps the old copy serving when the new one never comes up, and stops there', async () => {
    const compose = new ComposeFixture((service) => service !== 'admin');
    expect(await new RollingDeploy(compose.stack, async () => undefined, 0).run('v0.2.196')).toBe(false);
    expect(compose.containers.admin).toEqual(['admin-old']);
    expect(compose.stopped).toEqual(['api-old', 'admin-new-1']);
    expect(compose.containers.frontend).toEqual(['front-old']);
    expect(compose.gatewayRestarts).toBe(0);
  });
});

describe('DeployService on a failed rolling deploy', () => {
  /** The new admin never comes up; the version the stack is asked to roll back to always does. */
  it('rolls the swapped apps back one at a time instead of recreating the stack', async () => {
    let target = '0.2.196';
    const compose = new ComposeFixture((service) => service !== 'admin' || target !== '0.2.196');
    let ups = 0;
    const stack = Object.assign(compose.stack, {
      pull: async () => 0,
      up: async () => { ups += 1; return 0; },
      query: async (sql: string) => (sql.includes('deploy_mode') ? 'rolling' : '54'),
      migrationFiles: async () => ['054_timestamps_carry_their_zone.js'],
      apiLogs: async () => '',
    });
    // A new api container reports whichever version `.env` named when it was started.
    const probeContainer = stack.probeContainer;
    stack.probeContainer = async (id: string, script: string) => (await probeContainer(id, script)).replace('0.2.196', target);
    const versions: any = { current: async () => '0.2.195', set: async (v: string) => { target = v; }, rememberReplaced: async () => undefined, rollbackTarget: async () => '' };
    const probe: any = { waitFor: async (v: string) => v === target };
    const rolling = (s: any) => new RollingDeploy(s, async () => undefined, 0);
    const service = new DeployService({ name: 'probe' } as any, StackFixture.shell(4_486_000_000), stack, versions, probe, rolling);

    expect(await service.deploy('0.2.196')).toBe(false);
    expect(target).toBe('0.2.195');
    expect(ups).toBe(0);
    expect(compose.gatewayRestarts).toBe(1);
  });
});

describe('RollingDeploy.httpAnswerScript', () => {
  it('counts a redirect to https as an answer, the way the gateway answers plain HTTP', async () => {
    const http = await import('http');
    const { execFile } = await import('child_process');
    const server = http.createServer((_req, res) => { res.writeHead(301, { location: 'https://localhost:1/' }); res.end(); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const printed = await new Promise<string>((resolve) => execFile(process.execPath, ['-e', RollingDeploy.httpAnswerScript(port)], (_error, stdout) => resolve(stdout)));
      expect(printed).toBe('301');
    } finally {
      server.close();
    }
  });
});
