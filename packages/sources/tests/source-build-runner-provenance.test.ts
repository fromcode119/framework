import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionScope } from '@fromcode119/core';
import { SourceBuildRunner } from '@sources/packaging/source-build-runner';

/**
 * A build runs only a commit GitHub merged, unless the operator allowed otherwise — and a refusal is
 * recorded on the source's row, where the Sources screen shows it, like any failed build.
 */
describe('SourceBuildRunner — only what GitHub merged is built', () => {
  const dirs: string[] = [];
  afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true }); });

  /** A checkout whose HEAD is an ordinary, unsigned commit — what a push leaves, not a GitHub merge. */
  function pushedCheckout(): { dir: string; sha: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-runner-provenance-'));
    dirs.push(dir);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_AUTHOR_NAME: 'x', GIT_AUTHOR_EMAIL: 'x@x', GIT_COMMITTER_NAME: 'x', GIT_COMMITTER_EMAIL: 'x@x' } }).toString().trim();
    git('init', '-q');
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
    git('add', '.');
    git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'pushed');
    return { dir, sha: git('rev-parse', 'HEAD') };
  }

  function runner(allowUnverified: boolean, checkout: { dir: string; sha: string }) {
    const rows: any[] = [];
    const build = vi.fn(async () => ({ slug: 'demo', version: '1.0.0', fileName: null, manifest: {}, artifactSha256: null }));
    const provider = {
      fetch: vi.fn(async () => ({ directory: checkout.dir, revision: checkout.sha })),
      changesSince: vi.fn(async () => []),
    };
    const instance = new SourceBuildRunner(
      {} as any, { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, 'builds',
      { build } as any, { install: vi.fn() } as any, vi.fn(),
      () => provider as any, () => 'plugins', () => null,
      async () => allowUnverified,
    );
    (instance as any).upsertBuildRecord = vi.fn(async (_slug: string, _type: unknown, _url: string, _branch: string, values: any) => { rows.push(values); });
    return { instance, build, rows };
  }

  it('refuses a commit GitHub did not merge, builds nothing, and records why', async () => {
    const { instance, build, rows } = runner(false, pushedCheckout());
    const result = await instance.buildOne(ExtensionScope.PLUGIN, { slug: 'demo', gitUrl: 'https://github.com/o/demo.git', branch: 'main' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not signed/);
    expect(build).not.toHaveBeenCalled();
    expect(rows.at(-1)).toMatchObject({ last_build_status: 'failed' });
    expect(String(rows.at(-1).last_error)).toMatch(/Build commits not merged through GitHub/);
  });

  it('builds it when the operator allowed commits GitHub did not merge', async () => {
    const { instance, build } = runner(true, pushedCheckout());
    const result = await instance.buildOne(ExtensionScope.PLUGIN, { slug: 'demo', gitUrl: 'https://github.com/o/demo.git', branch: 'main' });

    expect(result.success).toBe(true);
    expect(build).toHaveBeenCalledTimes(1);
  });
});
