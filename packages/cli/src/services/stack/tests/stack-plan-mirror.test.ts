import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackPlan } from '@cli/services/stack/stack-plan';

describe('StackPlan and the shared mirror', () => {
  let root: string;
  let framework: string;

  /** A tree shaped like the real one: the framework checkout two levels down, plugins beside it. */
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-mirror-')));
    framework = path.join(root, 'framework', 'Source');
    fs.mkdirSync(path.join(framework, 'deploy'), { recursive: true });
    fs.mkdirSync(path.join(framework, 'modules', 'core', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(framework, 'package.json'), JSON.stringify({ workspaces: ['modules/*'] }));
    fs.writeFileSync(
      path.join(framework, 'deploy', 'docker-compose.full-stack.yml'),
      ['services:', '  api:', '    volumes:', '      - ../plugins:/srv/plugins', ''].join('\n'),
    );
    execFileSync('git', ['init', '-q', framework]);

    const plugin = path.join(root, 'plugins', 'shop');
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({ slug: 'shop' }));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('mounts a plugin named from the mirror READ-ONLY, because it is not a change', () => {
    const mirrored = path.join(root, 'plugins', 'shop');
    const plan = new StackPlan({ name: 'demo', framework, plugins: [mirrored], version: 'v1.0.0', port: 8200 });

    expect(plan.overlay()).toContain(`${mirrored}:/srv/plugins/shop:ro`);
    expect(plan.mirroredPlugins()).toEqual([mirrored]);
  });

  it('keeps a plugin worktree outside the mirror writable', () => {
    const worktree = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-shop-wt-')));
    fs.writeFileSync(path.join(worktree, 'manifest.json'), JSON.stringify({ slug: 'shop' }));
    const plan = new StackPlan({ name: 'demo', framework, plugins: [worktree], version: 'v1.0.0', port: 8200 });

    expect(plan.overlay()).toContain(`${worktree}:/srv/plugins/shop\n`);
    expect(plan.mirroredPlugins()).toEqual([]);
    fs.rmSync(worktree, { recursive: true, force: true });
  });
});
