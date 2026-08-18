import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpDeployTools } from '../src/controllers/mcp/tools/mcp-deploy-tools';

const buildDeps = () => ({
  db: {},
  mediaManager: {} as any,
  hooks: { call: vi.fn(async () => ({})) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
});

const restartTool = (deps: any) => McpDeployTools.all(deps).find((t) => t.tool === 'deploy.restart')!;

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

    const result: any = await restartTool(deps).handler({}, {});
    expect(result.restarting).toBe(true);
    expect(exit).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(exit).toHaveBeenCalledWith(0);
  });
});
