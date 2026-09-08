import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpDeployTools } from '@api/controllers/mcp/tools/mcp-deploy-tools';

const buildDeps = () => ({
  db: {},
  mediaManager: {} as any,
  hooks: { call: vi.fn(async () => ({})) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
});

const restartTool = (deps: any) => McpDeployTools.all(deps).find((t) => t.tool === 'deploy.restart')!;

/**
 * `ProcessRestartService.scheduleExit` refuses to schedule a real `process.exit` while
 * `NODE_ENV === 'test'`, so a suite can never take its own runner down. Vitest sets that, which means
 * the production path — answer first, exit after a delay — is unreachable unless a test opts out of
 * the guard for its own duration. Mocking `process.exit` is not enough: the guard returns before the
 * timer is ever created.
 */
function withProductionEnv<T>(run: () => T): T {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
}

describe('McpDeployTools.deploy.restart', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('carries its OWN permission so system:manage alone cannot restart the server', () => {
    const tool = restartTool(buildDeps());
    expect(tool.permission).toBe('system:deploy:restart');
    expect(tool.readOnly).toBe(false);
    expect(tool.inputSchema).toBeTruthy();
  });

  it('answers first and exits after a delay, so the caller receives the response', async () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const deps = buildDeps();

    const result: any = await withProductionEnv(() => restartTool(deps).handler({}, {}));

    // The whole point of the delay: the HTTP response is already on its way out before the exit.
    expect(result.restarting).toBe(true);
    expect(result.exitInMs).toBeGreaterThan(0);
    expect(exit).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(exit).toHaveBeenCalledWith(0);
  });

  /**
   * The guard is what keeps a `deploy.restart` in a suite from killing the runner, so it is worth
   * pinning: it must REFUSE rather than quietly report a restart that never happens, and it must say
   * why — a silent `restarting: false` would read to an operator as an unexplained failure.
   */
  it('refuses to exit the process while NODE_ENV=test, and says so', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    const result: any = await restartTool(buildDeps()).handler({}, {});

    expect(process.env.NODE_ENV).toBe('test');
    expect(result.restarting).toBe(false);
    expect(String(result.reason)).toMatch(/NODE_ENV=test/);
    expect(exit).not.toHaveBeenCalled();
  });

  it('refuses an app it does not know, listing what it does support', async () => {
    const result: any = await restartTool(buildDeps()).handler({ app: 'database' }, {});

    expect(result.error).toMatch(/database/);
    expect(result.supported).toContain('all');
  });
});
