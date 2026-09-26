import { describe, expect, it } from 'vitest';
import { ComposeFilesSync } from '@cli/services/deploy/compose-files-sync';
import { DeployService } from '@cli/services/deploy/deploy-service';

/** A shell that answers by command prefix and records what it was asked to run, in order. */
class ShellFixture {
  readonly ran: string[] = [];
  constructor(private readonly answers: Record<string, { code?: number; stdout?: string; stderr?: string }>) {}
  readonly run = async (command: string) => {
    this.ran.push(command);
    const key = Object.keys(this.answers).find((prefix) => command.startsWith(prefix));
    const answer = key ? this.answers[key] : {};
    return { code: answer.code ?? 0, stdout: answer.stdout ?? '', stderr: answer.stderr ?? '' };
  };
}

describe('ComposeFilesSync', () => {
  it('accepts only a release version, before anything reaches a shell', () => {
    expect(ComposeFilesSync.tag('v0.2.205')).toBe('v0.2.205');
    expect(ComposeFilesSync.tag('0.2.205')).toBe('v0.2.205');
    expect(() => ComposeFilesSync.tag('v0.2.205; rm -rf /')).toThrow('not a release version');
  });

  it("checks out the release's deploy files and says which changed", async () => {
    const shell = new ShellFixture({ 'git rev-parse': { stdout: 'true\n' }, 'git diff': { stdout: 'docker-compose.full-stack.yml\ndocker-compose.pdf.yml\n' } });
    expect(await new ComposeFilesSync(shell).sync('v0.2.206')).toEqual(['docker-compose.full-stack.yml', 'docker-compose.pdf.yml']);
    expect(shell.ran).toEqual([
      'git rev-parse --is-inside-work-tree',
      'git fetch --quiet origin tag v0.2.206',
      'git diff --name-only v0.2.206 -- .',
      'git checkout v0.2.206 -- .',
    ]);
  });

  it('leaves a directory that is not a checkout exactly as it is', async () => {
    const shell = new ShellFixture({ 'git rev-parse': { code: 128, stderr: 'not a git repository' } });
    expect(await new ComposeFilesSync(shell).sync('v0.2.206')).toBeNull();
    expect(shell.ran).toEqual(['git rev-parse --is-inside-work-tree']);
  });

  it('stops the deploy when the release cannot be fetched', async () => {
    const shell = new ShellFixture({ 'git rev-parse': { stdout: 'true' }, 'git fetch': { code: 1, stderr: 'network down' } });
    await expect(new ComposeFilesSync(shell).sync('v0.2.206')).rejects.toThrow('network down');
    expect(shell.ran).not.toContain('git checkout v0.2.206 -- .');
  });
});

describe('DeployService and the deploy files', () => {
  it('syncs the release before pulling, and puts the previous release back when the pull fails', async () => {
    const synced: string[] = [];
    let versionWritten = false;
    const stack: any = { pull: async () => 1 };
    const versions: any = { current: async () => '0.2.205', set: async () => { versionWritten = true; } };
    const service = new DeployService({ name: 'probe' } as any, {} as any, stack, versions, {} as any, undefined, { sync: async (v: string) => { synced.push(v); return []; } });

    expect(await service.deploy('0.2.206')).toBe(false);
    expect(synced).toEqual(['0.2.206', '0.2.205']);
    expect(versionWritten).toBe(false);
  });
});
