import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IImageDefaults } from '@cli/services/updater/interfaces/image-defaults.interface';
import type { IReplacedContainer } from '@cli/services/updater/interfaces/replaced-container.interface';

/**
 * Replaces one running container with the same container on a newer image, and can undo it.
 *
 * The replacement is the old container's own configuration — environment, mounts, ports, restart policy,
 * networks and their aliases, compose labels — with only the image changed, so `docker compose` still
 * recognises it as its service. The old container is stopped and renamed aside rather than deleted:
 * until the new version has reported itself healthy it is the way back.
 *
 * What came from the OLD IMAGE rather than from the deployment is dropped, so the new image supplies its
 * own: an inspected container carries its image's default environment and command, and copying those
 * forward would pin every future version to the defaults of the first one installed.
 */
export class ContainerReplacement {
  static readonly ASIDE_SUFFIX = '-previous';
  private static readonly STOP_TIMEOUT_SECONDS = 30;

  constructor(private readonly engine: IDockerEngine) {}

  async replace(service: string, containerId: string, image: string): Promise<IReplacedContainer> {
    const current = await this.engine.inspect(containerId);
    const name = current.Name.replace(/^\//, '');
    const body = ContainerReplacement.bodyFor(current, image, await this.engine.imageDefaults(current.Config.Image));

    await this.engine.stop(current.Id, ContainerReplacement.STOP_TIMEOUT_SECONDS);
    await this.engine.rename(current.Id, `${name}${ContainerReplacement.ASIDE_SUFFIX}`);
    let replacementId = '';
    try {
      replacementId = await this.engine.createContainer(name, body);
      for (const [network, endpoint] of ContainerReplacement.extraNetworks(current)) {
        await this.engine.connectNetwork(network, replacementId, ContainerReplacement.endpoint(endpoint, current.Id));
      }
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

  static bodyFor(current: IContainerInspect, image: string, oldImage: IImageDefaults): Record<string, any> {
    const { Hostname, Image, ...config } = current.Config;
    void Hostname; void Image;
    const imageEnv = new Set(oldImage.Env);
    const networks = Object.entries(current.NetworkSettings.Networks ?? {});
    const [first] = networks;
    return {
      ...config,
      Image: image,
      Env: (config.Env ?? []).filter((entry: string) => !imageEnv.has(entry)),
      Cmd: ContainerReplacement.same(config.Cmd, oldImage.Cmd) ? null : config.Cmd,
      Entrypoint: ContainerReplacement.same(config.Entrypoint, oldImage.Entrypoint) ? null : config.Entrypoint,
      WorkingDir: config.WorkingDir === oldImage.WorkingDir ? '' : config.WorkingDir,
      HostConfig: current.HostConfig,
      NetworkingConfig: first ? { EndpointsConfig: { [first[0]]: ContainerReplacement.endpoint(first[1], current.Id) } } : undefined,
    };
  }

  /** A container create joins ONE network; the rest are connected after it exists. */
  private static extraNetworks(current: IContainerInspect): Array<[string, Record<string, any>]> {
    return Object.entries(current.NetworkSettings.Networks ?? {}).slice(1);
  }

  /** Aliases are how the other services find this one (`api`, `gateway`); the old container's own id alias is not carried. */
  private static endpoint(endpoint: Record<string, any>, containerId: string): Record<string, any> {
    const aliases = (endpoint?.Aliases ?? []).filter((alias: string) => alias && !containerId.startsWith(alias));
    return { Aliases: aliases };
  }

  private static same(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
}
