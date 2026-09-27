import { describe, expect, it, vi } from 'vitest';
import { ExtensionScope } from '@fromcode119/core';
import { SourceBuildRunner } from '@sources/packaging/source-build-runner';

/**
 * A source has one checkout directory. Two builds of it at once raced on that directory and one failed
 * with ENOTEMPTY (production, 2026-09-27). A second request for a source already building must join
 * the running build, never start a parallel one.
 */
describe('SourceBuildRunner — one build per source at a time', () => {
  const runnerWith = (fetch: () => Promise<unknown>) => {
    const runner: any = Object.create(SourceBuildRunner.prototype);
    runner.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    runner.runBuild = vi.fn(async (_type: ExtensionScope, entry: any) => { await fetch(); return { slug: entry.slug, type: _type, success: true, version: '1.0.0' }; });
    return runner as SourceBuildRunner & { runBuild: ReturnType<typeof vi.fn> };
  };

  it('a second request for the same source waits for the first and gets its result', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner = runnerWith(() => gate);
    const first = runner.buildOne(ExtensionScope.PLUGIN, { slug: 'appointments' });
    const second = runner.buildOne(ExtensionScope.PLUGIN, { slug: 'appointments' });
    release();
    expect(await first).toEqual(await second);
    expect(runner.runBuild).toHaveBeenCalledTimes(1);
  });

  it('different sources still build side by side, and a finished build does not block the next', async () => {
    const runner = runnerWith(async () => undefined);
    await Promise.all([runner.buildOne(ExtensionScope.PLUGIN, { slug: 'a' }), runner.buildOne(ExtensionScope.PLUGIN, { slug: 'b' })]);
    expect(runner.runBuild).toHaveBeenCalledTimes(2);
    await runner.buildOne(ExtensionScope.PLUGIN, { slug: 'a' });
    expect(runner.runBuild).toHaveBeenCalledTimes(3);
  });

  it('a failed build is not remembered: the next request builds again', async () => {
    const runner = runnerWith(async () => { throw new Error('remote unreachable'); });
    await expect(runner.buildOne(ExtensionScope.PLUGIN, { slug: 'x' })).rejects.toThrow('remote unreachable');
    runner.runBuild.mockImplementation(async () => ({ slug: 'x', success: true }));
    expect(await runner.buildOne(ExtensionScope.PLUGIN, { slug: 'x' })).toMatchObject({ success: true });
  });
});
