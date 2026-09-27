import { describe, expect, it } from 'vitest';
import { execFile } from 'child_process';
import path from 'path';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';
import { DeployService } from '@cli/services/deploy/deploy-service';

/**
 * The deploy decides from what `docker compose` says about the RELEASE's own files — so these run the
 * real compose against `deploy/`, not a fixture. A fixture that listed `edge` is how the release that
 * introduced it shipped a deploy that could not see it: compose leaves a service behind a profile out of
 * `config --services`, and `gateway` and `edge` both are.
 */
class LocalShell {
  constructor(private readonly cwd: string) {}
  readonly run = (command: string) => new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile('sh', ['-c', command], { cwd: this.cwd, env: { ...process.env, VERSION: 'v0.0.0' } }, (error, stdout, stderr) => {
      resolve({ code: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr });
    });
  });
}

describe('ComposeStack against the real deploy files', () => {
  const stack = new ComposeStack(new LocalShell(path.resolve(__dirname, '../../../deploy')) as any);

  it('sees the services behind a profile — the edge and the gateway', async () => {
    expect(await stack.declared([ComposeStack.EXTENSION_HOST, ComposeStack.EDGE, 'gateway'])).toEqual([ComposeStack.EXTENSION_HOST, ComposeStack.EDGE, 'gateway']);
    expect(await stack.services()).toEqual(expect.arrayContaining(['api', 'admin', 'frontend', 'gateway', ComposeStack.EDGE, ComposeStack.EXTENSION_HOST]));
  }, 30_000);
});

describe('ComposeStack.reachable', () => {
  it('reaches a wildcard bind on loopback and refuses an unpublished port', () => {
    expect(ComposeStack.reachable('0.0.0.0:80')).toBe('127.0.0.1:80');
    expect(ComposeStack.reachable('[::]:443')).toBe('[::1]:443');
    expect(ComposeStack.reachable('127.0.0.1:8085')).toBe('127.0.0.1:8085');
    expect(ComposeStack.reachable(':0')).toBeNull();
    expect(ComposeStack.reachable('')).toBeNull();
  });
});

describe('ReleaseHealthProbe', () => {
  const stackAnswering = (publicAddress: string | null, status: string): any => ({
    health: async () => '{"version":"0.2.210"}',
    publicAddress: async () => publicAddress,
    publicStatus: async () => status,
  });
  const probe = (stack: any) => new ReleaseHealthProbe(stack, 50, async () => undefined);

  it('is not satisfied by the api alone while nothing answers on the public address', async () => {
    expect(await probe(stackAnswering('127.0.0.1:80', '000')).waitFor('v0.2.210')).toBe(false);
    expect(await probe(stackAnswering(null, '')).waitFor('v0.2.210')).toBe(false);
  });

  it('accepts any HTTP answer on the public address once the api reports the version', async () => {
    expect(await probe(stackAnswering('127.0.0.1:80', '301')).waitFor('v0.2.210')).toBe(true);
  });
});

describe('DeployService rollback to a release without the edge', () => {
  it('stops the edge so the older gateway can take the ports back', async () => {
    const stopped: string[] = [];
    let declaresEdge = true;
    const stack: any = {
      pull: async () => 0,
      query: async () => 'restart',
      containerIds: async (service: string) => service === ComposeStack.EDGE ? ['edge-1'] : [],
      declared: async (services: string[]) => services.filter((service) => service !== ComposeStack.EDGE || declaresEdge),
      stopAndRemove: async (id: string) => { stopped.push(id); return 0; },
      up: async () => 0,
      apiLogs: async () => '',
    };
    const versions: any = { current: async () => 'v0.2.209', set: async () => undefined };
    let probes = 0;
    const probe: any = { waitFor: async () => ++probes > 1 };
    const sync = async (version: string) => { declaresEdge = version !== 'v0.2.209'; return []; };
    const service = new DeployService({ name: 'probe' } as any, {} as any, stack, versions, probe, undefined, { sync });

    expect(await service.deploy('v0.2.210')).toBe(false);
    expect(stopped).toEqual(['edge-1']);
  });
});
