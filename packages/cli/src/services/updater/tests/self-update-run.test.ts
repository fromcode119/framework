import { describe, expect, it } from 'vitest';
import { SelfUpdateRun } from '@cli/services/updater/self-update-run';
import { InMemoryDockerEngine } from '@cli/services/updater/tests/in-memory-docker-engine';

const REG = 'ghcr.io/fromcode119/framework-';
const SERVICES = { api: 'api', 'extension-host': 'api', admin: 'admin', frontend: 'frontend', gateway: 'gateway', edge: 'gateway' } as const;

class Stack {
  engine = new InMemoryDockerEngine();
  version = 'v0.2.392';
  healthy = true;
  steps: string[] = [];
  constructor(tag = 'v0.2.392') {
    if (tag === 'latest') this.version = '';
    for (const [service, image] of Object.entries(SERVICES)) this.engine.add(service, `${REG}${image}:${tag}`);
    this.engine.add('db', 'postgres:16');
    for (const image of ['api', 'admin', 'frontend', 'gateway']) this.engine.published.add(`${REG}${image}:v0.2.400`);
  }
  run() {
    const file = { read: () => this.version, write: (v: string) => { this.version = v; }, clear: () => { this.version = ''; } };
    return new SelfUpdateRun(this.engine, { reports: async () => this.healthy }, file, 'site', (s) => this.steps.push(s)).run('0.2.392', '0.2.400');
  }
  imageOf(service: string) {
    return this.engine.byName(`site-${service}-1`)?.[1].image;
  }
}

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

  it('carries the deployment\'s settings but takes the new image\'s own defaults', async () => {
    const stack = new Stack();

    await stack.run();

    const api = stack.engine.created.find((c) => c.name === 'site-api-1')!.body;
    expect(api.Env).toEqual(['API_URL=x']);
    expect(api.Cmd).toEqual(['npm', 'start']);
    expect(api.HostConfig.RestartPolicy.Name).toBe('unless-stopped');
    expect(api.NetworkingConfig.EndpointsConfig.site_framework.Aliases).toEqual(['api']);
    expect(api.Hostname).toBeUndefined();
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
