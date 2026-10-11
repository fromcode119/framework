import crypto from 'crypto';
import http from 'http';
import { EdgeProtection, InternalServiceAuth } from '@fromcode119/core';
import { GatewayChallengePage } from '@cli/services/gateway/challenge/gateway-challenge-page';

/**
 * "Under attack" mode: the gateway answers a visitor with a browser check before passing them on.
 *
 * The page hands the browser a signed puzzle — find a number whose SHA-256 with the puzzle starts
 * with `BITS` zero bits — which a browser solves in a moment and a script that does not run
 * JavaScript never does. The answer comes back on `VERIFY_PATH`; a right one earns a signed cookie
 * that lets this visitor's browser in for the configured time. Nothing is stored: every token and
 * cookie carries its own expiry and a signature only the gateways (which share the internal secret)
 * can make, so a deploy that replaces the gateway keeps every visitor's pass.
 */
export class GatewayChallenge {
  static readonly VERIFY_PATH = '/.well-known/atlantis-check';
  static readonly COOKIE = 'fc_clearance';
  /**
   * Zero bits the answer must start with: about 33,000 tries on average — measured at ~0.3 s on a
   * laptop, so a slow phone still passes in a second or two, while a script without JavaScript never does.
   */
  static readonly BITS = 15;
  private static readonly PUZZLE_TTL_MS = 5 * 60_000;

  private readonly fallbackKey = crypto.randomBytes(32);

  constructor(private readonly page: GatewayChallengePage = new GatewayChallengePage()) {}

  /**
   * True when this answered the request itself: the check page, a verification, or a refusal of a
   * non-GET request without a pass. False lets the request through.
   */
  handle(req: http.IncomingMessage, res: http.ServerResponse, protection: EdgeProtection, tenantId: string | null): boolean {
    const url = new URL(req.url || '/', 'http://gateway.local');
    if (url.pathname === GatewayChallenge.VERIFY_PATH) {
      this.verify(req, res, url, protection);
      return true;
    }
    if (this.lets(req, protection, tenantId, url.pathname)) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      GatewayChallenge.send(res, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'browser_check_required' }));
      return true;
    }
    this.challenge(req, res, protection, `${url.pathname}${url.search}`);
    return true;
  }

  /** Whether a WebSocket upgrade may pass: the same rule, but an upgrade cannot show a page. */
  allowsUpgrade(req: http.IncomingMessage, protection: EdgeProtection, tenantId: string | null): boolean {
    return this.lets(req, protection, tenantId, new URL(req.url || '/', 'http://gateway.local').pathname);
  }

  private lets(req: http.IncomingMessage, protection: EdgeProtection, tenantId: string | null, pathname: string): boolean {
    return !protection.isUnderAttack(tenantId) || protection.isExempt(pathname) || this.hasPass(req);
  }

  private challenge(req: http.IncomingMessage, res: http.ServerResponse, protection: EdgeProtection, back: string): void {
    const host = GatewayChallenge.hostOf(req);
    const body = Buffer.from(`${host}|${Date.now()}|${crypto.randomBytes(9).toString('base64url')}`).toString('base64url');
    const nonce = crypto.randomBytes(12).toString('base64');
    const html = this.page.render({
      title: protection.title, message: protection.message, host,
      token: `${body}.${this.sign(`puzzle|${body}`)}`, bits: GatewayChallenge.BITS, back, verify: GatewayChallenge.VERIFY_PATH, nonce,
    });
    res.writeHead(503, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '5',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
    res.end(req.method === 'HEAD' ? undefined : html);
  }

  private verify(req: http.IncomingMessage, res: http.ServerResponse, url: URL, protection: EdgeProtection): void {
    const token = url.searchParams.get('t') || '';
    const answer = url.searchParams.get('n') || '';
    const [body, signature] = token.split('.');
    const [host, issuedAt] = Buffer.from(body || '', 'base64url').toString('utf8').split('|');
    const fresh = Date.now() - Number(issuedAt) < GatewayChallenge.PUZZLE_TTL_MS;
    const valid = Boolean(body && signature) && GatewayChallenge.same(signature, this.sign(`puzzle|${body}`))
      && host === GatewayChallenge.hostOf(req) && fresh && /^\d{1,12}$/.test(answer) && GatewayChallenge.solves(token, answer);
    if (!valid) {
      GatewayChallenge.send(res, 403, 'text/plain; charset=utf-8', 'The browser check did not pass. Reload the page to try again.');
      return;
    }
    const minutes = protection.clearanceMinutes > 0 ? protection.clearanceMinutes : 60;
    const expires = Date.now() + minutes * 60_000;
    const secure = (req.socket as { encrypted?: boolean }).encrypted ? '; Secure' : '';
    res.writeHead(302, {
      Location: GatewayChallenge.safeReturn(url.searchParams.get('r')),
      'Cache-Control': 'no-store',
      'Set-Cookie': `${GatewayChallenge.COOKIE}=${expires}.${this.sign(this.passPayload(req, expires))}; Max-Age=${minutes * 60}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    });
    res.end();
  }

  private hasPass(req: http.IncomingMessage): boolean {
    const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${GatewayChallenge.COOKIE}=`));
    if (!cookie) return false;
    const [expires, signature] = cookie.slice(GatewayChallenge.COOKIE.length + 1).split('.');
    const until = Number(expires);
    return Number.isFinite(until) && until > Date.now() && Boolean(signature) && GatewayChallenge.same(signature, this.sign(this.passPayload(req, until)));
  }

  /** A pass belongs to one host and one browser, so a copied cookie does not work elsewhere. */
  private passPayload(req: http.IncomingMessage, expires: number): string {
    const browser = crypto.createHash('sha256').update(String(req.headers['user-agent'] || '')).digest('base64url');
    return `pass|${GatewayChallenge.hostOf(req)}|${expires}|${browser}`;
  }

  private sign(payload: string): string {
    return crypto.createHmac('sha256', this.key()).update(payload).digest('base64url');
  }

  /** The internal secret every gateway shares; a process-local one only when none is configured. */
  private key(): Buffer {
    const secret = InternalServiceAuth.secret();
    return secret ? crypto.createHash('sha256').update(`edge-challenge|${secret}`).digest() : this.fallbackKey;
  }

  static solves(token: string, answer: string): boolean {
    const digest = crypto.createHash('sha256').update(`${token}:${answer}`).digest();
    return digest.readUInt32BE(0) >>> (32 - GatewayChallenge.BITS) === 0;
  }

  private static same(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  /**
   * Only a path on this same host — never another site. Parsed as a URL, because a browser drops tabs
   * and newlines and reads a backslash as a slash: `/<tab>/evil.test` is `//evil.test` to it.
   */
  static safeReturn(value: string | null): string {
    const back = String(value || '/');
    if (!back.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(back)) return '/';
    const base = new URL('http://gateway.local');
    let parsed: URL;
    try { parsed = new URL(back, base); } catch { return '/'; }
    return parsed.origin === base.origin ? `${parsed.pathname}${parsed.search}` : '/';
  }

  private static hostOf(req: http.IncomingMessage): string {
    return String(req.headers.host || '').trim().toLowerCase().replace(/:\d+$/, '');
  }

  private static send(res: http.ServerResponse, status: number, type: string, body: string): void {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  }
}
