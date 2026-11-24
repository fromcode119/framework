import net from 'net';
import { EdgeConnectionLog } from '@cli/services/edge/edge-connection-log';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import type { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';
import type { IEdgeOrigin } from '@cli/services/edge/interfaces/edge-origin.interface';

/**
 * A server reached over plain TCP: every address its name resolves to, the healthy ones first
 * (`EdgeUpstreams`). What lets a server behind it be REPLACED with no gap: during a deploy two run side by
 * side, each new connection goes to one that answers, and a connection a stopping one refuses is tried on
 * another before the visitor would notice.
 */
export class EdgeTcpOrigin implements IEdgeOrigin {
  private static readonly ATTEMPTS = 3;
  private static readonly CONNECT_TIMEOUT_MS = 2_000;

  constructor(
    readonly config: EdgeOriginConfig,
    readonly upstreams: EdgeUpstreams = new EdgeUpstreams(config.address, config.ports.http ?? config.ports.tls, 1_000, undefined, undefined, config.health),
    private readonly log: EdgeConnectionLog = new EdgeConnectionLog(),
  ) {}

  async start(): Promise<void> {
    this.upstreams.start();
    await this.upstreams.check();
  }

  stop(): void {
    this.upstreams.stop();
  }

  get ready(): boolean {
    return this.upstreams.healthyCount > 0;
  }

  async connect(protocol: string, header: Buffer | null, publicPort: number, startedAt: number): Promise<net.Socket | null> {
    const port = this.config.ports[protocol];
    const progress = { tried: new Set<string>(), refused: new Set<string>(), attempts: 0 };
    for (let attempt = 0; attempt < EdgeTcpOrigin.ATTEMPTS; attempt += 1) {
      // A server not yet tried first. With every one tried, the attempts left go to them again: across a
      // lossy link a second connection often gets through where the first was lost, and with a single
      // server (the relay in front of the platform) there is no other to try — on 2026-11-04 one
      // attempt per visitor at 60% loss failed a third of them.
      let address = this.upstreams.candidates(progress.tried)[0] ?? this.upstreams.candidates(new Set())[0];
      if (!address) {
        // None known (one starting, or all being replaced): look again before giving up.
        await this.upstreams.check();
        address = this.upstreams.candidates(new Set())[0];
        if (!address) break;
      }
      progress.tried.add(address);
      progress.attempts += 1;
      const socket = await EdgeTcpOrigin.open(address, port);
      if (socket) {
        if (header) socket.write(header);
        if (progress.refused.size) this.log.retried(publicPort, startedAt, address, progress.refused, progress.attempts);
        this.upstreams.count(address, 1);
        socket.once('close', () => this.upstreams.count(address!, -1));
        return socket;
      }
      this.upstreams.refused(address);
      progress.refused.add(address);
    }
    this.log.dropped(publicPort, startedAt, progress.tried, progress.attempts);
    return null;
  }

  private static open(address: string, port: number): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: address, port });
      const timer = setTimeout(() => { socket.destroy(); resolve(null); }, EdgeTcpOrigin.CONNECT_TIMEOUT_MS);
      socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
      socket.once('error', () => { clearTimeout(timer); resolve(null); });
    });
  }
}
