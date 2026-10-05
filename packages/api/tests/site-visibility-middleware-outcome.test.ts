import { describe, expect, it } from 'vitest';
import { ApiOutcomeCounter } from '@fromcode119/core';
import { SiteVisibilityMiddleware } from '@api/server/site-visibility-middleware';

/** A private site's 503 is its answer: the monitor must not read crawler visits as the api failing. */
describe('SiteVisibilityMiddleware outcome', () => {
  const response = (): any => {
    const res: any = { headers: {} as Record<string, string> };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.set = (name: string, value: string) => { res.headers[name] = value; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
  };
  const run = async (allows: boolean) => {
    const logger: any = { error: () => undefined };
    const middleware = new SiteVisibilityMiddleware({ allows: async () => allows } as any, logger).middleware();
    const res = response();
    let passed = false;
    middleware({ tenant: { id: 'acme' }, tenantSurface: 'storefront', headers: { host: 'acme.test' } }, res, () => { passed = true; });
    await new Promise((resolve) => setImmediate(resolve));
    return { res, passed };
  };

  it('marks the refusal of a private site as deliberate', async () => {
    const { res, passed } = await run(false);
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(ApiOutcomeCounter.isRefusal(res)).toBe(true);
  });

  it('leaves a request it lets through unmarked', async () => {
    const { res, passed } = await run(true);
    expect(passed).toBe(true);
    expect(ApiOutcomeCounter.isRefusal(res)).toBe(false);
  });
});
