import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SelfUpdateRun } from '@cli/services/updater/self-update-run';
import { InMemoryDockerEngine } from '@cli/services/updater/tests/in-memory-docker-engine';
import { RollingDeploy } from '@cli/services/deploy/rolling-deploy';
import { ComposeDirectory } from '@cli/services/updater/compose/compose-directory';
import { EnvVersionFile } from '@cli/services/updater/env-version-file';
import { DeployFolderFixture } from '@cli/services/updater/tests/deploy-folder-fixture';

const REG = 'ghcr.io/fromcode119/framework-';
const SERVICES = { api: 'api', 'extension-host': 'api', admin: 'admin', frontend: 'frontend', gateway: 'gateway', edge: 'gateway' } as const;

class Stack {
  engine = new InMemoryDockerEngine();
  /** The deployment folder: the older compose files, and an `.env` naming the version that runs. */
  folder: string;
  healthy = true;
  steps: string[] = [];
  /** What had been created each time the api's health was asked. */
  createdAtHealth: string[][] = [];
  availableBytes = 8 * 1024 ** 3;
  constructor(tag = 'v0.2.392') {
    this.folder = DeployFolderFixture.older(tag === 'latest' ? '' : tag);
    for (const [service, image] of Object.entries(SERVICES)) this.engine.add(service, `${REG}${image}:${tag}`);
    this.engine.add('db', 'postgres:16');
    for (const image of ['api', 'admin', 'frontend', 'gateway']) this.engine.published.add(`${REG}${image}:v0.2.400`);
  }
  run() {
    const rolling = (stack: any) => new RollingDeploy(stack, async () => undefined, 0, 0);
    return new SelfUpdateRun(this.engine, { reports: async () => { this.createdAtHealth.push(this.engine.created.map((c) => c.name)); return this.healthy; } },
      new EnvVersionFile(path.join(this.folder, '.env')), new ComposeDirectory(this.folder), 'site', (s) => this.steps.push(s), rolling, () => this.availableBytes)
      .run('0.2.392', '0.2.400');
  }
  get version(): string {
    return new EnvVersionFile(path.join(this.folder, '.env')).read();
  }
  file(name: string): string {
    return fs.readFileSync(path.join(this.folder, name), 'utf8');
  }
  /** The create body of the newest container made for `service`, release-file probes aside. */
  body(service: string) {
    return [...this.engine.created].reverse().find((c) => c.name.startsWith(`site-${service}-`))!.body;
  }
  /** The image `service` serves on: its one running container (a rolled one has a new name), else by name. */
  imageOf(service: string) {
    const running = this.runningImages(service);
    return running.length === 1 ? running[0] : this.engine.byName(`site-${service}-1`)?.[1].image;
  }
  /** The images every running container of `service` is on. */
  runningImages(service: string) {
    return [...this.engine.containers.values()].filter((c) => c.running && c.labels['com.docker.compose.service'] === service).map((c) => c.image);
  }
}

