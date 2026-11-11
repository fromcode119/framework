import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IImageDefaults } from '@cli/services/updater/interfaces/image-defaults.interface';
import { ShippedMigration } from '@cli/services/deploy/shipped-migration';
import { DeployFolderFixture } from '@cli/services/updater/tests/deploy-folder-fixture';
import { TarFixture } from '@cli/services/updater/tests/tar-fixture';

/** A Docker daemon in memory: containers by id, local images, and switches to make a step fail. */
export class InMemoryDockerEngine implements IDockerEngine {
  containers = new Map<string, { name: string; image: string; running: boolean; labels: Record<string, string>; env: string[]; cmd: string[] | null; created: number; body?: Record<string, any> }>();
  images = new Set<string>();
  published = new Set<string>();
  failStartFor = '';
  /** A service whose NEWLY created container will not start (its running one still does). */
  failNewStartFor = '';
  /** A service whose NEWLY created container starts and then crash-loops under its restart policy. */
  crashLoopNewFor = '';
  /** What the database answers for `deploy_mode` ('' = never set, which is restart). */
  deployMode = '';
  appliedMigration = 54;
  shipped: Array<[number, boolean]> = [[54, false]];
  /** Every container ever stopped, in order, with the containers of its service still running at that moment. */
  stops: Array<{ name: string; runningPeers: number }> = [];
  created: Array<{ name: string; body: Record<string, any> }> = [];
  /** Services that run with `network_mode` set (`none` for the sandboxed site extension host). */
  networkModes: Record<string, string> = {};
  /** What each api image ships in /app/deploy: by default the repository's own deploy folder. */
  releaseFiles = DeployFolderFixture.release();
  private next = 1;

  add(service: string, image: string, project = 'site'): string {
    const id = `c${this.next++}aaaaaaaaaaaa`;
    this.containers.set(id, { name: `${project}-${service}-1`, image, running: true, env: ['NODE_VERSION=22', 'API_URL=x'], cmd: ['npm', 'start'], created: this.next,
      labels: { 'com.docker.compose.project': project, 'com.docker.compose.service': service, 'com.docker.compose.container-number': '1', 'com.docker.compose.project.working_dir': `/opt/apps/${project}/deploy` } });
    this.images.add(image);
    return id;
  }

  byName(name: string) {
    return [...this.containers.entries()].find(([, c]) => c.name === name);
  }

  async listContainers(labels: string[]): Promise<IContainerSummary[]> {
    const [key, value] = labels[0].split('=');
    return [...this.containers.entries()].filter(([, c]) => c.labels[key] === value)
      .map(([id, c]) => ({ Id: id, Names: [`/${c.name}`], Image: c.image, State: c.running ? 'running' : 'exited', Labels: c.labels, Created: c.created }));
  }

