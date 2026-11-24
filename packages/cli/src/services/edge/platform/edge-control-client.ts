import net from 'net';
import tls from 'tls';
import { EdgeControlPaths } from '@fromcode119/core';

/**
 * One HTTP/1.1 request over the control channel's TLS, the edge's side. Kept to what the channel needs
 * (JSON in, JSON out, one request per connection) so nothing an HTTP client library does is in the way of
 * the certificate checks, which are all here: `ca` is the platform's root, `servername` the control
 * address the certificate must name, and `identity` this edge's own key and certificate when it has them.
 */
export class EdgeControlClient {
  static readonly TIMEOUT_MS = EdgeControlPaths.RULES_WAIT_MS + 10_000;

  constructor(readonly host: string, readonly port: number, private readonly version: string) {}

  /** `host:port`, `[v6]:port` → the two halves; null when it is neither. */
  static parse(dial: string): { host: string; port: number } | null {
    const match = /^\[?([^\]]+?)\]?:(\d{1,5})$/.exec(String(dial ?? '').trim());
    const port = match ? Number(match[2]) : 0;
    return match && port >= 1 && port <= 65_535 ? { host: match[1].toLowerCase(), port } : null;
  }

  request(method: string, path: string, body: unknown, trust: { ca?: string; key?: string; cert?: string; insecure?: boolean }): Promise<{ status: number; body: any; peer: tls.PeerCertificate | null }> {
    return new Promise((resolve) => {
      const payload = body === undefined ? '' : JSON.stringify(body);
      const options: tls.ConnectionOptions = {
        host: this.host,
        port: this.port,
        servername: net.isIP(this.host) ? undefined : this.host,
        minVersion: 'TLSv1.3',
        ALPNProtocols: [EdgeControlPaths.CONTROL],
        ...(trust.insecure ? { rejectUnauthorized: false } : { ca: trust.ca, rejectUnauthorized: true }),
        ...(trust.key && trust.cert ? { key: trust.key, cert: trust.cert } : {}),
      };
      const socket = tls.connect(options, () => {
        socket.write(`${method} ${path} HTTP/1.1\r\nHost: ${this.host}\r\nUser-Agent: ${this.version}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
      });
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => socket.destroy(new Error('timeout')), EdgeControlClient.TIMEOUT_MS);
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('error', () => undefined);
      socket.on('close', () => {
        clearTimeout(timer);
        const peer = socket.getPeerCertificate?.() ?? null;
        resolve({ ...EdgeControlClient.response(Buffer.concat(chunks).toString('utf8')), peer: peer && Object.keys(peer).length ? peer : null });
      });
    });
  }

  private static response(text: string): { status: number; body: any } {
    const status = /^HTTP\/1\.1 (\d{3})/.exec(text)?.[1];
    if (!status) return { status: 0, body: null };
    const split = text.indexOf('\r\n\r\n');
    const head = text.slice(0, split);
    let raw = split < 0 ? '' : text.slice(split + 4);
    if (/\r\ntransfer-encoding:\s*chunked/i.test(head)) raw = EdgeControlClient.unchunk(raw);
    try { return { status: Number(status), body: raw ? JSON.parse(raw) : null }; } catch { return { status: Number(status), body: null }; }
  }

  private static unchunk(raw: string): string {
    let out = '';
    let rest = raw;
    for (;;) {
      const line = rest.indexOf('\r\n');
      const size = Number.parseInt(rest.slice(0, line), 16);
      if (!(size > 0)) return out;
      out += rest.slice(line + 2, line + 2 + size);
      rest = rest.slice(line + 2 + size + 2);
    }
  }
}
