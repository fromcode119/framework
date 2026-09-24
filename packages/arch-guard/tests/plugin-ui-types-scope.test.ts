import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginUiTypesCommand } from '../src/cli/plugin-ui-types-command';
import { PluginUiTypecheck } from '../src/plugin-ui-typecheck';
import { GuardScope } from '../src/cli/guard-scope';

/**
 * A scoped run type-checks the directory it was pointed at. It used to look the scope's NAME up under
 * `<repo>/plugins`, so a worktree or second checkout of a plugin was reported clean on the strength of
 * the main checkout's copy — and a scope matching no plugin (any theme) checked every plugin instead.
 */
describe('plugin-ui-types scope selection', () => {
  let tmp = '';
  const dir = (...parts: string[]): string => {
    const full = path.join(tmp, ...parts);
    mkdirSync(full, { recursive: true });
    return full;
  };
  const select = (repo: string): string[] => {
    const byName = new Map(PluginUiTypecheck.pluginDirs(repo).map((d) => [path.basename(d), d]));
    return (PluginUiTypesCommand as any).select(repo, [], byName);
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('checks the scoped directory, not the same-named plugin in the repo', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'ui-types-scope-'));
    dir('repo', 'plugins', 'alpha', 'src', 'ui');
    const worktree = path.dirname(path.dirname(dir('elsewhere', 'plugins', 'alpha', 'src', 'ui')));
    vi.stubEnv(GuardScope.ENV, worktree);
    expect(select(path.join(tmp, 'repo'))).toEqual([worktree]);
  });

  it('checks nothing for a scoped extension without an admin UI', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'ui-types-scope-'));
    dir('repo', 'plugins', 'alpha', 'src', 'ui');
    vi.stubEnv(GuardScope.ENV, dir('repo', 'themes', 'beta'));
    expect(select(path.join(tmp, 'repo'))).toEqual([]);
  });
});