  async inspect(id: string): Promise<IContainerInspect> {
    const c = this.containers.get(id)!;
    // A container made here reports what it was created with, as Docker does (the image env added).
    const looping = Boolean(c.body) && this.crashLoopNewFor === c.labels['com.docker.compose.service'];
    if (c.body) return { Id: id, Name: `/${c.name}`, State: { Running: c.running, ...(looping ? { Restarting: true } : {}) }, ...(looping ? { RestartCount: 3 } : {}), Config: { ...c.body, Env: [...(c.body.Env ?? []), 'NODE_VERSION=22'], Cmd: c.body.Cmd ?? ['node'], Hostname: id.slice(0, 12) },
      HostConfig: c.body.HostConfig ?? {}, NetworkSettings: { Networks: Object.fromEntries(Object.entries(c.body.NetworkingConfig?.EndpointsConfig ?? {})) } };
    const mode = this.networkModes[c.labels['com.docker.compose.service']];
    return { Id: id, Name: `/${c.name}`, State: { Running: c.running },
      Config: { Image: c.image, Env: c.env, Cmd: c.cmd, Labels: c.labels, Hostname: id.slice(0, 12) },
      HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, ...(mode ? { NetworkMode: mode } : {}) },
      // Docker reports the mode itself as the container's one network, with no aliases.
      NetworkSettings: { Networks: mode ? { [mode]: { Aliases: null } } : { site_framework: { Aliases: ['api', id.slice(0, 12)] }, site_proxy: { Aliases: ['api'] } } } };
  }

  async imageDefaults(): Promise<IImageDefaults> {
    return { Env: ['NODE_VERSION=22'], Cmd: ['node'], Entrypoint: null, WorkingDir: '/app' };
  }

  async hasImage(reference: string): Promise<boolean> { return this.images.has(reference); }

  async pull(repository: string, tag: string): Promise<string | null> {
    const ref = `${repository}:${tag}`;
    if (!this.published.has(ref)) return 'manifest unknown';
    this.images.add(ref);
    return null;
  }

  async createContainer(name: string, body: Record<string, any>): Promise<string> {
    if (this.byName(name)) throw new Error(`name ${name} in use`);
    // As Docker: a container on `none`, `host` or another container's network takes no endpoint settings.
    const mode = String(body.HostConfig?.NetworkMode ?? '');
    if ((['none', 'host'].includes(mode) || mode.startsWith('container:')) && Object.keys(body.NetworkingConfig?.EndpointsConfig ?? {}).length) {
      throw new Error(`invalid config for network ${mode}: invalid endpoint settings`);
    }
    const id = `c${this.next++}bbbbbbbbbbbb`;
    this.created.push({ name, body });
    this.containers.set(id, { name, image: body.Image, running: false, labels: body.Labels ?? {}, env: body.Env, cmd: body.Cmd, created: this.next, body });
    return id;
  }

  async connectNetwork(): Promise<void> {}

  async start(id: string): Promise<void> {
    const c = this.containers.get(id)!;
    if (c.body && this.failNewStartFor === c.labels['com.docker.compose.service']) throw new Error('exited with code 1');
    if (this.failStartFor && c.labels['com.docker.compose.service'] === this.failStartFor && c.image.endsWith(':v0.2.400')) throw new Error('exited with code 1');
    c.running = true;
  }

  async stop(id: string): Promise<void> {
    const c = this.containers.get(id)!;
    c.running = false;
    const service = c.labels['com.docker.compose.service'];
    const runningPeers = [...this.containers.values()].filter((o) => o.running && o.labels['com.docker.compose.service'] === service).length;
    this.stops.push({ name: c.name, runningPeers });
  }
  async rename(id: string, name: string): Promise<void> { this.containers.get(id)!.name = name; }
  async remove(id: string): Promise<void> { this.containers.delete(id); }
  async listImages(): Promise<string[]> { return [...this.images]; }
  async removeImage(reference: string): Promise<void> { this.images.delete(reference); }

  /** The api answers its health with the version of its image; a Next app answers 200; the db answers `psql`. */
  async exec(id: string, cmd: string[]): Promise<{ code: number; stdout: string }> {
    const c = this.containers.get(id)!;
    if (!c.running) return { code: 1, stdout: '' };
    if (cmd[0] === 'sh') return { code: 0, stdout: cmd[3].includes('deploy_mode') ? this.deployMode : String(this.appliedMigration) };
    if (c.labels['com.docker.compose.service'] !== 'api') return { code: 0, stdout: '200' };
    return { code: 0, stdout: `{"status":"ok","version":"${c.image.split(':v').pop()}"}` };
  }

  async logs(id: string): Promise<string> {
    const c = this.containers.get(id)!;
    return c.name.includes('migration-probe') ? `\n${ShippedMigration.MARKER}${JSON.stringify(this.shipped)}\n` : '[extension-host] listening on 3000';
  }

  async top(): Promise<{ Titles: string[]; Processes: string[][] }> { return { Titles: ['PID', 'UID'], Processes: [['1', '0']] }; }
  async memoryUsage(): Promise<number> { return 200 * 1024 * 1024; }
  async wait(): Promise<number> { return 0; }

  /** Only the api image is asked for its deploy folder; anything else has none. */
  async archive(id: string, path: string): Promise<Buffer> {
    const c = this.containers.get(id)!;
    if (!c.image.includes('framework-api:') || path !== '/app/deploy') throw new Error(`Could not find the file ${path} in container ${id}`);
    return TarFixture.build('deploy', this.releaseFiles);
  }
}
