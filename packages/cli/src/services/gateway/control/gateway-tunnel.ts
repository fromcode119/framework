import type net from 'net';
import type tls from 'tls';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';
import type { GatewayListener } from '@cli/services/gateway/gateway-listener';

/**
 * A visitor's connection arriving through an edge's tunnel: inside the edge's mutual TLS, a PROXY v2
 * header naming the visitor, then the visitor's own bytes — a TLS handshake for a site on 443, or plain
 * HTTP on 80.
 *
 * The header is believed because the certificate the tunnel came under is one of the platform's edges,
 * not because of any address. The first byte after it picks the listener — `0x16` opens every TLS
 * handshake — and from there the visitor is served exactly like one who reached the public ports.
 */
export class GatewayTunnel {
  private static readonly TLS_HANDSHAKE = 0x16;
  private static readonly FIRST_BYTE_TIMEOUT_MS = 10_000;

  constructor(private readonly plain: () => GatewayListener | null, private readonly secure: () => GatewayListener | null) {}

  accept(socket: tls.TLSSocket, edge: { id: string; name: string }): void {
    GatewayProxyProtocol.accept(socket, (visitor: net.Socket) => {
      if (!GatewayTunnel.named(visitor)) { socket.destroy(); return; }
      const timer = setTimeout(() => visitor.destroy(), GatewayTunnel.FIRST_BYTE_TIMEOUT_MS);
      visitor.once('data', (chunk: Buffer) => {
        clearTimeout(timer);
        visitor.pause();
        visitor.unshift(chunk);
        const listener = chunk[0] === GatewayTunnel.TLS_HANDSHAKE ? this.secure() : this.plain();
        if (!listener) {
          console.warn(`[platform-gateway] tunnel from edge ${edge.name || edge.id}: no ${chunk[0] === GatewayTunnel.TLS_HANDSHAKE ? 'TLS' : 'HTTP'} listener to serve it`);
          visitor.destroy();
          return;
        }
        listener.adopt(visitor);
      });
      visitor.resume();
    }, { resume: false });
  }

  /**
   * The edge must name the visitor: a tunnel with no header, or a LOCAL one, carries nobody to serve.
   * Reading a header with an address sets it on the socket itself (`GatewayProxyProtocol`).
   */
  private static named(visitor: net.Socket): boolean {
    return Object.prototype.hasOwnProperty.call(visitor, 'remoteAddress');
  }
}
