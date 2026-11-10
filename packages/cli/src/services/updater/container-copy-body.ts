import type { IContainerBody } from '@cli/services/updater/interfaces/container-body.interface';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';

/**
 * A new container as a copy of a running one, on another image tag.
 *
 * Only the way BACK uses this, and only when the deployment's previous compose files cannot be read: it
 * reproduces exactly what was running, which is what a rollback wants. It never carries a release
 * forward — that is what kept every machine on the compose settings of the first version it installed.
 *
 * What came from the old IMAGE rather than from the deployment is dropped, so the target image supplies
 * its own: an inspected container carries its image's default environment and command.
 */
export class ContainerCopyBody implements IContainerBodySource {
  private static readonly MODES_WITHOUT_ENDPOINTS = ['none', 'host'];
  private static readonly SHARED_MODE_PREFIX = 'container:';
  private static readonly NUMBER_LABEL = 'com.docker.compose.container-number';
  readonly origin = 'a copy of the running containers (the previous compose files could not be read)';

  constructor(private readonly engine: IDockerEngine, private readonly tag: string) {}

  async build(_service: string, name: string, number: number, template: IContainerInspect): Promise<IContainerBody> {
    const oldImage = await this.engine.imageDefaults(template.Config.Image);
    const { Hostname, Image, ...config } = template.Config;
    void Hostname;
    const imageEnv = new Set(oldImage.Env);
    const oldName = template.Name.replace(/^\//, '');
    const renamed = (endpoint: Record<string, any>) => {
      const aliases = (endpoint?.Aliases ?? []).filter((alias: string) => alias && !template.Id.startsWith(alias) && alias !== oldName);
      return { Aliases: [...new Set([...aliases, name])] };
    };
    const [first, ...rest] = ContainerCopyBody.networks(template);
    return {
      body: {
        ...config,
        Image: `${String(Image).slice(0, String(Image).lastIndexOf(':'))}:${this.tag}`,
        Env: (config.Env ?? []).filter((entry: string) => !imageEnv.has(entry)),
        Cmd: ContainerCopyBody.same(config.Cmd, oldImage.Cmd) ? null : config.Cmd,
        Entrypoint: ContainerCopyBody.same(config.Entrypoint, oldImage.Entrypoint) ? null : config.Entrypoint,
        WorkingDir: config.WorkingDir === oldImage.WorkingDir ? '' : config.WorkingDir,
        Labels: { ...config.Labels, [ContainerCopyBody.NUMBER_LABEL]: String(number) },
        HostConfig: template.HostConfig,
        NetworkingConfig: first ? { EndpointsConfig: { [first[0]]: renamed(first[1]) } } : undefined,
      },
      extraNetworks: rest.map(([network, endpoint]) => [network, renamed(endpoint)]),
    };
  }

  /**
   * A container with `network_mode: none`, `host` or `container:<id>` shows that mode as its one
   * "network", but Docker refuses endpoint settings for it; `HostConfig.NetworkMode` alone carries it.
   */
  private static networks(template: IContainerInspect): Array<[string, Record<string, any>]> {
    const mode = String(template.HostConfig?.NetworkMode ?? '');
    if (ContainerCopyBody.MODES_WITHOUT_ENDPOINTS.includes(mode) || mode.startsWith(ContainerCopyBody.SHARED_MODE_PREFIX)) return [];
    return Object.entries(template.NetworkSettings.Networks ?? {});
  }

  private static same(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
}
