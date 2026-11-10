import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IReplacedContainer } from '@cli/services/updater/interfaces/replaced-container.interface';

/**
 * Replaces one running container in place — same name, same compose number — with a new one whose
 * configuration comes from `source` (for an update, the release's own compose service definition), and
 * can undo it.
 *
 * The old container is stopped and renamed aside rather than deleted: until the new version has
 * reported itself healthy it is the way back, exactly as it was, settings and all.
 */
export class ContainerReplacement {
  static readonly ASIDE_SUFFIX = '-previous';
  private static readonly STOP_TIMEOUT_SECONDS = 30;
  private static readonly NUMBER_LABEL = 'com.docker.compose.container-number';

  constructor(private readonly engine: IDockerEngine) {}

  async replace(service: string, containerId: string, source: IContainerBodySource): Promise<IReplacedContainer> {
    const current = await this.engine.inspect(containerId);
    const name = current.Name.replace(/^\//, '');
    const number = Number(current.Config.Labels?.[ContainerReplacement.NUMBER_LABEL]) || 1;
    // Built before anything stops: a definition the updater cannot apply leaves this container serving.
    const { body, extraNetworks } = await source.build(service, name, number, current);

    await this.engine.stop(current.Id, ContainerReplacement.STOP_TIMEOUT_SECONDS);
    await this.engine.rename(current.Id, `${name}${ContainerReplacement.ASIDE_SUFFIX}`);
    let replacementId = '';
    try {
      replacementId = await this.engine.createContainer(name, body);
      for (const [network, endpoint] of extraNetworks) await this.engine.connectNetwork(network, replacementId, endpoint);
      await this.engine.start(replacementId);
    } catch (error) {
      await this.restore({ service, name, previousId: current.Id, replacementId });
      throw error;
    }
    return { service, name, previousId: current.Id, replacementId };
  }

  /** Puts the previous container back under its own name and starts it. */
  async restore(replaced: IReplacedContainer): Promise<void> {
    if (replaced.replacementId) await this.engine.remove(replaced.replacementId).catch(() => undefined);
    await this.engine.rename(replaced.previousId, replaced.name);
    await this.engine.start(replaced.previousId);
  }

  /** The new version held: the previous container is no longer a way back. */
  async discard(replaced: IReplacedContainer): Promise<void> {
    await this.engine.remove(replaced.previousId);
  }
}
