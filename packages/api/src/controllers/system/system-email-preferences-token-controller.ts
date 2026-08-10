import type { Request } from 'express';
import { EmailPreferencesTokenService, MetaContextProxy, SigningSecretService } from '@fromcode119/core';
import { SystemEmailPreferencesController } from '@api/controllers/system/system-email-preferences-controller';

/**
 * The same preferences surface, for someone arriving from a link in an email instead of a session.
 *
 * Most recipients have no account at all, so the account panel cannot be the only way to change what
 * you receive. The signed token IS the credential, exactly as it is on every unsubscribe link the
 * platform issues.
 *
 * It subclasses rather than copies deliberately. Listing the declared categories, refusing an unknown
 * key and flipping a suppression are identical in both surfaces; the ONLY thing that differs is who the
 * request is acting for. Duplicating the controller would mean two places to forget a rule — the
 * eleven-migration-services mistake — and the rule most costly to forget here is that the address never
 * comes from the request body.
 */
export class SystemEmailPreferencesTokenController extends SystemEmailPreferencesController {
  /**
   * The address inside the token, or `''` for anything that does not verify — which the base class
   * turns into a 401.
   *
   * `req.query.token` for the GET and `req.body.token` for the POST. Nothing else on the request is
   * consulted: an `address` field in the body is ignored, so a caller cannot aim this at a stranger.
   */
  protected async resolveAddress(req: Request): Promise<string> {
    const token = String((req.query as any)?.token || (req.body as any)?.token || '').trim(); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!token) return '';

    try {
      const meta = MetaContextProxy.createMetaProxy(this.manager);
      const secret = await SigningSecretService.signingKey(meta, EmailPreferencesTokenService.PURPOSE);
      return EmailPreferencesTokenService.resolveAddress(token, secret) || '';
    } catch {
      // A signing key that cannot be resolved means "cannot verify", which must read as "reject".
      return '';
    }
  }

  protected get suppressionSource(): string {
    return 'email-preferences-link';
  }
}
