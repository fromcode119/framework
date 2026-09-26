import type http from 'http';

/**
 * Stops the api the way a rolling deploy needs it stopped: finish what was asked, then go.
 *
 * `docker stop` sends SIGTERM, and the api had no handler, so the process died where it stood — every
 * request in flight was cut, and the gateway's kept-alive connections to it failed on their next use.
 * During a rolling deploy the old container is stopped WHILE the new one is serving, so that cut was
 * the only failure left. On SIGTERM this refuses new connections, closes the idle kept-alive ones, marks
 * responses still being written `Connection: close`, and exits once the last one has finished — or
 * after `GRACE_MS`, which stays under the deploy's own stop timeout.
 */
export class GracefulHttpShutdown {
  static readonly GRACE_MS = 25_000;

  private stopping = false;

  constructor(
    private readonly server: http.Server,
    private readonly logger: { info(message: string): void; warn(message: string): void },
    private readonly exit: (code: number) => void = (code) => process.exit(code),
  ) {}

  install(): void {
    // A response written after the signal must not invite the client to reuse this connection.
    this.server.on('request', (_req: http.IncomingMessage, res: http.ServerResponse) => {
      if (this.stopping && !res.headersSent) res.shouldKeepAlive = false;
    });
    process.once('SIGTERM', () => this.stop('SIGTERM'));
    process.once('SIGINT', () => this.stop('SIGINT'));
  }

  stop(signal: string): void {
    if (this.stopping) return;
    this.stopping = true;
    this.logger.info(`${signal}: refusing new connections and finishing the requests in flight (up to ${GracefulHttpShutdown.GRACE_MS} ms).`);
    this.server.close(() => {
      this.logger.info('Every request finished; exiting.');
      this.exit(0);
    });
    this.server.closeIdleConnections();
    setTimeout(() => {
      this.logger.warn(`Requests still open after ${GracefulHttpShutdown.GRACE_MS} ms; closing them and exiting.`);
      this.server.closeAllConnections();
      this.exit(0);
    }, GracefulHttpShutdown.GRACE_MS).unref();
  }
}