describe('SelfUpdateRun — rolling, as the deploy command does', () => {
  const APPS = ['api', 'extension-host', 'admin', 'frontend', 'gateway'];
  const rollingStack = () => { const stack = new Stack(); stack.engine.deployMode = 'rolling'; return stack; };

  it('starts each new app beside the running one and stops the old one only after the new one answers', async () => {
    const stack = rollingStack();

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.steps.some((step) => step.startsWith('Deploy mode: rolling'))).toBe(true);
    for (const service of APPS) expect(stack.runningImages(service)).toEqual([`${REG}${SERVICES[service as keyof typeof SERVICES]}:v0.2.400`]);
    // Never a moment with no copy of an app running: each old one stopped while its replacement ran.
    const platformStops = stack.engine.stops.filter((stop) => APPS.some((service) => stop.name.startsWith(`site-${service}-`)));
    expect(platformStops.length).toBe(APPS.length);
    for (const stop of platformStops) expect(stop.runningPeers).toBeGreaterThanOrEqual(1);
    expect(stack.engine.byName('site-api-2')![1].labels['com.docker.compose.container-number']).toBe('2');
    expect(stack.runningImages('edge')).toEqual([`${REG}gateway:v0.2.392`]);
    expect(stack.version).toBe('v0.2.400');
  });

  it('names the new copy on the network by its service and its own name, configured as the release declares', async () => {
    const stack = rollingStack();

    await stack.run();

    const api = stack.engine.created.find((c) => c.name === 'site-api-2')!.body;
    expect(api.NetworkingConfig.EndpointsConfig.site_framework.Aliases).toEqual(['api', 'site-api-2']);
    expect(api.Labels['com.docker.compose.container-number']).toBe('2');
    expect(api.Env).toContain('JWT_SECRET=kept');
    expect(api.HostConfig.LogConfig.Type).toBe('journald');
  });

  it('adds a copy of a service on network_mode none without endpoint settings Docker refuses', async () => {
    const stack = rollingStack();
    stack.engine.add('site-extension-host', `${REG}api:v0.2.392`);
    stack.engine.networkModes['site-extension-host'] = 'none';

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.runningImages('site-extension-host')).toEqual([`${REG}api:v0.2.400`]);
    const copy = stack.engine.created.find((c) => c.name === 'site-site-extension-host-2')!.body;
    expect(copy.HostConfig.NetworkMode).toBe('none');
    expect(copy.NetworkingConfig).toBeUndefined();
  });

  it('restarts instead when the release runs a migration the serving release cannot run beside', async () => {
    const stack = rollingStack();
    stack.engine.appliedMigration = 53;

    const outcome = await stack.run();

    expect(outcome.state).toBe('succeeded');
    expect(stack.steps.find((step) => step.startsWith('Deploy mode:'))).toContain('migration 54');
    expect(stack.engine.byName('site-api-2')).toBeUndefined();
  });

  it('restarts instead when the machine has no room for a second copy', async () => {
    const stack = rollingStack();
    stack.availableBytes = 300 * 1024 ** 2;

    await stack.run();

    expect(stack.steps.find((step) => step.startsWith('Deploy mode:'))).toContain('not enough memory');
  });

  it('rolls the apps it already swapped back, with no gap either, when a new one will not start', async () => {
    const stack = rollingStack();
    stack.engine.failStartFor = 'admin';

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(outcome.error).toContain('v0.2.392 is serving again');
    for (const service of APPS) expect(stack.runningImages(service)).toEqual([`${REG}${SERVICES[service as keyof typeof SERVICES]}:v0.2.392`]);
    for (const stop of stack.engine.stops) expect(stop.runningPeers).toBeGreaterThanOrEqual(1);
    expect(stack.version).toBe('v0.2.392');
  });

  it('rolls back when the new version never reports itself healthy', async () => {
    const stack = rollingStack();
    stack.healthy = false;

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(stack.runningImages('api')).toEqual([`${REG}api:v0.2.392`]);
    expect(stack.version).toBe('v0.2.392');
  });

  it('rolls back to the containers the older compose files declare, and puts those files back', async () => {
    const stack = rollingStack();
    stack.healthy = false;

    await stack.run();

    const gateway = stack.body('gateway');
    expect(gateway.Image).toBe(`${REG}gateway:v0.2.392`);
    expect(gateway.HostConfig.Memory).toBe(256 * 1024 ** 2);
    expect(gateway.HostConfig.LogConfig.Type).toBe('json-file');
    expect(stack.file('docker-compose.full-stack.yml')).toBe(DeployFolderFixture.olderFullStack());
  });

  it('rolls back to a copy of what ran when the older compose files cannot be read', async () => {
    const stack = rollingStack();
    stack.healthy = false;
    fs.writeFileSync(path.join(stack.folder, 'docker-compose.full-stack.yml'), 'services: [');

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(stack.steps.some((step) => step.includes('a rollback would copy the running containers'))).toBe(true);
    expect(stack.runningImages('api')).toEqual([`${REG}api:v0.2.392`]);
    expect(stack.file('docker-compose.full-stack.yml')).toBe('services: [');
  });
});

