import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { AcmeChallengeType } from '@core/enums/acme-challenge-type.enum';
import { CloudflareChallengeRecord } from '@core/certificates/acme/providers/cloudflare/cloudflare-challenge-record';
import { CloudflareDnsProvider } from '@core/certificates/acme/providers/cloudflare/cloudflare-dns-provider';

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
 * TWO CHALLENGE TYPES. HTTP-01 answers through `AcmeChallengeStore`, unchanged from before. DNS-01
 * answers through `CloudflareDnsProvider` and is the only way to prove control of a WILDCARD name —
 * an authority can only validate `*.example.com` by asking DNS, never by asking a URL. TLS-ALPN-01
 * would still need a special handshake path in the gateway for no gain over the two above.
 */
export class AcmeClientAdapter {
  /** Bytes of the order flow we wait through before giving up, in the library's own units. */
  private static readonly TERMS_AGREED = true;
  private static readonly DNS_CHALLENGE_PREFIX = '_acme-challenge.';

  constructor(private readonly challenges: AcmeChallengeStore) {}

  /**
   * Obtain a certificate for one host, publishing and withdrawing the challenge around it.
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
    /** Defaults to 'http-01' — the pre-existing behaviour is untouched when this is omitted. */
    challengeType?: AcmeChallengeType;
    /** Extra names the CSR should cover, e.g. `['*.example.com']` for a wildcard order. */
    altNames?: readonly string[];
    /** Required when `challengeType` is 'dns-01'; ignored otherwise. */
    cloudflareToken?: string;
  }): Promise<{ certificatePem: string; privateKeyPem: string; accountUrl: string }> {
    const acme = await import('acme-client');
    const challengeType: AcmeChallengeType = input.challengeType ?? AcmeChallengeType.HTTP_01;

    const client = new acme.Client({
      directoryUrl: input.directoryUrl,
      accountKey: input.accountKeyPem,
      ...(input.accountUrl ? { accountUrl: input.accountUrl } : {}),
    });

    // Only ever widens the CSR when the caller actually asked for extra names — an http-01 order
    // with no altNames builds EXACTLY the single-name CSR it always has.
    const extraNames = (input.altNames ?? []).map((name) => String(name).toLowerCase()).filter((name) => name && name !== input.host);
    const [privateKey, csr] = await acme.crypto.createCsr(
      extraNames.length ? { commonName: input.host, altNames: extraNames } : { commonName: input.host },
    );

    if (challengeType === AcmeChallengeType.DNS_01 && !String(input.cloudflareToken || '').trim()) {
      throw new Error('DNS-01 was requested with no Cloudflare token configured.');
    }
    const dnsProvider = challengeType === AcmeChallengeType.DNS_01 ? new CloudflareDnsProvider(String(input.cloudflareToken)) : null;
    // Keyed by the challenge's own URL (unique per authorization/challenge per RFC 8555) so the
    // apex and wildcard authorizations — which publish under the SAME record name — each remove
    // only the specific record id they created.
    const dnsRecords = new Map<string, CloudflareChallengeRecord>();

    const certificatePem = await client.auto({
      csr,
      termsOfServiceAgreed: AcmeClientAdapter.TERMS_AGREED,
      ...(input.contactEmail ? { email: input.contactEmail } : {}),
      // Stated rather than left to the library's preference order. The library expects a raw
      // string here, not an Enum instance — `.value` is the boundary crossing.
      challengePriority: [challengeType.value],
      challengeCreateFn: async (authz: any, challenge: any, keyAuthorization: string) => {
        if (challengeType === AcmeChallengeType.DNS_01) {
          // RFC 8555: a wildcard authorization's identifier is the BASE name, with no "*." — the
          // apex and wildcard authorizations for one order therefore both resolve to the same
          // record name here, which is exactly the case `CloudflareDnsProvider` is built to answer
          // (ADD, never upsert).
          const zoneName = String(authz?.identifier?.value || input.host);
          const recordName = `${AcmeClientAdapter.DNS_CHALLENGE_PREFIX}${zoneName}`;
          const created = await dnsProvider!.createChallengeRecord(zoneName, recordName, keyAuthorization);
          dnsRecords.set(String(challenge.url || challenge.token), created);
          return;
        }
        await this.challenges.put(String(challenge.token), input.host, keyAuthorization);
      },
      challengeRemoveFn: async (_authz: any, challenge: any) => {
        if (challengeType === AcmeChallengeType.DNS_01) {
          const created = dnsRecords.get(String(challenge.url || challenge.token));
          if (created) await dnsProvider!.removeChallengeRecord(created);
          return;
        }
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
