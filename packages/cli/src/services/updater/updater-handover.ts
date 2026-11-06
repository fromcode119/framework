import { EngineStack } from '@cli/services/updater/engine-stack';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';

/**
 * Moves the updater itself onto the version it just installed.
 *
 * Every other service is replaced by the update; the updater cannot be, because stopping its own
 * container ends the process doing the stopping. Left alone it would keep running the code of the image
 * it was first started from, so a fix to the updater would never reach an installation that updates
 * itself. So after a successful update it starts a copy of itself on the new version — beside itself,
 * the way the rolling swap adds an app — and stops acting; the copy, as it starts, retires every older
 * updater of the same service. A copy that will not start leaves the running updater in charge.
 */
export class UpdaterHandover {
  private static readonly STOP_GRACE_SECONDS = 10;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly project: string,
    /** This container's id (its hostname is a prefix of it). */
    private readonly selfId: string,
  ) {}

  /** Starts this updater on `tag` when it runs another one; true when a successor now runs. */
  async handTo(tag: string): Promise<boolean> {
    const self = await this.engine.inspect(this.selfId);
    if (self.Config.Image.endsWith(`:${tag}`)) return false;
    const service = String(self.Config.Labels?.[EngineStack.SERVICE_LABEL] ?? '');
    if (!service) return false;
    const before = new Set((await this.containersOf(service)).map((container) => container.Id));
    const stack = new EngineStack(this.engine, this.project, tag);
    const running = (await stack.containerIds(service)).length;
    if ((await stack.scale(service, running + 1)) === 0) return true;
    // A successor that was created but would not start must not be left for a later `compose up` to find.
    for (const container of await this.containersOf(service)) {
      if (!before.has(container.Id)) await this.engine.remove(container.Id).catch(() => undefined);
    }
    return false;
  }

  /** Stops and removes every updater of this service older than this one. */
  async retirePredecessors(): Promise<number> {
    const self = await this.engine.inspect(this.selfId);
    const service = String(self.Config.Labels?.[EngineStack.SERVICE_LABEL] ?? '');
    if (!service) return 0;
    const containers = await this.containersOf(service);
    const own = containers.find((container) => container.Id === self.Id);
    let retired = 0;
    for (const container of containers) {
      if (container.Id === self.Id || (container.Created ?? 0) > (own?.Created ?? 0)) continue;
      await this.engine.stop(container.Id, UpdaterHandover.STOP_GRACE_SECONDS).catch(() => undefined);
      await this.engine.remove(container.Id).catch(() => undefined);
      retired += 1;
    }
    return retired;
  }

  private async containersOf(service: string): Promise<IContainerSummary[]> {
    return (await this.engine.listContainers([`${EngineStack.PROJECT_LABEL}=${this.project}`]))
      .filter((container) => container.Labels[EngineStack.SERVICE_LABEL] === service);
  }
}
