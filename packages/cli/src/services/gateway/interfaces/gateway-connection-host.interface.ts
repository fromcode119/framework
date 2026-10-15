import type http from 'http';

/** What serves the connections `GatewayListener` accepts: an HTTP server, or the TLS listener's connections. */
export interface IGatewayConnectionHost {
  on(event: 'request', listener: (req: http.IncomingMessage, res: http.ServerResponse) => void): unknown;
  emit(event: string, ...args: unknown[]): boolean;
  closeIdleConnections(): void;
}
