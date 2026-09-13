import express from 'express';
import { AcmeChallengeStore, RouteConstants } from '@fromcode119/core';

/**
 * `GET /.well-known/acme-challenge/:token` — how a certificate authority proves a host is ours.
 *
 * PUBLIC AND UNAUTHENTICATED, which is the protocol rather than an oversight. The authority arrives
 * as an anonymous stranger over plain HTTP, from an address we cannot predict, and the ability to
 * answer with the right value is itself the proof of control. There is nothing to protect: the
 * response is a random token paired with a hash of our account key, useful to nobody else.
 *
 * MOUNTED AT THE ROOT OF EVERY HOST, not under the api's versioned base, because the authority
 * requests exactly this path. It is also exempt from tenant resolution — the hosts that need it most
 * are the ones that have no tenant yet, and answering `unknown_host` to this request is answering it
 * to the one call that would let the host become known.
 *
 * An unknown or expired token is a plain 404. Saying anything more would tell a stranger which
 * tokens this platform is currently waiting on.
 */
export class AcmeChallengeRouter {
  static readonly MOUNT_PATH = RouteConstants.SEGMENTS.ACME_CHALLENGE;

  readonly router = express.Router();

  constructor(private readonly challenges: AcmeChallengeStore) {
    this.router.get('/:token', (req, res) => { void this.answer(req, res); });
  }

  private async answer(req: express.Request, res: express.Response): Promise<void> {
    // Never cached: a token is answered once, by one authority, within seconds of being published.
    res.setHeader('Cache-Control', 'no-store');

    const keyAuthorization = await this.challenges.find(String(req.params.token ?? ''));
    if (!keyAuthorization) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }

    // The protocol requires the bare value, as `application/octet-stream` or text — never JSON.
    res.status(200).type('text/plain').send(keyAuthorization);
  }
}
