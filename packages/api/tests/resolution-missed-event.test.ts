import { HookEventUtils } from '@fromcode119/core';
import { SystemRuntimeController } from '@api/controllers/system/system-runtime-controller';

/**
 * A storefront 404 reaches a 404 log only through `resolution:missed`. The storefront marks its LAST
 * lookup before answering 404 with `missed=1`; every earlier lookup of the same request must stay
 * silent, or one visitor 404 would be logged several times.
 */
describe('resolution:missed', () => {
  const VISITOR = { referer: 'https://example.test/from', 'user-agent': 'Mozilla/5.0 Test' };

  const buildRuntime = (found: boolean) => ({
    resolution: {
      resolveSlug: vi.fn(async () => (found ? { type: 'pages', plugin: 'system', doc: { id: 1, slug: 'here' } } : null)),
    },
    manager: { hooks: { emit: vi.fn() } },
  });

  const buildRequest = (query: Record<string, string>) => ({
    query,
    get: (name: string) => VISITOR[name.toLowerCase() as keyof typeof VISITOR],
  });

  const buildResponse = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() });

  it('reports the visitor 404 with the path, referrer and browser', async () => {
    const runtime = buildRuntime(false);
    const res = buildResponse();

    await new SystemRuntimeController(runtime as any).resolveSlug(buildRequest({ slug: 'gone/page', missed: '1' }) as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(runtime.manager.hooks.emit).toHaveBeenCalledWith(HookEventUtils.HOOK_EVENTS.RESOLUTION_MISSED, {
      path: '/gone/page',
      referrer: VISITOR.referer,
      userAgent: VISITOR['user-agent'],
    });
  });

  it('stays silent on a speculative lookup that does not say it is the last one', async () => {
    const runtime = buildRuntime(false);

    await new SystemRuntimeController(runtime as any).resolveSlug(buildRequest({ slug: 'gone' }) as any, buildResponse() as any);

    expect(runtime.manager.hooks.emit).not.toHaveBeenCalled();
  });

  it('stays silent when the path resolves', async () => {
    const runtime = buildRuntime(true);

    await new SystemRuntimeController(runtime as any).resolveSlug(buildRequest({ slug: 'here', missed: '1' }) as any, buildResponse() as any);

    expect(runtime.manager.hooks.emit).not.toHaveBeenCalled();
  });
});
