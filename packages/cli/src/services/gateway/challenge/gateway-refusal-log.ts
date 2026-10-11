import http from 'http';

/**
 * One structured line per visitor the gateway refuses — an attack, a blocked address or country, too
 * many requests — so whatever watches the platform's logs can act on it: block the address further
 * out, alert, count. The gateway names no such tool; it only writes the line.
 *
 *   [edge-refused] {"reason":"sql_injection","address":"203.0.113.7","host":"shop.test","method":"GET","path":"/x","at":"…"}
 *
 * The path is written without its query, which can carry a visitor's own data. A visitor refused
 * again for the same reason within a minute writes nothing more, so a flood cannot flood the log.
 */
export class GatewayRefusalLog {
  static readonly PREFIX = '[edge-refused]';
  private static readonly QUIET_MS = 60_000;
  private static readonly MAX_REMEMBERED = 50_000;

  private readonly lastWritten = new Map<string, number>();

  constructor(
    private readonly write: (line: string) => void = (line) => console.warn(line),
    private readonly now: () => number = Date.now,
  ) {}

  record(req: http.IncomingMessage, reason: string): void {
    const address = String(req.socket.remoteAddress || '');
    const key = `${address}|${reason}`;
    const now = this.now();
    const last = this.lastWritten.get(key);
    if (last !== undefined && now - last < GatewayRefusalLog.QUIET_MS) return;
    this.lastWritten.delete(key);
    this.lastWritten.set(key, now);
    while (this.lastWritten.size > GatewayRefusalLog.MAX_REMEMBERED) {
      const oldest = this.lastWritten.keys().next().value;
      if (oldest === undefined) break;
      this.lastWritten.delete(oldest);
    }
    const path = String(req.url || '/').split('?')[0].slice(0, 300);
    this.write(`${GatewayRefusalLog.PREFIX} ${JSON.stringify({
      reason,
      address,
      host: String(req.headers.host || '').toLowerCase().replace(/:\d+$/, ''),
      method: String(req.method || 'GET'),
      path,
      at: new Date(now).toISOString(),
    })}`);
  }
}
