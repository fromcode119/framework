import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { DeploymentVersionStore } from '@cli/services/deploy/deployment-version-store';

/** Runs the store's commands in a real shell, in a scratch directory standing in for the target. */
class LocalShell {
  constructor(private readonly dir: string) {}
  async run(command: string) {
    try {
      return { code: 0, stdout: execSync(command, { cwd: this.dir, shell: '/bin/sh' }).toString(), stderr: '' };
    } catch (error: any) {
      return { code: error.status ?? 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') };
    }
  }
  async runOrThrow(command: string) {
    const result = await this.run(command);
    if (result.code !== 0) throw new Error(result.stderr);
    return result.stdout;
  }
}

/** A box the deploy CLI manages must not also be updated by the platform's updater service. */
describe('DeploymentVersionStore.handUpdatesToThisCli', () => {
  const dirs: string[] = [];
  const target = (env: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-target-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, '.env'), env);
    return { dir, store: new DeploymentVersionStore(new LocalShell(dir) as any), read: () => fs.readFileSync(path.join(dir, '.env'), 'utf8') };
  };
  afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('turns the updater off on a target whose .env says nothing about it', async () => {
    const { store, read } = target('VERSION=v0.2.392\n');
    await store.handUpdatesToThisCli();
    expect(read()).toBe('VERSION=v0.2.392\nATLANTIS_UPDATER=off\n');
  });

  it('adds it on its own line when the file has no final newline', async () => {
    const { store, read } = target('VERSION=v0.2.392');
    await store.handUpdatesToThisCli();
    expect(read()).toBe('VERSION=v0.2.392\nATLANTIS_UPDATER=off\n');
  });

  it('leaves an operator\'s explicit choice alone, and adds nothing twice', async () => {
    const { store, read } = target('VERSION=v0.2.392\nATLANTIS_UPDATER=on\n');
    await store.handUpdatesToThisCli();
    await store.handUpdatesToThisCli();
    expect(read()).toBe('VERSION=v0.2.392\nATLANTIS_UPDATER=on\n');
  });
});
