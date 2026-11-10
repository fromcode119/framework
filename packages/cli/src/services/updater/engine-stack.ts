import os from 'os';
import { DeployCapacity } from '@fromcode119/core';
import { ShippedMigration } from '@cli/services/deploy/shipped-migration';
import { ContainerReplacement } from '@cli/services/updater/container-replacement';
import type { IDeployStack } from '@cli/services/deploy/interfaces/deploy-stack.interface';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';

/**
 * The compose project this updater belongs to, driven through the Docker Engine API, as a stack
 * `RollingDeploy` can roll to `tag`.
 *
 * The updater's image has no docker CLI, so this does what `docker compose up --scale` would: a new copy
 * takes its configuration from `source` — for an update, the release's own compose service definition —
 * under the next compose container number. Its network aliases (the service name) come with it, so the
 * gateway's lookup of `api` reaches the new copy the moment it starts, and the old one is stopped only
 * after the new one answers. Which services run is still what the running containers say.
 */
export class EngineStack implements IDeployStack {
  static readonly PROJECT_LABEL = 'com.docker.compose.project';
  static readonly SERVICE_LABEL = 'com.docker.compose.service';
  static readonly NUMBER_LABEL = 'com.docker.compose.container-number';
  static readonly DB_SERVICE = 'db';
  /** Names the throwaway container that lists the new api image's migrations. */
  private static readonly PROBE_NAME = 'migration-probe';

  constructor(
    private readonly engine: IDockerEngine,
    private readonly project: string,
    /** The image tag new copies run (`v0.2.400`). */
    private readonly tag: string,
    /** Where each new container's configuration comes from. */
    private readonly source: IContainerBodySource,
    /** The machine's available memory; this container sees the host's. */
    private readonly availableBytes: () => number = () => os.freemem(),
  ) {}

  async declared(services: readonly string[]): Promise<string[]> {
    const running = new Set((await this.projectContainers()).filter(EngineStack.isRunning).map(EngineStack.serviceOf));
    return services.filter((service) => running.has(service));
  }

  async containerIds(service: string): Promise<string[]> {
    return (await this.running(service)).map((container) => container.Id);
  }

  /** Nothing to start a service from without compose files; one that runs keeps running. */
  async ensure(service: string): Promise<number> {
    return (await this.running(service)).length ? 0 : 1;
  }

  async scale(service: string, count: number): Promise<number> {
    try {
      const running = await this.running(service);
      if (!running.length) return 1;
      const template = await this.engine.inspect(running[running.length - 1].Id);
      for (let added = running.length; added < count; added += 1) {
        const number = (await this.highestNumber(service)) + 1;
        const name = `${this.project}-${service}-${number}`;
        const { body, extraNetworks } = await this.source.build(service, name, number, template);
        const id = await this.engine.createContainer(name, body);
        for (const [network, endpoint] of extraNetworks) await this.engine.connectNetwork(network, id, endpoint);
        await this.engine.start(id);
      }
      return 0;
    } catch (error) {
      console.error(`[updater] could not add a ${service} on ${this.tag}: ${(error as Error).message}`);
      return 1;
    }
  }

  async probeContainer(id: string, script: string): Promise<string> {
    const result = await this.engine.exec(id, ['node', '-e', script]).catch(() => ({ code: 1, stdout: '' }));
    return result.code === 0 ? result.stdout.trim() : '';
  }

  async imageOf(id: string): Promise<string> {
    return (await this.engine.inspect(id).catch(() => null))?.Config?.Image ?? '';
  }

  async logsOf(id: string, lines = 50): Promise<string> {
    return this.engine.logs(id, lines).catch(() => '');
  }

  async processesFromUid(id: string, uidBase: number): Promise<number | null> {
    try {
      const top = await this.engine.top(id, '-eo pid,uid');
      const column = top.Titles.findIndex((title) => title.trim().toUpperCase() === 'UID');
      if (column < 0) return null;
      return top.Processes.map((row) => Number(row[column])).filter((uid) => Number.isInteger(uid) && uid >= uidBase).length;
    } catch {
      return null;
    }
  }

