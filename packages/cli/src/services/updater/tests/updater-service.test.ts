import path from 'path';
import { describe, expect, it } from 'vitest';
import { UpdaterService } from '@cli/services/updater/updater-service';
import { InMemoryDockerEngine } from '@cli/services/updater/tests/in-memory-docker-engine';
import { UpdaterHandover } from '@cli/services/updater/updater-handover';
import { ComposeDirectory } from '@cli/services/updater/compose/compose-directory';
import { EnvVersionFile } from '@cli/services/updater/env-version-file';
import { DeployFolderFixture } from '@cli/services/updater/tests/deploy-folder-fixture';

const REG = 'ghcr.io/fromcode119/framework-';

/** The api as the updater sees it: a plan, a place to report, and a health answer (`serving`). */
class FakeApi {
  reported: any[] = [];
  constructor(public next: { current: string; target: string; reason: string }, public serving: string) {}
  async plan() { return this.next; }
  async report(status: any) { this.reported.push(status); return true; }
  async reportUntilStored(status: any) { return this.report(status); }
  async reports(version: string) { return version.replace(/^v/, '') === this.serving; }
}

const setup = (serving: string) => {
  const engine = new InMemoryDockerEngine();
  for (const [service, image] of [['api', 'api'], ['admin', 'admin'], ['frontend', 'frontend'], ['gateway', 'gateway']]) {
    engine.add(service, `${REG}${image}:v0.2.391`);
    engine.published.add(`${REG}${image}:v0.2.392`);
  }
  const api = new FakeApi({ current: '0.2.391', target: '0.2.392', reason: 'automatic' }, serving);
  const folder = DeployFolderFixture.older('v0.2.391');
  const file = new EnvVersionFile(path.join(folder, '.env'));
  const directory = new ComposeDirectory(folder);
  return { engine, api, file, folder, directory, updater: new UpdaterService(engine, api as any, file, directory, 'site') };
};

/** The same, with the updater running as a container of the project on `updaterTag`. */
const withUpdater = (serving: string, updaterTag = 'v0.2.391') => {
  const base = setup(serving);
  const selfId = base.engine.add('updater', `${REG}gateway:${updaterTag}`);
  const updater = new UpdaterService(base.engine, base.api as any, base.file, base.directory, 'site', new UpdaterHandover(base.engine, 'site', selfId, base.folder));
  return { ...base, selfId, updater };
};
const updaters = (engine: InMemoryDockerEngine) =>
  [...engine.containers.entries()].filter(([, c]) => c.labels['com.docker.compose.service'] === 'updater');

describe('UpdaterService', () => {
  it('does not take again, automatically, a version that just rolled back', async () => {
    const { updater, engine, api } = setup('0.2.391');

    await updater.tick();
    const createdAfterFirst = engine.created.length;
    await updater.tick();

    expect(createdAfterFirst).toBeGreaterThan(0);
    expect(engine.created.length).toBe(createdAfterFirst);
    expect(api.reported.at(-1).state).toBe('rolledBack');
  });

  it('does try it again when an operator asks for it', async () => {
    const { updater, engine, api } = setup('0.2.391');
    await updater.tick();
    const createdAfterFirst = engine.created.length;

    api.next = { current: '0.2.391', target: '0.2.392', reason: 'requested' };
    await updater.tick();

    expect(engine.created.length).toBeGreaterThan(createdAfterFirst);
  });

  it('starts itself on the version it installed and stops acting', async () => {
    const { updater, engine, api } = withUpdater('0.2.392');

    await updater.tick();

    expect(api.reported.at(-1).state).toBe('succeeded');
    const running = updaters(engine).filter(([, c]) => c.running).map(([, c]) => `${c.name} ${c.image}`);
    expect(running).toEqual([`site-updater-1 ${REG}gateway:v0.2.391`, `site-updater-2 ${REG}gateway:v0.2.392`]);
    // Handed over: the old one no longer polls, even when a newer version is offered.
    api.next = { current: '0.2.392', target: '0.2.393', reason: 'requested' };
    const reports = api.reported.length;
    await updater.tick();
    expect(api.reported.length).toBe(reports);
  });

  it('starts its successor as the release\'s compose files declare the updater service', async () => {
    const { updater, engine } = withUpdater('0.2.392');

    await updater.tick();

    const successor = engine.created.find((c) => c.name === 'site-updater-2')!.body;
    expect(successor.Image).toBe(`${REG}gateway:v0.2.392`);
    expect(successor.Cmd).toEqual(['node', 'packages/cli/dist/bin.js', 'system', 'updater']);
    expect(successor.User).toBe('root');
    expect(successor.HostConfig.Binds).toEqual(expect.arrayContaining(['/var/run/docker.sock:/var/run/docker.sock', '/opt/apps/site/deploy:/app/deploy-project']));
  });

  it('retires the updater it replaced as it starts, before it acts', async () => {
    const { updater, engine, folder } = withUpdater('0.2.392');
    await updater.tick();
    const [successorId] = updaters(engine).find(([, c]) => c.name === 'site-updater-2')!;

    await new UpdaterService(engine, new FakeApi({ current: '0.2.392', target: '', reason: 'current' }, '0.2.392') as any, {} as any, new ComposeDirectory(folder), 'site',
      new UpdaterHandover(engine, 'site', successorId, folder)).retirePredecessors();

    expect(updaters(engine).map(([, c]) => `${c.name} ${c.image} ${c.running}`)).toEqual([`site-updater-2 ${REG}gateway:v0.2.392 true`]);
  });

  it('does not hand over after an update that rolled back', async () => {
    const { updater, engine, api } = withUpdater('0.2.391');

    await updater.tick();

    expect(api.reported.at(-1).state).toBe('rolledBack');
    expect(updaters(engine).map(([, c]) => c.name)).toEqual(['site-updater-1']);
  });

  it('does not start a second copy of an updater already on the installed version', async () => {
    const { updater, engine } = withUpdater('0.2.392', 'v0.2.392');

    await updater.tick();

    expect(updaters(engine).map(([, c]) => c.name)).toEqual(['site-updater-1']);
  });

  it('keeps the running updater in charge, and leaves no stray container, when its successor will not start', async () => {
    const { updater, engine, api } = withUpdater('0.2.392');
    const start = engine.start.bind(engine);
    engine.start = async (id: string) => {
      if (engine.containers.get(id)!.labels['com.docker.compose.service'] === 'updater') throw new Error('exited with code 1');
      return start(id);
    };

    await updater.tick();

    expect(updaters(engine).map(([, c]) => `${c.name} ${c.running}`)).toEqual(['site-updater-1 true']);
    api.next = { current: '0.2.392', target: '0.2.393', reason: 'automatic' };
    const reports = api.reported.length;
    await updater.tick();
    expect(api.reported.length).toBeGreaterThan(reports);
  });
});
