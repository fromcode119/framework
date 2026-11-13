import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { DeployService } from '@cli/services/deploy/deploy-service';
import { DeploymentLock } from '@cli/services/deploy/deployment-lock';
import { RemoteDeploymentLock } from '@cli/services/deploy/remote-deployment-lock';
import { LocalDeploymentLock } from '@cli/services/updater/local-deployment-lock';

/** A shell that really runs in a temporary folder, so the lock's own commands are what is tested. */
class FolderShell {
  readonly directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-lock-'));

  async run(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const { spawnSync } = await import('child_process');
    const result = spawnSync('sh', ['-c', `cd ${this.directory} && ${command}`], { encoding: 'utf8' });
    return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
  }
}

describe('DeploymentLock', () => {
  it('names the holder of a fresh mark and nobody for an abandoned or unreadable one', () => {
    expect(DeploymentLock.holder(DeploymentLock.line(DeploymentLock.CLI, 1000), 1060)).toBe(DeploymentLock.CLI);
    expect(DeploymentLock.holder(DeploymentLock.line(DeploymentLock.CLI, 1000), 1001 + DeploymentLock.STALE_SECONDS)).toBe('');
    expect(DeploymentLock.holder('', 1000)).toBe('');
    expect(DeploymentLock.holder('garbage', 1000)).toBe('');
  });

  it('lets the deploy command and the updater exclude each other in one folder, both ways', async () => {
    const shell = new FolderShell();
    const cli = new RemoteDeploymentLock(shell);
    const updater = new LocalDeploymentLock(shell.directory);

    expect(await cli.acquire()).toBe('');
    expect(updater.acquire()).toBe(DeploymentLock.CLI);
    await cli.release();

    expect(updater.acquire()).toBe('');
    expect(await cli.acquire()).toBe(DeploymentLock.UPDATER);
    updater.release();
    expect(await cli.acquire()).toBe('');
  });

  it('takes over a mark its owner abandoned', async () => {
    const shell = new FolderShell();
    const long = Math.floor(Date.now() / 1000) - DeploymentLock.STALE_SECONDS - 5;
    fs.writeFileSync(path.join(shell.directory, DeploymentLock.FILE), `${DeploymentLock.line(DeploymentLock.UPDATER, long)}\n`);

    expect(await new RemoteDeploymentLock(shell).acquire()).toBe('');
  });
});

describe('DeployService and another deployer', () => {
  it('changes nothing while the updater holds the folder', async () => {
    let touched = 0;
    const touch = async () => { touched += 1; return '' as any; };
    const service = new DeployService(
      { name: 'box' } as any, {} as any,
      { pull: touch, up: touch } as any,
      { current: touch, set: touch } as any,
      { waitFor: touch } as any,
      undefined,
      { sync: touch },
      { acquire: async () => DeploymentLock.UPDATER, release: touch },
    );

    expect(await service.deploy('v0.2.573')).toBe(false);
    expect(touched).toBe(0);
  });
});

describe('ComposeStack.straysFrom', () => {
  it('finds a container of a rolled service left on another version, and leaves the rest alone', () => {
    const listing = [
      'aaa|deploy-api-370|ghcr.io/fromcode119/framework-api:v0.2.572|api',
      'bbb|deploy-api-371|ghcr.io/fromcode119/framework-api:v0.2.571|api',
      'ccc|deploy-edge-1|ghcr.io/fromcode119/framework-gateway:v0.2.530|edge',
      'ddd|deploy-db-1|postgres:16|db',
    ].join('\n');

    expect(ComposeStack.straysFrom(listing, ['api', 'admin'], 'v0.2.572')).toEqual([
      { id: 'bbb', name: 'deploy-api-371', image: 'ghcr.io/fromcode119/framework-api:v0.2.571' },
    ]);
  });
});
