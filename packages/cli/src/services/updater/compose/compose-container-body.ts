import { ComposeFileMerge } from '@cli/services/updater/compose/compose-file-merge';
import { ComposeValueParser } from '@cli/services/updater/compose/compose-value-parser';
import type { ComposeProject } from '@cli/services/updater/compose/compose-project';
import type { IContainerBody } from '@cli/services/updater/interfaces/container-body.interface';
import type { IContainerBodySource } from '@cli/services/updater/interfaces/container-body-source.interface';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';

/**
 * One compose service definition as the Engine API container it declares.
 *
 * Every key a service may use is either applied or listed as needing nothing on a container
 * (`build`, `depends_on`, `profiles`). Any other key REFUSES the update, naming the key — a setting the
 * updater does not understand is never quietly dropped from the container, which is how the old updater
 * lost a memory limit and a log driver on every machine. The test over the repository's own compose
 * files keeps a release from introducing such a key unnoticed.
 */
export class ComposeContainerBody implements IContainerBodySource {
  static readonly NUMBER_LABEL = 'com.docker.compose.container-number';
  /** Compose records the project folder on the host on every container it starts. */
  static readonly WORKING_DIR_LABEL = 'com.docker.compose.project.working_dir';
  readonly origin = 'the release\'s compose files';
  private static readonly COMPOSE_LABEL_PREFIX = 'com.docker.compose.';
  private static readonly NOT_ON_A_CONTAINER = new Set(['build', 'depends_on', 'profiles']);
  private static readonly APPLIED = new Set([
    'image', 'command', 'entrypoint', 'user', 'working_dir', 'environment', 'labels', 'volumes', 'ports',
    'networks', 'network_mode', 'restart', 'logging', 'deploy', 'mem_limit', 'cap_add', 'cap_drop',
    'security_opt', 'init', 'runtime', 'read_only', 'privileged', 'tmpfs', 'extra_hosts', 'shm_size', 'stop_signal',
  ]);

  constructor(readonly project: ComposeProject) {}

  async build(service: string, containerName: string, number: number, template: IContainerInspect): Promise<IContainerBody> {
    const labels = template.Config?.Labels ?? {};
    // Relative bind sources are paths in the deployment folder on the HOST, where the daemon resolves them.
    const hostDirectory = String(labels[ComposeContainerBody.WORKING_DIR_LABEL] ?? '');
    if (!hostDirectory.startsWith('/')) throw new Error(`${template.Name} does not say which folder compose started it from.`);
    return this.body(service, containerName, number, labels, hostDirectory);
  }

  /**
   * The create body for `containerName` in a project started from `hostDirectory`, plus the networks to connect after it exists (a create joins one).
   * `templateLabels` are the running container's: its compose bookkeeping (`project`, `service`,
   * `config_files`…) is kept so `docker compose` still owns the new container.
   */
  body(service: string, containerName: string, number: number, templateLabels: Record<string, string>, hostDirectory: string): IContainerBody {
    const definition = this.project.service(service);
    for (const key of Object.keys(definition)) {
      if (key.startsWith('x-') || ComposeContainerBody.NOT_ON_A_CONTAINER.has(key) || ComposeContainerBody.APPLIED.has(key)) continue;
      throw new Error(`The "${service}" service sets "${key}", which the updater cannot apply; update this machine with the deploy command.`);
    }
    if (!definition.image) throw new Error(`The "${service}" service names no image.`);
    const [first, ...rest] = this.networks(service, containerName, definition);
    return {
      body: {
        Image: String(definition.image),
        Cmd: definition.command === undefined || definition.command === null ? null : ComposeValueParser.words(definition.command),
        Entrypoint: definition.entrypoint === undefined || definition.entrypoint === null ? null : ComposeValueParser.words(definition.entrypoint),
        ...(definition.user !== undefined ? { User: String(definition.user) } : {}),
        ...(definition.working_dir ? { WorkingDir: String(definition.working_dir) } : {}),
        ...(definition.stop_signal ? { StopSignal: String(definition.stop_signal) } : {}),
        Env: Object.entries(ComposeFileMerge.keyed(definition.environment)).filter(([, value]) => value !== null).map(([name, value]) => `${name}=${value}`),
        Labels: { ...this.composeLabels(templateLabels), ...ComposeFileMerge.keyed(definition.labels), [ComposeContainerBody.NUMBER_LABEL]: String(number) },
        ExposedPorts: Object.fromEntries((definition.ports ?? []).map((port: unknown) => [ComposeValueParser.port(port).containerPort, {}])),
        HostConfig: this.hostConfig(definition, first?.[0], hostDirectory),
        NetworkingConfig: first ? { EndpointsConfig: { [first[0]]: first[1] } } : undefined,
      },
      extraNetworks: rest,
    };
  }

