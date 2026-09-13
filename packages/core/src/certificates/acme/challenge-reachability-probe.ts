import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { randomBytes } from 'crypto';

/**
 * Can the outside world actually reach our challenge path for this host — asked before an order,
 * never after.
 *
 * DNS pointing here is necessary and not sufficient. The request still has to survive whatever sits
 * in front of the platform: an edge that redirects port 80 to HTTPS, a router that never got the
 * challenge rule, a firewall. Every one of those makes the authority's validation fail, and each
 * failure spends part of a budget of five per hostname per hour.
 *
 * So the platform proves the path works by asking itself first, over plain HTTP, exactly the way the
 * authority will. It costs one local request and nothing at the authority.
 */
export class ChallengeReachabilityProbe {
  private static readonly TIMEOUT_MS = 5000;
  private static readonly PATH = '/.well-known/acme-challenge/';

  constructor(
    private readonly challenges: AcmeChallengeStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * Whether `http://<host>/.well-known/acme-challenge/<token>` returns what we just published.
   *
   * Returns a reason on failure, '' on success. The reason is stored verbatim, because "unreachable"
   * and "answered 301" send an operator to completely different places.
   */
  async check(host: string): Promise<string> {
    const token = `probe-${randomBytes(16).toString('hex')}`;
    const expected = `${token}.probe`;

    await this.challenges.put(token, host, expected);
    try {
      const url = `http://${host}${ChallengeReachabilityProbe.PATH}${token}`;
      const response = await this.fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(ChallengeReachabilityProbe.TIMEOUT_MS),
      });

      if (response.status >= 300 && response.status < 400) {
        // The common one, and invisible from inside: an edge redirecting every plain-HTTP request to
        // HTTPS takes the challenge with it, and the authority does not follow to a certificate that
        // does not exist yet.
        return `the challenge path answered ${response.status} (redirected) — port 80 must serve `
          + `${ChallengeReachabilityProbe.PATH} directly`;
      }
      if (!response.ok) return `the challenge path answered ${response.status}`;

      const body = (await response.text()).trim();
      if (body !== expected) return 'the challenge path answered something else — another service is serving it';
      return '';
    } catch (error: any) {
      return `the challenge path could not be reached: ${error?.message || error}`;
    } finally {
      await this.challenges.remove(token);
    }
  }
}
