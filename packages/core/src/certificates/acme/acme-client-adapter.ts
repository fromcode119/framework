import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';

/**
 * The ONLY place this platform speaks ACME.
 *
 * Everything above it deals in "issue a certificate for this host" and never in orders,
 * authorizations, nonces or JWS. That boundary is the point: the protocol library is the one
 * dependency here with a real surface area, and confining it to one class means replacing it later
 * is one file rather than an archaeology exercise.
 *
 * The library is loaded with a DYNAMIC IMPORT so that merely importing core does not pull it in. It
 * is only ever reached from the issuance sweep, which runs in the api process; a build that bundles
 * core for anything else must not have to resolve it.
 *
 * HTTP-01 ONLY. DNS-01 would need each customer's DNS credentials, which is a different feature with
 * a different consent story, and TLS-ALPN-01 would need a special handshake path in the gateway for
 * no gain over a port-80 route that already has to exist.
 */
export class AcmeClientAdapter {
  /** Bytes of the order flow we wait through before giving up, in the library's own units. */
  private static readonly TERMS_AGREED = true;

  constructor(private readonly challenges: AcmeChallengeStore) {}

  /**
   * Obtain a certificate for one host, publishing and withdrawing the challenge token around it.
   *
   * Returns the chain and the key it was issued for. Throws with the authority's own problem detail
   * on failure — that text is stored verbatim and shown to the operator, because a paraphrase of
   * "CAA record forbids issuance" helps nobody.
   */
  async issue(input: {
    directoryUrl: string;
    accountKeyPem: string;
    accountUrl?: string;
    contactEmail?: string;
    host: string;
  }): Promise<{ certificatePem: string; privateKeyPem: string; accountUrl: string }> {
    const acme = await import('acme-client');

    const client = new acme.Client({
      directoryUrl: input.directoryUrl,
      accountKey: input.accountKeyPem,
      ...(input.accountUrl ? { accountUrl: input.accountUrl } : {}),
    });

    const [privateKey, csr] = await acme.crypto.createCsr({ commonName: input.host });

    const certificatePem = await client.auto({
      csr,
      termsOfServiceAgreed: AcmeClientAdapter.TERMS_AGREED,
      ...(input.contactEmail ? { email: input.contactEmail } : {}),
      // http-01 only, and stated rather than left to the library's preference order.
      challengePriority: ['http-01'],
      challengeCreateFn: async (_authz: any, challenge: any, keyAuthorization: string) => {
        await this.challenges.put(String(challenge.token), input.host, keyAuthorization);
      },
      challengeRemoveFn: async (_authz: any, challenge: any) => {
        await this.challenges.remove(String(challenge.token));
      },
    });

    return {
      certificatePem: String(certificatePem),
      privateKeyPem: privateKey.toString(),
      accountUrl: String(client.getAccountUrl() || input.accountUrl || ''),
    };
  }

  /** A fresh account key, for the first order against an authority we have no account with. */
  static async createAccountKey(): Promise<string> {
    const acme = await import('acme-client');
    return (await acme.crypto.createPrivateKey()).toString();
  }
}
