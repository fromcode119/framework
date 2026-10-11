import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import vm from 'vm';
import { EdgeProtection } from '@fromcode119/core';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';

/** A gateway that answers "through" for anything the check lets pass. */
class ChallengeFixture {
  static start(challenge: GatewayChallenge, protection: EdgeProtection, tenantId: string | null): Promise<http.Server> {
    const server = http.createServer((req, res) => {
      if (challenge.handle(req, res, protection, tenantId)) return;
      res.end('through');
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
  }

  static get(server: http.Server, url: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
    const port = (server.address() as { port: number }).port;
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: url, method, headers: { host: 'shop.test', 'user-agent': 'test-browser', ...headers } }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  /** What the page's script does: find the answer. */
  static solve(token: string): number {
    for (let n = 0; ; n += 1) if (GatewayChallenge.solves(token, String(n))) return n;
  }
}

describe('GatewayChallenge — under attack mode', () => {
  const challenge = new GatewayChallenge();
  const protection = new EdgeProtection(['site-1'], 30, ['/api/', '/.well-known/'], 'Checking your browser', 'One moment <please>');
  let server: http.Server;

  beforeAll(async () => { server = await ChallengeFixture.start(challenge, protection, 'site-1'); });
  afterAll(() => server.close());

  const tokenOf = (body: string): string => JSON.parse(/var token = ("[^"]+")/.exec(body)![1]);

  it('answers a visitor with the check page, showing the operator\'s words escaped', async () => {
    const res = await ChallengeFixture.get(server, '/products?page=2');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toContain('Checking your browser');
    expect(res.body).toContain('One moment &#60;please&#62;');
    expect(res.body).not.toContain('<please>');
  });

  it('lets the visitor in after a correct answer, back to the page they asked for', async () => {
    const page = await ChallengeFixture.get(server, '/products?page=2');
    const token = tokenOf(page.body);
    const answer = ChallengeFixture.solve(token);
    const verify = await ChallengeFixture.get(server, `${GatewayChallenge.VERIFY_PATH}?t=${encodeURIComponent(token)}&n=${answer}&r=${encodeURIComponent('/products?page=2')}`);
    expect(verify.status).toBe(302);
    expect(verify.headers.location).toBe('/products?page=2');
    const cookie = String(verify.headers['set-cookie']).split(';')[0];
    expect(cookie.startsWith(`${GatewayChallenge.COOKIE}=`)).toBe(true);
    expect(String(verify.headers['set-cookie'])).toContain('Max-Age=1800');

    expect((await ChallengeFixture.get(server, '/products?page=2', { cookie })).body).toBe('through');
    // The pass is this browser's: another one gets the check again.
    expect((await ChallengeFixture.get(server, '/', { cookie, 'user-agent': 'other-browser' })).status).toBe(503);
  });

  it('refuses a wrong answer, a forged token and a return address on another site', async () => {
    const token = tokenOf((await ChallengeFixture.get(server, '/')).body);
    const answer = ChallengeFixture.solve(token);
    expect((await ChallengeFixture.get(server, `${GatewayChallenge.VERIFY_PATH}?t=${encodeURIComponent(token)}&n=${answer + 1}`)).status).toBe(403);
    const forged = `${Buffer.from(`shop.test|${Date.now()}|x`).toString('base64url')}.${crypto.randomBytes(32).toString('base64url')}`;
    expect((await ChallengeFixture.get(server, `${GatewayChallenge.VERIFY_PATH}?t=${encodeURIComponent(forged)}&n=${ChallengeFixture.solve(forged)}`)).status).toBe(403);
    const away = await ChallengeFixture.get(server, `${GatewayChallenge.VERIFY_PATH}?t=${encodeURIComponent(token)}&n=${answer}&r=${encodeURIComponent('//evil.test/')}`);
    expect(away.headers.location).toBe('/');
  });

  it('never checks the exempt paths, and refuses a POST without a pass instead of showing a page', async () => {
    expect((await ChallengeFixture.get(server, '/api/v1/plugins/payments/webhook')).body).toBe('through');
    const post = await ChallengeFixture.get(server, '/checkout', {}, 'POST');
    expect(post.status).toBe(403);
    expect(post.body).toContain('browser_check_required');
  });

  it('leaves a site that is not under attack alone', async () => {
    const other = await ChallengeFixture.start(challenge, protection, 'site-2');
    try {
      expect((await ChallengeFixture.get(other, '/')).body).toBe('through');
    } finally {
      other.close();
    }
  });

  it('the page\'s own hashing matches the gateway\'s, so a browser\'s answer is accepted', () => {
    const template = fs.readFileSync(path.join(__dirname, '..', 'gateway-challenge-page.html'), 'utf8');
    const source = /function sha256\(ascii\) \{[\s\S]*?\n {4}return hash;\n {2}\}/.exec(template)![0];
    const sandbox: { sha256?: (value: string) => number[] } = {};
    vm.runInNewContext(`${source}; this.sha256 = sha256;`, sandbox);
    for (const input of ['', 'abc', 'token.signature:12345', 'x'.repeat(130)]) {
      const words = sandbox.sha256!(input);
      const browser = Buffer.alloc(32);
      words.slice(0, 8).forEach((word, i) => browser.writeInt32BE(word, i * 4));
      expect(browser.toString('hex')).toBe(crypto.createHash('sha256').update(input).digest('hex'));
    }
  });
});