  async stopAndRemove(id: string, graceSeconds: number): Promise<number> {
    try {
      await this.engine.stop(id, graceSeconds);
      await this.engine.remove(id);
      return 0;
    } catch {
      return 1;
    }
  }

  async restartService(service: string): Promise<number> {
    const replacement = new ContainerReplacement(this.engine);
    try {
      for (const container of await this.running(service)) {
        const replaced = await replacement.replace(service, container.Id, this.source);
        await replacement.discard(replaced);
      }
      return 0;
    } catch (error) {
      console.error(`[updater] could not replace ${service} on ${this.tag}: ${(error as Error).message}`);
      return 1;
    }
  }

  /** As the database's own user, inside the db container — the SQL passed as `$0`, never spliced into the shell. */
  async query(sql: string): Promise<string> {
    const [db] = await this.running(EngineStack.DB_SERVICE);
    if (!db) return '';
    const result = await this.engine.exec(db.Id, ['sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$0"', sql]).catch(() => ({ code: 1, stdout: '' }));
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** A throwaway container of the new api image loads its migration classes, as `compose run` does for the CLI. */
  async shippedMigrations(): Promise<ShippedMigration[]> {
    const [api] = await this.running('api');
    if (!api) return [];
    const current = await this.engine.inspect(api.Id);
    const defaults = await this.engine.imageDefaults(current.Config.Image);
    const imageEnv = new Set(defaults.Env);
    const id = await this.engine.createContainer(`${this.project}-${EngineStack.PROBE_NAME}-${Date.now()}`, {
      Image: `${EngineStack.repository(current.Config.Image)}:${this.tag}`,
      Entrypoint: ['node'],
      Cmd: ['-e', ShippedMigration.PROBE],
      Env: (current.Config.Env ?? []).filter((entry: string) => !imageEnv.has(entry)),
    });
    try {
      await this.engine.start(id);
      if ((await this.engine.wait(id)) !== 0) return [];
      return ShippedMigration.parse(await this.engine.logs(id, 1000));
    } catch {
      return [];
    } finally {
      await this.engine.remove(id).catch(() => undefined);
    }
  }

  /** The machine's available memory against each app's current use, as `docker stats` counts it. */
  async capacity(services: readonly string[]): Promise<DeployCapacity> {
    let largest = 0;
    let largestService = services[0] ?? '';
    for (const service of services) {
      for (const container of await this.running(service)) {
        const bytes = await this.engine.memoryUsage(container.Id).catch(() => 0);
        if (bytes > largest) { largest = bytes; largestService = service; }
      }
    }
    return new DeployCapacity(this.availableBytes(), Math.round(largest * DeployCapacity.BOOT_MARGIN), largestService);
  }

  private async projectContainers(): Promise<IContainerSummary[]> {
    return this.engine.listContainers([`${EngineStack.PROJECT_LABEL}=${this.project}`]);
  }

  private async running(service: string): Promise<IContainerSummary[]> {
    return (await this.projectContainers())
      .filter((container) => EngineStack.serviceOf(container) === service && EngineStack.isRunning(container))
      .sort((a, b) => (a.Created ?? 0) - (b.Created ?? 0));
  }

  /** Every container of the service counts, stopped ones too: compose refuses a number already taken. */
  private async highestNumber(service: string): Promise<number> {
    return Math.max(0, ...(await this.projectContainers())
      .filter((container) => EngineStack.serviceOf(container) === service)
      .map((container) => Number(container.Labels[EngineStack.NUMBER_LABEL]) || 0));
  }

  private static serviceOf(container: IContainerSummary): string {
    return container.Labels[EngineStack.SERVICE_LABEL] ?? '';
  }

  private static isRunning(container: IContainerSummary): boolean {
    return container.State === 'running';
  }

  static repository(image: string): string {
    return image.slice(0, image.lastIndexOf(':'));
  }
}