  private hostConfig(definition: Record<string, any>, firstNetwork: string | undefined, hostDirectory: string): Record<string, any> {
    const limits = definition.deploy?.resources?.limits ?? {};
    const reservations = definition.deploy?.resources?.reservations ?? {};
    const memory = limits.memory ?? definition.mem_limit;
    const bindings: Record<string, Array<{ HostIp: string; HostPort: string }>> = {};
    for (const port of definition.ports ?? []) {
      const { containerPort, binding } = ComposeValueParser.port(port);
      (bindings[containerPort] ??= []).push(binding);
    }
    return {
      Binds: (definition.volumes ?? []).map((entry: unknown) => ComposeValueParser.volume(entry, hostDirectory, (key) => this.project.volumeName(key))),
      PortBindings: bindings,
      RestartPolicy: ComposeValueParser.restart(definition.restart ?? 'no'),
      NetworkMode: definition.network_mode ? String(definition.network_mode) : firstNetwork ?? 'default',
      ...(definition.logging ? { LogConfig: { Type: String(definition.logging.driver ?? 'json-file'), Config: ComposeFileMerge.keyed(definition.logging.options) } } : {}),
      ...(memory !== undefined ? { Memory: ComposeValueParser.bytes(memory) } : {}),
      ...(reservations.memory !== undefined ? { MemoryReservation: ComposeValueParser.bytes(reservations.memory) } : {}),
      ...(limits.cpus !== undefined ? { NanoCpus: Math.round(Number(limits.cpus) * 1e9) } : {}),
      ...(definition.cap_add ? { CapAdd: definition.cap_add.map(String) } : {}),
      ...(definition.cap_drop ? { CapDrop: definition.cap_drop.map(String) } : {}),
      ...(definition.security_opt ? { SecurityOpt: definition.security_opt.map(String) } : {}),
      ...(definition.init !== undefined ? { Init: Boolean(definition.init) } : {}),
      ...(definition.runtime ? { Runtime: String(definition.runtime) } : {}),
      ...(definition.read_only !== undefined ? { ReadonlyRootfs: Boolean(definition.read_only) } : {}),
      ...(definition.privileged !== undefined ? { Privileged: Boolean(definition.privileged) } : {}),
      ...(definition.tmpfs ? { Tmpfs: Object.fromEntries([definition.tmpfs].flat().map((entry: string) => { const [target, options = ''] = String(entry).split(':'); return [target, options]; })) } : {}),
      ...(definition.extra_hosts ? { ExtraHosts: Object.entries(ComposeFileMerge.keyed(definition.extra_hosts)).map(([host, ip]) => ip === null ? host : `${host}:${ip}`) } : {}),
      ...(definition.shm_size !== undefined ? { ShmSize: ComposeValueParser.bytes(definition.shm_size) } : {}),
    };
  }

  /**
   * The networks the service joins, each with the names compose gives it there: the service name, the
   * container's own name, and any declared `aliases`. A `network_mode` joins none (Docker refuses
   * endpoint settings for it).
   */
  private networks(service: string, containerName: string, definition: Record<string, any>): Array<[string, Record<string, any>]> {
    if (definition.network_mode) return [];
    const declared = definition.networks ?? ['default'];
    const entries: Array<[string, any]> = Array.isArray(declared) ? declared.map((key) => [String(key), {}]) : Object.entries(declared);
    return entries.map(([key, settings]) => [this.project.networkName(key), {
      Aliases: [...new Set([service, containerName, ...((settings ?? {}).aliases ?? []).map(String)])],
    }]);
  }

  private composeLabels(labels: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(labels ?? {}).filter(([key]) => key.startsWith(ComposeContainerBody.COMPOSE_LABEL_PREFIX)));
  }
}
