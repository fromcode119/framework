import type express from 'express';
import { RobotsConstants } from '@fromcode119/core/constants/robots.constants';

/**
 * `X-Robots-Tag: noindex` on a plugin route that is requested directly.
 *
 * A plugin route (`/api/v1/plugins/<slug>/...`) is an endpoint, not a document. It still answers a
 * plain GET from anywhere, and `robots.txt` allows the whole site, so the address of a file that a
 * plugin also publishes at its proper place (`/.well-known/security.txt` is served from
 * `/api/v1/plugins/security/security.txt`) was crawlable under the long name as well, as a second copy.
 *
 * The one request that must NOT carry it is the storefront relaying that route as the site's own file:
 * it forwards the plugin's `X-Robots-Tag` to the public address, so a refusal stamped here would land on
 * `sitemap.xml` and `llms.txt`. The relay says so with `PUBLIC_FILE_HEADER`. Sending that header
 * from outside only spares the sender this header; it grants nothing.
 *
 * A route that sets its own `X-Robots-Tag` later in the chain still wins, since it runs after this.
 */
export class PluginRouteRobotsHeaderMiddleware {
  middleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      if (!req.get(RobotsConstants.PUBLIC_FILE_HEADER)) res.setHeader(RobotsConstants.HEADER, RobotsConstants.REFUSE);
      next();
    };
  }
}
