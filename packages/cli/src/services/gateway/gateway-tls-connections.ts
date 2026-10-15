import { EventEmitter } from 'events';
import type http from 'http';
import type http2 from 'http2';
import type tls from 'tls';

/**
 * The TLS listener's open connections, as `GatewayListener` needs to see them to stop gracefully:
 * the `request` event (so a response written while stopping closes its connection) and
 * `closeIdleConnections()` — the two things an `http.Server` gives it for plain HTTP.
 *
 * HTTP/2 sessions are told to go away (GOAWAY): their in-flight streams finish and the browser sends
 * its next request on a new connection, which the edge gives to the replacement gateway. An HTTP/1.1
 * connection with no request in flight is closed; a busy one closes after its response.
 */
export class GatewayTlsConnections extends EventEmitter {
  private readonly sessions = new Set<http2.ServerHttp2Session>();
  /** HTTP/1.1 connections and how many requests each has in flight. */
  private readonly plain = new Map<tls.TLSSocket, number>();

  addSession(session: http2.ServerHttp2Session): void {
    this.sessions.add(session);
    session.once('close', () => this.sessions.delete(session));
  }

  addPlain(socket: tls.TLSSocket): void {
    this.plain.set(socket, 0);
    socket.once('close', () => this.plain.delete(socket));
  }

  /** Counts a request against its connection until the response is done. */
  track(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.emit('request', req, res);
    const socket = req.socket as tls.TLSSocket;
    if (!this.plain.has(socket)) return;
    this.plain.set(socket, (this.plain.get(socket) ?? 0) + 1);
    res.once('close', () => {
      if (this.plain.has(socket)) this.plain.set(socket, Math.max(0, (this.plain.get(socket) ?? 1) - 1));
    });
  }

  closeIdleConnections(): void {
    for (const session of this.sessions) if (!session.closed) session.close();
    for (const [socket, inFlight] of this.plain) if (inFlight === 0) socket.destroy();
  }
}
