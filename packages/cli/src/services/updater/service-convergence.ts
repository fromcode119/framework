import { ContainerDrift } from '@cli/services/updater/container-drift';
import { ContainerReplacement } from '@cli/services/updater/container-replacement';
import { ComposeContainerBody } from '@cli/services/updater/compose/compose-container-body';
import { PinnedImageBody } from '@cli/services/updater/pinned-image-body';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';

/**
 * The rest of the deployment brought to what the release's compose files declare, once its apps run the
 * new version: what `docker compose up` would do on that machine, and what a self-updating one never got.
 *
 * - A service the release adds (and `COMPOSE_PROFILES` enables) is started.
 * - A running service whose settings differ from its definition — the database's log driver, the edge's
 *   memory limit, redis's command — is recreated, and ONLY then. Its data is in named volumes, which
 *   the new container mounts again. It is kept aside until the new one stays up, and put back if not.
 * - A one-shot (`restart: "no"`, the database secret) that already ran is left alone.
 *
 * The edge goes last: it is what visitors reach, and everything behind it is in place by then. It keeps
 * the image it runs (see `PinnedImageBody`): only its settings follow the release. A service
 * that cannot be converged is reported and keeps serving as it was; the update itself stands.
 */
export class ServiceConvergence {
  private static readonly SERVICE_LABEL = 'com.docker.compose.service';
  private static readonly PROJECT_LABEL = 'com.docker.compose.project';
  private static readonly LAST = 'edge';
  /** A recreated service must still be running this many checks later (a database on the wrong data exits). */
  private static readonly SETTLE_CHECKS = 5;
  private static readonly SETTLE_INTERVAL_MS = 2000;
  private static readonly HEALTH_CHECKS = 30;

  private readonly replacement: ContainerReplacement;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly source: ComposeContainerBody,
    /** Services the update itself replaced, and the updater, which hands itself over. */
    private readonly managed: string[],
    private readonly onStep: (step: string) => void,
    private readonly pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.replacement = new ContainerReplacement(engine);
  }

  /** Each service it could not bring to its definition, with why; empty when everything matches. */
  async run(): Promise<string[]> {
    const project = this.source.project;
    const containers = await this.engine.listContainers([`${ServiceConvergence.PROJECT_LABEL}=${project.name}`]);
    const services = project.activeServices().filter((service) => !this.managed.includes(service))
      .sort((a, b) => Number(a === ServiceConvergence.LAST) - Number(b === ServiceConvergence.LAST));
    const problems: string[] = [];
    for (const service of services) {
      try {
        await this.converge(service, containers);
      } catch (error) {
        const problem = `${service}: ${(error as Error).message}`;
        this.onStep(`Could not bring ${problem}`);
        problems.push(problem);
      }
    }
    return problems;
  }

  private async converge(service: string, containers: IContainerSummary[]): Promise<void> {
    const definition = this.source.project.service(service);
    const oneShot = String(definition.restart ?? 'no') === 'no';
    const current = containers.filter((container) => ServiceConvergence.serviceOf(container) === service
      && !container.Names.some((name) => name.endsWith(ContainerReplacement.ASIDE_SUFFIX)))[0];
    if (!current) return this.add(service, containers, oneShot);
    if (oneShot) return;

    const running = await this.engine.inspect(current.Id);
    const source: IContainerBodySource = service === ServiceConvergence.LAST ? new PinnedImageBody(this.source, String(running.Config.Image)) : this.source;
    const { body } = await source.build(service, running.Name.replace(/^\//, ''), 1, running);
    await this.ensureImage(String(body.Image));
    const drift = ContainerDrift.differences(body, running, await this.engine.imageDefaults(String(body.Image)));
    if (!drift.length) return;

    this.onStep(`Recreating ${service} for its changed ${drift.join(', ')}`);
    const replaced = await this.replacement.replace(service, current.Id, source);
    if (!(await this.settled(replaced.replacementId))) {
      await this.replacement.restore(replaced);
      throw new Error('the new container did not stay up, so the previous one is serving again');
    }
    await this.replacement.discard(replaced);
  }

  /** A service the deployment did not run before: started under compose's own labels, as `up` would. */
  private async add(service: string, containers: IContainerSummary[], oneShot: boolean): Promise<void> {
    const template = containers.find((container) => this.managed.includes(ServiceConvergence.serviceOf(container)));
    if (!template) throw new Error('no platform container runs to take the deployment folder from');
    const workingDir = template.Labels[ComposeContainerBody.WORKING_DIR_LABEL] ?? '';
    if (!workingDir.startsWith('/')) throw new Error(`${template.Names[0]} does not say which folder compose started it from`);
    const name = `${this.source.project.name}-${service}-1`;
    const labels = { ...template.Labels, [ServiceConvergence.SERVICE_LABEL]: service };
    const { body, extraNetworks } = this.source.body(service, name, 1, labels, workingDir);
    await this.ensureImage(String(body.Image));

    this.onStep(`Starting ${service}, which the release adds`);
    const id = await this.engine.createContainer(name, body);
    for (const [network, endpoint] of extraNetworks) await this.engine.connectNetwork(network, id, endpoint);
    await this.engine.start(id);
    if (!oneShot && !(await this.settled(id))) throw new Error('it was started but did not stay up');
  }

  /** A third-party image (`postgres:16-alpine`) a release moves to is downloaded first, like `up` would. */
  private async ensureImage(image: string): Promise<void> {
    if (await this.engine.hasImage(image)) return;
    const colon = image.lastIndexOf(':');
    const tagged = colon > image.lastIndexOf('/');
    const error = await this.engine.pull(tagged ? image.slice(0, colon) : image, tagged ? image.slice(colon + 1) : 'latest');
    if (error) throw new Error(`could not download ${image} — ${error}`);
  }

  /** Up, and still up a while later; with a healthcheck, healthy. */
  private async settled(id: string): Promise<boolean> {
    let checks = 0;
    for (let attempt = 0; attempt < ServiceConvergence.HEALTH_CHECKS; attempt++) {
      const state = (await this.engine.inspect(id)).State as Record<string, any>;
      if (!state.Running) return false;
      const health = state.Health?.Status;
      if (health === 'unhealthy') return false;
      if ((health === undefined || health === 'healthy') && ++checks >= ServiceConvergence.SETTLE_CHECKS) return true;
      await this.pause(ServiceConvergence.SETTLE_INTERVAL_MS);
    }
    return false;
  }

  private static serviceOf(container: IContainerSummary): string {
    return container.Labels[ServiceConvergence.SERVICE_LABEL] ?? '';
  }
}
