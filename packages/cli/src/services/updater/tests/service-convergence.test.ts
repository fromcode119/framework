import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ComposeContainerBody } from '@cli/services/updater/compose/compose-container-body';
import { ComposeProject } from '@cli/services/updater/compose/compose-project';
import { SelfUpdateRun } from '@cli/services/updater/self-update-run';
import { ServiceConvergence } from '@cli/services/updater/service-convergence';
import { DeployFolderFixture } from '@cli/services/updater/tests/deploy-folder-fixture';
import { InMemoryDockerEngine } from '@cli/services/updater/tests/in-memory-docker-engine';

const REG = 'ghcr.io/fromcode119/framework-';

/** A deployment already on v0.2.400 for its apps, with the release's own compose files in its folder. */
class Deployment {
  engine = new InMemoryDockerEngine();
  steps: string[] = [];
  readonly folder = fs.mkdtempSync(path.join(os.tmpdir(), 'convergence-'));

  constructor(env = '') {
    for (const [file, content] of DeployFolderFixture.release()) {
      fs.mkdirSync(path.dirname(path.join(this.folder, file)), { recursive: true });
      fs.writeFileSync(path.join(this.folder, file), content);
    }
    fs.writeFileSync(path.join(this.folder, '.env'), `VERSION=v0.2.400\n${env}`);
    this.engine.add('api', `${REG}api:v0.2.400`);
    for (const image of ['postgres:15-alpine', 'redis:7-alpine']) this.engine.published.add(image);
  }

  converge() {
    const release = new ComposeContainerBody(ComposeProject.load(this.folder, 'site'));
    return new ServiceConvergence(this.engine, release, [...SelfUpdateRun.SERVICES, 'updater'], (step) => this.steps.push(step), async () => undefined).run();
  }

  running(service: string) {
    return [...this.engine.containers.values()].filter((c) => c.running && c.labels['com.docker.compose.service'] === service);
  }
}

describe('ServiceConvergence — the services an update does not roll', () => {
  it('recreates the database on the release\'s settings, keeping its data volume, and removes the old one', async () => {
    const deployment = new Deployment();
    deployment.engine.add('db', 'postgres:15-alpine');

    expect(await deployment.converge()).toEqual([]);

    const [db] = deployment.running('db');
    expect(db.name).toBe('site-db-1');
    expect(db.body!.HostConfig.LogConfig.Type).toBe('journald');
    expect(db.body!.HostConfig.Memory).toBeGreaterThan(0);
    expect(db.body!.HostConfig.Binds.some((bind: string) => bind === 'site_postgres_data:/var/lib/postgresql/data')).toBe(true);
    expect([...deployment.engine.containers.values()].filter((c) => c.labels['com.docker.compose.service'] === 'db')).toHaveLength(1);
    expect(deployment.steps.some((step) => step.startsWith('Recreating db for its changed'))).toBe(true);
  });

  it('starts a service the release adds, under compose\'s labels, and runs a one-shot it never ran', async () => {
    const deployment = new Deployment();

    expect(await deployment.converge()).toEqual([]);

    expect(deployment.running('redis').map((c) => c.name)).toEqual(['site-redis-1']);
    expect(deployment.running('redis')[0].labels['com.docker.compose.project']).toBe('site');
    expect(deployment.engine.byName('site-db-secrets-1')).toBeTruthy();
    expect(deployment.steps).toContain('Starting redis, which the release adds');
  });

  it('leaves everything alone once it matches, and a one-shot that already ran', async () => {
    const deployment = new Deployment();
    await deployment.converge();
    const created = deployment.engine.created.length;

    expect(await deployment.converge()).toEqual([]);

    expect(deployment.engine.created.length).toBe(created);
  });

  it('puts back a service whose new container will not start, and reports it', async () => {
    const deployment = new Deployment();
    const old = deployment.engine.add('redis', 'redis:7-alpine');
    deployment.engine.failNewStartFor = 'redis';

    const problems = await deployment.converge();

    expect(problems).toEqual([expect.stringMatching(/^redis: exited with code 1/)]);
    expect(deployment.running('redis').map((c) => c.name)).toEqual(['site-redis-1']);
    expect(deployment.engine.containers.has(old)).toBe(true);
  });

  it('applies the edge\'s settings but keeps the version it runs, and only under its profile', async () => {
    const off = new Deployment();
    off.engine.add('edge', `${REG}gateway:v0.2.392`);
    await off.converge();
    expect(off.engine.created.some((c) => c.name.startsWith('site-edge'))).toBe(false);

    const on = new Deployment('COMPOSE_PROFILES=single-domain\n');
    on.engine.add('edge', `${REG}gateway:v0.2.392`);
    expect(await on.converge()).toEqual([]);

    const [edge] = on.running('edge');
    expect(edge.image).toBe(`${REG}gateway:v0.2.392`);
    expect(edge.body!.HostConfig.LogConfig.Type).toBe('journald');
  });

  it('holds the edge\'s command back with its image, so a release\'s command never runs on an image without it', async () => {
    const deployment = new Deployment('COMPOSE_PROFILES=single-domain\n');
    const old = deployment.engine.add('edge', `${REG}gateway:v0.2.392`);
    deployment.engine.containers.get(old)!.cmd = ['./node_modules/.bin/tsx', 'packages/cli/src/bin.ts', 'system', 'edge'];

    expect(await deployment.converge()).toEqual([]);

    const [edge] = deployment.running('edge');
    expect(edge.image).toBe(`${REG}gateway:v0.2.392`);
    expect(edge.body!.Cmd).toEqual(['./node_modules/.bin/tsx', 'packages/cli/src/bin.ts', 'system', 'edge']);
    expect(edge.body!.HostConfig.LogConfig.Type).toBe('journald');
  });

  it('puts back a service whose new container crash-loops, though Docker reports it running between restarts', async () => {
    const deployment = new Deployment();
    const old = deployment.engine.add('redis', 'redis:7-alpine');
    deployment.engine.crashLoopNewFor = 'redis';

    const problems = await deployment.converge();

    expect(problems).toEqual([expect.stringMatching(/^redis: the new container did not stay up/)]);
    expect(deployment.engine.containers.has(old)).toBe(true);
    expect(deployment.engine.containers.get(old)!.running).toBe(true);
  });
});
