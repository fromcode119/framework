import http from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import { ChallengeReachabilityProbe } from '@core/certificates/acme/challenge-reachability-probe';

/**
 * The pre-flight must behave like the validator it simulates — no stricter.
 *
 * The redirect case is here because the first live run failed on it: the probe refused a `301`,
 * which looked prudent and was a bug. Certificate authorities FOLLOW http→https redirects during
 * HTTP-01, so refusing one blocks issuance on a deployment that would have validated perfectly. A
 * pre-flight stricter than the thing it simulates does not prevent failures, it invents them.
 */
describe('ChallengeReachabilityProbe', () => {
  let server: http.Server | null = null;

  afterEach(() => { server?.close(); server = null; });

  /** A server standing in for the edge, and the store the probe publishes into. */
  const start = (handler: http.RequestListener): Promise<number> => new Promise((resolve) => {
    server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve((server!.address() as { port: number }).port));
  });

  const storeFor = (published: Record<string, string>) => ({
    put: async (token: string, _host: string, value: string) => { published[token] = value; },
    remove: async (token: string) => { delete published[token]; },
  });

  it('passes when the challenge path answers directly', async () => {
    const published: Record<string, string> = {};
    const port = await start((req, res) => {
      const token = String(req.url).split('/').pop() ?? '';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(published[token] ?? 'nothing');
    });

    const probe = new ChallengeReachabilityProbe(storeFor(published) as any);
    expect(await probe.check(`127.0.0.1:${port}`)).toBe('');
  });

  it('PASSES when the edge redirects — the authority follows, so we must too', async () => {
    const published: Record<string, string> = {};
    const port = await start((req, res) => {
      const url = String(req.url);
      if (!url.startsWith('/redirected')) {
        res.writeHead(301, { Location: `/redirected${url}` });
        res.end();
        return;
      }
      const token = url.split('/').pop() ?? '';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(published[token] ?? 'nothing');
    });

    const probe = new ChallengeReachabilityProbe(storeFor(published) as any);
    expect(await probe.check(`127.0.0.1:${port}`)).toBe('');
  });

  it('fails when something else is serving the challenge path', async () => {
    const published: Record<string, string> = {};
    const port = await start((_req, res) => { res.writeHead(200); res.end('some other app'); });

    const probe = new ChallengeReachabilityProbe(storeFor(published) as any);
    expect(await probe.check(`127.0.0.1:${port}`)).toContain('another service is serving');
  });

  it('fails, with the status, when the path is not served', async () => {
    const published: Record<string, string> = {};
    const port = await start((_req, res) => { res.writeHead(404); res.end('nope'); });

    const probe = new ChallengeReachabilityProbe(storeFor(published) as any);
    expect(await probe.check(`127.0.0.1:${port}`)).toContain('answered 404');
  });

  it('fails when nothing is listening at all', async () => {
    const probe = new ChallengeReachabilityProbe(storeFor({}) as any);
    // Port 1 is reserved and never listening.
    expect(await probe.check('127.0.0.1:1')).toContain('could not be reached');
  });

  it('gives up rather than following a redirect loop forever', async () => {
    const published: Record<string, string> = {};
    const port = await start((req, res) => { res.writeHead(302, { Location: String(req.url) }); res.end(); });

    const probe = new ChallengeReachabilityProbe(storeFor(published) as any);
    expect(await probe.check(`127.0.0.1:${port}`)).toContain('too many redirects');
  });

  it('withdraws the probe token whatever happened', async () => {
    const published: Record<string, string> = {};
    const port = await start((_req, res) => { res.writeHead(500); res.end(); });

    await new ChallengeReachabilityProbe(storeFor(published) as any).check(`127.0.0.1:${port}`);
    expect(Object.keys(published)).toHaveLength(0);
  });
});
