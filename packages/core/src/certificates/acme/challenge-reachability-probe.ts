import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { randomBytes } from 'crypto';
import http from 'http';
import https from 'https';

/**
 * Can the outside world reach our challenge path for this host — asked before an order, never after.
 *
 * DNS pointing here is necessary and not sufficient. The request still has to survive whatever sits
 * in front of the platform, and every failure at the authority spends part of a budget of five per
 * hostname per hour. So the platform asks itself first, over plain HTTP, exactly the way the
 * authority will.
 *
 * "EXACTLY THE WAY" IS THE WHOLE POINT, and it is easy to get wrong in the strict direction. A
 * probe that refused a redirect looked prudent and was a bug: certificate authorities FOLLOW
 * http→https redirects during HTTP-01, so an edge that redirects port 80 to HTTPS — which is most of
 * them — validates perfectly well. Refusing it blocked issuance on a working deployment. A
 * pre-flight that is stricter than the thing it simulates does not prevent failures; it invents them.
 *
 * It also ignores certificate validity when it follows, because the authority does. That is not
 * laxness: the host being validated frequently has NO certificate yet — that is the entire reason
 * the order exists — so the redirect necessarily lands on a name nothing can present a valid
 * certificate for.
 */
export class ChallengeReachabilityProbe {
  private static readonly TIMEOUT_MS = 5000;
  private static readonly MAX_REDIRECTS = 5;
  private static readonly PATH = '/.well-known/acme-challenge/';

  constructor(private readonly challenges: AcmeChallengeStore) {}

  /**
   * Whether `http://<host>/.well-known/acme-challenge/<token>` ends up returning what we published.
   *
   * Returns a reason on failure, '' on success. The reason is stored verbatim, because "unreachable"
   * and "answered 404" send an operator to completely different places.
   */
  async check(host: string): Promise<string> {
    const token = `probe-${randomBytes(16).toString('hex')}`;
    const expected = `${token}.probe`;

    await this.challenges.put(token, host, expected);
    try {
      const body = await ChallengeReachabilityProbe.get(`http://${host}${ChallengeReachabilityProbe.PATH}${token}`);
      if (body.trim() === expected) return '';
      return `the challenge path answered something else — another service is serving ${ChallengeReachabilityProbe.PATH}`;
    } catch (error: any) {
      return `the challenge path could not be reached: ${error?.message || error}`;
    } finally {
      await this.challenges.remove(token);
    }
  }

  /**
   * Fetch a URL, following redirects the way a validator does.
   *
   * Written on `http`/`https` rather than `fetch` for one reason: it must be able to follow a
   * redirect onto a host with no valid certificate, which is the normal case here and which `fetch`
   * refuses.
   */
  private static get(url: string, hop = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      if (hop > ChallengeReachabilityProbe.MAX_REDIRECTS) {
        reject(new Error('too many redirects'));
        return;
      }

      const target = new URL(url);
      const client = target.protocol === 'https:' ? https : http;
      const request = client.get(
        url,
        // The authority does not check the certificate here, and the host being validated usually
        // cannot present a valid one yet. Verifying would fail every first issuance.
        { timeout: ChallengeReachabilityProbe.TIMEOUT_MS, rejectUnauthorized: false } as any,
        (response) => {
          const status = Number(response.statusCode || 0);
          const location = String(response.headers.location || '');
          if (status >= 300 && status < 400 && location) {
            response.resume();
            resolve(ChallengeReachabilityProbe.get(new URL(location, url).toString(), hop + 1));
            return;
          }
          if (status !== 200) {
            response.resume();
            reject(new Error(`answered ${status}`));
            return;
          }

          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => resolve(body));
        },
      );

      request.on('timeout', () => { request.destroy(new Error('timed out')); });
      request.on('error', (error) => reject(error));
    });
  }
}
