import { describe, expect, it } from 'vitest';
import { DeployCapacity, DeployMode } from '@fromcode119/core';
import { DeployStrategy } from '@cli/services/deploy/deploy-strategy';
import { RollingDeploy } from '@cli/services/deploy/rolling-deploy';

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
  readonly containers: Record<string, string[]> = { api: ['api-old'], admin: ['admin-old'], frontend: ['front-old'] };
  readonly stopped: string[] = [];
  gatewayRestarts = 0;
  private next = 0;

  constructor(private readonly healthy: (service: string) => boolean) {}

  readonly stack: any = {
    containerIds: async (service: string) => [...(this.containers[service] ?? [])],
    scale: async (service: string, count: number) => {
      while (this.containers[service].length < count) this.containers[service].push(`${service}-new-${this.next++}`);
      return 0;
    },
    probeContainer: async (id: string) => {
      const service = Object.keys(this.containers).find((key) => this.containers[key].includes(id)) ?? '';
      if (!id.includes('-new-') || !this.healthy(service)) return '';
      return service === 'api' ? '{"status":"ok","version":"0.2.196"}' : '200';
    },
    stopAndRemove: async (id: string) => {
      this.stopped.push(id);
      for (const key of Object.keys(this.containers)) this.containers[key] = this.containers[key].filter((c) => c !== id);
      return 0;
    },
    restartService: async () => { this.gatewayRestarts += 1; return 0; },
  };
}

describe('RollingDeploy', () => {
  it('swaps each app only after its new copy answers, then restarts the gateway', async () => {
    const compose = new ComposeFixture(() => true);
    expect(await new RollingDeploy(compose.stack, async () => undefined).run('v0.2.196')).toBe(true);
    expect(compose.stopped).toEqual(['api-old', 'admin-old', 'front-old']);
    expect(Object.values(compose.containers).every((ids) => ids.length === 1 && ids[0].includes('-new-'))).toBe(true);
    expect(compose.gatewayRestarts).toBe(1);
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
