import { describe, expect, it } from 'vitest';
import { UpdaterService } from '@cli/services/updater/updater-service';
import { InMemoryDockerEngine } from '@cli/services/updater/tests/in-memory-docker-engine';

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
  let version = 'v0.2.391';
  const file = { read: () => version, write: (v: string) => { version = v; } } as any;
  return { engine, api, updater: new UpdaterService(engine, api as any, file, 'site') };
};

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
});
