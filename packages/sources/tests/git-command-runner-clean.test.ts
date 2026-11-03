import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitCommandRunner } from '@sources/providers/git/git-command-runner';

/**
 * A pull must not keep the previous build's output. Agent Bridge 0.2 dropped its admin UI; the
 * workspace kept the ignored src/ui/bundle.js from the 0.1 build and every later build failed.
 */
describe('pulling a source workspace', () => {
  const dirs: string[] = [];
  afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true }); });

  const temp = (): string => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-git-clean-test-')); dirs.push(dir); return dir; };
  const git = (cwd: string, ...args: string[]): void => { execFileSync('git', args, { cwd, stdio: 'ignore' }); };
  const write = (file: string, text: string): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

  it('removes ignored build output and keeps the dependency caches', async () => {
    const origin = temp();
    git(origin, 'init', '-q', '-b', 'main');
    write(path.join(origin, '.gitignore'), 'index.js\nsrc/ui/bundle.js\nnode_modules/\n.npm-cache/\n');
    write(path.join(origin, 'index.ts'), 'export {};\n');
    git(origin, 'add', '-A');
    git(origin, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one');

    const workspace = path.join(temp(), 'plugin');
    const url = `file://${origin}`;
    const runner = new GitCommandRunner({ warn: () => undefined });
    await runner.clone(url, 'main', workspace);
    write(path.join(workspace, 'index.js'), 'old build');
    write(path.join(workspace, 'src/ui/bundle.js'), 'old admin bundle');
    write(path.join(workspace, 'node_modules/dep/index.js'), 'installed');
    write(path.join(workspace, '.npm-cache/entry'), 'cached');

    await runner.pull(workspace, url, 'main');

    expect(fs.existsSync(path.join(workspace, 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(workspace, 'index.js'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'src/ui/bundle.js'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'node_modules/dep/index.js'))).toBe(true);
    expect(fs.existsSync(path.join(workspace, '.npm-cache/entry'))).toBe(true);
  });
});
