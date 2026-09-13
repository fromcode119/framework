import express from 'express';
import { PlatformSettingsService, RouteConstants, SystemConstants } from '@fromcode119/core';

/**
 * `GET /robots.txt` for the PLATFORM's own hosts — the api host, and any host that reaches this
 * process without a tenant.
 *
 * The api said nothing to a crawler at all: no `robots.txt`, no `X-Robots-Tag`, no meta. It was
 * indexable by omission rather than by decision, which is the same failure the console already had
 * and fixed. What looked like protection in production was an EDGE rule (a header added in front of
 * the platform), so a deployment without that rule — anyone else's — had nothing.
 *
 * THE ANSWER IS AN OPERATOR SETTING, not a hardcoded refusal. It is the same switch the console
 * reads (`ADMIN_SEARCH_INDEXING`), because the platform has exactly two classes of host: a tenant's
 * site, whose indexability follows that site's own visibility, and the platform's own hosts, which
 * are this one and the console. One question, one control — a second key would be a toggle nobody
 * would ever set differently, and a hardcoded refusal would be a second answer to a question this
 * codebase has already answered once.
 *
 * FAIL-CLOSED by inheritance: `readFlag` treats unset and unreadable alike as `false`, so the
 * default and the error case both say "do not index". That direction is the safe one — a platform
 * briefly refusing a crawler costs nothing, while a platform briefly inviting one into an index is
 * not undone by any later correction.
 *
 * MOUNTED AT THE ROOT and exempt from tenant resolution: the hosts that need this answer are
 * precisely the ones with no tenant, and tenant resolution answers them `unknown_host`. The
 * exemption is an EXACT path match, so a tenant's own robots route is untouched.
 */
export class PlatformRobotsRouter {
  static readonly MOUNT_PATH = RouteConstants.SEGMENTS.ROBOTS;

  readonly router = express.Router();

  constructor() {
    this.router.get('/', (req, res) => { void PlatformRobotsRouter.answer(res); });
  }

  private static async answer(res: express.Response): Promise<void> {
    const indexable = await PlatformSettingsService.readFlag(
      SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING,
    );

    // Never cached. A cached answer outlives the setting that produced it, so an operator turning
    // indexing off would keep serving the old invitation for as long as the cache lived — and that
    // is the one direction that cannot be taken back.
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).type('text/plain').send(PlatformRobotsRouter.body(indexable));
  }

  /** The protocol's own text. A crawler reads these two lines and nothing else. */
  private static body(indexable: boolean): string {
    return `User-agent: *\n${indexable ? 'Allow' : 'Disallow'}: /\n`;
  }
}
