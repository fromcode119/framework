import { describe, expect, it } from 'vitest';
import { PluginRouteRobotsHeaderMiddleware } from '@api/middlewares/plugin-route-robots-header-middleware';
import { RobotsConstants } from '@fromcode119/core/constants/robots.constants';

/**
 * A plugin route is an endpoint, not a document: asked directly, it must refuse indexing, so the long
 * address of a file that a plugin publishes at its proper place is not a second crawlable copy. The
 * storefront relaying that route as the site's own file is the one request that must stay unmarked,
 * because it forwards the plugin's X-Robots-Tag onto the public address.
 */
describe('PluginRouteRobotsHeaderMiddleware', () => {
  const run = async (requestHeaders: Record<string, string>) => {
    const sent: Record<string, string> = {};
    const req: any = { get: (name: string) => requestHeaders[name.toLowerCase()] };
    const res: any = { setHeader: (name: string, value: string) => { sent[name] = value; } };
    await new Promise<void>((resolve) => new PluginRouteRobotsHeaderMiddleware().middleware()(req, res, resolve as any));
    return sent;
  };

  it('refuses indexing on a direct request', async () => {
    expect(await run({})).toEqual({ [RobotsConstants.HEADER]: RobotsConstants.REFUSE });
  });

  it('leaves the response alone when the storefront is relaying it as the site\'s own file', async () => {
    expect(await run({ [RobotsConstants.PUBLIC_FILE_HEADER]: '1' })).toEqual({});
  });
});
