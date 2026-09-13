import http from 'http';
import https from 'https';
import { Duplex } from 'stream';
import tls, { SecureContext } from 'tls';
import { CertificateBundle } from '@fromcode119/core';
import { CertificateBundleClient } from '@cli/services/certificate-bundle-client';

/**
 * Terminates TLS for the platform, answering each handshake with the certificate stored for the name
 * the client asked for.
 *
 * THERE IS NO DEFAULT CERTIFICATE, deliberately. A name with nothing stored, and a client that sends
 * no name at all, are both refused at the handshake. The alternative — answering with some other
 * host's certificate, or a self-signed one — replaces a clean connection failure with a browser
 * security warning on a name the platform may not even serve, and teaches operators to click
 * through those warnings. A refused handshake is the honest answer to "I have nothing for that".
 *
 * OPT-IN. Without `GATEWAY_TLS_PORT` this never starts and the gateway behaves exactly as it did
 * before, which is what keeps a deployment whose edge already terminates TLS untouched.
 */
export class GatewayTlsListener {
  static readonly ENV_PORT = 'GATEWAY_TLS_PORT';

  server: https.Server | null = null;

  /**
   * One `SecureContext` per host, because building one parses and validates PEM on every handshake
   * otherwise. Cleared whenever the bundle changes rather than expired on a timer — a replaced
   * certificate must take effect on the next handshake, not a minute later.
   */
  private readonly contexts = new Map<string, SecureContext>();
  private cachedFrom: CertificateBundle | null = null;

  constructor(private readonly port: number, private readonly certificates: CertificateBundleClient) {}

  /** The configured port, or null when TLS termination is off. 0 is valid — "any free port", for tests. */
  static readPort(): number | null {
    const raw = String(process.env[GatewayTlsListener.ENV_PORT] || '').trim();
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  get size(): number {
    return this.certificates.current?.size ?? 0;
  }

  start(handlers: {
    request: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    upgrade: (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void;
  }): void {
    const server = https.createServer({
      SNICallback: (servername, callback) => { void this.contextFor(servername, callback); },
    }, handlers.request);

    server.on('tlsClientError', (error: Error) => {
      // Every refused handshake lands here, including ordinary internet scanning. Logged at warn
      // without the peer's input echoed back.
      console.warn(`[platform-gateway] tls handshake refused: ${error.message}`);
    });
    server.on('clientError', (error: Error, socket) => {
      console.warn(`[platform-gateway] tls client error: ${error.message}`);
      socket.destroy();
    });
    server.on('upgrade', handlers.upgrade);

    this.server = server;
    server.listen(this.port, () => {
      console.log(`[platform-gateway] terminating TLS on 0.0.0.0:${this.port} certificates=${this.size}`);
    });
  }

  /**
   * The context for one SNI name.
   *
   * Refusing is the normal path for anything the platform does not serve, so the error says only
   * that there is no certificate — never which hosts do have one.
   */
  private async contextFor(servername: string, callback: (error: Error | null, context?: SecureContext) => void): Promise<void> {
    try {
      const bundle = await this.certificates.resolve();
      if (!bundle) {
        callback(new Error('no certificates configured'));
        return;
      }
      if (bundle !== this.cachedFrom) {
        this.contexts.clear();
        this.cachedFrom = bundle;
      }

      const host = String(servername || '').trim().toLowerCase();
      const cached = this.contexts.get(host);
      if (cached) {
        callback(null, cached);
        return;
      }

      const entry = bundle.find(host);
      if (!entry) {
        callback(new Error('no certificate for the requested name'));
        return;
      }

      const context = tls.createSecureContext({ cert: entry.certificatePem, key: entry.privateKeyPem });
      this.contexts.set(host, context);
      callback(null, context);
    } catch (error: any) {
      // A malformed stored certificate must refuse ONE host's handshakes, never take the listener
      // down and with it every other site on the platform.
      console.warn(`[platform-gateway] could not build a TLS context: ${error?.message || error}`);
      callback(new Error('certificate unavailable'));
    }
  }
}
