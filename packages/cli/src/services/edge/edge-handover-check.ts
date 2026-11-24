import fs from 'fs';

/**
 * Whether this machine lets an edge hand its ports to the next one without losing a connection.
 *
 * Both processes listen with SO_REUSEPORT. When the old one closes, Linux resets the connections still
 * queued on its socket — unless `net.ipv4.tcp_migrate_req` is 1 (Linux 5.14+), which moves them to the
 * socket that stays. Measured on 2026-11-24: 4000 requests from 30 clients across a handover lost 25
 * without it and none with it. The edge does not change the setting itself — it belongs to the machine,
 * and `deploy/edge/relay/protection/90-edge.conf` carries it — it says so instead.
 */
export class EdgeHandoverCheck {
  static readonly SETTING = 'net.ipv4.tcp_migrate_req';
  private static readonly FILE = '/proc/sys/net/ipv4/tcp_migrate_req';

  /** Null when handover is lossless (or the platform is not Linux), otherwise what to do about it. */
  static problem(): string | null {
    if (process.platform !== 'linux') return null;
    let value = '';
    try { value = fs.readFileSync(EdgeHandoverCheck.FILE, 'utf8').trim(); } catch { /* older kernel */ }
    if (value === '1') return null;
    return value
      ? `${EdgeHandoverCheck.SETTING} is ${value}: when this edge hands its ports to the next one, connections still queued on it are reset. Set it to 1 (deploy/edge/relay/protection/90-edge.conf).`
      : `${EdgeHandoverCheck.SETTING} is not available on this kernel (Linux 5.14+): a handover between edge processes resets the connections still queued on the one closing.`;
  }
}