describe('SelfUpdateRun', () => {
  it('moves every platform service to the new version, keeps the database and edge, and records the version', async () => {
    const stack = new Stack();

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    for (const service of ['api', 'extension-host', 'admin', 'frontend', 'gateway']) expect(stack.imageOf(service)).toMatch(/:v0\.2\.400$/);
    expect(stack.imageOf('edge')).toMatch(/:v0\.2\.392$/);
    expect(stack.imageOf('db')).toBe('postgres:16');
    expect(stack.version).toBe('v0.2.400');
    expect([...stack.engine.containers.values()].some((c) => c.name.endsWith('-previous'))).toBe(false);
    expect(stack.steps[0]).toContain('Downloading');
  });

  it('replaces a service on network_mode none in place without endpoint settings Docker refuses', async () => {
    const stack = new Stack();
    stack.engine.networkModes['extension-host'] = 'none';

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.imageOf('extension-host')).toBe(`${REG}api:v0.2.400`);
  });

  it('replaces the gateway only after the new api reports healthy, so TLS never meets an api still booting', async () => {
    const stack = new Stack();

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.createdAtHealth[0]).toEqual(expect.arrayContaining(['site-api-1', 'site-admin-1', 'site-frontend-1']));
    expect(stack.createdAtHealth[0].some((name) => name.startsWith('site-gateway-'))).toBe(false);
    expect(stack.imageOf('gateway')).toBe(`${REG}gateway:v0.2.400`);
  });

  it('rolls the gateway behind a running edge even when the apps restart, so the edge always has one to send to', async () => {
    const stack = new Stack();

    await stack.run();

    expect(stack.steps).toContain('Rolling the gateway behind the edge');
    expect(stack.runningImages('gateway')).toEqual([`${REG}gateway:v0.2.400`]);
    const gatewayStops = stack.engine.stops.filter((stop) => stop.name.startsWith('site-gateway-'));
    expect(gatewayStops.length).toBe(1);
    expect(gatewayStops[0].runningPeers).toBeGreaterThanOrEqual(1);
  });

  it('replaces the gateway in place, after the api, where no edge runs', async () => {
    const stack = new Stack();
    const [edgeId] = [...stack.engine.containers.entries()].find(([, c]) => c.labels['com.docker.compose.service'] === 'edge')!;
    stack.engine.containers.delete(edgeId);

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.steps).not.toContain('Rolling the gateway behind the edge');
    expect(stack.createdAtHealth[0]).not.toContain('site-gateway-1');
    expect(stack.engine.created.map((c) => c.name)).toContain('site-gateway-1');
    expect(stack.imageOf('gateway')).toBe(`${REG}gateway:v0.2.400`);
  });

  it('leaves the serving gateway untouched when the new api never reports healthy', async () => {
    const stack = new Stack();
    stack.healthy = false;

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(stack.engine.created.some((c) => c.name.startsWith('site-gateway-'))).toBe(false);
    expect(stack.imageOf('gateway')).toBe(`${REG}gateway:v0.2.392`);
  });

  it('builds each new container from the release\'s compose service, substituted from the deployment\'s .env', async () => {
    const stack = new Stack();

    await stack.run();

    const api = stack.engine.created.find((c) => c.name === 'site-api-1')!.body;
    expect(api.Image).toBe(`${REG}api:v0.2.400`);
    expect(api.Env).toEqual(expect.arrayContaining(['JWT_SECRET=kept', 'NODE_ENV=production', 'LOG_LEVEL=info', 'BUNDLED_DATABASE_HOST=db']));
    expect(api.Cmd).toEqual(['npm', 'run', 'start', '--workspace=@fromcode119/api']);
    expect(api.Entrypoint).toBeNull();
    expect(api.HostConfig.RestartPolicy.Name).toBe('unless-stopped');
    expect(api.HostConfig.Memory).toBe(2 * 1024 ** 3);
    expect(api.HostConfig.CapDrop).toEqual(['ALL']);
    expect(api.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    // Relative sources are the deployment folder on the HOST, where compose started the stack from.
    expect(api.HostConfig.Binds).toEqual(expect.arrayContaining(['/opt/apps/site/data:/app/data', 'site_extension_runtime:/run/fromcode', 'site_db_secrets:/run/fromcode-db:ro']));
    expect(api.NetworkingConfig.EndpointsConfig.site_framework.Aliases).toEqual(['api', 'site-api-1']);
    expect(api.Labels['com.docker.compose.project']).toBe('site');
    expect(api.Hostname).toBeUndefined();
  });

  it('brings a machine on an older compose file to the release\'s: files written, limits and log driver applied', async () => {
    const stack = new Stack();
    expect(stack.file('docker-compose.full-stack.yml')).toContain('256M');

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    expect(stack.file('docker-compose.full-stack.yml')).toBe(DeployFolderFixture.release().get('docker-compose.full-stack.yml')!.toString('utf8'));
    expect(stack.file('edge/haproxy/haproxy.cfg').length).toBeGreaterThan(0);
    expect(stack.file('.env')).toContain('JWT_SECRET=kept');
    expect(stack.steps.find((step) => step.startsWith('Deployment files from v0.2.400'))).toContain('docker-compose.full-stack.yml');
    const gateway = stack.body('gateway');
    expect(gateway.HostConfig.Memory).toBe(512 * 1024 ** 2);
    expect(gateway.HostConfig.LogConfig).toEqual({ Type: 'journald', Config: { tag: '{{.Name}}', labels: 'com.docker.compose.service' } });
    for (const service of ['api', 'extension-host', 'admin', 'frontend']) expect(stack.body(service).HostConfig.LogConfig.Type).toBe('journald');
  });

  it('puts the older compose files back with the containers when the new version never reports healthy', async () => {
    const stack = new Stack();
    stack.healthy = false;

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(stack.file('docker-compose.full-stack.yml')).toBe(DeployFolderFixture.olderFullStack());
    expect(fs.existsSync(path.join(stack.folder, 'edge'))).toBe(false);
    expect(stack.version).toBe('v0.2.392');
  });

  it('refuses, changing nothing, a release whose compose files set something it cannot apply', async () => {
    const stack = new Stack();
    const release = DeployFolderFixture.release();
    release.set('docker-compose.full-stack.yml', Buffer.from(release.get('docker-compose.full-stack.yml')!.toString('utf8')
      .replace('  api:\n', '  api:\n    healthcheck:\n      test: ["CMD", "true"]\n')));
    stack.engine.releaseFiles = release;

    const outcome = await stack.run();

    expect(outcome.state).toBe('failed');
    expect(outcome.error).toContain('"healthcheck"');
    expect(outcome.error).toContain('Nothing was changed');
    expect(stack.file('docker-compose.full-stack.yml')).toBe(DeployFolderFixture.olderFullStack());
    expect(stack.version).toBe('v0.2.392');
    expect(stack.engine.stops).toHaveLength(0);
  });

  it('refuses, changing nothing, a release image that ships no compose files', async () => {
    const stack = new Stack();
    stack.engine.releaseFiles = new Map([['DEPLOYMENT.md', Buffer.from('#')]]);

    const outcome = await stack.run();

    expect(outcome.state).toBe('failed');
    expect(outcome.error).toContain('ships no docker-compose.full-stack.yml');
    expect(stack.engine.stops).toHaveLength(0);
    expect([...stack.engine.containers.values()].some((c) => c.name.includes('release-files'))).toBe(false);
  });

  it('changes nothing when a new image cannot be downloaded', async () => {
    const stack = new Stack();
    stack.engine.published.delete(`${REG}frontend:v0.2.400`);

    const outcome = await stack.run();

    expect(outcome.state).toBe('failed');
    expect(outcome.error).toContain('Nothing was changed');
    expect(stack.imageOf('api')).toMatch(/:v0\.2\.392$/);
    expect(stack.version).toBe('v0.2.392');
    expect(stack.engine.created).toHaveLength(0);
  });

  it('puts everything back when a new container will not start', async () => {
    const stack = new Stack();
    stack.engine.failStartFor = 'admin';

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    for (const service of ['api', 'extension-host', 'admin', 'frontend', 'gateway']) {
      expect(stack.imageOf(service)).toMatch(/:v0\.2\.392$/);
      expect(stack.engine.byName(`site-${service}-1`)![1].running).toBe(true);
    }
    expect(stack.version).toBe('v0.2.392');
  });

  it('puts everything back when the new version never reports itself healthy', async () => {
    const stack = new Stack();
    stack.healthy = false;

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(outcome.error).toContain('v0.2.392 is serving again');
    expect(stack.imageOf('api')).toMatch(/:v0\.2\.392$/);
    expect(stack.version).toBe('v0.2.392');
  });

  it('does not download an image that is already on the machine', async () => {
    const stack = new Stack();
    stack.engine.images.add(`${REG}admin:v0.2.400`);
    stack.engine.published.delete(`${REG}admin:v0.2.400`);

    const outcome = await stack.run();

    expect(outcome.state).toBe('succeeded');
    expect(stack.steps.some((step) => step.includes('admin:'))).toBe(false);
  });

  it('removes images older than the one it replaced, never another project\'s images', async () => {
    const stack = new Stack();
    stack.engine.images.add(`${REG}api:v0.2.300`);
    stack.engine.images.add('redis:7');

    await stack.run();

    expect(stack.engine.images.has(`${REG}api:v0.2.300`)).toBe(false);
    expect(stack.engine.images.has(`${REG}api:v0.2.392`)).toBe(true);
    expect(stack.engine.images.has('redis:7')).toBe(true);
  });

  it('updates an install whose .env names no version and so runs every service on latest', async () => {
    const stack = new Stack('latest');

    const outcome = await stack.run();

    expect(outcome).toEqual({ state: 'succeeded', error: '' });
    for (const service of ['api', 'extension-host', 'admin', 'frontend', 'gateway']) expect(stack.imageOf(service)).toMatch(/:v0\.2\.400$/);
    expect(stack.imageOf('edge')).toMatch(/:latest$/);
    expect(stack.version).toBe('v0.2.400');
    expect(stack.engine.images.has(`${REG}api:latest`)).toBe(true);
  });

  it('leaves an unpinned install unpinned when it has to roll back', async () => {
    const stack = new Stack('latest');
    stack.healthy = false;

    const outcome = await stack.run();

    expect(outcome.state).toBe('rolledBack');
    expect(stack.imageOf('api')).toMatch(/:latest$/);
    expect(stack.version).toBe('');
  });
});
