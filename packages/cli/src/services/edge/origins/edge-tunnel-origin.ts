import tls from 'tls';
import net from 'net';
import { EdgeControlPaths } from '@fromcode119/core';
import type { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';
import type { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';
import type { IEdgeOrigin } from '@cli/services/edge/interfaces/edge-origin.interface';

/**
 * The Fromcode platform this edge joined, through the mutual-TLS tunnel on its control address. Each
 * visitor gets its own TLS 1.3 connection: the platform checks this edge's certificate, this edge checks
 * the platform's, and the PROXY header naming the visitor travels inside — believed because of the
 * certificate it came under, not because of an address.
 */
export class EdgeTunnelOrigin implements IEdgeOrigin {
  private static readonly CONNECT_TIMEOUT_MS = 5_000;
  private static readonly ATTEMPTS = 2;

  constructor(readonly config: EdgeOriginConfig, private readonly identity: EdgeIdentityStore) {}

  async start(): Promise<void> {}
  stop(): void {}

  get ready(): boolean {
    return this.identity.valid;
  }

  async connect(_protocol: string, header: Buffer | null): Promise<net.Socket | null> {
    for (let attempt = 0; attempt < EdgeTunnelOrigin.ATTEMPTS; attempt += 1) {
      const socket = await this.open();
      if (socket) { if (header) socket.write(header); return socket; }
    }
    return null;
  }

  private open(): Promise<tls.TLSSocket | null> {
    const control = this.identity.control;
    const material = this.identity.tls;
    if (!control || !material) return Promise.resolve(null);
    return new Promise((resolve) => {
      const socket = tls.connect({
        host: control.host,
        port: control.port,
        servername: net.isIP(control.host) ? undefined : control.host,
        ...material,
        minVersion: 'TLSv1.3',
        ALPNProtocols: [EdgeControlPaths.TUNNEL],
      });
      const timer = setTimeout(() => { socket.destroy(); resolve(null); }, EdgeTunnelOrigin.CONNECT_TIMEOUT_MS);
      socket.once('secureConnect', () => {
        clearTimeout(timer);
        if (socket.alpnProtocol !== EdgeControlPaths.TUNNEL) { socket.destroy(); resolve(null); return; }
        resolve(socket);
      });
      socket.once('error', () => { clearTimeout(timer); resolve(null); });
    });
  }
}
