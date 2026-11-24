import net from 'net';
import { NetworkAddressUtils } from '@fromcode119/core';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';
import { EdgeHello } from '@cli/services/edge/edge-hello';

/**
 * What an edge needs to know before it picks a server: who the visitor really is, and which host they
 * asked for. Read from the connection's first bytes, which are then sent on unchanged.
 *
 * A PROXY header is believed ONLY from an address the listener names in `acceptProxyFrom` (a relay in
 * front of this edge). From anyone else it is a visitor claiming to be someone else, and the connection
 * is refused — the trap of a load balancer that passes a visitor's header through.
 */
export class EdgeFirstBytes {
  static readonly LIMIT = 16_384;
  static readonly TIMEOUT_MS = 10_000;

  /**
   * Resolves with the visitor, host and every byte read; `null` when the connection must be refused
   * (a header from someone not allowed, an unreadable header, nothing in time, or too much before a host).
   */
  static read(socket: net.Socket, protocol: string, acceptProxyFrom: readonly string[]): Promise<{ address: string; port: number; host: string; bytes: Buffer; proxied: boolean } | null> {
    return new Promise((resolve) => {
      let bytes = Buffer.alloc(0);
      let visitor = { address: String(socket.remoteAddress ?? ''), port: socket.remotePort ?? 0 };
      let headerDone = false;
      let proxied = false;
      const done = (value: { address: string; port: number; host: string; bytes: Buffer; proxied: boolean } | null): void => {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        socket.removeListener('end', onEnd);
        socket.pause();
        resolve(value);
      };
      const timer = setTimeout(() => done(null), EdgeFirstBytes.TIMEOUT_MS);
      const onEnd = (): void => done(null);
      const onData = (chunk: Buffer): void => {
        bytes = Buffer.concat([bytes, chunk]);
        if (!headerDone) {
          const decided = GatewayProxyProtocol.decide(bytes);
          if (decided === null) return;
          if (decided === 'invalid') return done(null);
          if (decided !== false) {
            if (!NetworkAddressUtils.matchesAny(visitor.address, acceptProxyFrom)) return done(null);
            if (decided.address) visitor = { address: decided.address, port: decided.port ?? 0 };
            bytes = bytes.subarray(decided.length);
            proxied = true;
          } else if (bytes.length < 6 && 'PROXY '.startsWith(bytes.toString('latin1'))) {
            return; // could still be a version 1 header
          } else if (bytes.subarray(0, 6).toString('latin1') === 'PROXY ') {
            return done(null); // version 1, text: never accepted
          }
          headerDone = true;
        }
        const host = protocol === 'tls' ? EdgeHello.tlsHost(bytes) : EdgeHello.httpHost(bytes);
        if (host !== undefined) return done({ ...visitor, host, bytes, proxied });
        if (bytes.length > EdgeFirstBytes.LIMIT) done(null);
      };
      socket.on('data', onData);
      socket.on('end', onEnd);
      socket.resume();
    });
  }
}
